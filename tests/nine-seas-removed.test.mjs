import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

/* 2026-11-14 — 유저 지시 "9개의 바다 잔재 전부 없애 — 내부 코드까지".
 * 옛 '하울르스톤 : 이그드라실 9개의 바다' 시절 식별자·고유명을 코드·파일 이름·배포 문서에서 지웠다.
 * 옛 키는 세이브 이관표(src/game/legacyKeys.ts)와 거래소 서버의 옛 매물 변환표에만 남긴다. */

const OLD_EN = /(?<![A-Za-z])(howlrstone|alfheim|muspelheim|niflheim|nidavellir|nidhogg?|abudditos|fenrir|skoll|surt|hati|gram|vord|jorm|nagr|hel|helhound|valkyrie|valk|yggfeast)(?![a-z])|HOWLRSTONE|Howlrstone|(?<![A-Za-z])howl[A-Z]/;
const OLD_KO = /니드호그|수르트|펜리르|아부디토스|베오르드|요르문간드|나그라파르|가르간|하울르스톤|쿠소디아|알프헤임|무스펠|니플헤임|니다벨리르|스바르트|발할라|발키리|라그나로크|요툰/;

/* 역사 기록(docs·worklog·AGENTS)과 금지어 목록을 담은 테스트는 대상이 아니다.
 * 2026-11-16 — 멀티플레이 서버의 구역 키 별칭표(multiplayer/stageAliases.js)는
 *  이미 배포된 구버전 APK 가 보내는 옛 구역 이름을 받아 주기 위한 **상호운용 표**다.
 *  클라 이관표·거래소 매물 변환표와 같은 성격이라 여기서만 예외한다. */
const EXEMPT = (f) => /^(docs|skills|tests)\//.test(f) || /^(worklog|AGENTS|ONBOARDING)\.md$/.test(f) || f === 'src/game/legacyKeys.ts' || f === 'multiplayer/stageAliases.js' || f === 'scripts/maple_contents.json';
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const TEXT = /\.(ts|tsx|mjs|js|cjs|json|py|html|md|txt|css|sh|yml|yaml|gradle|xml|toml)$/;

