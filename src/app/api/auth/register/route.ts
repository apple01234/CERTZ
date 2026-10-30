/**
 * v1.4.22 — POST /api/auth/register (serverless 이행 — 계승: accounts/index.js)
 *  GitHub DB 원자적 쓰기(sha 잠금) · scrypt 솔트 해시 · 관리자 롤(env) · 세션 토큰 본문 동봉.
 */
import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { mutateDb } from "@/lib/ghdb";
import { hashPw, issueToken, json, options, publicUser, rateLimit, audit } from "@/lib/sapi";
import type { Resp } from "@/lib/ghdb";

export function OPTIONS(req: NextRequest) { return options(req); }

const ADMIN_USERS = (process.env.SERTZ_ADMIN_USERS || "admin,apple01234").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, "register", 10, 5 * 60 * 1000)) {
      return json(req, 429, { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." });
    }
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(b.id || "").trim().toLowerCase();
    const pw = String(b.pw || "");
    const name = String(b.name || "").replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029]/g, "").trim().slice(0, 8) || id.slice(0, 8);
    if (!/^[a-z0-9_]{3,20}$/.test(id)) return json(req, 400, { error: "아이디는 영문 소문자/숫자/_ 3~20자" });
    if (pw.length < 6) return json(req, 400, { error: "비밀번호는 6자 이상" });
    /* v1.0.15 보안 — 관리자 예약 이름 차단. 관리자 판정은 이제 아이디 기준이지만,
     *  닉네임으로 운영자를 사칭(채팅·이름표)하는 것을 막기 위해 예약어를 거부한다. */
    if (ADMIN_USERS.includes(name.toLowerCase())) return json(req, 400, { error: "사용할 수 없는 이름이에요" });
    const r = await mutateDb((db) => {
      if (db.users[id]) return { status: 409, body: { error: "이미 존재하는 아이디예요" } };
      /* v1.0.16 보안 — 관리자 예약 ID 선점 차단. 종전엔 db.users에 그 id가 없으면
       *  ADMIN_USERS 목록의 아이디로 가입하는 것만으로 role=admin을 받았다
       *  (계정이 삭제·개명된 빈틈에서 권한 상승). 관리자가 이미 하나라도 있으면
       *  예약 ID 가입을 거부하고, 관리자가 전무한 최초 부트스트랩에서만 허용한다. */
      const reserved = ADMIN_USERS.includes(id);
      if (reserved && Object.values(db.users).some((u) => u.role === "admin")) {
        return { status: 403, body: { error: "사용할 수 없는 아이디예요" } };
      }
      const salt = randomBytes(16).toString("hex");
      const role = reserved ? "admin" : "user";
      const user = { id, name, provider: "local", salt, hash: hashPw(pw, salt), createdAt: Date.now(), role };
      db.users[id] = user;
      const { token, cookie } = issueToken(db, user);
      return { resp: { status: 200, body: { user: publicUser(user), token }, headers: { "Set-Cookie": cookie } } };
      audit("register", { ip: "serverless", uid: id, role });
      return { resp: { status: 200, body: { ok: true } } };
    });
    const out = r;
    return json(req, out.status, out.body, out.headers);
  } catch (e) {
    console.error("[SERTZ-api] register 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
