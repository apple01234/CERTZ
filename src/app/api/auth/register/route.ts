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

    let success: Resp | null = null;
    const r = await mutateDb((db) => {
      if (db.users[id]) return { status: 409, body: { error: "이미 존재하는 아이디예요" } };
      const salt = randomBytes(16).toString("hex");
      const role = ADMIN_USERS.includes(id) ? "admin" : "user";
      const user = { id, name, provider: "local", salt, hash: hashPw(pw, salt), createdAt: Date.now(), role };
      db.users[id] = user;
      const { token, cookie } = issueToken(db, user);
      success = { status: 200, body: { user: publicUser(user), token }, headers: { "Set-Cookie": cookie } };
      audit("register", { ip: "serverless", uid: id, role });
      return null; // 쓰기 진행
    });
    const out = success && r.status === 200 ? success : r;
    return json(req, out.status, out.body, out.headers);
  } catch (e) {
    console.error("[SERTZ-api] register 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
