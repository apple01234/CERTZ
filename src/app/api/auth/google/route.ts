/**
 * v1.0.2-beta — POST /api/auth/google (구글 로그인 실연동 — Firebase Auth 계승)
 *  ① 클라에서 받은 Firebase ID 토큰을 fbverify로 검증 (서명·iss/aud/exp/sub)
 *  ② 검증 성공 → sub 기반 계정 자동 생성/조회(provider:"google") — 첫 로그인이면 가입
 *  ③ 기존 자체 계정(local)과 동일한 세션 토큰 발급 — 클라우드 세이브·거래소·랭킹 전부 호환
 *  보안: Google 계정은 비밀번호가 없어(salt/hash 빈 값) 로그인 라우트의 비밀번호 경로로
 *        침입할 수 없고(provider==="local" 게이트), 자체 아이디와 충돌하지 않는다(g_ 접두).
 */
import { NextRequest } from "next/server";
import { mutateDb, type Resp } from "@/lib/ghdb";
import { verifyFirebaseIdTokenDetailed } from "@/lib/fbverify";
import { issueToken, json, options, publicUser, rateLimit, audit } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

/** 표시 이름 정리 — 제어문자 제거·8자 제한(자체 가입 name 규칙과 동일) */
function cleanName(raw: string, fallback: string): string {
  const n = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029]/g, "").trim().slice(0, 8);
  return n || fallback;
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, "google", 15, 5 * 60 * 1000)) {
      return json(req, 429, { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." });
    }
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const idToken = String(b.idToken || "");
    if (!idToken) return json(req, 400, { error: "로그인 토큰이 없어요" });

    /* v1.4.30 (#10) — 검증 실패 원인을 클라에 노출 + Vercel 로그에 reason 기록:
     *  "검증에 실패했어요"만 반복되던 블랙박스를 해소 — 원인별 메시지로 재시도 유도 */
    const { ident: fb, reason } = await verifyFirebaseIdTokenDetailed(idToken);
    if (!fb) {
      audit("google_verify_fail", { ip: "serverless", reason });
      return json(req, 401, { error: `구글 로그인 검증에 실패했어요${reason ? ` (${reason})` : ""} — 다시 시도해 주세요` });
    }

    const uid = `g_${fb.sub}`; // Firebase sub는 전역 유일 — 자체 아이디와 충돌 불가
    const fallbackName = `용사${fb.sub.slice(-4)}`;
    const displayName = cleanName(fb.name || fb.email?.split("@")[0] || "", fallbackName);
    const email = fb.email || "";

    let success: Resp | null = null;
    const r = await mutateDb((db) => {
      let user = db.users[uid];
      if (!user) {
        /* 첫 구글 로그인 — 자동 가입 (name은 Google 표시명에서 8자 추출) */
        user = { id: uid, name: displayName, provider: "google", salt: "", hash: "", createdAt: Date.now(), role: "user" };
        db.users[uid] = user;
        audit("register", { ip: "serverless", uid, role: "user", provider: "google" });
      } else if (user.provider !== "google") {
        /* 아이디가 겹치는 일은 없지만(provider 접두) 방어적 차단 */
        return { status: 409, body: { error: "이 아이디는 다른 로그인 방식으로 사용 중이에요" } };
      }
      const { token, cookie } = issueToken(db, user);
      success = { status: 200, body: { user: publicUser(user), token }, headers: { "Set-Cookie": cookie } };
      audit("login", { ip: "serverless", uid, provider: "google" });
      return null; // 세션 토큰 발급 쓰기
    });
    const out = success && r.status === 200 ? success : r;
    return json(req, out.status, out.body, out.headers);
  } catch (e) {
    console.error("[SERTZ-api] google 로그인 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
