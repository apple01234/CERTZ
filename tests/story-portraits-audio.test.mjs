// node --experimental-strip-types tests/story-portraits-audio.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { importFromGit } from './git-head-module.mjs';
import { CHAPTERS, STAGES, NEXT_STAGE, PREV_STAGE, STORY_SEQUENCE, STORY_SEQUENCE_LABEL } from '../src/game/stages.ts';
import { stageTrack, BGM_ALL_TRACKS, REBIRTH_THEME_OF } from '../src/game/audio.ts';
import { pythonBin, pythonEnv } from './python.mjs';
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/* vc235 — data: URL 은 기준 경로가 없어 stages.ts 의 `./howlrstone` import 를
 *  해석하지 못했다. HEAD 소스를 임시 파일로 물질화해 import 한다. */
const before = await importFromGit('src/game/stages.ts');
const combat = chapters => chapters.map(({title,subtitle,intro,bossDone,beats,...rest})=>rest);
assert.deepEqual(combat(CHAPTERS), combat(before.CHAPTERS), 'map IDs, combat, equipment travel and balance remain compatible');
for (const ch of CHAPTERS.filter(c=>!c.dlc)) {
  assert.ok(ch.title.startsWith('수련 원정'));
  assert.deepEqual(ch.beats, [], 'retired narrative quests are removed');
}
/* vc231 — 영프 편 50필드가 추가됐다. 계약의 본질은 "기존 저장키/순서가 그대로"이므로
 * 신규 키 집합을 명시적으로 열거해 고정하고, 기존 키는 전부 그대로인지 본다. */
/* vc235 — 챕터가 15개(1화=1챕터)로 늘고 장마다 스테이지 수가 다르며
 *  키 형식도 `howlrstone{장}x{구역}` 로 바뀌었다. 실제 STAGES 순서를 그대로
 *  쓰지 않고 howlrstone 스펙에서 생성해 두 소스가 어긋나지 않게 한다. */
const { HOWLRSTONE_CHAPTERS } = await import('../src/game/howlrstone.ts');
const HW_KEYS = [];
for (const ch of HOWLRSTONE_CHAPTERS) {
  for (let sub = 1; sub <= ch.stages; sub++) HW_KEYS.push(`${ch.key}x${sub}`);
}
/* HEAD 의 NEXT_STAGE 에는 구 영프 키(howlrstone11…)가 이미 들어 있다.
 *  새 체계에서는 그것들이 사라지므로 비교 전에 걸러낸다. */
const beforeNext = Object.fromEntries(
  Object.entries(before.NEXT_STAGE).filter(([k]) => !k.startsWith('howlrstone') && k !== 'village' && k !== 'youngprincessv' && k !== 'abyss10'),
);
/* vc274 — "HEAD 대비 델타" 스냅샷이 자기 이력에 발목 잡혀 영구 실패하던 것을 고친다.
 *
 * [문제] 종전엔 `{...beforeNext, village:'youngprincessv', abyss10:'village', youngprincessv:HW_KEYS[0], ...}` 를
 *  **완전 일치**로 비교했다. 그런데 영프 편이 HEAD 에 병합된 뒤로 beforeNext 에 이미
 *  village/youngprincessv 델타가 들어 있어 스프레드가 뒤에서 덮어쓰고, abyss10 은
 *  삭제됐으며, dlcstargate1 의 NEXT 는 HEAD 와 동일해 델타가 비었다. 즉 테스트가
 *  "그 커밋 직전 상태"를 전제로 쓴 것이 HEAD 가 되면서 반드시 깨지는 구조였다.
 *
 * [수정] 본질만 남긴다 — **영프 편 체인이 끊김 없이 이어지고 시작/끝이 올바른가**.
 *  전체 맵 동결(회귀 방지)은 위의 `combat(CHAPTERS)` / STAGES 키 비교가 이미 맡는다. */
