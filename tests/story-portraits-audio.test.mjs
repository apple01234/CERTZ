// node --experimental-strip-types tests/story-portraits-audio.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { CHAPTERS, STAGES, NEXT_STAGE, PREV_STAGE, STORY_SEQUENCE, STORY_SEQUENCE_LABEL } from '../src/game/stages.ts';
import { stageTrack, BGM_ALL_TRACKS, HUNT_THEME_OF, REBIRTH_THEME_OF } from '../src/game/audio.ts';
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const oldSrc = execFileSync('git', ['show', 'HEAD:src/game/stages.ts'], { encoding: 'utf8' });
const before = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(oldSrc)).toString('base64')}`);
assert.deepEqual(CHAPTERS, before.CHAPTERS, '기존 챕터/인덱스/대사/밸런스 보존');
/* vc231 — 영프 편 50필드가 추가됐다. 계약의 본질은 "기존 저장키/순서가 그대로"이므로
 * 신규 키 집합을 명시적으로 열거해 고정하고, 기존 키는 전부 그대로인지 본다. */
const HW_KEYS = [];
for (const n of [1, 2, 3, 4, 5]) {
  for (let sub = 1; sub <= 10; sub++) HW_KEYS.push(`howlrstone${n}${sub}`);
}
assert.deepEqual(
  NEXT_STAGE,
  {
    ...before.NEXT_STAGE,
    youngprincessv: 'howlrstone11',
    ...Object.fromEntries(HW_KEYS.map((k, i) => [k, i < HW_KEYS.length - 1 ? HW_KEYS[i + 1] : 'dlcstargate1'])),
  },
  '진행 저장키 보존 (신규 영프 마을 + 영프 편 50필드만 추가)',
);
assert.deepEqual(
  PREV_STAGE,
  {
    ...before.PREV_STAGE,
    youngprincessv: 'village',
    dlcstargatev: 'youngprincessv',
    ...Object.fromEntries(HW_KEYS.map((k, i) => [k, i === 0 ? 'youngprincessv' : HW_KEYS[i - 1]])),
  },
  '복귀 저장키 보존 (신규 영프 편 50필드 경유)',
);
const oldKeys = Object.keys(before.STAGES), newKeys = Object.keys(STAGES);
/* youngprincessv 는 vc230 에서 이미 추가됐으므로 신규분은 영프 편 50필드뿐이다. */
assert.deepEqual(newKeys.filter(k => !oldKeys.includes(k)).sort(), HW_KEYS.sort(), '신규 스테이지 = 영프 편 50필드 (영프 마을은 vc230 기존분)');
assert.ok(oldKeys.every(k => newKeys.includes(k)), '기존 스테이지 키 전부 유지');
assert.equal(CHAPTERS.filter(c => !c.dlc).length, 9);
assert.deepEqual(CHAPTERS.filter(c => !c.dlc).map(c => c.num), [2,3,4,5,6,7,8,9,10]);
assert.equal(STAGES.village.name, '제1장 미드가르드');
assert.equal(STORY_SEQUENCE[1].status, 'implemented', 'vc231 — 영프 편 콘텐츠 투입');
assert.equal(STORY_SEQUENCE_LABEL, '아뜰란티스 기반 스토리 1~10챕터 → 하울르스톤: 영준 프린세스(1기 15화) → 그랜드 플레닛');
const tracks = new Set(BGM_ALL_TRACKS);
let stages = 0;
for (const ch of CHAPTERS) {
  for (let n = 1; n <= 10; n++) {
    const track = stageTrack(`${ch.key}${n}`);
    tracks.add(track); stages++;
    const theme = HUNT_THEME_OF[ch.key] ?? ch.key;
    assert.equal(track, n === 10 ? `bgm_${theme}_boss` : `bgm_${theme}_${Math.ceil(n/3)}`);
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
assert.ok(ui.includes('{STORY_SEQUENCE_LABEL}'));
// 검사 역검증: 존재하지 않는 음원은 반드시 실패한다(실제 파일/작업트리 변조 없음).
assert.throws(() => fs.readFileSync(new URL('../public/assets/audio/__missing_contract_probe__.ogg', import.meta.url)));
execFileSync('python3', ['tools/crop_npc_portraits.py', '--check'], { stdio: 'inherit' });
console.log(`ALL CHECKS PASS: ${stages} hunt stages / ${tracks.size} real Ogg tracks / ${Object.keys(map).length} portrait mappings; chapter/save order unchanged`);
