/**
 * v1.4.22 — POST /api/auth/login (serverless 이행 — 계승: accounts/index.js)
 *  계정 열거 방지 통일 메시지 · timingSafeEqual · scrypt(기존 계정 해시 호환) · 토큰 본문 동봉.
 */
import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { loadDb, mutateDb } from "@/lib/ghdb";
import { audit, hashPw, issueToken, json, options, publicUser, rateLimit, type Resp } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

const LOGIN_FAIL_MSG = "아이디 또는 비밀번호가 올바르지 않아요 — 가입한 적이 없다면 회원가입 탭을 이용해 주세요";

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, "login", 15, 5 * 60 * 1000)) {
      return json(req, 429, { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." });
    }
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(b.id || "").trim().toLowerCase();

    /* 1차 — 캐시 읽기로 빠른 검증 (실패 조기 반환은 쓰기 없음)
     *  v1.4.22 — 캐시에 유저가 없으면 강제 재조회 1회: 가입→즉시 로그인 레이스 제거
     *  (인스턴스 간 8초 캐시 어긋남 — 로컬 재현은 dev 핫리로드 혼선, 실서버 방어로 흡수).
     *  비밀번호 불일치엔 재조회하지 않는다(무차별 대입 비용 보호). */
    let { db } = await loadDb(false);
    if (!db.users[id]) ({ db } = await loadDb(true));
    const user = db.users[id];
    if (user && user.provider === "local") {
      const hash = Buffer.from(hashPw(String(b.pw || ""), user.salt), "hex");
      const stored = Buffer.from(user.hash, "hex");
      if (hash.length === stored.length && timingSafeEqual(hash, stored)) {
        let success: Resp | null = null;
        const r = await mutateDb((fdb) => {
          const fu = fdb.users[id];
          if (!fu || fu.provider !== "local") return { status: 401, body: { error: LOGIN_FAIL_MSG } };
          const { token, cookie } = issueToken(fdb, fu);
          success = { status: 200, body: { user: publicUser(fu), token }, headers: { "Set-Cookie": cookie } };
          audit("login", { ip: "serverless", uid: id, role: fu.role === "admin" ? "admin" : "user" });
          return null; // 토큰 발급 쓰기
        });
        const out = success && r.status === 200 ? success : r;
        return json(req, out.status, out.body, out.headers);
      }
    }
    audit("login_fail", { ip: "serverless", uid: id });
    return json(req, 401, { error: LOGIN_FAIL_MSG });
  } catch (e) {
    console.error("[SERTZ-api] login 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
