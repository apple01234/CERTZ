/* 2026-11-13 멀티플레이 서버 최적화 회귀 방지 — 방 나누기(50명) · 0.1초 틱 묶음 · 패킷 경량화 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { applyPlayerDelta } from "../src/game/net.ts";

const require = createRequire(import.meta.url);
const { createRoomDirectory } = require("../multiplayer/rooms.js");
const { metaOf, moveRow, deltaPacket } = require("../multiplayer/packets.js");
const config = require("../multiplayer/config.js");

test("기본 설정: 방 정원 50명, 틱 100ms", () => {
  assert.equal(config.ROOM_CAP, 50);
  assert.equal(config.TICK_MS, 100);
});

test("정원이 차면 다음 방으로 자동 배치된다", () => {
  const dir = createRoomDirectory(50);
  for (let i = 0; i < 120; i++) dir.assign(`s${i}`, "village");
  assert.deepEqual(dir.keys().sort(), ["village#0", "village#1", "village#2"]);
  assert.equal(dir.members("village#0").length, 50);
  assert.equal(dir.members("village#1").length, 50);
  assert.equal(dir.members("village#2").length, 20);
});

test("빈자리는 낮은 번호 방부터 메우고, 같은 구역 재입장은 방을 옮기지 않는다", () => {
  const dir = createRoomDirectory(2);
  for (const id of ["a", "b", "c"]) dir.assign(id, "v");
  assert.equal(dir.roomOf("c"), "v#1");
  dir.leave("a");
  assert.equal(dir.assign("d", "v").key, "v#0");
  assert.deepEqual(dir.assign("c", "v"), { key: "v#1", prev: "v#1", moved: false });
});

test("파티원이 있는 방에 자리가 있으면 그 방으로 간다", () => {
  const dir = createRoomDirectory(2);
  for (const id of ["a", "b", "c"]) dir.assign(id, "v"); // c 는 v#1
  dir.leave("a");                                        // v#0 에 빈자리
  assert.equal(dir.assign("friend", "v", ["c"]).key, "v#1");
});

test("구역을 옮기면 이전 방에서 빠지고 빈 방은 정리된다", () => {
  const dir = createRoomDirectory(50);
  dir.assign("a", "village");
  const r = dir.assign("a", "forest");
  assert.deepEqual(r, { key: "forest#0", prev: "village#0", moved: true });
  assert.deepEqual(dir.keys(), ["forest#0"]);
});

test("묶음 패킷은 바뀐 좌표만 [n, x, y, flags] 로 담고 빈 필드는 뺀다", () => {
  const p = { n: 7, name: "가", lv: 3, cls: null, x: 10.6, y: 20.2, flip: true, moving: true, stage: "v", code: "", gm: false, t: 1 };
  assert.deepEqual(moveRow(p), [7, 11, 20, 3]);
  assert.equal(deltaPacket([], []), null);
  assert.deepEqual(deltaPacket([moveRow(p)], []), { m: [[7, 11, 20, 3]] });
  const meta = metaOf("sock", p);
  for (const k of ["stage", "t", "gm", "code"]) assert.ok(!(k in meta), `스냅샷에 ${k} 가 남았다`);
  assert.ok(JSON.stringify(moveRow(p)).length * 4 < JSON.stringify({ id: "x".repeat(20), ...p }).length);
});

test("클라이언트는 스냅샷 위에 묶음을 덮어 종전과 같은 목록을 만든다", () => {
  const roster = new Map([
    [1, { id: "a", n: 1, name: "가", lv: 1, cls: null, x: 0, y: 0, flip: false, moving: false }],
    [2, { id: "b", n: 2, name: "나", lv: 1, cls: null, x: 5, y: 5, flip: false, moving: false }],
  ]);
  const list = applyPlayerDelta(roster, { m: [[1, 30, 40, 3], [99, 1, 1, 0]], l: [2] });
  assert.equal(list.length, 1);
  assert.deepEqual({ x: list[0].x, y: list[0].y, flip: list[0].flip, moving: list[0].moving, name: list[0].name }, { x: 30, y: 40, flip: true, moving: true, name: "가" });
});

test("서버는 좌표를 즉시 보내지 않고 틱에서 방 단위로 한 번 보낸다", () => {
  const src = readFileSync(new URL("../multiplayer/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /broadcastPlayers/);
  assert.match(src, /setInterval\(flushTick, TICK_MS\)/);
  assert.match(src, /io\.to\(key\)\.emit\("pd", pkt\)/);
});
