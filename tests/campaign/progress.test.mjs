import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAPTERS, CAMPAIGN_ID } from "../../src/game/campaign/catalog.ts";
import {
  newCampaign,
  advance,
  currentObjective,
  parseCampaign,
  unlocked,
} from "../../src/game/campaign/progress.ts";
import {
  applyCampaignAction,
  emptyCampaignStore,
} from "../../src/lib/campaignStore.ts";

test("34 connected chapters complete with no level, farming, paid, or legacy prerequisite", () => {
  let p = newCampaign("증인", "warrior", "test0001");
  assert.equal(CHAPTERS.length, 34);
  assert.equal(unlocked(p, "a2-01"), false);
  assert.equal(advance(p, { kind: "travel", chapterId: "a3-09" }), p);
  for (const chapter of CHAPTERS) {
    assert.equal(unlocked(p, chapter.id), true);
    p = advance(p, { kind: "travel", chapterId: chapter.id });
    while (currentObjective(p)) {
      const o = currentObjective(p);
      if (o.kind === "boss") p = advance(p, { kind: "boss-won" });
      else
        for (const target of o.targets)
          p = advance(p, { kind: "interact", target });
      assert.ok(parseCampaign(p));
    }
    assert.equal(p.completed.at(-1), chapter.id);
  }
  assert.equal(p.coins, 34 * 60);
  assert.equal(p.inventory["memory-fragment"], 34);
  assert.equal(p.completed.length, 34);
  p = advance(p, { kind: "travel", chapterId: "a1-01" });
  while (currentObjective(p))
    for (const target of currentObjective(p).targets)
      p = advance(p, { kind: "interact", target });
  assert.equal(p.coins, 34 * 60);
});
test("wrong puzzle order resets progress, duplicate interactions do not advance, forged saves rejected", () => {
  let p = newCampaign("증인", "mage", "test0002");
  p.completed = CHAPTERS.slice(0, 5).map((c) => c.id);
  p = advance(p, { kind: "travel", chapterId: "a1-06" });
  p = advance(p, { kind: "interact", target: currentObjective(p).targets[0] });
  const o = currentObjective(p);
  p = advance(p, { kind: "interact", target: o.targets[1] });
  assert.deepEqual(p.targets, []);
  p = advance(p, { kind: "interact", target: o.targets[0] });
  assert.equal(advance(p, { kind: "interact", target: o.targets[0] }), p);
  assert.equal(parseCampaign({ ...p, campaignId: "legacy" }), null);
  assert.equal(parseCampaign({ ...p, coins: -1 }), null);
  assert.equal(parseCampaign({ ...p, completed: ["a1-02"] }), null);
  assert.equal(parseCampaign({ ...p, schemaVersion: 2 }), null);
  assert.equal(parseCampaign({ ...p, family: "__proto__" }), null);
});
test("cloud save derives capped story rewards, ignores imported currency, and blocks stale overwrites", () => {
  const store = emptyCampaignStore();
  const p = newCampaign("증인", "warrior", "test0003");
  p.completed = ["a1-01"];
  p.coins = 999999;
  p.inventory = { "memory-fragment": 999 };
  const first = applyCampaignAction(store, "a", {
    action: "save",
    save: p,
    revision: 0,
  });
  assert.equal(first.status, 200);
  assert.equal(first.account.characters[p.characterId].coins, 60);
  assert.equal(
    first.account.characters[p.characterId].inventory["memory-fragment"],
    1,
  );
  assert.equal(
    applyCampaignAction(store, "a", { action: "save", save: p, revision: 0 })
      .status,
    409,
  );
  assert.equal(
    applyCampaignAction(store, "a", { action: "save", save: p, revision: 1 })
      .account.characters[p.characterId].coins,
    60,
  );
});
test("market escrow, seller payout, cancellation, and races preserve the campaign economy", () => {
  const s = emptyCampaignStore(),
    a = newCampaign("판매자", "mage", "test0004"),
    b = newCampaign("구매자", "ranger", "test0005");
  a.completed = ["a1-01"];
  b.completed = ["a1-01"];
  applyCampaignAction(s, "a", { action: "save", save: a, revision: 0 });
  applyCampaignAction(s, "b", { action: "save", save: b, revision: 0 });
  assert.equal(
    applyCampaignAction(s, "a", {
      action: "list",
      characterId: a.characterId,
      item: "legacy-weapon",
      quantity: 1,
      price: 20,
      revision: 1,
    }).status,
    400,
  );
  applyCampaignAction(s, "a", {
    action: "list",
    characterId: a.characterId,
    item: "memory-fragment",
    quantity: 1,
    price: 20,
    revision: 1,
  });
  const id = Object.keys(s.listings)[0];
  assert.equal(
    s.accounts.a.characters[a.characterId].inventory["memory-fragment"],
    0,
  );
  assert.equal(
    applyCampaignAction(s, "b", {
      action: "buy",
      characterId: b.characterId,
      listingId: id,
      revision: 1,
    }).status,
    200,
  );
  assert.equal(s.accounts.a.characters[a.characterId].coins, 78);
  assert.equal(s.accounts.b.characters[b.characterId].coins, 40);
  assert.equal(
    s.accounts.b.characters[b.characterId].inventory["memory-fragment"],
    2,
  );
  assert.equal(
    applyCampaignAction(s, "b", {
      action: "buy",
      characterId: b.characterId,
      listingId: id,
      revision: 2,
    }).status,
    409,
  );
});

test("prototype chapter keys and impossible payloads fail closed without throwing", () => {
  const p = newCampaign("증인", "mage", "test0099");
  for (const value of [
    "__proto__",
    "constructor",
    "toString",
    null,
    { toString: "bad" },
  ])
    assert.doesNotThrow(() =>
      assert.equal(parseCampaign({ ...p, chapterId: value }), null),
    );
});
