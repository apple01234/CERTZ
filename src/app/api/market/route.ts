/**
 * v1.4.22 — GET /api/market (serverless 이행 — 계승: accounts/index.js)
 *  조회 — 비로그인도 목록 공개(판매자명 노출), 로그인 시 내 등록/정산금 스냅샷.
 */
import { NextRequest } from "next/server";
import { loadDb } from "@/lib/ghdb";
import { currentUser, json, marketSnapshot, options } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

export async function GET(req: NextRequest) {
  try {
    const { db } = await loadDb(false);
    const user = currentUser(db, req);
    return json(req, 200, marketSnapshot(db, user ? user.id : null));
  } catch (e) {
    console.error("[SERTZ-api] market GET 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
