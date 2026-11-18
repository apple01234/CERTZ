/* 2026-11-18 "지역 이동 주문서 작동 안함" 회귀 방지 — 라일락 월드(lilacworldNxM)·챕터 마을(…v)
 * 방문 기록이 부적 목록에서 빠져 이동할 곳을 고를 수 없었다. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { warpGroups } from "../src/game/warpGroups.ts";
import { STAGES } from "../src/game/stages.ts";
import { LILACWORLD_ENTRY } from "../src/game/lilacworld.ts";

const keysOf = (groups) => groups.flatMap((g) => g.stages.map((s) => s.key));

test("라일락 월드 구역만 방문해도 목록이 비지 않는다", () => {
  assert.ok(STAGES[LILACWORLD_ENTRY], "본편 시작 구역이 STAGES에 있어야 한다");
  const groups = warpGroups([LILACWORLD_ENTRY, "lilacworld2x1"]);
  assert.deepEqual(keysOf(groups).sort(), [LILACWORLD_ENTRY, "lilacworld2x1"].sort());
  assert.match(groups[0].label, /라일락 월드 1장/);
});

test("방문한 실제 구역은 하나도 빠지지 않고, 없는 키는 버린다", () => {
  const visited = Object.keys(STAGES).filter((_, i) => i % 7 === 0).concat(["no_such_stage"]);
  const keys = keysOf(warpGroups(visited));
  assert.equal(new Set(keys).size, keys.length, "중복 없음");
  assert.deepEqual(keys.sort(), visited.filter((k) => k in STAGES).sort());
});

test("방문 기록이 없으면 빈 목록", () => {
  assert.deepEqual(warpGroups([]), []);
});
