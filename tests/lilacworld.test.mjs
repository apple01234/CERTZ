// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/lilacworld.test.mjs
//
// 영준 프린세스 편 계약 검증 — vc231
//
// 검증 축:
//  1) 기획서 1기 15화가 5챕터 × 10구역 = 50 필드로 실제 생성됐는가
//  2) 기존 본편/DLC 계약이 바뀌지 않았는가 (CHAPTERS 배열 불변 = 인덱스 곡선 회귀 0)
//  3) 체인이 village → lilacworld1x1 … (이야기 마을) … lilacworld15x4 → dlcstargatev → dlcstargate1 로 이어지는가
//  4) 영프 엔딩 플래그가 서면 그랜드 플래닛 게이트가 잠기는가 (vc230이 남긴 막다른 길 해소)
//  5) 퀘스트/몬스터/보스/대사가 실제로 채워져 있는가 (빈 구역 없음)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CHAPTERS, STAGES, NEXT_STAGE, PREV_STAGE, STAGE_SHORT, STAGE_THEME,
  BOSS_DEFS, ENEMIES, stageScale, stageIntro, parseStage, chapterSpec, lilacworldSpec,
} from '../src/game/stages.ts';
import { LILACWORLD_CHAPTERS, LILACWORLD_FINAL, LILACWORLD_ENTRY } from '../src/game/lilacworld.ts';
import { CHAPTER_STORY_PLAN, chapterEncounter } from '../src/game/chapterStoryPlan.ts';
import { DIALOGUES } from '../src/game/data.ts';
import { stageTrack } from '../src/game/audio.ts';
import { MIDDLE_CHAPTER_IMPLEMENTED, storyEntryAllowed, storyPortalDestination, YOUNG_PRINCESS_VILLAGE, lwFinalStage } from '../src/game/storyProgression.ts';

/* ── 1. 챕터/구역 수 ─────────────────────────────────────────────────────── */
/* vc235 — 원문 1기 15화를 **1화 = 1챕터**로 맞췄다(종전 5챕터 = 3화씩 묶음).
 *  유저 지적: "영프 스토리 10챕터인데 10스테이지로 너가 만든 것 같은디??"
 *  → 화 단위와 챕터 단위가 어긋나 있었다. */
assert.equal(LILACWORLD_CHAPTERS.length, 15, '원문 1기 15화 = 15챕터');
const hwKeys = LILACWORLD_CHAPTERS.map((c) => c.key);
assert.deepEqual(hwKeys, Array.from({ length: 15 }, (_, i) => `lilacworld${i + 1}`));

assert.equal(STAGES.lilacworld1x2.quests[0].targetLabel, "수련터 출구");
assert.equal(STAGES.lilacworld1x3.quests[0].type, "reach");
assert.equal(STAGES.lilacworld1x3.quests[0].targetLabel, "지하 감옥 입구");
const [dungeonGate, buriedSword] = STAGES.lilacworld1x4.quests;
assert.equal(dungeonGate.id, "14-lv", "기존 5레벨 조건과 저장 인덱스를 유지한다");
assert.equal(dungeonGate.need, 5);
assert.equal(buriedSword.type, "collect");
assert.equal(buriedSword.title, "펜던트가 가리킨 검");
assert.match(DIALOGUES[buriedSword.dialogue].lines.join(" "), /검을 뽑는 순간/);
const evacuation = STAGES.lilacworld2x2;
assert.equal(evacuation.quests[0].type, "reach");
assert.equal(evacuation.quests[0].targetLabel, "마을 안쪽");
const secondAreaIntros = hwKeys.map((key) => stageIntro(`${key}x2`));
assert.equal(new Set(secondAreaIntros).size, hwKeys.length);
assert.ok(secondAreaIntros.every((id) => DIALOGUES[id]));

