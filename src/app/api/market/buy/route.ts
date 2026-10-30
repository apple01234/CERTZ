/**
 * v1.4.22 — POST /api/market/buy (serverless 이행 — 계승: accounts/index.js)
 *  구매: 본인 물건 금지 · 판매자 정산 90%(수수료 10%) · 정합성은 sha 잠금 재시도로 보장
 *  (동시 구매 시 뒤 요청이 충돌→재조회 후 "이미 판매된 등록" 응답).
 *
 * vc205 (감사 #3) — **구매자 골드를 서버가 차감한다.**
 *  종전엔 판매자 정산(payouts)만 늘리고 구매자 골드는 건드리지 않았다. 골드 차감이
 *  클라 책임이었으므로, 클라를 조작하거나 예전 세이브를 되올리면 **공짜로 구매**가 성립했다.
 *  이제 mutateDb 안에서 구매자 세이브 gold 를 확인·차감하고, 부족하면 402 로 거절한다.
 *  (권위 있는 골드 = db.saves[uid].data.gold. 클라가 올린 값은 cloud-save 가 무시한다 — 감사 #1)
 *
 * vc205 (감사 #4) — 클로저 부수효과 제거. 응답을 반환값으로 돌려준다.
 */
import { NextRequest } from "next/server";
import { loadDb, mutateDb } from "@/lib/ghdb";
import { MARKET_FEE_PCT, creditOwned, currentUser, json, marketSnapshot, options, rateLimit, audit } from "@/lib/sapi";

export function OPTIONS(req: NextRequest) { return options(req); }

/** 세이브에서 골드를 읽는다 (손상/부재 시 null) */
function readGold(fdb: { saves: Record<string, { data?: Record<string, unknown> }> }, uid: string): number | null {
  const d = fdb.saves[uid]?.data;
  if (!d) return null;
  const g = d.gold;
  return typeof g === "number" && Number.isFinite(g) ? g : null;
}

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

    const r = await mutateDb((fdb) => {
      const me = fdb.users[user.id];
      if (!me) return { status: 401, body: { error: "거래판은 로그인이 필요해요" } };
      const l = fdb.market.listings[id];
      if (!l) return { status: 404, body: { error: "이미 판매된 등록이에요 — 새로고침해 주세요" } };
      if (l.seller === me.id) return { status: 403, body: { error: "내 등록은 구매할 수 없어요" } };
      /* vc153 (#신규8) — 다수 등록분 부분 구매: 1클릭 = 1개. qty가 남으면 등록 유지, 0이면 소멸 */
      const units = Math.max(1, Math.min(99, parseInt(String(b.qty), 10) || 1));
      const avail = l.qty ?? 1;
      if (avail < units) return { status: 409, body: { error: `남은 수량이 부족해요 (잔여 ${avail}개)` } };

      /* vc205 (감사 #3) — 구매자 골드 확인·차감 (서버 권위) */
      const cost = l.price * units;
      const gold = readGold(fdb, me.id);
      if (gold === null) return { status: 409, body: { error: "클라우드 세이브를 먼저 동기화해 주세요" } };
      if (gold < cost) return { status: 402, body: { error: `골드가 부족해요 (필요 ${cost}G · 보유 ${gold}G)` } };
      const meSave = fdb.saves[me.id];
      if (meSave?.data) {
        meSave.data.gold = gold - cost;
        meSave.updatedAt = Date.now();
      }

      const item = { itemKey: l.itemKey, up: l.up ?? 0, price: l.price, qty: units, sellerName: l.sellerName };
      const left = avail - units;
      if (left <= 0) delete fdb.market.listings[id];
      else l.qty = left;
      fdb.payouts[l.seller] ||= { gold: 0, count: 0 };
      fdb.payouts[l.seller].gold += Math.floor((l.price * units * (100 - MARKET_FEE_PCT)) / 100);
      fdb.payouts[l.seller].count += units;
      /* v1.4.41 (감사 #1) — 구매자 세이브에 구매분을 지급. */
      creditOwned(fdb, me.id, item.itemKey, units, item.up);
      audit("market_buy", { ip: "serverless", uid: me.id, listingId: l.id, itemKey: l.itemKey, price: l.price, units, seller: l.seller, cost });
      return { resp: { status: 200, body: { ok: true, item, gold: gold - cost, ...marketSnapshot(fdb, me.id) } } };
    });
    return json(req, r.status, r.body);
  } catch (e) {
    console.error("[SERTZ-api] market/buy 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
