/**
 * v1.4.22 — POST /api/market/collect (serverless 이행 — 계승: accounts/index.js)
 *  정산 수령 — pendingGold 반환 후 0으로 (수수료 10%는 등록 시점에 절단된 구조 계승).
 */
import { NextRequest } from "next/server";
import { loadDb, mutateDb } from "@/lib/ghdb";
import { currentUser, json, marketSnapshot, options, rateLimit, audit } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

export async function POST(req: NextRequest) {
  try {
    const { db } = await loadDb(false);
    const user = currentUser(db, req);
    if (!user) return json(req, 401, { error: "거래판은 로그인이 필요해요" });
    if (!rateLimit(req, "market", 30, 60 * 1000)) {
      return json(req, 429, { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." });
    }
    let success: { status: number; body: unknown } | null = null;
    const r = await mutateDb((fdb) => {
      const me = fdb.users[user.id];
      if (!me) return { status: 401, body: { error: "거래판은 로그인이 필요해요" } };
      const pay = fdb.payouts[me.id];
      const gold = pay?.gold || 0;
      if (gold <= 0) return { status: 400, body: { error: "수령할 정산금이 없어요" } };
      fdb.payouts[me.id] = { gold: 0, count: 0 };
      success = { status: 200, body: { ok: true, gold, ...marketSnapshot(fdb, me.id) } };
      audit("market_collect", { ip: "serverless", uid: me.id, gold });
      return null; // 쓰기
    });
    const out = success && r.status === 200 ? success : r;
    return json(req, out.status, out.body);
  } catch (e) {
    console.error("[SERTZ-api] market/collect 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
