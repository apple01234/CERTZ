/**
 * v1.4.22 — POST /api/market/list (serverless 이행 — 계승: accounts/index.js)
 *  등록: 로그인 필수 · 동시 3칸 · 가격 1G~10,000,000G · 보스 드롭 화이트리스트 +
 *  클라우드 세이브 실보유 검증(미보유 등록 → 복제 익스플로잇 차단 계승).
 */
import { NextRequest } from "next/server";
import { loadDb, mutateDb } from "@/lib/ghdb";
import { currentUser, json, marketSnapshot, options, ownsListableItem, rateLimit, audit } from "@/lib/sapi";

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
    const itemKey = String(b.itemKey || "").slice(0, 40);
    const up = Math.max(0, Math.min(15, parseInt(String(b.up), 10) || 0));
    const price = parseInt(String(b.price), 10);
    if (!itemKey) return json(req, 400, { error: "아이템 정보가 올바르지 않아요" });
    if (!Number.isFinite(price) || price < 1 || price > 10000000) return json(req, 400, { error: "가격은 1G ~ 10,000,000G 사이" });

    let success: { status: number; body: unknown } | null = null;
    const r = await mutateDb((fdb) => {
      const me = fdb.users[user.id];
      if (!me) return { status: 401, body: { error: "거래판은 로그인이 필요해요" } };
      const own = ownsListableItem(fdb, me.id, itemKey);
      if (!own.ok) return { status: 403, body: { error: own.error } };
      const mine = Object.values(fdb.market.listings).filter((l) => l.seller === me.id);
      if (mine.length >= 3) return { status: 409, body: { error: "등록 칸이 가득 찼어요 (최대 3칸)" } };
      if (mine.some((l) => l.itemKey === itemKey)) return { status: 409, body: { error: "같은 아이템을 동시에 여러 칸에 등록할 수 없어요" } };
      const id = `m${fdb.market.nextId++}`;
      fdb.market.listings[id] = { id, seller: me.id, sellerName: me.name, itemKey, up, price, ts: Date.now() };
      success = { status: 200, body: { ok: true, id, ...marketSnapshot(fdb, me.id) } };
      audit("market_list", { ip: "serverless", uid: me.id, itemKey, price });
      return null; // 쓰기
    });
    const out = success && r.status === 200 ? success : r;
    return json(req, out.status, out.body);
  } catch (e) {
    console.error("[SERTZ-api] market/list 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
