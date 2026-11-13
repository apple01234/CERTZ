/**
 * vc278 — 궁극기 지속 타격(wave) 회귀 방지.
 *
 * 배경: 4차 10종 궁극기의 시전 시간은 22~30초인데 실제 타격은 0~1.3초에 끝나
 * 공백이 21~29초였다(타격 비율 0.0~4.3%). 이 테스트는 웨이브가 시전 시간 전체에
 * 고르게 퍼지는지, 그리고 경계 조건에서 터지지 않는지를 고정한다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planUltWaves, waveIntensity } from "../src/game/combat/ultWaves.ts";

test("웨이브가 시전 시간 전체에 퍼진다 (초반 몰림 없음)", () => {
  const hold = 24000;
  const { at } = planUltWaves(hold, { startMs: 600, endPadMs: 700 });
  assert.ok(at.length > 5, `웨이브가 너무 적다: ${at.length}`);
  // 첫 웨이브는 start 이후
  assert.ok(at[0] >= 600, `첫 웨이브가 인트로와 겹친다: ${at[0]}`);
  // 마지막 웨이브는 종결 연출 전
  assert.ok(at[at.length - 1] <= hold - 700, `마지막 웨이브가 종결과 겹친다: ${at.at(-1)}`);
  // 앞 절반에 전체의 60% 이상이 몰리면 안 된다
  const half = hold / 2;
  const firstHalf = at.filter((t) => t <= half).length;
  assert.ok(firstHalf <= at.length * 0.6,
    `초반 몰림: 앞 절반에 ${firstHalf}/${at.length}`);
});

test("웨이브는 단조 증가하고 최소 간격을 지킨다", () => {
  const { at } = planUltWaves(26000, { minIntervalMs: 220 });
  for (let i = 1; i < at.length; i++) {
    assert.ok(at[i] > at[i - 1], `시각이 증가하지 않음: ${at[i - 1]} → ${at[i]}`);
    assert.ok(at[i] - at[i - 1] >= 220, `최소 간격 위반: ${at[i] - at[i - 1]}ms`);
  }
});

test("웨이브 수가 상한을 넘지 않는다 (프레임 부하 방지)", () => {
  const { at } = planUltWaves(30000, { maxWaves: 24 });
  assert.ok(at.length <= 24, `상한 초과: ${at.length}`);
});

test("창이 매우 짧으면 웨이브 1회로 줄인다", () => {
  const { at } = planUltWaves(800, { startMs: 600, endPadMs: 700 });
  assert.equal(at.length, 1, `짧은 창에서 ${at.length}회 — 1회여야 한다`);
});

test("hold 가 0 이하면 웨이브가 없다 (음수/0 방어)", () => {
  for (const h of [0, -100, -5000]) {
    const { at } = planUltWaves(h);
    assert.deepEqual(at, [], `hold=${h} 에서 웨이브가 생성됨`);
  }
});

test("모든 4차 10종 hold 에서 타격 공백이 사라진다", () => {
  /* 실측된 4차 10종 hold 값. 이전에는 타격이 0~1300ms 에 끝나
   * 공백이 21740~28700ms 였다. 웨이브 적용 후에는 마지막 웨이브가
   * hold 의 90% 이상 지점에 와야 한다. */
  const HOLDS = {
    arclord: 26000, blademaster: 22000, crusader: 24000, deadeye: 22000,
    dreadnought: 30000, eternal: 26000, seaking: 28000, shadowlord: 22000,
    skylord: 22000, warbringer: 24000,
  };
  for (const [k, hold] of Object.entries(HOLDS)) {
    const { at } = planUltWaves(hold);
    assert.ok(at.length >= 10, `${k}: 웨이브 ${at.length}개 — 너무 적다`);
    const last = at[at.length - 1];
    assert.ok(last >= hold * 0.9, `${k}: 마지막 웨이브 ${last}ms 가 hold 의 90%(${hold * 0.9}) 미만`);
  }
});

test("강도는 뒤로 갈수록 강해진다 (고조)", () => {
  assert.ok(waveIntensity(0, 10) < waveIntensity(9, 10), "마지막이 첫보다 약하다");
  assert.equal(waveIntensity(0, 1), 1, "웨이브 1개면 배율 1");
  // 범위 확인
  for (let i = 0; i < 10; i++) {
    const v = waveIntensity(i, 10);
    assert.ok(v >= 0.7 && v <= 1.3, `강도 범위 이탈: ${v}`);
  }
});

