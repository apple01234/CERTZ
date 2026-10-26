/**
 * v1.4.22 — GET /api/admin/summary (serverless 이행 — 계승: v1.0.2)
 *  관리자 요약 — 서버 롤 검증(일반 유저/미인증 403). 감사 로그는 Vercel 로그로 수집되므로
 *  recentAudit은 파일 수집이 불가한 serverless 특성상 빈 배열(카운트는 실시간 집계).
 */
import { NextRequest } from "next/server";
import { loadDb } from "@/lib/ghdb";
import { audit, currentUser, isAdminUser, json, options } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

export async function GET(req: NextRequest) {
  try {
    const { db } = await loadDb(false);
    const me = currentUser(db, req);
    if (!isAdminUser(me)) {
      audit("admin_denied", { ip: "serverless", uid: me?.id ?? null });
      return json(req, 403, { error: "관리자 권한이 필요해요" });
    }
    audit("admin_summary", { ip: "serverless", uid: me!.id });
    return json(req, 200, {
      users: Object.keys(db.users).length,
      listings: Object.keys(db.market.listings).length,
      payoutGold: Object.values(db.payouts).reduce((a, b) => a + (b.gold || 0), 0),
      recentAudit: [],
    });
  } catch (e) {
    console.error("[SERTZ-api] admin/summary 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
