import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createBattle,
  stepBattle,
  STEP,
  hazardContains,
} from "../../src/game/campaign/battle.ts";
import { signProof, verifyProof } from "../../src/game/campaign/receipts.ts";
const member = { id: "one", name: "증인", family: "warrior" };
test("fixed combat enforces attack range/cooldown and bounds", () => {
  const b = createBattle("run", "a1-03", "story", [member]);
  stepBattle(b, { one: { x: Infinity, y: NaN, attack: true } });
  assert.equal(b.boss.hp, b.boss.maxHp);
  b.players[0].x = 512;
  b.players[0].y = 300;
  const hp = b.boss.hp;
  stepBattle(b, { one: { x: 0, y: 0, attack: true } });
  assert.equal(b.boss.hp, hp);
  b.time = 1000;
  stepBattle(b, { one: { x: 0, y: 0, attack: true } });
  assert.ok(b.boss.hp < hp);
  const after = b.boss.hp;
  stepBattle(b, { one: { x: 0, y: 0, attack: true } });
  assert.equal(b.boss.hp, after);
  for (let i = 0; i < 400; i++) stepBattle(b, { one: { x: 999, y: 999 } });
  assert.ok(b.players[0].x <= 984 && b.players[0].y <= 590);
});
test("telegraphs do not damage early, only hit once, and dodge grants a real invulnerability window", () => {
  const b = createBattle("run", "a1-03", "solo", [member]);
  b.hazards = [
    {
      id: 1,
      kind: "circle",
      x: 380,
      y: 470,
      radius: 90,
      at: 300,
      until: 700,
      hit: [],
    },
  ];
  stepBattle(b, {});
  assert.equal(b.players[0].hp, 100);
  b.time = 300;
  stepBattle(b, { one: { x: 0, y: 0, dodge: true } });
  assert.equal(b.players[0].hp, 100);
  const c = createBattle("run", "a1-03", "solo", [member]);
  c.time = 300;
  c.hazards = b.hazards.map((h) => ({ ...h, hit: [] }));
  stepBattle(c, {});
  assert.equal(c.players[0].hp, 65);
  stepBattle(c, {});
  assert.equal(c.players[0].hp, 65);
});
test("hard and cooperative encounters exceed story HP, fallen allies can be revived", () => {
  const story = createBattle("a", "a1-03", "story", [member]),
    solo = createBattle("b", "a1-03", "solo", [member]),
    coop = createBattle("c", "a1-03", "coop", [
      member,
      { ...member, id: "two" },
      { ...member, id: "three" },
    ]);
  assert.ok(
    story.boss.maxHp < solo.boss.maxHp && solo.boss.maxHp < coop.boss.maxHp,
  );
  coop.players[1].hp = 0;
  coop.players[1].x = coop.players[0].x;
  coop.players[1].y = coop.players[0].y;
  coop.boss.nextAttack = 10000;
  for (let i = 0; i < 62; i++)
    stepBattle(coop, { one: { x: 0, y: 0, revive: true } });
  assert.equal(coop.players[1].hp, 45);
});
test("proofs reject tampering, expiration, and missing server configuration", () => {
  const secret = "test-secret-not-production-1234567890";
  const token = signProof({ id: "a", exp: 2000 }, secret);
  assert.equal(verifyProof(token, secret, 1000).id, "a");
  assert.equal(verifyProof(token, secret, 2001), null);
  assert.equal(verifyProof(token + "x", secret, 1000), null);
  assert.equal(verifyProof(token, "", 1000), null);
});