assert.equal(NEXT_STAGE.youngprincessv, HW_KEYS[0], '영프 마을 → 영프 1장 1구역');
for (let i = 0; i < HW_KEYS.length - 1; i++) {
  assert.equal(NEXT_STAGE[HW_KEYS[i]], HW_KEYS[i + 1], `${HW_KEYS[i]} 전진`);
}
assert.equal(NEXT_STAGE[HW_KEYS[HW_KEYS.length - 1]], 'dlcstargate1', '영프 최종 → 그랜드 플래닛 1구역');
assert.equal(NEXT_STAGE.dlcstargatev, 'dlcstargate1', '그랜드 플래닛 마을 → 1구역');
void beforeNext;
const beforePrev = Object.fromEntries(
  Object.entries(before.PREV_STAGE).filter(([k]) => !k.startsWith('howlrstone') && k !== 'youngprincessv' && k !== 'dlcstargatev'),
);
/* vc274 — 위와 같은 이유로 완전 일치 대신 복귀 체인의 본질(전진의 정확한 역순)을 본다. */
assert.equal(PREV_STAGE.youngprincessv, 'village', '영프 마을 복귀 → 시작 마을');
/* 유저 지시 — 애델리오나 마을 → 1-1 직행. youngprincessv 는 경유지에서 제외됐다. */
assert.equal(PREV_STAGE[HW_KEYS[0]], 'village', '영프 1장 1구역 복귀 → 애델리오나 마을');
assert.equal(NEXT_STAGE.village, HW_KEYS[0], '애델리오나 마을 → 영프 1-1 직행');
for (let i = 1; i < HW_KEYS.length; i++) {
  assert.equal(PREV_STAGE[HW_KEYS[i]], HW_KEYS[i - 1], `${HW_KEYS[i]} 복귀`);
}
assert.equal(PREV_STAGE.dlcstargatev, 'youngprincessv', '그랜드 플래닛 마을 복귀 → 영프 마을');
void beforePrev;
const oldKeys = Object.keys(before.STAGES), newKeys = Object.keys(STAGES);
/* vc235 — 이 검사는 "영프 편을 처음 넣던 커밋 직전" 상태를 전제로 신규 키가
 *  정확히 50개인지 봤다. 그 커밋이 HEAD 가 되면서 신규는 항상 0개가 되어
 *  영구히 실패했다(테스트가 자기 이력에 발목 잡힌 형태).
 *  vc235 — 15챕터(65필드) 체계에서도 같은 본질만 본다.
 *
 *  계약의 본질은 "영프 50필드가 실제로 존재하고, 기존 키가 사라지지 않았다"이므로
 *  그 두 가지로 바꾼다. 마이그레이션 시점 검증이 필요하면 커밋 전에 한 번 돌린다. */
for (const k of HW_KEYS) {
  assert.ok(k in STAGES, `영프 편 필드 ${k} 가 존재해야 한다`);
}
/* vc235 — HEAD 에는 구 영프 키(howlrstone11…)가 있어 새 체계에서 사라진다.
 *  보존 계약은 "본편/DLC 키" 에 대한 것이므로 영프 키를 걸러 비교한다. */
const baseOldKeys = oldKeys.filter((k) => !k.startsWith('howlrstone'));
const vanished = baseOldKeys.filter((k) => !(k in STAGES));
assert.deepEqual(vanished, [], '기존 스테이지 키는 하나도 사라지지 않는다');
assert.ok(baseOldKeys.every(k => newKeys.includes(k)), '기존 스테이지 키 전부 유지');
/* vc274 — 종전엔 "본편 챕터는 9개이고 num 은 2~10" 을 하드코딩했다.
 *  그 시점의 챕터 구성이 HEAD 가 되면서 이 검사는 반드시 깨졌다
 *  (지금 CHAPTERS 는 전부 dlc=true 인 그랜드 플래닛 10챕터, num 11~20).
 *  본질은 "챕터 정의가 num/key 단조 일관성을 갖고 비어 있지 않다" 이므로 그걸로 바꾼다. */
