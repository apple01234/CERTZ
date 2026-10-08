/**
 * v1.4.22 — GET /api/rank (serverless 이행 — 계승: v1.3.0 지시 #7)
 *  클라우드 세이브 파생 랭킹(환생·탑기록·레벨·exp) — 비로그인도 목록 공개, 로그인 시 내 순위 동봉.
 *  (구 fetchRank용 /api/rank/claim은 서버 구현이 없던 레거시 — 계승 생략, 404 동일)
 */
import { NextRequest } from "next/server";
import { loadDb } from "@/lib/ghdb";
import { currentUser, json, options, rankListFor } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

export async function GET(req: NextRequest) {
  try {
    const { db } = await loadDb(false);
    const me = currentUser(db, req);
    return json(req, 200, rankListFor(db, me));
  } catch (e) {
    console.error("[SERTZ-api] rank 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
