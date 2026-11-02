import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { CAMPAIGN_ID, PAID_PRODUCTS } from "@/game/campaign/catalog";
import { currentUser, json, options, rateLimit } from "@/lib/sapi";
import { loadDb, mutateDb } from "@/lib/ghdb";
import { verifyWithGoogle } from "@/lib/playPurchase";
import { accountOf, emptyCampaignStore } from "@/lib/campaignStore";
export const runtime = "nodejs";
export const OPTIONS = options;
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, "campaign-purchase", 12, 60000))
      return json(req, 429, { error: "잠시 후 다시 시도하세요." });
    const raw = await req.text();
    if (raw.length > 20000)
      return json(req, 413, { error: "요청이 너무 큽니다." });
    const b = JSON.parse(raw);
    if (
      b.campaignId !== CAMPAIGN_ID ||
      !Object.hasOwn(PAID_PRODUCTS, b.sku) ||
      typeof b.purchaseToken !== "string" ||
      b.purchaseToken.length < 10 ||
      b.purchaseToken.length > 8000
    )
      return json(req, 400, { error: "올바른 구매 요청이 아닙니다." });
    const { db } = await loadDb();
    const user = currentUser(db, req);
    if (!user) return json(req, 401, { error: "로그인이 필요합니다." });
    const verified = await verifyWithGoogle(b.sku, b.purchaseToken);
    if (!verified.ok)
      return json(req, verified.status, {
        error:
          "구매를 확인하지 못했습니다. 결제 설정 또는 구매 상태를 확인하고 복원을 시도하세요.",
      });
    const accountId = createHash("sha256")
      .update(`${CAMPAIGN_ID}:${user.id}`)
      .digest("hex");
    if (verified.accountId !== accountId)
      return json(req, 403, { error: "구매한 계정으로 로그인해 복원하세요." });
    const key = createHash("sha256").update(b.purchaseToken).digest("hex");
    const out = await mutateDb((fdb) => {
      const u = currentUser(fdb, req);
      if (!u || u.id !== user.id)
        return { status: 401, body: { error: "로그인이 만료되었습니다." } };
      fdb.campaigns ??= {};
      const store =
          fdb.campaigns[CAMPAIGN_ID] ??
          (fdb.campaigns[CAMPAIGN_ID] = emptyCampaignStore()),
        account = accountOf(store, u.id);
      store.purchases ??= {};
      const prior = store.purchases[key];
      if (prior)
        return prior.uid === u.id && prior.sku === b.sku
          ? { status: 200, body: { account, duplicate: true } }
          : { status: 409, body: { error: "다른 계정의 구매입니다." } };
      account.entitlements ??= [];
      if (!account.entitlements.includes(b.sku))
        account.entitlements.push(b.sku);
      if (b.sku === "oath_slots_4") account.slots = 12;
      if (b.sku === "oath_cloak_starlight")
        for (const p of Object.values(account.characters))
          if (!p.cosmetics.includes("cloak-starlight"))
            p.cosmetics.push("cloak-starlight");
      account.revision++;
      store.purchases[key] = { uid: u.id, sku: b.sku };
      return { resp: { status: 200, body: { account } } };
    });
    return json(req, out.status, out.body);
  } catch {
    return json(req, 503, {
      error:
        "구매 확인 서버에 연결할 수 없습니다. 구매 복원으로 다시 시도하세요.",
    });
  }
}
