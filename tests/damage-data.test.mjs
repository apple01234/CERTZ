/**
 * damage-data.test.mjs — DamageData 파이프라인 계약 (JENNY HealthTrait 이식 검증)
 *
 * 원본 JENNY 가 지키는 4가지를 고정한다:
 *   ① 원본값(originalDamage) 보존
 *   ② 가해자→대상 방향 자동 계산 (이미 있으면 덮지 않음)
 *   ③ 배율 적용 순서 고정 + 최소 1 보장
 *   ④ 순수 피해(pure)는 배율을 무시
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  makeDamage, ensureDirection, resolveDamage, applyDamage, DamageType,
} from '../src/game/combat/damageData.ts';

test('makeDamage — 원본값이 보존되고 기본값이 한 곳에서 정해진다', () => {
  const d = makeDamage(100, { x: 0, y: 0 });
  assert.equal(d.damage, 100);
  assert.equal(d.originalDamage, 100, '원본값 보존 — JENNY 핵심 설계');
  assert.equal(d.hurtAmount, 0);
  assert.equal(d.dying, false);
  assert.equal(d.damageType, DamageType.NORMAL);
  assert.equal(d.instakill, false);
  assert.equal(d.pure, false);
});

test('ensureDirection — 가해자→대상 단위벡터를 자동 계산한다', () => {
  const d = makeDamage(10, { x: 0, y: 0 });
  d.targetPos = { x: 3, y: 4 };
  ensureDirection(d);
  assert.ok(d.direction);
  assert.equal(Math.round(d.direction.x * 100) / 100, 0.6);
  assert.equal(Math.round(d.direction.y * 100) / 100, 0.8);
});

test('ensureDirection — 이미 방향이 있으면 덮어쓰지 않는다', () => {
  const d = makeDamage(10, { x: 0, y: 0 });
  d.targetPos = { x: 3, y: 4 };
  d.direction = { x: 1, y: 0 };
  ensureDirection(d);
  assert.deepEqual(d.direction, { x: 1, y: 0 }, '호출부가 준 방향이 우선');
});

test('ensureDirection — 같은 좌표면 방향을 만들지 않는다 (0 나눗셈 방지)', () => {
  const d = makeDamage(10, { x: 5, y: 5 });
  d.targetPos = { x: 5, y: 5 };
  ensureDirection(d);
  assert.equal(d.direction, null);
});

test('resolveDamage — 배율이 순서대로 적용되고 최소 1 이 보장된다', () => {
  const d = makeDamage(100);
  /* 원소 -15% → 85, 방어 0.8 → 68, 받는피해 +50% → 102 */
  const out = resolveDamage(d, { element: 0.85, defense: 0.8, received: 1.5 });
  assert.equal(out, 102);
  assert.equal(d.damage, 102, '계산 결과가 객체에 반영된다');
  assert.equal(d.originalDamage, 100, '원본값은 그대로');
});

test('resolveDamage — 방어력이 공격력을 넘어도 최소 1 (무적 벽 방지)', () => {
  const d = makeDamage(3);
  const out = resolveDamage(d, { defense: 0.01 });
  assert.equal(out, 1);
});

test('resolveDamage — pure 피해는 배율을 무시한다', () => {
  const d = makeDamage(50);
  d.pure = true;
  const out = resolveDamage(d, { element: 2, defense: 0.1 });
  assert.equal(out, 50, '순수 피해는 저항을 관통');
});

test('resolveDamage — instakill 은 최대값', () => {
  const d = makeDamage(10);
  d.instakill = true;
  const out = resolveDamage(d, { defense: 0.5 });
  assert.equal(out, Number.MAX_SAFE_INTEGER);
});

test('applyDamage — 실제 체력에서 깎고 hurtAmount 를 채운다', () => {
  const d = makeDamage(30);
  const r = applyDamage(d, 100, 100);
  assert.equal(r.health, 70);
  assert.equal(r.died, false);
  assert.equal(d.hurtAmount, 30);
});

test('applyDamage — 체력보다 큰 피해는 체력까지만 (음수 방지)', () => {
  const d = makeDamage(500);
  const r = applyDamage(d, 40, 100);
  assert.equal(r.health, 0);
  assert.equal(r.died, true);
  assert.equal(d.hurtAmount, 40, '실제로 깎인 양은 체력만큼');
});

test('applyDamage — 무적이면 피해 0, prevented 표시', () => {
  const d = makeDamage(50);
  const r = applyDamage(d, 100, 100, { invulnerable: true });
  assert.equal(r.health, 100);
  assert.equal(r.died, false);
  assert.equal(d.prevented, true);
  assert.equal(d.hurtAmount, 0);
});

test('applyDamage — immortal 이면 죽지 않는다 (치트/연출)', () => {
  const d = makeDamage(9999);
  const r = applyDamage(d, 10, 100, { immortal: true });
  assert.equal(r.died, false);
});

test('applyDamage — noKill 이면 체력을 1 로 붙잡는다 (JENNY no_kill_groups)', () => {
  const d = makeDamage(9999);
  const r = applyDamage(d, 10, 100, { noKill: true });
  assert.equal(r.health, 1);
  assert.equal(r.died, false);
  assert.equal(d.dying, false);
});

test('파이프라인 전체 — 원소 상성 → 방어 → 적용 (SERTZ Enemy 흐름 재현)', () => {
  /* SERTZ Enemy.takeDamage 가 인라인으로 하던 계산을 파이프라인으로 표현.
   * 같은 입력이면 같은 결과가 나와야 한다(회귀 방지). */
  const d = makeDamage(200, { x: 0, y: 0 });
  d.targetPos = { x: 1, y: 0 };
  d.damageType = DamageType.FIRE;
  ensureDirection(d);
  assert.deepEqual(d.direction, { x: 1, y: 0 });

  const dealt = resolveDamage(d, { element: 1.25, defense: 0.9 });  // 200 *1.25 =250 *0.9 =225
  assert.equal(dealt, 225);
  const r = applyDamage(d, 1000, 1000);
  assert.equal(r.health, 775);
  assert.equal(d.hurtAmount, 225);
  assert.equal(d.dying, false);
});
