/**
 * speed-modstack-equivalence.test.mjs — vc276 회귀 방지
 *
 * Player.recalcSpeed() 를 ModStack 기반으로 바꿨다.
 * **결과값이 종전과 완전히 동일**해야 한다 — 이 테스트가 그걸 고정한다.
 *
 * 종전 식:
 *   speed = round(BASE * (1 + growthPct/100) * buff * sky * slow)
 * 신식:
 *   stack = [1+growthPct/100, buff, sky, slow] 전부 MULTIPLY
 *   speed = round(BASE * stack.value)
 *
 * 두 식이 모든 조합에서 같은지 확인한다. 하나라도 어긋나면 이속 밸런스가 바뀐다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ModStack, ModOp } from '../src/game/combat/modStack.ts';

const BASE_SPEED = 225; // Player.BASE_SPEED

/** 종전 인라인 식 */
function legacySpeed(growthPct, buff, sky, slow) {
  return Math.round(BASE_SPEED * (1 + growthPct / 100) * buff * sky * slow);
}

/** 신식 ModStack 식 — 실제 Player.recalcSpeed() 와 동일하게 base=BASE_SPEED */
function modStackSpeed(growthPct, buff, sky, slow) {
  const s = new ModStack(BASE_SPEED);
  s.clear();
  s.base = BASE_SPEED;
  s.addBit(1, 1 + growthPct / 100, ModOp.MULTIPLY, 10);
  s.addBit(2, buff, ModOp.MULTIPLY, 20);
  s.addBit(3, sky, ModOp.MULTIPLY, 20);
  s.addBit(4, slow, ModOp.MULTIPLY, 20);
  return Math.round(s.value);
}

test('이속 — 종전 식과 ModStack 식이 모든 조합에서 동일하다', () => {
  const growths = [0, 10, 25.5, 60, 75, 100];
  const buffs = [1, 1.25];
  const skys = [1, 1.25, 1.3, 1.4, 1.5, 1.54];
  const slows = [1, 0.55, 0.7, 0.85];
  let cases = 0;
  for (const g of growths) {
    for (const b of buffs) {
      for (const sk of skys) {
        for (const sl of slows) {
          const a = legacySpeed(g, b, sk, sl);
          const c = modStackSpeed(g, b, sk, sl);
          assert.equal(c, a, `growth=${g} buff=${b} sky=${sk} slow=${sl}`);
          cases++;
        }
      }
    }
  }
  assert.ok(cases >= 288, `조합 ${cases}개 검증 (6 growth × 2 buff × 6 sky × 4 slow)`);
});

test('이속 — 실제 게임 값 대조 (민첩 0 · 버프 없음 = 기본 225)', () => {
  assert.equal(modStackSpeed(0, 1, 1, 1), 225);
});

test('이속 — 신속 버프 + 감속 동시 (1.25 × 0.55)', () => {
  const v = modStackSpeed(0, 1, 1.25, 0.55);
  assert.equal(v, Math.round(225 * 1.25 * 0.55));
  assert.equal(v, 155);
});

test('이속 — 민첩 만렙(60%) + 강화 만렙(15%) = 1.75배', () => {
  const v = modStackSpeed(75, 1, 1, 1);
  assert.equal(v, Math.round(225 * 1.75));
  assert.equal(v, 394);
});

test('이속 — clear() 후 재삽입이라 값이 누적되지 않는다', () => {
  const s = new ModStack(1.0);
  /* 1회차 */
  s.clear();
  s.addBit(1, 1.5, ModOp.MULTIPLY, 10);
  assert.equal(s.value, 1.5);
  /* 2회차 — clear 없이 같은 uid 재삽입하면 갱신(누적 아님) */
  s.addBit(1, 2.0, ModOp.MULTIPLY, 10);
  assert.equal(s.value, 2.0, '같은 uid 는 교체된다');
  /* 3회차 — clear 하면 base 만 남는다 */
  s.clear();
  assert.equal(s.value, 1.0);
});
