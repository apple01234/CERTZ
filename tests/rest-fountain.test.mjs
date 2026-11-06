import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/* 하루 v2 — 보스 구역 치유의 샘 (참고작의 보스 뒤 분수방 아이디어).
 * WorldScene 은 Phaser 없이 import 할 수 없어서 소스 계약으로 고정한다. */
const src = fs.readFileSync(new URL('../src/game/scenes/WorldScene.ts', import.meta.url), 'utf8');
const body = name => {
  const start = src.indexOf(`private ${name}(`);
  assert.ok(start >= 0, `${name} 가 있어야 한다`);
  const next = src.indexOf('\n  /**', start);
  return src.slice(start, next > 0 ? next : start + 4000);
};

test('차원문이 열릴 때 치유의 샘 생성을 시도한다 (silent 복원 포함)', () => {
  assert.match(body('activatePortal'), /this\.spawnRestFountain\(silent\)/);
});

test('샘은 보스 구역에서만, 마을 우물과 중복 없이, 개방 셀에만 생성된다', () => {
  const fn = body('spawnRestFountain');
  assert.match(fn, /!this\.stageDef\.boss/);
  assert.match(fn, /this\.stageDef\.isVillage/);
  assert.match(fn, /this\.wellPos/);
  assert.match(fn, /this\.inOpenArea\(/);
  assert.doesNotMatch(fn, /solidGroup/, '샘은 충돌 없는 장식이어야 한다(벽·길막 방지)');
});

test('근접 회복은 마을 전용이 아니라 wellPos 가 있으면 동작한다(쿨다운 유지)', () => {
  assert.match(src, /if \(this\.wellPos && this\.wellCd <= 0\) \{/);
  assert.match(src, /this\.wellCd = 8000;/);
  assert.match(src, /this\.wellPos = null;/, 'init 에서 스테이지마다 초기화');
});
