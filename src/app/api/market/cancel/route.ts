/**
 * v1.4.22 — POST /api/market/cancel (serverless 이행 — 계승: accounts/index.js)
 *  취소 — 본인 등록만. 아이템은 클라가 세이브에 복구한다(서버는 ledger만 관리하는 계승 계약).
 */
import { NextRequest } from "next/server";
import { loadDb, mutateDb } from "@/lib/ghdb";
import { currentUser, json, marketSnapshot, options, rateLimit, creditOwned } from "@/lib/sapi";

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
    const r = await mutateDb((fdb) => {
      const me = fdb.users[user.id];
      if (!me) return { status: 401, body: { error: "거래판은 로그인이 필요해요" } };
      const l = fdb.market.listings[id];
      if (!l) return { status: 404, body: { error: "이미 판매된 등록이에요" } };
      if (l.seller !== me.id) return { status: 403, body: { error: "본인 등록만 취소할 수 있어요" } };
      const item = { itemKey: l.itemKey, up: l.up ?? 0, qty: l.qty ?? 1 };
      delete fdb.market.listings[id];
      /* v1.4.41 (감사 #1) — 취소분을 세이브 owned 로 반환(에스크로 해제) */
      creditOwned(fdb, me.id, item.itemKey, item.qty, item.up);
      return { resp: { status: 200, body: { ok: true, item, ...marketSnapshot(fdb, me.id) } } };
    });
    return json(req, r.status, r.body);
  } catch (e) {
    console.error("[SERTZ-api] market/cancel 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
