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

/* ── 2026-11-12 — 총 피해 예산 정규화 (240 지시서 121·122) ── */
import { createWavePool, waveWeight, WAVE_SHARE, WAVE_FINALE_SHARE } from "../src/game/combat/ultWaves.ts";

/** 직접 타격 rolled 를 각각 times 번 적중시키고 n 번의 wave 를 전부 지급받는다. */
function runCast(n, rolled, times = 1) {
  const pool = createWavePool(n);
  let direct = 0;
  for (const d of rolled) { const out = pool.reduce(d); for (let k = 0; k < times; k++) { direct += out; pool.credit(out); } }
  const paid = Array.from({ length: n }, (_, i) => pool.payout(i, true));
  return { direct, paid, waves: paid.reduce((a, b) => a + b, 0), full: rolled.reduce((a, b) => a + b, 0) * times };
}

test("wave 풀은 총 피해를 보존한다 (직접 타격에서 줄인 만큼만 지급)", () => {
  const r = runCast(23, [228, 228, 228, 648, 74, 74, 74]);
  assert.ok(Math.abs(r.direct + r.waves - r.full) <= 4, `직접 ${r.direct} + wave ${r.waves} vs ${r.full}`);
  assert.ok(Math.abs(r.waves / r.full - WAVE_SHARE) < 0.01, `wave 몫 ${(r.waves / r.full).toFixed(3)}`);
});

test("한 번 굴린 값이 여러 번 적중해도 보존된다 (deadeye 실측 82% 회귀 방지)", () => {
  const r = runCast(23, Array(50).fill(160), 2);
  assert.ok(Math.abs((r.direct + r.waves) / r.full - 1) < 0.005, `${((r.direct + r.waves) / r.full).toFixed(3)}`);
});

test("마지막 wave 가 종결이다 — 풀의 FINALE_SHARE 를 가져간다", () => {
  const r = runCast(23, [100000]);
  assert.equal(Math.max(...r.paid), r.paid[22]);
  assert.ok(Math.abs(r.paid[22] / r.waves - WAVE_FINALE_SHARE) < 0.01, `${(r.paid[22] / r.waves).toFixed(3)}`);
  assert.ok(waveWeight(22, 23) > waveWeight(21, 23) * 5);
});

test("표적이 없던 wave 의 몫은 다음 wave 로 이월된다", () => {
  const a = createWavePool(4), b = createWavePool(4);
  for (const p of [a, b]) p.credit(p.reduce(10000));
  let sa = 0, sb = 0;
  for (let i = 0; i < 4; i++) sa += a.payout(i, true);
  for (let i = 0; i < 4; i++) sb += b.payout(i, i >= 2); // 앞의 두 번은 표적 없음
  assert.equal(sa, sb, "이월 후 총 지급액이 같다");
});

test("풀과 무관한 타격·wave 자기 지급은 적립되지 않는다", () => {
  const pool = createWavePool(3);
  const out = pool.reduce(1000);
  pool.credit(123);                     // 시전 중의 기본공격 등
  pool.paying(() => pool.credit(out));  // wave 지급 타격이 같은 값이어도
  assert.equal(pool.payout(0, true) + pool.payout(1, true) + pool.payout(2, true), 0);
});

test("남은 wave 가 없으면 직접 타격을 줄이지 않는다 (지급할 곳 없는 피해 소실 방지)", () => {
  const pool = createWavePool(2);
  pool.payout(0, true); pool.payout(1, true);
  assert.equal(pool.reduce(500), 500);
  assert.equal(createWavePool(0).reduce(500), 500);
});

test("useSkill5 는 wave 에서 새 피해를 굴리지 않는다", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/game/entities/Player.ts", "utf8");
  const i = src.indexOf("const n = wavePlan.at.length;");
  assert.ok(i > -1);
  const block = src.slice(i, src.indexOf("switch (key5) {", i));
  assert.doesNotMatch(block, /rd\(|rollDamage\(/, "wave 는 풀 지급만 한다");
  assert.match(src, /dmg: wavePool\.reduce\(r\.dmg\)/, "직접 타격은 줄여서 넣는다");
  assert.match(readFileSync("src/game/scenes/WorldScene.ts", "utf8"), /ultPool\?\.credit\(dmg\)/, "적중 시 적립");
});
