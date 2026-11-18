/* 2026-11-18 — "게임 중간중간마다 스토리에 맞는 마을을 배치해" 회귀 테스트.
 *  · 라일락 월드 사이에 정본 지명 마을이 실제 안전 마을로 존재한다
 *  · 마을마다 주민 2명과 대사가 등록돼 있다(빈 대화 없음)
 *  · 키 파싱이 마을을 올바른 장으로 읽는다(시작 마을로 오인하지 않는다)
 *  · 부적 목록·차원문 미리보기가 마을을 인식한다 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { STAGES, NEXT_STAGE, parseStage, LILACWORLD_STORY_VILLAGES } from "../src/game/stages.ts";
import { CHAPTER_VILLAGE_NPC, DIALOGUES } from "../src/game/data.ts";
import { warpGroups } from "../src/game/warpGroups.ts";
import { portalPreview } from "../src/game/portalPreview.ts";

test("이야기 마을 4곳이 안전 마을로 체인에 들어 있다", () => {
  assert.deepEqual(LILACWORLD_STORY_VILLAGES.map((v) => v.name), ["칼리야 왕국", "에벤트 왕국", "에스테반 왕국", "연합 진영"]);
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
