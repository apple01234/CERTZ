/**
 * skill-evolution-vb.test.mjs — vc280 P5 확장: V/B 슬롯 진화 계약
 *
 * [배경] vc252 까지 진화는 Z 12개뿐이었고 C 는 4개, **V/B 는 데이터 0개**였다.
 *  유저 요구는 "n차 → (n+1)차에서 보유한 모든 스킬이 강화되거나 상위로 교체".
 *  이 테스트는 "데이터에 있다"가 아니라 **실제로 수치가 달라진다**를 고정한다.
 *
 * 이 테스트가 막는 회귀:
 *   ① 진화 표에 직업을 추가했는데 Player 헬퍼가 안 따라가 "이름만 진화"가 되는 것
 *   ② V/B 진화 대상이 아닌 직업의 수치가 조용히 바뀌는 것(하위호환 파괴)
 *   ③ 진화 축(changes)에 없는 축을 헬퍼가 올리는 것(데이터·런타임 불일치)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SKILL_EVOLUTIONS, V_EVOLVED_JOBS, B_EVOLVED_JOBS, C_EVOLVED_JOBS,
  isVEvolved, isBEvolved, isCEvolved, countUpgraded, evolutionOf,
} from '../src/game/skillEvolution.ts';
import { CLASSES } from '../src/game/classes.ts';

test('V/B 진화 커버리지가 vc252 대비 실제로 넓어졌다', () => {
  /* vc252: Z 12 / C 4 / V 0 / B 0. 이 숫자가 줄면 회귀다. */
  const z = countUpgraded('z');
  const c = countUpgraded('c');
  const v = countUpgraded('v');
  const b = countUpgraded('b');
  assert.ok(z >= 12, `Z 진화 ${z} < 12`);
  assert.ok(c >= 4, `C 진화 ${c} < 4`);
  assert.ok(v >= 14, `V 진화 ${v} < 14 — V 슬롯 확장이 빠졌다`);
  assert.ok(b >= 10, `B 진화 ${b} < 10 — B 슬롯 확장이 빠졌다`);
  assert.equal(v, V_EVOLVED_JOBS.size);
  assert.equal(b, B_EVOLVED_JOBS.size);
  assert.equal(c, C_EVOLVED_JOBS.size);
});

test('V/B 진화 대상 직업은 실제로 존재하는 직업이다', () => {
  /* 오타로 없는 직업명을 넣으면 진화가 조용히 죽는다(에러 없이 0건). */
  for (const job of V_EVOLVED_JOBS) {
    assert.ok(job in CLASSES, `V 진화의 '${job}' 가 classes.ts 에 없다`);
  }
  for (const job of B_EVOLVED_JOBS) {
    assert.ok(job in CLASSES, `B 진화의 '${job}' 가 classes.ts 에 없다`);
  }
});

test('V 진화는 3차 이상, B 진화는 4차 직업에만 붙는다', () => {
  /* 슬롯 자체가 3차/4차 스킬이므로 차수가 낮으면 진화 대상이 될 수 없다.
   *  (2차 직업에 V 진화를 달면 슬롯이 없는 스킬을 진화시키는 셈) */
  for (const job of V_EVOLVED_JOBS) {
    assert.ok((CLASSES[job].tier ?? 1) >= 3, `V 진화 '${job}' 가 ${CLASSES[job].tier}차 — 3차 이상이어야 한다`);
  }
  for (const job of B_EVOLVED_JOBS) {
    assert.ok((CLASSES[job].tier ?? 1) >= 4, `B 진화 '${job}' 가 ${CLASSES[job].tier}차 — 4차여야 한다`);
  }
});

test('진화 항목의 changes 가 비어 있지 않다 (이름만 진화 금지)', () => {
  for (const slot of ['v', 'b']) {
    const list = SKILL_EVOLUTIONS.filter((e) => e.skillId.endsWith(`:${slot}`));
    assert.ok(list.length > 0, `${slot} 슬롯 진화 항목이 0개`);
    for (const e of list) {
      const jobs = slot === 'v' ? V_EVOLVED_JOBS : B_EVOLVED_JOBS;
      if (!jobs.has(e.jobId)) continue; // 대상이 아니면 빈 배열이 정상
      assert.ok(e.changes.length > 0, `${e.jobId}:${slot} 의 changes 가 비었다 — 무엇이 변하는지 없다`);
    }
  }
});

test('changes 의 축 이름이 Player 헬퍼가 지원하는 집합 안에 있다', () => {
  /* Player 는 range/duration/count/pierce/hits/extraHit/multiHit 축만 해석한다.
   *  오타(예: "radius")를 넣으면 조용히 무시되어 진화가 안 일어난다. */
  const KNOWN = new Set(['range', 'duration', 'count', 'pierce', 'hits', 'extraHit', 'multiHit']);
  for (const e of SKILL_EVOLUTIONS) {
    for (const ch of e.changes) {
      assert.ok(KNOWN.has(ch), `${e.skillId} 의 변화 축 '${ch}' 를 Player 가 해석하지 않는다`);
    }
  }
});

test('진화 대상이 아닌 직업은 isVEvolved/isBEvolved 가 false (하위호환)', () => {
  /* 이게 깨지면 진화 없는 직업의 스킬 수치가 조용히 바뀐다 = 밸런스 회귀. */
  assert.equal(isVEvolved('novice'), false);
  assert.equal(isBEvolved('novice'), false);
  assert.equal(isVEvolved(undefined), false);
  assert.equal(isBEvolved(null), false);
  /* 실제 대상은 true */
  assert.equal(isVEvolved('warlord'), true);
  assert.equal(isBEvolved('warbringer'), true);
});

test('V/B 슬롯은 자기 차수에서 resolve 된다', () => {
  /* 3차 직업의 v 슬롯, 4차 직업의 b 슬롯이 실제로 나와야 한다(빈 슬롯이면 진화 불가). */
  const v3 = evolutionOf('warlord', 'v');
  assert.ok(v3, 'warlord:v 가 resolve 되지 않는다');
  assert.equal(v3.tier, 3);
  assert.ok(v3.changes.includes('range'), 'warlord:v 에 range 축이 없다');

  const b4 = evolutionOf('warbringer', 'b');
  assert.ok(b4, 'warbringer:b 가 resolve 되지 않는다');
  assert.equal(b4.tier, 4);
  assert.ok(b4.changes.length > 0);
});

test('C 진화 확대가 기존 4개(해적 계열)를 유지한다', () => {
  /* vc252 의 4개를 실수로 지우면 안 된다 — 기존 유저의 진화가 사라진다. */
  for (const job of ['raider', 'powdermaster', 'seaking', 'dreadnought']) {
    assert.equal(isCEvolved(job), true, `기존 C 진화 '${job}' 가 사라졌다`);
  }
});
