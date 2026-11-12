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