test('코드·배포 파일에 옛 9개의 바다 식별자·고유명이 없다', () => {
  const hits = [];
  for (const f of files) {
    if (EXEMPT(f) || !TEXT.test(f) || !fs.existsSync(f)) continue;
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (f === 'accounts/index.js' && line.startsWith('const LEGACY_ITEM =')) return; // 옛 매물 변환표
      if (OLD_EN.test(line) || OLD_KO.test(line)) hits.push(`${f}:${i + 1} ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(hits, []);
});

test('파일 이름에 옛 식별자가 없다', () => {
  const bad = files.filter((f) => !/^docs\//.test(f) && f.split('/').some((part) => OLD_EN.test(part)));
  assert.deepEqual(bad, []);
});

test('구 세이브의 옛 키는 새 키로 옮겨지고 플레이어가 쓴 글은 그대로다', async () => {
  const { migrateLegacyKeys, rekeyLegacy } = await import('../src/game/legacyKeys.ts');
  const old = {
    v: 2, stage: 'howlrstone3x2', playerName: 'surt', owned: ['bd_nidhog', 'bd_abudditos', 'weapon_1'],
    accessories: ['bd_fenrir'], starMap: { bd_skoll: 7 }, seen: ['howlBook', 'howlWalk1_2', 'bossIntroSurt'],
    questIdx: { howlrstone1x1: 2, r5: 1 }, huntProg: { 'howlrstone2x3:hw3': 4 }, cosmetics: ['outfit_valkyrie'],
    figures: ['fig_fenrir', 'fig_valk'], cutsceneSeen: ['howlrstone1'], unlockedSets: ['alfheim', 'hel', 'kingdom'],
    monsterKills: { helhound: 3, wolf: 1 }, friends: [{ code: 'x', name: 'gram' }],
  };
  const d = migrateLegacyKeys(structuredClone(old));
  assert.equal(d.stage, 'lilacworld3x2');
  assert.equal(d.playerName, 'surt');
  assert.deepEqual(d.friends, [{ code: 'x', name: 'gram' }]);
  assert.deepEqual(d.owned, ['bd_blackwyrm', 'bd_doomwyrm', 'weapon_1']);
  assert.deepEqual(d.accessories, ['bd_greedwolf']);
  assert.deepEqual(d.starMap, { bd_twinwolf: 7 });
  assert.deepEqual(d.seen, ['lwBook', 'lwWalk1_2', 'bossIntroFlamegiant']);
  assert.deepEqual(d.questIdx, { lilacworld1x1: 2, r5: 1 });
  assert.deepEqual(d.huntProg, { 'lilacworld2x3:hw3': 4 });
  assert.deepEqual(d.cosmetics, ['outfit_wingmaiden']);
  assert.deepEqual(d.figures, ['fig_greedwolf', 'fig_wingmaiden']);
  assert.deepEqual(d.cutsceneSeen, ['lilacworld1']);
  assert.deepEqual(d.unlockedSets, ['fairyglade', 'duskrealm', 'kingdom']);
  assert.deepEqual(d.monsterKills, { duskhound: 3, wolf: 1 });
  /* 이미 새 키인 값과 일반 단어는 그대로 */
  for (const s of ['help', 'helmet', 'shell', 'program', 'lilacworld1x1', 'hw1', 'warden']) assert.equal(rekeyLegacy(s), s);
});

test('세이브 로드 경로가 v3 이전 세이브만 옮기고, 옛 스테이지 키도 해석한다', async () => {
  const { migrateSave, SAVE_VERSION } = await import('../src/game/config.ts');
  const { resolveStage, STAGES } = await import('../src/game/stages.ts');
  assert.ok(SAVE_VERSION >= 3);
  const migrated = migrateSave({ v: 2, stage: 'howlrstone2x1', lv: 1, exp: 0, maxHp: 1, atk: 1, cleared: false, owned: ['bd_gram'] });
  assert.equal(migrated.stage, 'lilacworld2x1');
  assert.deepEqual(migrated.owned, ['bd_warden']);
  assert.equal(migrated.v, SAVE_VERSION);
  assert.ok(STAGES.lilacworld2x1);
  assert.equal(resolveStage('howlrstone4x3'), 'lilacworld4x3');
});

/* 2026-11-16 — 외부 평가 P0 "옛 키와 새 키가 동시에 있으면 데이터가 유실될 수 있다".
 *  종전엔 새 키 값만 남기고 옛 키 값을 버렸고, 목록은 중복 항목이 생겼다. */
test('옛 키와 새 키가 동시에 있어도 장비·강화·진행이 사라지지 않는다', async () => {
  const { migrateLegacyKeys } = await import('../src/game/legacyKeys.ts');
  const mixed = {
    v: 2, stage: 'lilacworld2x1',
    /* 같은 아이템이 옛 키·새 키 두 벌로 존재(이관 중간 상태) */
    owned: ['bd_nidhog', 'bd_blackwyrm', 'weapon_1'],
    /* 강화 수치가 두 키로 갈라져 있다 — 낮은 쪽이 사라지면 강화가 내려간다 */
    starMap: { bd_nidhog: 3, bd_blackwyrm: 7 },
    questIdx: { howlrstone1x1: 2, lilacworld1x1: 5 },
    figures: ['fig_fenrir', 'fig_greedwolf'],
  };
  const d = migrateLegacyKeys(structuredClone(mixed));
  /* 목록은 합집합 + 중복 제거 — 아이템이 두 칸이 되지도, 사라지지도 않는다 */
  assert.deepEqual(d.owned, ['bd_blackwyrm', 'weapon_1']);
  assert.deepEqual(d.figures, ['fig_greedwolf']);
  /* 수치 맵은 큰 값(강화 손실 없음) */
  assert.deepEqual(d.starMap, { bd_blackwyrm: 7 });
  /* 진행 맵도 큰 값(되돌리지 않음) */
  assert.deepEqual(d.questIdx, { lilacworld1x1: 5 });
  /* 옛 키는 남지 않는다 */
  assert.equal(JSON.stringify(d).includes('nidhog'), false);
  assert.equal(JSON.stringify(d).includes('howlrstone'), false);
});

test('옛 키만 있는 구 세이브는 종전과 똑같이 이관된다 (회귀 없음)', async () => {
  const { migrateLegacyKeys } = await import('../src/game/legacyKeys.ts');
  const old = { v: 2, starMap: { bd_nidhog: 12 }, owned: ['bd_nidhog'], questIdx: { howlrstone1x1: 3 } };
  const d = migrateLegacyKeys(structuredClone(old));
  assert.deepEqual(d.starMap, { bd_blackwyrm: 12 });
  assert.deepEqual(d.owned, ['bd_blackwyrm']);
  assert.deepEqual(d.questIdx, { lilacworld1x1: 3 });
});

test('보스 의뢰문 조사가 이름 받침에 맞는다', async () => {
  const { objJosa, STAGES } = await import('../src/game/stages.ts');
  assert.equal(objJosa('재림의 파수꾼'), '재림의 파수꾼을');
  assert.equal(objJosa('재림의 천사기사'), '재림의 천사기사를');
  for (const st of Object.values(STAGES)) for (const q of st.quests ?? []) {
    assert.doesNotMatch(q.desc ?? '', /[을를]를 처치|[가-힣]을을/, `${st.key}: ${q.desc}`);
  }
});
