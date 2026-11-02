import { test } from "node:test";
import assert from "node:assert/strict";
import { io } from "socket.io-client";
import { createCampaignServer } from "../../multiplayer/campaign/server.mjs";
import { signProof, verifyProof } from "../../src/game/campaign/receipts.ts";
const secret = "test-secret-not-production-1234567890";
function once(s, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${event}`)), 5000);
    s.once(event, (v) => {
      clearTimeout(timer);
      resolve(v);
    });
  });
}
test("three real clients share an authoritative encounter and receive a signed result", async () => {
  const server = createCampaignServer({ secret });
  await new Promise((r) => server.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.http.address().port}`;
  const clients = [];
  try {
    for (let i = 0; i < 3; i++) {
      const ticket = signProof(
        {
          uid: `user${i}`,
          characterId: `char000${i}`,
          name: `증인${i}`,
          family: "warrior",
          bosses: ["a1-03"],
          exp: Date.now() + 100000,
        },
        secret,
      );
      const s = io(url, {
        auth: { ticket },
        transports: ["websocket"],
        forceNew: true,
      });
      clients.push(s);
      await once(s, "connect");
    }
    const r = once(clients[0], "campaign:room");
    clients[0].emit("campaign:create", { mode: "coop", chapterId: "a1-03" });
    const room = await r;
    for (let i = 1; i < 3; i++) {
      const joined = once(clients[i], "campaign:room");
      clients[i].emit("campaign:join", { code: room.code });
      await joined;
    }
    assert.equal(server.rooms.get(room.code).members.size, 3);
    const states = clients.map((s) => once(s, "campaign:state"));
    clients[0].emit("campaign:start");
    const snapshots = await Promise.all(states);
    assert.equal(new Set(snapshots.map((b) => b.id)).size, 1);
    assert.equal(snapshots[0].players.length, 3);
    // A forged client win event has no handler; only the simulation can finish a run.
    clients[0].emit("campaign:win", { hp: 0, score: 1 });
    assert.equal(server.rooms.get(room.code).battle.status, "fighting");
    const battle = server.rooms.get(room.code).battle;
    battle.boss.hp = 1;
    battle.players[0].x = 512;
    battle.players[0].y = 300;
    const receipts = clients.map((s) => once(s, "campaign:receipt"));
    clients[0].emit("campaign:input", { x: 0, y: 0, attack: true });
    const received = await Promise.all(receipts);
    assert.equal(new Set(received).size, 1);
    const proof = verifyProof(received[0], secret);
    assert.equal(proof.members.length, 3);
    assert.equal(proof.mode, "coop");
    assert.ok(proof.time > 0);
  } finally {
    clients.forEach((s) => s.disconnect());
    await server.close();
  }
});
