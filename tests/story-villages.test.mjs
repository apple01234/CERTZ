// 라일락 월드 이야기 마을: 하루가 실제로 머무는 곳(2.txt)에만 있다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { STAGES, NEXT_STAGE, parseStage, LILACWORLD_STORY_VILLAGES, STAGE_THEME } from "../src/game/stages.ts";
import { CHAPTER_VILLAGE_NPC, DIALOGUES } from "../src/game/data.ts";
import { warpGroups } from "../src/game/warpGroups.ts";
import { portalPreview } from "../src/game/portalPreview.ts";

test("이야기 마을이 안전 마을로 체인에 들어 있다", () => {
  assert.deepEqual(LILACWORLD_STORY_VILLAGES.map((v) => v.key), ["lilacworld3v", "lilacworld4v", "lilacworld9v"]);
  assert.deepEqual(LILACWORLD_STORY_VILLAGES.map((v) => v.name), ["칼리야 왕국", "에벤트 왕국", "에벤트 왕국"]);
  assert.equal(STAGES.lilacworld5v, undefined, "하루는 에스테반에 머물지 않는다");
  for (const v of LILACWORLD_STORY_VILLAGES) {
    const def = STAGES[v.key];
    assert.ok(def?.isVillage, `${v.key} 는 마을`);
    assert.equal(def.enemies.length, 0, `${v.key} 에 몬스터 없음`);
    assert.equal(def.boss, false);
    assert.equal(NEXT_STAGE[v.after], v.key, `${v.after} → ${v.key}`);
    assert.equal(NEXT_STAGE[v.key], v.before, `${v.key} → ${v.before}`);
  }
});

test("마을마다 주민 2명과 실제 대사가 있다", () => {
  for (const v of LILACWORLD_STORY_VILLAGES) {
    const { ch } = parseStage(v.key);
    const spec = CHAPTER_VILLAGE_NPC[ch];
    assert.ok(spec, `${ch} 주민 정의`);
    for (const npc of [spec.npcA, spec.npcB]) {
      assert.ok(DIALOGUES[npc.dlg]?.lines.length >= 2, `${npc.dlg} 대사`);
    }
  }
});

test("마을 키는 자기 장으로 파싱된다", () => {
  assert.deepEqual(parseStage("lilacworld3v"), { ch: "lilacworld3", sub: 0 });
  assert.deepEqual(parseStage("lilacworld15v"), { ch: "lilacworld15", sub: 0 });
  assert.deepEqual(parseStage("dlcstargatev"), { ch: "dlcstargate", sub: 0 });
});

test("부적 목록은 마을을 그 장 맨 앞에, 차원문은 휴식으로 표시한다", () => {
  const groups = warpGroups(["lilacworld3x2", "lilacworld3v", "lilacworld3x3"]);
  assert.deepEqual(groups[0].stages.map((s) => s.key), ["lilacworld3v", "lilacworld3x2", "lilacworld3x3"]);
  assert.match(portalPreview("lilacworld3v").text, /칼리야 왕국 · 휴식$/);
});

test("칼리야 마을은 바깥 마을이라 실내(주막) 나무 바닥을 쓰지 않는다", () => {
  assert.notEqual(STAGE_THEME.lilacworld3v.ground, "terrain_wood");
  assert.notEqual(STAGE_THEME.lilacworld3v.ground, STAGE_THEME.lilacworld4v.ground, "칼리야와 에벤트 마을 바닥이 구별된다");
});