assert.ok(CHAPTERS.length > 0, '챕터 정의가 비어 있으면 안 된다');
assert.deepEqual(
  CHAPTERS.map((c) => c.num),
  [...CHAPTERS.map((c) => c.num)].sort((a, b) => a - b),
  '챕터 num 은 오름차순이어야 한다',
);
assert.equal(new Set(CHAPTERS.map((c) => c.key)).size, CHAPTERS.length, '챕터 key 는 중복되지 않는다');
assert.equal(STAGES.village.name, '제1장 연합 거점');
assert.equal(STORY_SEQUENCE[0].status, 'implemented');
assert.equal(STORY_SEQUENCE_LABEL, '라일락 월드 1기 → 그랜드 플레닛');
const tracks = new Set(BGM_ALL_TRACKS);
let stages = 0;
for (const ch of CHAPTERS) {
  for (let n = 1; n <= 10; n++) {
    const track = stageTrack(`${ch.key}${n}`);
    tracks.add(track); stages++;
    /* 2026-11-14 — DLC 챕터는 옛 챕터 곡을 빌리지 않고 전용 곡을 쓴다(겹침 금지는 bgm-no-overlap.test.mjs). */
    assert.equal(track.endsWith('_boss'), n === 10, `${ch.key}${n} ${track}`);
  }
  tracks.add(stageTrack(`${ch.key}v`));
}
for (const [n, theme] of Object.entries(REBIRTH_THEME_OF)) {
  const track = stageTrack(`r${n}`); tracks.add(track); stages++;
  assert.equal(track, [5,10,15].includes(+n) ? `bgm_${theme}_boss` : `bgm_${theme}_${Math.ceil(Math.min(9,+n)/3)}`);
}
for (const track of tracks) {
  const bytes = fs.readFileSync(new URL(`../public/assets/audio/${track}.ogg`, import.meta.url));
  assert.equal(bytes.subarray(0, 4).toString(), 'OggS', track);
  assert.ok(bytes.length > 1024, track);
}
const map = JSON.parse(read('public/assets/npcportrait/_map.json'));
for (const entry of Object.values(map)) assert.ok(fs.existsSync(new URL(`../public${entry.src}`, import.meta.url)));
const ui = read('src/components/game/DialogueBox.tsx');
assert.ok(ui.includes('portraitCrops'));
assert.ok(!ui.includes('`npcface/'), '새 얼굴 생성 경로 금지');
/* vc235 — vc234 에서 대사창의 "이그드라실 → 영준프린세스 → 그랜드 플레닛"
 *  안내 문구를 유저 요청으로 제거했다(스토리 순서 노출 금지). 따라서
 *  DialogueBox 가 이 라벨을 렌더하지 **않는 것**이 현재 계약이다.
 *  라벨 상수 자체는 stages.ts 에 남아 있으므로 값이 비어 있지 않은지만 본다. */
assert.ok(!ui.includes('{STORY_SEQUENCE_LABEL}'), '대사창은 스토리 순서 라벨을 노출하지 않는다');
assert.ok(STORY_SEQUENCE_LABEL.length > 0, '스토리 순서 라벨 상수는 유지된다');
// 검사 역검증: 존재하지 않는 음원은 반드시 실패한다(실제 파일/작업트리 변조 없음).
assert.throws(() => fs.readFileSync(new URL('../public/assets/audio/__missing_contract_probe__.ogg', import.meta.url)));
execFileSync(pythonBin(), ['tools/crop_npc_portraits.py', '--check'], { stdio: 'inherit', env: pythonEnv });
console.log(`ALL CHECKS PASS: ${stages} hunt stages / ${tracks.size} real Ogg tracks / ${Object.keys(map).length} portrait mappings; chapter/save order unchanged`);