/* ═══ 2026-11-13 — 궁극기 개편: 표적당 고정 예산 ═══ */
import { createUltBudget, waveWeight, DIRECT_SHARE, WAVE_FINALE_SHARE } from "../src/game/combat/ultWaves.ts";
import { readFileSync } from "node:fs";

/** 직접 타격 hits 회(전부 첫 wave 전) + wave n 회를 한 표적에 넣고 받은 총 피해를 돌려준다. */
function castTotal(n, budget, hits, hitDmg = 777) {
  const pool = createUltBudget(n, budget), t = {};
  let total = 0, direct = 0;
  for (let i = 0; i < hits; i++) { const d = pool.draw(t, pool.tag(hitDmg)); total += d; direct += d; }
  const pays = [];
  for (let i = 0; i < n; i++) pool.paying(() => { const d = pool.payout(i, t); pays.push(d); total += d; });
  return { total, direct, pays };
}

test("타수가 4든 125든 표적당 총 피해는 예산과 같다 (직업 간 38배 격차 회귀 방지)", () => {
  for (const hits of [0, 4, 26, 49, 125, 400]) {
    const { total } = castTotal(20, 100000, hits);
    assert.ok(Math.abs(total - 100000) <= hits + 1, `타수 ${hits}: ${total}`);
  }
});

test("시전 시간(wave 수)이 달라도 총 피해는 같다", () => {
  for (const n of [1, 5, 12, 24]) {
    const { total } = castTotal(n, 50000, 30);
    assert.ok(Math.abs(total - 50000) <= 31, `wave ${n}: ${total}`);
  }
});

test("직접 타격은 굴린 값과 무관하게 예산의 DIRECT_SHARE 를 넘지 못한다", () => {
  const a = castTotal(10, 80000, 200, 1), b = castTotal(10, 80000, 200, 9e9);
  assert.equal(a.direct, b.direct);
  assert.ok(a.direct <= 80000 * DIRECT_SHARE + 200, `${a.direct}`);
});

test("마지막 wave 가 종결이다 — wave 지급분 중 가장 크다", () => {
  const { pays } = castTotal(12, 60000, 10);
  assert.equal(Math.max(...pays), pays.at(-1));
  assert.ok(Math.abs(waveWeight(11, 12) / Array.from({ length: 12 }, (_, i) => waveWeight(i, 12)).reduce((x, y) => x + y) - WAVE_FINALE_SHARE) < 1e-9);
});

test("등록되지 않은 타격과 wave 자기 지급은 예산을 건드리지 않는다", () => {
  const pool = createUltBudget(3, 9000), t = {};
  assert.equal(pool.draw(t, 1234), 1234);
  pool.tag(500);
  pool.paying(() => assert.equal(pool.draw(t, 500), 500));
  assert.deepEqual(pool.targets(), []);
});

test("늦게 들어온 표적은 남은 wave 몫만 받는다", () => {
  const pool = createUltBudget(10, 10000), a = {}, b = {};
  let ta = 0, tb = 0;
  for (let i = 0; i < 10; i++) pool.paying(() => { ta += pool.payout(i, a); if (i >= 9) tb += pool.payout(i, b); });
  assert.equal(ta, 10000);
  assert.ok(tb < 10000 * 0.5 && tb > 0, `${tb}`);
});

test("1차·2차 궁극기 모두 예산을 쓰고, 적은 피해를 받기 전에 예산을 거친다", () => {
  const player = readFileSync(new URL("../src/game/entities/Player.ts", import.meta.url), "utf8");
  assert.equal(player.match(/this\.startUltBudget\(/g)?.length, 2);
  assert.match(player, /startUltBudget\(1, ult5HoldOf/);
  assert.match(player, /startUltBudget\(2, ult5bHoldOf/);
  for (const f of ["Enemy", "Boss"]) {
    const src = readFileSync(new URL(`../src/game/entities/${f}.ts`, import.meta.url), "utf8");
    assert.match(src, /dmg = this\.scene\.notePlayerHit\?\.\(dmg, this\) \?\? dmg/);
  }
});