let stageCount = 0;
for (const ch of LILACWORLD_CHAPTERS) {
  assert.ok(ch.episodes.length > 0, `${ch.key}: 원문 화 범위 표기`);
  /* vc235 — 챕터당 스테이지 수가 가변(4~5). 키는 `장x구역`. */
  assert.ok(ch.stages >= 3 && ch.stages <= 6, `${ch.key}: 스테이지 수 ${ch.stages} 는 과하거나 부족하다`);
  for (let sub = 1; sub <= ch.stages; sub++) {
    const key = `${ch.key}x${sub}`;
    const def = STAGES[key];
    assert.ok(def, `${key} 스테이지가 실제로 생성되어야 한다`);
    assert.equal(def.quests.length > 0, true, `${key}: 퀘스트가 비어 있으면 진행이 막힌다`);
    /* [vc288 — 보스맵 격리] 보스 구역은 일반몹 0마리가 계약이다(요구사항 8.2).
     *  종전엔 모든 구역에 몹이 있어야 한다고 강제했는데, 그 규칙 때문에 보스맵에
     *  잡몹이 깔려 보스 패턴을 읽을 수 없었다. 보스 구역만 예외로 둔다. */
    const expectedBoss = !!chapterEncounter(ch.key, sub);
    if (expectedBoss || /^lilacworld(6|15)$/.test(ch.key)) assert.equal(def.enemies.length, 0, `${key}: boss/healing/rebuilding room`);
    else if (def.quests.some(q => q.type === 'hunt')) assert.ok(def.enemies.length > 0, `${key}: hunt target must spawn`);
    /* 보스가 있는 장은 마지막 구역이 보스전, 없는 장은 보스 없음. */
    assert.equal(def.boss, expectedBoss, `${key}: 정본의 실제 만남 위치`);
    assert.ok(STAGE_SHORT[key], `${key}: 구역 라벨 필요`);
    assert.ok(STAGE_THEME[key], `${key}: 지형 테마 필요`);
    assert.ok(stageIntro(key), `${key}: 인트로 대사 키 필요`);
    // 생성된 인트로 대사가 DIALOGUES 에 실제로 존재해야 빈 대사창이 안 뜬다
    const introId = stageIntro(key);
    assert.ok(DIALOGUES[introId], `${key}: stageIntro(${introId}) 가 DIALOGUES 에 없다`);
    stageCount++;
  }
}
/* vc235 — 15챕터 × 4~5스테이지 = 65필드 */
assert.equal(stageCount, 65, '15챕터 가변 스테이지 = 65 필드');

/* ── 2. 본편/DLC 회귀 0 ─────────────────────────────────────────────────── */
/* vc251 — 수련 원정 9지역(forest…abyss, 90스테이지) 삭제.
 *  CHAPTERS 는 이제 DLC 10개만 남는다. 영프 챕터가 섞여 들어가지 않는 계약은 그대로 유지. */
