import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { verifyWithGoogle } from "../../src/lib/playPurchase.ts";
import { newCampaign } from "../../src/game/campaign/progress.ts";
import {
  applyCampaignAction,
  emptyCampaignStore,
} from "../../src/lib/campaignStore.ts";
test("purchase verification fails closed without credentials; cancellation and pending payment never grant", async () => {
  const before = process.env.GOOGLE_PLAY_SA_JSON,
    fetchBefore = globalThis.fetch;
  try {
    delete process.env.GOOGLE_PLAY_SA_JSON;
    assert.equal(
      (await verifyWithGoogle("oath_slots_4", "fake-token")).status,
      503,
    );
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.GOOGLE_PLAY_SA_JSON = JSON.stringify({
      client_email: "test@example.invalid",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
    });
    for (const purchaseState of [1, 2, 0]) {
      globalThis.fetch = async (url) =>
        new Response(
          JSON.stringify(
            String(url).includes("oauth2")
              ? { access_token: "mock-only" }
              : { purchaseState, obfuscatedExternalAccountId: "account-hash" },
          ),
          { status: 200 },
        );
      const result = await verifyWithGoogle("oath_slots_4", "fake-token");
      assert.equal(result.ok, purchaseState === 0);
      if (result.ok) assert.equal(result.accountId, "account-hash");
    }
  } finally {
    globalThis.fetch = fetchBefore;
    if (before === undefined) delete process.env.GOOGLE_PLAY_SA_JSON;
    else process.env.GOOGLE_PLAY_SA_JSON = before;
  }
});
test("paid skins cannot be imported or minted through the free cosmetic endpoint", () => {
  const store = emptyCampaignStore(),
    p = newCampaign("증인", "warrior", "test0098");
  p.cosmetics = ["cloak-starlight"];
  p.equipped = "cloak-starlight";
  const saved = applyCampaignAction(store, "a", {
    action: "save",
    save: p,
    revision: 0,
  });
  assert.deepEqual(saved.account.characters[p.characterId].cosmetics, []);
  assert.equal(
    applyCampaignAction(store, "a", {
      action: "cosmetic",
      item: "cloak-starlight",
      characterId: p.characterId,
      revision: 1,
    }).status,
    400,
  );
});
