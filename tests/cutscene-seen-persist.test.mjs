/**
 * vc270 — "한 번 본 컷씬은 맵 이동 후 다시 재생하지 않는다" 회귀 고정.
 *
 * 실제 버그: buildSave 가 `[...seenSet].slice(-160)` 으로 컷신 기록까지 Set 삽입 순서대로
 * 잘라서, 160개를 넘게 본 세이브에서 **오래된 컷신 키가 사라져** 연출이 다시 재생됐다.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSeenList, isCutsceneSeenKey } from '../src/game/cutsceneSeen.ts';

test('컷신 키와 일반 대사 키를 구분한다', () => {
  assert.equal(isCutsceneSeenKey('lilacCut_rea1_lilac00'), true);
  assert.equal(isCutsceneSeenKey('chapter1_intro'), true);
  assert.equal(isCutsceneSeenKey('stageIntro_howlrstone1_2'), true);
  assert.equal(isCutsceneSeenKey('village_npc_lin'), false);
});

test('대사 키가 상한을 넘어도 컷신 키는 하나도 잃지 않는다', () => {
  const cut = Array.from({ length: 40 }, (_, i) => `lilacCut_rea1_c${i}`);
  const dlg = Array.from({ length: 400 }, (_, i) => `talk_${i}`);
  const out = buildSeenList([...cut, ...dlg]);

  for (const k of cut) assert.ok(out.includes(k), `컷신 키가 사라졌다: ${k}`);
  assert.equal(out.filter(isCutsceneSeenKey).length, cut.length);
  // 대사 키는 오래된 것부터 줄어든다(최근 것이 남는다).
  assert.ok(out.includes('talk_399'));
  assert.ok(!out.includes('talk_0'));
});

test('종전 동작(slice(-160))이면 잃었을 케이스를 실제로 막는다', () => {
  // 먼저 컷신을 보고, 그 뒤로 대사만 200개 본 세이브
  const keys = ['lilacCut_rea1_lilac00', ...Array.from({ length: 200 }, (_, i) => `talk_${i}`)];
  const oldWay = [...new Set(keys)].slice(-160);
  assert.ok(!oldWay.includes('lilacCut_rea1_lilac00'), '전제: 종전 방식은 컷신 기록을 버린다');

  const now = buildSeenList(new Set(keys));
  assert.ok(now.includes('lilacCut_rea1_lilac00'), '수정 후에는 컷신 기록이 남아야 한다');
});

test('컷신이 아주 많아도 잘라내지 않는다', () => {
  const cut = Array.from({ length: 500 }, (_, i) => `lilacCut_rea1_x${i}`);
  const out = buildSeenList(cut);
  assert.equal(out.length, 500);
});

test('빈 입력과 중복은 안전하다', () => {
  assert.deepEqual(buildSeenList([]), []);
  const out = buildSeenList(['lilacCut_a', 'lilacCut_a', 'talk']);
  assert.equal(out.filter((k) => k === 'lilacCut_a').length, 1);
});