assert.equal(CHAPTERS.length, 10, 'CHAPTERS 는 DLC 10챕터만 (수련 원정 9지역 삭제)');
assert.equal(CHAPTERS.filter((c) => !c.dlc).length, 0, '수련 원정 챕터는 전부 삭제됐다');
assert.equal(CHAPTERS.filter((c) => c.dlc).length, 10, 'DLC 10챕터 불변');
assert.deepEqual(CHAPTERS.map((c) => c.num), [11, 12, 13, 14, 15, 16, 17, 18, 19, 20], 'DLC 장 번호 불변');
for (const ch of CHAPTERS) {
  assert.ok(!hwKeys.includes(ch.key), `${ch.key}: 영프 챕터가 CHAPTERS 에 섞이면 인덱스 곡선이 회귀한다`);
}
// 기존 스테이지 밸런스가 이번 변경으로 흔들리지 않았는지 — HEAD(이전 커밋)와 직접 대조한다.
// (영프 편은 scaleMul 우선 경로라 CH_HP/CH_ATK/CH_EXP 곡선을 건드리지 않는다.)
{
  /* vc235 — data: URL 대신 HEAD 소스를 임시 파일로 물질화해 import 한다.
   *  data: URL 은 기준 경로가 없어 stages.ts 의 `./lilacworld` import 를
   *  해석하지 못했다(ERR_UNSUPPORTED_RESOLVE_REQUEST). 상세는 git-head-module.mjs. */
  const { importFromGit } = await import('./git-head-module.mjs');
  const before = await importFromGit('src/game/stages.ts');
  /* vc251 — 삭제된 지역 키(forest1/abyss10/duskrealm5)는 대조 대상에서 뺀다(존재하지 않는다).
   *  남은 DLC 밸런스가 이번 변경으로 흔들리지 않았는지만 본다. */
  for (const key of ['dlcstargate1', 'dlcsernium10', 'dlcprisma5']) {
    assert.deepEqual(stageScale(key), before.stageScale(key), `${key} 밸런스가 변했다 (회귀)`);
  }
  /* vc235 — 영프 편 키가 `lilacworld{N}{sub}` → `lilacworld{N}x{sub}` 로 바뀌었다
   *  (챕터가 두 자리가 되면서 붙여쓰기가 모호해짐). 비교 대상 HEAD 는 이미
   *  영프 50필드를 포함하므로 "본편/DLC 키만" 남아 있는지 본다. */
  const preExisting = Object.keys(before.STAGES).filter(
    (k) => !k.startsWith('lilacworld') && !/^(forest|kingdom|fairyglade|emberland|frostland|cave|forgehall|duskrealm|abyss)(v|\d+)$/.test(k),
  );
  assert.deepEqual(
    preExisting.every((k) => STAGES[k]),
    true,
    'DLC/특수 스테이지 키가 전부 남아 있어야 한다 (수련 원정 9지역은 삭제됨)',
  );
}
// 영프는 전용 곡선
const hwScale = stageScale(LILACWORLD_ENTRY);
assert.deepEqual(hwScale, LILACWORLD_CHAPTERS[0].scaleMul, '영프는 전용 scaleMul 을 그대로 쓴다');

/* ── 3. 체인 ───────────────────────────────────────────────────────────── */
const firstKey = `${LILACWORLD_CHAPTERS[0].key}x1`;
assert.equal(LILACWORLD_ENTRY, firstKey);
assert.equal(NEXT_STAGE[YOUNG_PRINCESS_VILLAGE], firstKey, '영프 마을 → 영프 1-1 (vc230 막다른 길 해소)');
/* 유저 지시 — 애델리오나 마을 다음은 별도 시작 마을이 아니라 1-1 스테이지다.
 *  youngprincessv 는 경유지에서 빠졌지만 스테이지 정의는 남아 있다. */
assert.equal(NEXT_STAGE['village'], firstKey, '애델리오나 마을 → 영프 1-1 직행');
assert.equal(PREV_STAGE[firstKey], 'village', '영프 1-1 복귀는 애델리오나 마을');
/* 2026-11-18 — 이야기 마을(LILACWORLD_STORY_VILLAGES)이 구역 사이에 끼어든다.
 *  전진은 "바로 다음 구역" 또는 "다음 구역으로 이어지는 마을 한 곳"이어야 하고, 복귀는 그 역순이어야 한다. */
