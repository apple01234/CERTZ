/**
 * v1.4.22 — POST /api/market/buy (serverless 이행 — 계승: accounts/index.js)
 *  구매: 본인 물건 금지 · 판매자 정산 90%(수수료 10%) · 정합성은 sha 잠금 재시도로 보장
 *  (동시 구매 시 뒤 요청이 충돌→재조회 후 "이미 판매된 등록" 응답).
 */
import { NextRequest } from "next/server";
import { loadDb, mutateDb } from "@/lib/ghdb";
import { MARKET_FEE_PCT, currentUser, json, marketSnapshot, options, rateLimit, audit } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

export async function POST(req: NextRequest) {
  try {
    const { db } = await loadDb(false);
    const user = currentUser(db, req);
    if (!user) return json(req, 401, { error: "거래판은 로그인이 필요해요" });
    if (!rateLimit(req, "market", 30, 60 * 1000)) {
      return json(req, 429, { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." });
    }
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(b.id || "");

    let success: { status: number; body: unknown } | null = null;
    const r = await mutateDb((fdb) => {
      const me = fdb.users[user.id];
      if (!me) return { status: 401, body: { error: "거래판은 로그인이 필요해요" } };
      const l = fdb.market.listings[id];
      if (!l) return { status: 404, body: { error: "이미 판매된 등록이에요 — 새로고침해 주세요" } };
      if (l.seller === me.id) return { status: 403, body: { error: "내 등록은 구매할 수 없어요" } };
      const item = { itemKey: l.itemKey, up: l.up ?? 0, price: l.price, sellerName: l.sellerName };
      delete fdb.market.listings[id];
      fdb.payouts[l.seller] ||= { gold: 0, count: 0 };
      fdb.payouts[l.seller].gold += Math.floor((l.price * (100 - MARKET_FEE_PCT)) / 100);
      fdb.payouts[l.seller].count += 1;
      success = { status: 200, body: { ok: true, item, ...marketSnapshot(fdb, me.id) } };
      audit("market_buy", { ip: "serverless", uid: me.id, listingId: l.id, itemKey: l.itemKey, price: l.price, seller: l.seller });
      return null; // 쓰기
    });
    const out = success && r.status === 200 ? success : r;
    return json(req, out.status, out.body);
  } catch (e) {
    console.error("[SERTZ-api] market/buy 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
