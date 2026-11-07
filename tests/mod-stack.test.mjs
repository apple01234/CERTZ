/**
 * mod-stack.test.mjs — ModStack 계약 (JENNY FloatModStack 이식 검증)
 *
 * 원본 설계에서 **반드시 지켜져야 하는** 5가지를 고정한다.
 * 하나라도 깨지면 버프 중첩 해제가 어긋나 밸런스가 무너진다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ModStack, ModOp, BASE_UID } from '../src/game/combat/modStack.ts';

test('ModStack — 기본값은 base 이고 아무 bit 도 없다', () => {
  const s = new ModStack(1.0);
  assert.equal(s.value, 1.0);
  assert.equal(s.hasValue, false);
  assert.equal(s.base, 1.0);
});

test('ModStack — MULTIPLY 중첩은 곱이고, 일부 해제가 나머지에 영향 없다', () => {
  const s = new ModStack(1.0);
  /* JENNY 원본이 이 동작을 위해 존재한다: 버프 3개 중 1개만 만료될 때
   * 나머지 2개의 곱이 그대로 남아야 한다. */
  const a = s.addBit(0, 1.5, ModOp.MULTIPLY, 10);
  const b = s.addBit(0, 2.0, ModOp.MULTIPLY, 20);
  const c = s.addBit(0, 1.2, ModOp.MULTIPLY, 30);
  assert.equal(s.value, 1 * 1.5 * 2.0 * 1.2);

  s.removeBit(b);
  assert.equal(s.value, 1 * 1.5 * 1.2, '가운데 버프만 빠져야 한다');
  assert.equal(s.hasValue, true);

  s.removeBit(a);
  s.removeBit(c);
  assert.equal(s.value, 1.0, '전부 해제되면 base 로 복귀');
  assert.equal(s.hasValue, false);
});

test('ModStack — 우선순위 정렬은 결정적이다 (priority → uid)', () => {
  /* MULTIPLY 와 ADD 를 섞으면 **적용 순서가 결과를 바꾼다.**
   * 원본은 priority 오름차순(같으면 uid 오름차순)으로 적용하므로
   * 아래 조합의 결과는 하나로 고정되어야 한다 — 이게 결정성의 핵심이다. */
  const s = new ModStack(0);
  s.addBit(0, 10, ModOp.ADD, 1);
  s.addBit(0, 2, ModOp.MULTIPLY, 2);
  /* base(MULTIPLY 0, priority -Inf) → ADD 10 (priority 1) → MULTIPLY 2 (priority 2)
   *   result = 0 × ... 아니다. base 가 맨 앞에서 곱해진다:
   *   0 (base) → +10 = 10 → ×2 = 20 */
  assert.equal(s.value, 20, 'priority 1(ADD) 다음 priority 2(MULTIPLY)');

  /* 같은 priority 면 **uid 오름차순**. uid100(×2) 이 uid500(+10) 보다 먼저. */
  const t = new ModStack(0);
  t.addBit(500, 10, ModOp.ADD, 1);
  t.addBit(100, 2, ModOp.MULTIPLY, 1);
  /* base(0) → uid100 ×2 → 0 → uid500 +10 → 10 */
  assert.equal(t.value, 10, 'uid 100(×2) 이 먼저, 그다음 +10 → 0×2+10 = 10');

  /* 순서를 뒤집어도 결과가 같아야 "결정적"이다 (같은 priority·같은 uid 집합) */
  const u = new ModStack(0);
  u.addBit(100, 2, ModOp.MULTIPLY, 1);
  u.addBit(500, 10, ModOp.ADD, 1);
  assert.equal(u.value, t.value, '삽입 순서와 무관하게 같은 결과');
});

test('ModStack — 같은 값 재삽입은 캐시를 무효화하지 않는다', () => {
  const s = new ModStack(1.0);
  const id = s.addBit(0, 2, ModOp.MULTIPLY, 0);
  assert.equal(s.value, 2);
  /* 매 프레임 같은 값을 다시 넣는 호출부에서 불필요한 재계산을 막는다. */
  s.addBit(id, 2, ModOp.MULTIPLY, 0);
  assert.equal(s.value, 2);
  /* 값을 바꾸면 반영된다. */
  s.addBit(id, 3, ModOp.MULTIPLY, 0);
  assert.equal(s.value, 3);
});

test('ModStack — base 는 removeBit 으로 지워지지 않는다', () => {
  const s = new ModStack(1.7);
  s.removeBit(BASE_UID);
  assert.equal(s.value, 1.7, 'base 보호');
  s.clear();
  assert.equal(s.value, 1.7, 'clear 후에도 base 유지');
});

test('ModStack — DIVIDE 0 은 0 으로 (원본과 동일)', () => {
  const s = new ModStack(0);
  s.addBit(0, 10, ModOp.ADD, 1);
  s.addBit(0, 0, ModOp.DIVIDE, 2);
  assert.equal(s.value, 0);
});

test('ModStack — SERTZ 용법: 이동속도 배율 스택', () => {
  /* 실제 사용 예 — 기본 1.0 에 가속 버프/감속 디버프가 공존 */
  const speed = new ModStack(1.0);
  const haste = speed.addBit(0, 1.3, ModOp.MULTIPLY, 10);
  const chill = speed.addBit(0, 0.6, ModOp.MULTIPLY, 20);
  assert.equal(Math.round(speed.value * 100) / 100, 0.78, '1.3 × 0.6');
  speed.removeBit(chill);
  assert.equal(Math.round(speed.value * 100) / 100, 1.3, '감속만 풀려도 가속은 남는다');
  speed.removeBit(haste);
  assert.equal(speed.value, 1.0);
});
