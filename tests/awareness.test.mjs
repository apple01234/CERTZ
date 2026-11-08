/**
 * awareness.test.mjs — 시야/인지 시스템 계약 (JENNY AwarenessTrait 이식 검증)
 *
 * 원본 JENNY 가 지키는 핵심 3가지를 고정한다:
 *   ① visible 과 trueVisible 의 구분 (시야에서 사라져도 유예 시간 동안은 "안다")
 *   ② lastKnownPosition 으로 추격이 이어진다 (벽 하나로 즉시 포기하지 않는다)
 *   ③ active 선택에 확률 분산 (0.75 최근접)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  makeEntry, updateEntry, chaseTarget, shouldDisengage, pickActive,
} from '../src/game/ai/awareness.ts';

const OMNISCIENT = 1000; // 원본 기본 1.0초

test('시야 — 반경 안이고 가려짐 없으면 trueVisible', () => {
  const e = makeEntry();
  updateEntry(e, { x: 0, y: 0, tx: 100, ty: 0, range: 300 }, 1000, OMNISCIENT);
  assert.equal(e.trueVisible, true);
  assert.equal(e.visible, true);
  assert.deepEqual(e.lastKnownPosition, { x: 100, y: 0 });
  assert.deepEqual(e.lastKnownVisiblePosition, { x: 100, y: 0 });
});

test('시야 — 벽에 가려지면 trueVisible 은 false 지만 유예 시간 동안 visible 은 true', () => {
  /* 이게 JENNY 이식의 핵심 이득이다.
   * 종전 SERTZ 는 거리만 봐서 벽을 무시했고,
   * 단순히 "안 보이면 즉시 포기"로 바꾸면 벽 하나에 추격이 끊긴다. */
  const e = makeEntry();
  const visibleQ = { x: 0, y: 0, tx: 100, ty: 0, range: 300 };
  updateEntry(e, visibleQ, 1000, OMNISCIENT);
  assert.equal(e.trueVisible, true);

  // 500ms 뒤 — 벽 뒤로 숨음
  const blockedQ = { ...visibleQ, blocked: () => true };
  updateEntry(e, blockedQ, 1500, OMNISCIENT);
  assert.equal(e.trueVisible, false, '실제로는 안 보인다');
  assert.equal(e.visible, true, '아직 안다 (유예 1초 이내)');
  assert.deepEqual(e.lastKnownPosition, { x: 100, y: 0 }, '마지막 목격 위치 유지');
});

test('시야 — 유예 시간이 지나면 완전히 잊는다', () => {
  const e = makeEntry();
  updateEntry(e, { x: 0, y: 0, tx: 100, ty: 0, range: 300 }, 1000, OMNISCIENT);
  const blockedQ = { x: 0, y: 0, tx: 100, ty: 0, range: 300, blocked: () => true };
  updateEntry(e, blockedQ, 1500, OMNISCIENT);
  assert.equal(e.visible, true);
  // 유예(1000ms) 초과
  updateEntry(e, blockedQ, 2200, OMNISCIENT);
  assert.equal(e.visible, false, '유예 초과 → 잊는다');
  assert.equal(e.trueVisible, false);
});

test('시야 — 반경 밖이면 보이지 않는다', () => {
  const e = makeEntry();
  updateEntry(e, { x: 0, y: 0, tx: 500, ty: 0, range: 300 }, 1000, OMNISCIENT);
  assert.equal(e.trueVisible, false);
  assert.equal(e.visible, false);
  assert.equal(e.inRange, false);
});

test('시야 — alwaysChase 면 거리/시야 무시 (보스)', () => {
  const e = makeEntry();
  updateEntry(e, { x: 0, y: 0, tx: 9999, ty: 0, range: 300 }, 1000, OMNISCIENT, true);
  assert.equal(e.visible, true);
});

test('추격 목표 — 보이면 대상, 안 보이면 마지막 목격 지점', () => {
  const e = makeEntry();
  const q = { x: 0, y: 0, tx: 100, ty: 0, range: 300 };
  updateEntry(e, q, 1000, OMNISCIENT);
  assert.deepEqual(chaseTarget(e, q), { x: 100, y: 0 }, '보일 때는 실제 위치');

  const moved = { x: 0, y: 0, tx: 250, ty: 80, range: 300, blocked: () => true };
  updateEntry(e, moved, 1200, OMNISCIENT);
  assert.equal(e.trueVisible, false);
  /* 원본 update_awareness 는 안 보여도 유예 시간 안이면 last_known_position 을
   * 현재 위치로 갱신한다(마지막 목격이 아니라 "안다고 믿는 위치").
   * 이 차이가 중요하다 — 아래 주석 참조. */
  assert.deepEqual(chaseTarget(e, moved), { x: 250, y: 80 });
});

test('추격 포기 — 유예 초과 + 이탈 거리 밖이면 놓아준다', () => {
  const e = makeEntry();
  updateEntry(e, { x: 0, y: 0, tx: 100, ty: 0, range: 300 }, 1000, OMNISCIENT);
  const blockedQ = { x: 0, y: 0, tx: 900, ty: 0, range: 300, blocked: () => true };
  updateEntry(e, blockedQ, 1200, OMNISCIENT);
  assert.equal(e.visible, true, '아직 유예 중');
  assert.equal(shouldDisengage(e, blockedQ, 500), false);

  updateEntry(e, blockedQ, 3000, OMNISCIENT);
  assert.equal(e.visible, false, '유예 초과');
  assert.equal(shouldDisengage(e, blockedQ, 500), true, '이탈 거리(500) 밖 → 포기');
});

test('활성 대상 선택 — 최근접 확률 0.75 를 지킨다', () => {
  const from = { x: 0, y: 0 };
  const cands = [
    { x: 100, y: 0, id: 'near' },
    { x: 500, y: 0, id: 'mid' },
    { x: 900, y: 0, id: 'far' },
  ];
  /* rnd < 0.75 → 최근접 */
  assert.equal(pickActive(cands, from, () => 0.1)?.id, 'near');
  assert.equal(pickActive(cands, from, () => 0.74)?.id, 'near');
  /* rnd >= 0.75 → 무작위. 0.75 → index floor(0.75*3)=2 → far */
  assert.equal(pickActive(cands, from, () => 0.75)?.id, 'far');
  assert.equal(pickActive(cands, from, () => 0.99)?.id, 'far');
});

test('활성 대상 선택 — 후보 0/1개 경계', () => {
  assert.equal(pickActive([], { x: 0, y: 0 }, () => 0.5), null);
  const one = [{ x: 10, y: 10 }];
  assert.equal(pickActive(one, { x: 0, y: 0 }, () => 0.9), one[0]);
});

test('시야 — 거리 경계값 (range 와 정확히 같으면 보인다)', () => {
  const e = makeEntry();
  updateEntry(e, { x: 0, y: 0, tx: 300, ty: 0, range: 300 }, 1000, OMNISCIENT);
  assert.equal(e.trueVisible, true, 'dist == range 는 이내로 취급');
  const e2 = makeEntry();
  updateEntry(e2, { x: 0, y: 0, tx: 301, ty: 0, range: 300 }, 1000, OMNISCIENT);
  assert.equal(e2.trueVisible, false);
});
