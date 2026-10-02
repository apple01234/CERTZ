/**
 * v1.4.22 — POST /api/auth/logout (serverless 이행 — 계승)
 *  Bearer/쿠키/쿼리 토큰 해제 + 쿠키 만료. 토큰이 있으면 DB에서 삭제(쓰기), 없으면 즉시 응답.
 */
import { NextRequest } from "next/server";
import { mutateDb } from "@/lib/ghdb";
import { clearCookie, extractToken, json, options } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

export async function POST(req: NextRequest) {
  try {
    const token = extractToken(req);
    if (!token) return json(req, 200, { ok: true }, { "Set-Cookie": clearCookie() });
    const r = await mutateDb((db) => {
      delete db.tokens[token];
      return null;
    });
    if (r.status !== 200) return json(req, r.status, r.body);
    return json(req, 200, { ok: true }, { "Set-Cookie": clearCookie() });
  } catch (e) {
    console.error("[SERTZ-api] logout 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