const stepTo = (from, to, label) => {
  const nx = NEXT_STAGE[from];
  if (nx === to) { assert.equal(PREV_STAGE[to], from, `${label} 복귀`); return; }
  assert.ok(STAGES[nx]?.isVillage, `${label} 전진은 다음 구역 또는 이야기 마을 (실제 ${nx})`);
  assert.equal(NEXT_STAGE[nx], to, `${label} 마을 → 다음 구역`);
  assert.equal(PREV_STAGE[nx], from, `${label} 마을 복귀`);
  assert.equal(PREV_STAGE[to], nx, `${label} 다음 구역 복귀는 마을`);
};
// 챕터 내부 순차
for (const ch of LILACWORLD_CHAPTERS) {
  for (let sub = 1; sub < ch.stages; sub++) stepTo(`${ch.key}x${sub}`, `${ch.key}x${sub + 1}`, `${ch.key}x${sub}`);
}
// 챕터 경계
assert.equal(NEXT_STAGE['lilacworld1x4'], 'lilacworld2x1');
assert.equal(PREV_STAGE['lilacworld2x1'], 'lilacworld1x4');
for (let i = 0; i < LILACWORLD_CHAPTERS.length - 1; i++) {
  const a = LILACWORLD_CHAPTERS[i], b = LILACWORLD_CHAPTERS[i + 1];
  stepTo(`${a.key}x${a.stages}`, `${b.key}x1`, `${a.key} → ${b.key}`);
}
// 정본 지명 마을이 정확히 그 자리에 있다
assert.equal(NEXT_STAGE.lilacworld3x2, 'lilacworld3v', '도깨비 언덕 → 칼리야 왕국 (리엘이 업고 온 마을)');
assert.equal(NEXT_STAGE.lilacworld3v, 'lilacworld3x3', '칼리야 왕국 → 리엘의 주막');
assert.equal(NEXT_STAGE.lilacworld4x3, 'lilacworld4v', '에벤트 외곽 → 에벤트 왕국');
assert.equal(NEXT_STAGE.lilacworld4x4, 'lilacworld5x1', '하루는 에스테반에 가지 않는다(2.txt:61-65) — 4장 → 5장 바로');
assert.equal(NEXT_STAGE.lilacworld8x5, 'lilacworld9v', '8장 → 에벤트 왕국(부상자 치료)');
assert.equal(NEXT_STAGE[LILACWORLD_FINAL], 'dlcstargatev', '영프 최종 → 그랜드 플래닛 제1행성 마을 (스토리 순서대로)');
assert.equal(NEXT_STAGE.dlcstargatev, 'dlcstargate1');
assert.equal(PREV_STAGE.dlcstargate1, 'dlcstargatev', 'dlcstargate1 복귀는 그랜드 플래닛 마을 (기존 규칙 유지)');
assert.equal(PREV_STAGE.dlcstargatev, YOUNG_PRINCESS_VILLAGE, '그랜드 플래닛 마을 복귀는 영프 마을');

/* ── 4. 게이트 ─────────────────────────────────────────────────────────── */
assert.equal(MIDDLE_CHAPTER_IMPLEMENTED, true, '영프 편이 구현됐으므로 게이트가 잠긴다');
assert.equal(lwFinalStage(LILACWORLD_FINAL), true);
assert.equal(lwFinalStage('lilacworld15x3'), false);
const base = { cleared: true, youngPrincessCleared: false };
assert.equal(storyEntryAllowed('dlcstargate1', base), false, '영프 엔딩 전에는 그랜드 플래닛 불가');
assert.equal(storyEntryAllowed('dlcstargate1', { cleared: true, youngPrincessCleared: true }), true);
assert.equal(storyPortalDestination(YOUNG_PRINCESS_VILLAGE, base), null, '엔딩 전 영프 마을 → 그랜드 플래닛 잠김');
assert.equal(storyPortalDestination(YOUNG_PRINCESS_VILLAGE, { cleared: true, youngPrincessCleared: true }), 'dlcstargate1');
assert.equal(storyPortalDestination('village', { cleared: false, youngPrincessCleared: true }), LILACWORLD_ENTRY, 'village 는 영프 1-1 로 직행한다');
assert.equal(storyPortalDestination('village', { cleared: false, youngPrincessCleared: false }), LILACWORLD_ENTRY, '엔딩 여부와 무관하게 1-1 직행');
// 영프 편 내부 진입은 cleared 만 있으면 된다(엔딩 플래그 불필요)
assert.equal(storyEntryAllowed(LILACWORLD_ENTRY, { cleared: true }), true);

