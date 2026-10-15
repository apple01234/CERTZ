/**
 * v1.4.22 — GET /api/auth/me (serverless 이행 — 계승)
 *  읽기 전용(8초 캐시 허용) — Bearer/쿠키/쿼리 토큰으로 현재 유저 조회.
 */
import { NextRequest } from "next/server";
import { loadDb } from "@/lib/ghdb";
import { currentUser, json, options, publicUser } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

export async function GET(req: NextRequest) {
  try {
    /* v1.4.22 — 항상 fresh 조회: 로그아웃/계정삭제 직후 다른 인스턴스의 8초 캐시로
     *  무효화된 세션이 살아있어 보이는 착시 제거 (세션 검증은 정합성 우선). */
    const { db } = await loadDb(true);
    return json(req, 200, { user: publicUser(currentUser(db, req)) });
  } catch (e) {
    console.error("[SERTZ-api] me 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
