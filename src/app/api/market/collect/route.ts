/**
 * v1.4.22 — POST /api/market/collect (serverless 이행 — 계승: accounts/index.js)
 *  정산 수령 — pendingGold 반환 후 0으로 (수수료 10%는 등록 시점에 절단된 구조 계승).
 *
 * vc205 (감사 #17) — **지급을 서버가 세이브에 직접 반영한다.**
 *  종전엔 `payouts[uid]` 를 0으로 지우고 응답으로 gold 만 돌려줬다. 클라가 응답을 못 받으면
 *  (네트워크 끊김·앱 종료) 서버는 이미 0, 클라 골드는 그대로 → **판매 대금이 사라졌다.**
 *  이제 mutateDb 안에서 세이브 gold 를 증가시키고, 응답에 반영된 잔액을 함께 준다.
 *  클라는 `gold`(이번 수령액)와 `serverGold`(반영 후 잔액)를 받아 로컬을 맞춘다.
 *
 * vc205 (감사 #4) — 클로저 부수효과 제거(반환값 기반).
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
    const r = await mutateDb((fdb) => {
      const me = fdb.users[user.id];
      if (!me) return { status: 401, body: { error: "거래판은 로그인이 필요해요" } };
      const pay = fdb.payouts[me.id];
      const gold = pay?.gold || 0;
      if (gold <= 0) return { status: 400, body: { error: "수령할 정산금이 없어요" } };
      if (!Number.isFinite(gold) || gold > 1_000_000_000) {
        /* 손상된 정산값 — 지급하지 않고 로그만 남긴다(무한 골드 방지) */
        audit("market_collect_suspect", { uid: me.id, gold });
        return { status: 409, body: { error: "정산금 값이 올바르지 않아요 — 고객센터에 문의해 주세요" } };
      }

      /* vc205 (감사 #17) — 서버가 세이브에 직접 지급 */
      const rec = fdb.saves[me.id];
      if (!rec?.data) return { status: 409, body: { error: "클라우드 세이브를 먼저 동기화해 주세요" } };
      const cur = typeof rec.data.gold === "number" && Number.isFinite(rec.data.gold) ? rec.data.gold : 0;
      const next = cur + gold;
      rec.data.gold = next;
      rec.updatedAt = Date.now();
      fdb.payouts[me.id] = { gold: 0, count: 0 };

      audit("market_collect", { ip: "serverless", uid: me.id, gold, serverGold: next });
      return {
        resp: {
          status: 200,
          body: { ok: true, gold, serverGold: next, ...marketSnapshot(fdb, me.id) },
        },
      };
    });
    return json(req, r.status, r.body);
  } catch (e) {
    console.error("[SERTZ-api] market/collect 실패", e);
    return json(req, 500, { error: "서버 오류" });
  }
}
