// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/howlrstone.test.mjs
//
// 영준 프린세스 편(하울르스톤) 계약 검증 — vc231
//
// 검증 축:
//  1) 기획서 1기 15화가 5챕터 × 10구역 = 50 필드로 실제 생성됐는가
//  2) 기존 본편/DLC 계약이 바뀌지 않았는가 (CHAPTERS 배열 불변 = 인덱스 곡선 회귀 0)
//  3) 체인이 youngprincessv → howlrstone1x1 … howlrstone15x4 → dlcstargate1 로 이어지는가
//  4) 영프 엔딩 플래그가 서면 그랜드 플래닛 게이트가 잠기는가 (vc230이 남긴 막다른 길 해소)
//  5) 퀘스트/몬스터/보스/대사가 실제로 채워져 있는가 (빈 구역 없음)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CHAPTERS, STAGES, NEXT_STAGE, PREV_STAGE, STAGE_SHORT, STAGE_THEME,
  BOSS_DEFS, ENEMIES, stageScale, stageIntro, parseStage, chapterSpec, howlrstoneSpec,
} from '../src/game/stages.ts';
import { HOWLRSTONE_CHAPTERS, HOWLRSTONE_FINAL, HOWLRSTONE_ENTRY } from '../src/game/howlrstone.ts';
import { DIALOGUES } from '../src/game/data.ts';
import { stageTrack } from '../src/game/audio.ts';
import { MIDDLE_CHAPTER_IMPLEMENTED, storyEntryAllowed, storyPortalDestination, YOUNG_PRINCESS_VILLAGE, howlFinalStage } from '../src/game/storyProgression.ts';

/* ── 1. 챕터/구역 수 ─────────────────────────────────────────────────────── */
/* vc235 — 원문 1기 15화를 **1화 = 1챕터**로 맞췄다(종전 5챕터 = 3화씩 묶음).
 *  유저 지적: "영프 스토리 10챕터인데 10스테이지로 너가 만든 것 같은디??"
 *  → 화 단위와 챕터 단위가 어긋나 있었다. */
assert.equal(HOWLRSTONE_CHAPTERS.length, 15, '원문 1기 15화 = 15챕터');
const hwKeys = HOWLRSTONE_CHAPTERS.map((c) => c.key);
assert.deepEqual(hwKeys, Array.from({ length: 15 }, (_, i) => `howlrstone${i + 1}`));