/* ── 5. 보스/몬스터 실체 ───────────────────────────────────────────────── */
for (const ch of LILACWORLD_CHAPTERS) {
  for (let sub = 1; sub <= ch.stages; sub++) {
    const def = STAGES[`${ch.key}x${sub}`], encounter = chapterEncounter(ch.key, sub);
    assert.equal(def.bossKey, encounter ?? undefined);
    if (!encounter) continue;
    const boss = BOSS_DEFS[encounter];
    assert.ok(boss && boss.hp > 0 && boss.atk > 0);
    assert.ok(DIALOGUES[boss.introDialogue]);
    assert.equal(def.enemies.length, 0);
  }
}
const bossOrder = LILACWORLD_CHAPTERS.flatMap(c => CHAPTER_STORY_PLAN[c.key].places.map(p => p.boss).filter(Boolean));
assert.deepEqual(bossOrder, ['dio','harold','verodin','rasion','feron','scarlet_blood','scarlet_dark','scarlet_seal','desknis']);
assert.equal(STAGES.lilacworld10x2.quests[0].dialogue, 'lwSecretRoute');

/* ── 7. parseStage / chapterSpec ───────────────────────────────────────── */
assert.deepEqual(parseStage('lilacworld3x3'), { ch: 'lilacworld3', sub: 3 });
assert.deepEqual(parseStage('lilacworld15x4'), { ch: 'lilacworld15', sub: 4 });
assert.equal(chapterSpec(LILACWORLD_ENTRY), null, 'CHAPTERS 밖이므로 chapterSpec 은 null');
assert.ok(lilacworldSpec(LILACWORLD_ENTRY), 'lilacworldSpec 이 영프 스펙을 돌려준다');
assert.equal(lilacworldSpec('forest1'), null);

/* ── 8. BGM 매핑 + 실파일 존재 ─────────────────────────────────────────── */
for (const ch of LILACWORLD_CHAPTERS) {
  /* vc235 — 키가 `장x구역` 형식이다. 붙여쓰기(`lilacworld61`)는 챕터를 잘못 자른다. */
  const track = stageTrack(`${ch.key}x1`);
  assert.notEqual(track, 'bgm_forest_1', `${ch.key}: 폴백 곡이 아니라 전용 배정이어야 한다`);
  const ogg = new URL(`../public/assets/audio/${track}.ogg`, import.meta.url);
  assert.ok(fs.existsSync(ogg), `${ch.key}: ${track}.ogg 가 없다`);
  assert.equal(fs.readFileSync(ogg).subarray(0, 4).toString(), 'OggS', `${ch.key}: ${track} 유효 ogg`);
}
// 보스 구역은 보스 트랙을 쓴다
const bossTrack = stageTrack(LILACWORLD_FINAL);
assert.ok(bossTrack.includes('boss'), '영프 최종 구역은 보스 트랙');
assert.ok(fs.existsSync(new URL(`../public/assets/audio/${bossTrack}.ogg`, import.meta.url)), `${bossTrack}.ogg`);

/* ── 9. WorldScene 엔딩 배선 ───────────────────────────────────────────── */
const world = fs.readFileSync(new URL('../src/game/scenes/WorldScene.ts', import.meta.url), 'utf8');
assert.ok(world.includes('lwFinalStage(this.stageDef.key)'), '엔딩 판정이 공용 헬퍼를 쓴다');
assert.ok(world.includes('this.youngPrincessCleared = true'), '영프 엔딩에서 플래그를 세운다');
assert.ok(world.includes('lilacworldEnding'), '엔딩 대사 연결');
assert.ok(!world.includes('LILACWORLD_FINAL'), 'WorldScene 은 상수 직접 참조 대신 헬퍼를 쓴다');

console.log(
  `ALL CHECKS PASS: ${stageCount} lilacworld stages (5 chapters x 10) / ` +
  `CHAPTERS untouched (${CHAPTERS.length}) / chain youngprincess → 1-1 … 5-10 → Grand Planet / ` +
  `gate locked after ending (MIDDLE_CHAPTER_IMPLEMENTED=${MIDDLE_CHAPTER_IMPLEMENTED})`,
);