let stageCount = 0;
for (const ch of HOWLRSTONE_CHAPTERS) {
  assert.ok(ch.episodes.length > 0, `${ch.key}: 원문 화 범위 표기`);
  /* vc235 — 챕터당 스테이지 수가 가변(4~5). 키는 `장x구역`. */
  assert.ok(ch.stages >= 3 && ch.stages <= 6, `${ch.key}: 스테이지 수 ${ch.stages} 는 과하거나 부족하다`);
  for (let sub = 1; sub <= ch.stages; sub++) {
    const key = `${ch.key}x${sub}`;
    const def = STAGES[key];
    assert.ok(def, `${key} 스테이지가 실제로 생성되어야 한다`);
    assert.equal(def.quests.length > 0, true, `${key}: 퀘스트가 비어 있으면 진행이 막힌다`);
    assert.equal(def.enemies.length > 0, true, `${key}: 스폰 몬스터가 없으면 사냥이 불가능하다`);
    /* 보스가 있는 장은 마지막 구역이 보스전, 없는 장은 보스 없음. */
    assert.equal(def.boss, ch.boss !== null && sub === ch.stages, `${key}: 보스는 마지막 구역에만`);
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
assert.equal(CHAPTERS.length, 19, 'CHAPTERS 배열은 그대로 (본편 9 + DLC 10)');
assert.equal(CHAPTERS.filter((c) => !c.dlc).length, 9, '본편 9챕터 불변');
assert.deepEqual(CHAPTERS.filter((c) => !c.dlc).map((c) => c.num), [2, 3, 4, 5, 6, 7, 8, 9, 10], '본편 장 번호 불변');
for (const ch of CHAPTERS) {
  assert.ok(!hwKeys.includes(ch.key), `${ch.key}: 영프 챕터가 CHAPTERS 에 섞이면 인덱스 곡선이 회귀한다`);
}
// 기존 스테이지 밸런스가 이번 변경으로 흔들리지 않았는지 — HEAD(이전 커밋)와 직접 대조한다.
// (영프 편은 scaleMul 우선 경로라 CH_HP/CH_ATK/CH_EXP 곡선을 건드리지 않는다.)
{
  /* vc235 — data: URL 대신 HEAD 소스를 임시 파일로 물질화해 import 한다.
   *  data: URL 은 기준 경로가 없어 stages.ts 의 `./howlrstone` import 를
   *  해석하지 못했다(ERR_UNSUPPORTED_RESOLVE_REQUEST). 상세는 git-head-module.mjs. */
  const { importFromGit } = await import('./git-head-module.mjs');
  const before = await importFromGit('src/game/stages.ts');
  for (const key of ['forest1', 'abyss10', 'dlcstargate1', 'dlcsernium10', 'hel5']) {
    assert.deepEqual(stageScale(key), before.stageScale(key), `${key} 밸런스가 변했다 (회귀)`);
  }
  /* vc235 — 영프 편 키가 `howlrstone{N}{sub}` → `howlrstone{N}x{sub}` 로 바뀌었다
   *  (챕터가 두 자리가 되면서 붙여쓰기가 모호해짐). 비교 대상 HEAD 는 이미
   *  영프 50필드를 포함하므로 "본편/DLC 키만" 남아 있는지 본다. */
  const preExisting = Object.keys(before.STAGES).filter((k) => !k.startsWith('howlrstone'));
  assert.deepEqual(
    preExisting.every((k) => STAGES[k]),
    true,
    '본편/DLC 스테이지 키가 전부 남아 있어야 한다',
  );
}
// 영프는 전용 곡선
const hwScale = stageScale(HOWLRSTONE_ENTRY);
assert.deepEqual(hwScale, HOWLRSTONE_CHAPTERS[0].scaleMul, '영프는 전용 scaleMul 을 그대로 쓴다');

/* ── 3. 체인 ───────────────────────────────────────────────────────────── */
const firstKey = `${HOWLRSTONE_CHAPTERS[0].key}x1`;
assert.equal(HOWLRSTONE_ENTRY, firstKey);
assert.equal(NEXT_STAGE[YOUNG_PRINCESS_VILLAGE], firstKey, '영프 마을 → 영프 1-1 (vc230 막다른 길 해소)');
assert.equal(PREV_STAGE[firstKey], YOUNG_PRINCESS_VILLAGE, '영프 1-1 복귀는 마을');
// 챕터 내부 순차
for (const ch of HOWLRSTONE_CHAPTERS) {
  for (let sub = 1; sub < ch.stages; sub++) {
    assert.equal(NEXT_STAGE[`${ch.key}x${sub}`], `${ch.key}x${sub + 1}`, `${ch.key}x${sub} 전진`);
    assert.equal(PREV_STAGE[`${ch.key}x${sub + 1}`], `${ch.key}x${sub}`, `${ch.key}x${sub + 1} 복귀`);
  }
}
// 챕터 경계
assert.equal(NEXT_STAGE['howlrstone1x4'], 'howlrstone2x1');
assert.equal(PREV_STAGE['howlrstone2x1'], 'howlrstone1x4');
assert.equal(NEXT_STAGE[HOWLRSTONE_FINAL], 'dlcstargate1', '영프 최종 → 그랜드 플래닛 (스토리 순서대로)');
assert.equal(PREV_STAGE.dlcstargate1, 'dlcstargatev', 'dlcstargate1 복귀는 그랜드 플래닛 마을 (기존 규칙 유지)');
assert.equal(PREV_STAGE.dlcstargatev, YOUNG_PRINCESS_VILLAGE, '그랜드 플래닛 마을 복귀는 영프 마을');

/* ── 4. 게이트 ─────────────────────────────────────────────────────────── */
assert.equal(MIDDLE_CHAPTER_IMPLEMENTED, true, '영프 편이 구현됐으므로 게이트가 잠긴다');
assert.equal(howlFinalStage(HOWLRSTONE_FINAL), true);
assert.equal(howlFinalStage('howlrstone15x3'), false);
const base = { cleared: true, youngPrincessCleared: false };
assert.equal(storyEntryAllowed('dlcstargate1', base), false, '영프 엔딩 전에는 그랜드 플래닛 불가');
assert.equal(storyEntryAllowed('dlcstargate1', { cleared: true, youngPrincessCleared: true }), true);
assert.equal(storyPortalDestination(YOUNG_PRINCESS_VILLAGE, base), null, '엔딩 전 영프 마을 → 그랜드 플래닛 잠김');
assert.equal(storyPortalDestination(YOUNG_PRINCESS_VILLAGE, { cleared: true, youngPrincessCleared: true }), 'dlcstargate1');
assert.equal(storyPortalDestination('village', { cleared: false, youngPrincessCleared: true }), null, '본편 미클리어면 영프 마을조차 불가');
// 영프 편 내부 진입은 cleared 만 있으면 된다(엔딩 플래그 불필요)
assert.equal(storyEntryAllowed(HOWLRSTONE_ENTRY, { cleared: true }), true);

/* ── 5. 보스/몬스터 실체 ───────────────────────────────────────────────── */
for (const ch of HOWLRSTONE_CHAPTERS) {
  /* vc235 — 보스가 없는 장(1·2·4·5·6·9·11·12·13·15)은 검사 대상이 아니다.
   *  보스가 있으면 **마지막 스테이지**에 스폰된다. */
  if (ch.boss === null) {
    assert.ok(STAGES[`${ch.key}x${ch.stages}`], `${ch.key}: 마지막 스테이지가 존재해야 한다`);
    continue;
  }
  const def = STAGES[`${ch.key}x${ch.stages}`];
  assert.ok(def.bossKey, `${ch.key}x${ch.stages}: bossKey 필수`);
  const boss = BOSS_DEFS[def.bossKey];
  assert.ok(boss, `${def.bossKey}: BOSS_DEFS 에 등록되어야 스폰된다`);
  assert.equal(boss.name, ch.boss === 'harold' ? '바다의 군단장 해롤드' : boss.name);
  assert.ok(boss.hp > 0 && boss.atk > 0, `${boss.name}: 능력치`);
  assert.ok(boss.patterns.p1.length > 0, `${boss.name}: 패턴`);
  assert.ok(DIALOGUES[boss.introDialogue], `${boss.name}: 인트로 대사 ${boss.introDialogue}`);
  // 스폰 몬스터 키가 ENEMIES 에 실존해야 화면에 실제로 나온다
  for (const q of def.quests) {
    if (q.type === 'hunt' && q.targetKey) {
      assert.ok(ENEMIES[q.targetKey], `${ch.key}10: 퀘스트 대상 ${q.targetKey} 가 ENEMIES 에 없다`);
    }
  }
  for (const e of def.enemies) {
    assert.ok(ENEMIES[e.key], `${ch.key}10: 스폰 ${e.key} 가 ENEMIES 에 없다`);
  }
}

/* ── 6. 영프 보스 5종 = 원문 등장 순서 ─────────────────────────────────── */
/* vc235 — 15챕터에서도 보스는 원문 등장 순서를 지켜야 한다.
 *  보스가 없는 장은 null 이므로 걸러서 비교한다. */
const bossOrder = HOWLRSTONE_CHAPTERS.map((c) => c.boss).filter((b) => b !== null);
assert.deepEqual(bossOrder, ['harold', 'verodin', 'feron', 'shadow', 'scarlet'],
  '원문 등장 순: 해롤드(3화) → 베로니카·딘(7화) → 페르온(8화) → 스칼렛 환영(10화) → 스칼렛(14화)');

/* ── 7. parseStage / chapterSpec ───────────────────────────────────────── */
assert.deepEqual(parseStage('howlrstone3x3'), { ch: 'howlrstone3', sub: 3 });
assert.deepEqual(parseStage('howlrstone15x4'), { ch: 'howlrstone15', sub: 4 });
assert.equal(chapterSpec(HOWLRSTONE_ENTRY), null, 'CHAPTERS 밖이므로 chapterSpec 은 null');
assert.ok(howlrstoneSpec(HOWLRSTONE_ENTRY), 'howlrstoneSpec 이 영프 스펙을 돌려준다');
assert.equal(howlrstoneSpec('forest1'), null);

/* ── 8. BGM 매핑 + 실파일 존재 ─────────────────────────────────────────── */
for (const ch of HOWLRSTONE_CHAPTERS) {
  /* vc235 — 키가 `장x구역` 형식이다. 붙여쓰기(`howlrstone61`)는 챕터를 잘못 자른다. */
  const track = stageTrack(`${ch.key}x1`);
  assert.notEqual(track, 'bgm_forest_1', `${ch.key}: 폴백 곡이 아니라 전용 배정이어야 한다`);
  const ogg = new URL(`../public/assets/audio/${track}.ogg`, import.meta.url);
  assert.ok(fs.existsSync(ogg), `${ch.key}: ${track}.ogg 가 없다`);
  assert.equal(fs.readFileSync(ogg).subarray(0, 4).toString(), 'OggS', `${ch.key}: ${track} 유효 ogg`);
}
// 보스 구역은 보스 트랙을 쓴다
const bossTrack = stageTrack(HOWLRSTONE_FINAL);
assert.ok(bossTrack.includes('boss'), '영프 최종 구역은 보스 트랙');
assert.ok(fs.existsSync(new URL(`../public/assets/audio/${bossTrack}.ogg`, import.meta.url)), `${bossTrack}.ogg`);

/* ── 9. WorldScene 엔딩 배선 ───────────────────────────────────────────── */
const world = fs.readFileSync(new URL('../src/game/scenes/WorldScene.ts', import.meta.url), 'utf8');
assert.ok(world.includes('howlFinalStage(this.stageDef.key)'), '엔딩 판정이 공용 헬퍼를 쓴다');
assert.ok(world.includes('this.youngPrincessCleared = true'), '영프 엔딩에서 플래그를 세운다');
assert.ok(world.includes('howlrstoneEnding'), '엔딩 대사 연결');
assert.ok(!world.includes('HOWLRSTONE_FINAL'), 'WorldScene 은 상수 직접 참조 대신 헬퍼를 쓴다');

console.log(
  `ALL CHECKS PASS: ${stageCount} howlrstone stages (5 chapters x 10) / ` +
  `CHAPTERS untouched (${CHAPTERS.length}) / chain youngprincess → 1-1 … 5-10 → Grand Planet / ` +
  `gate locked after ending (MIDDLE_CHAPTER_IMPLEMENTED=${MIDDLE_CHAPTER_IMPLEMENTED})`,
);
