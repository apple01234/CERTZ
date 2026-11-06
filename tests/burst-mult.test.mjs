// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/burst-mult.test.mjs
//
// 극딜 지속시간 → 딜배율 정규화 (유저 지시 #9) — v1.4.42
//
// [요구] "직업별로 극딜 지속시간이 짧은 직업들은 딜 배율을 높게 하고
//        긴 직업들은 짧은 직업에 비해 딜 배율을 좀 적게 해"
//
// [왜 테스트가 필요한가]
//  duration(ultHold.ts)과 damage(damageModel.ts)는 원래 **완전히 분리**돼 있었다.
//  즉 이 규칙은 "조금 잘못 튜닝된" 게 아니라 아예 **존재하지 않았다**.
//  다시 끊기지 않게 곡선의 방향·범위·평균을 여기서 못박는다.
//
// [이 테스트가 잡는 것]
//  1. 단조성 — 창이 길수록 배율이 낮다 (방향이 뒤집히면 즉시 실패)
//  2. 클램프 — 모든 직업이 유한하고 [FLOOR, CEIL] 안. 10배 같은 배율 금지
//  3. 양 끝 단언 — 최단창 > 최장창 (1차·2차 둘 다)
//  4. 평균 ≈ 1.0 — 전역 파워크리프 없음 (분배이지 상향이 아니다)
//  5. no-op 경로 — ultBurst 미지정 시 종전과 완전히 동일 (기존 ×3/×5 계약 보존)
import assert from 'node:assert/strict';
import {
  ULT5_HOLD_MS, ULT5B_HOLD_MS,
  BURST_EXP, BURST_REF1, BURST_REF2, BURST_FLOOR, BURST_CEIL,
  burstMultOf, ultBurstMultOf, ult5HoldOf, ult5bHoldOf,
} from '../src/game/ultHold.ts';
import { damageMultiplier, FIFTH1_MULT, FIFTH2_MULT } from '../src/game/combat/damageModel.ts';

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };

const keys = Object.keys(ULT5_HOLD_MS);
/** 2차는 1차와 키 집합이 같아야 한다(REF 를 2배로 둔 전제). */
assert.deepEqual(Object.keys(ULT5B_HOLD_MS), keys, '1차/2차 직업 키 집합이 다르다');

const m1 = keys.map((k) => ultBurstMultOf(1, k));
const m2 = keys.map((k) => ultBurstMultOf(2, k));
const avg = (a) => a.reduce((p, x) => p + x, 0) / a.length;

/* ── 1. 단조 감소 — 창이 길수록 배율이 낮다 ─────────────────────────────── */
{
  /* 서로 다른 시전 시간을 촘촘히 훑어 "짧다 → 배율 높다"가 예외 없이 성립하는지.
   * 클램프가 걸린 구간은 평평해질 뿐 **역전은 없다** → 전체는 비증가(>=)로 단언. */
  const holds = [1000, 3000, 5000, 6000, 6122, 6500, 8000, 10000, 12000, 14000,
    20000, 28000, 28402, 30000, 60000, 120000];
  for (let i = 1; i < holds.length; i++) {
    const short = burstMultOf(holds[i - 1], BURST_REF1);
    const long = burstMultOf(holds[i], BURST_REF1);
    ok(`비증가: ${holds[i - 1]}ms(${short.toFixed(3)}) >= ${holds[i]}ms(${long.toFixed(3)})`, short >= long);
  }
  /* 클램프 안쪽 구간에서는 **엄격히** 감소해야 한다(평평해지면 규칙이 죽은 것).
   * 곡선이 [FLOOR, CEIL] 을 벗어나지 않는 구간 = REF/CEIL² ~ REF/FLOOR² */
  const lo = Math.ceil(BURST_REF1 / (BURST_CEIL ** 2));
  const hi = Math.floor(BURST_REF1 / (BURST_FLOOR ** 2));
  let strict = 0;
  for (let h = lo + 1; h < hi; h += 137) {
    const a = burstMultOf(h, BURST_REF1);
    const b = burstMultOf(h + 137, BURST_REF1);
    ok(`엄격 감소(${lo}~${hi}ms): ${h}ms(${a.toFixed(4)}) > ${h + 137}ms(${b.toFixed(4)})`, a > b);
    strict++;
  }
  ok(`엄격 감소 구간 표본 ${strict}개 (>= 10)`, strict >= 10);
  /* 클램프 구간은 평평하다 — 양 끝이 실제로 잘린다. */
  ok('1,000ms → CEIL', burstMultOf(1000, BURST_REF1) === BURST_CEIL);
  ok('600,000ms → FLOOR', burstMultOf(600000, BURST_REF1) === BURST_FLOOR);
  ok('REF → 1.0 (기준점)', Math.abs(burstMultOf(BURST_REF1, BURST_REF1) - 1) < 1e-9);
}

/* ── 2. 유한 + 클램프 — 누구도 못 쓰거나 압도하는 배율이 없다 ────────────── */
{
  for (const [i, k] of keys.entries()) {
    for (const [tier, m] of [[1, m1[i]], [2, m2[i]]]) {
      ok(`${k} ${tier}차 배율 ${m.toFixed(3)} 유한`, Number.isFinite(m));
      ok(`${k} ${tier}차 배율 ${m.toFixed(3)} >= FLOOR ${BURST_FLOOR}`, m >= BURST_FLOOR);
      ok(`${k} ${tier}차 배율 ${m.toFixed(3)} <= CEIL ${BURST_CEIL}`, m <= BURST_CEIL);
    }
  }
  /* 10배 같은 이상치 금지 — 클램프 폭 자체가 2배를 넘지 않는다. */
  ok(`클램프 폭 ${(BURST_CEIL / BURST_FLOOR).toFixed(2)}배 <= 2.5배`, BURST_CEIL / BURST_FLOOR <= 2.5);
}

/* ── 3. 양 끝 — 최단창 직업이 최장창 직업보다 엄격히 높다 (1차·2차 둘 다) ── */
{
  const shortest1 = keys.reduce((a, k) => (ULT5_HOLD_MS[k] < ULT5_HOLD_MS[a] ? k : a));
  const longest1 = keys.reduce((a, k) => (ULT5_HOLD_MS[k] > ULT5_HOLD_MS[a] ? k : a));
  const shortest2 = keys.reduce((a, k) => (ULT5B_HOLD_MS[k] < ULT5B_HOLD_MS[a] ? k : a));
  const longest2 = keys.reduce((a, k) => (ULT5B_HOLD_MS[k] > ULT5B_HOLD_MS[a] ? k : a));

  const a1 = ultBurstMultOf(1, shortest1), b1 = ultBurstMultOf(1, longest1);
  const a2 = ultBurstMultOf(2, shortest2), b2 = ultBurstMultOf(2, longest2);
  ok(`1차 최단 ${shortest1}(${ULT5_HOLD_MS[shortest1]}ms)=${a1.toFixed(3)} > 최장 ${longest1}(${ULT5_HOLD_MS[longest1]}ms)=${b1.toFixed(3)}`, a1 > b1);
  ok(`2차 최단 ${shortest2}(${ULT5B_HOLD_MS[shortest2]}ms)=${a2.toFixed(3)} > 최장 ${longest2}(${ULT5B_HOLD_MS[longest2]}ms)=${b2.toFixed(3)}`, a2 > b2);

  /* 차등이 체감 가능해야 한다 — 1% 차이면 유저 요구를 만족하지 못한다. */
  ok(`1차 양 끝 차이 ×${(a1 / b1).toFixed(2)} (>= 1.5배)`, a1 / b1 >= 1.5);
  ok(`2차 양 끝 차이 ×${(a2 / b2).toFixed(2)} (>= 1.5배)`, a2 / b2 >= 1.5);
}

/* ── 4. 평균 ≈ 1.0 — 재분배이지 전역 상향이 아니다 ──────────────────────── */
{
  const a1 = avg(m1), a2 = avg(m2);
  /* REF 를 분포 기하평균 근처로 잡았으므로 평균은 1 에서 2% 이내여야 한다.
   * (클램프가 양 끝에서만 걸리므로 평균을 거의 끌지 않는다) */
  ok(`1차 평균 배율 ${a1.toFixed(4)} ≈ 1 (|Δ| <= 2%)`, Math.abs(a1 - 1) <= 0.02);
  ok(`2차 평균 배율 ${a2.toFixed(4)} ≈ 1 (|Δ| <= 2%)`, Math.abs(a2 - 1) <= 0.02);
  /* 2차는 1차의 정확히 2배 창이므로 배율표도 동일해야 한다. */
  for (const [i, k] of keys.entries()) {
    ok(`${k}: 1차/2차 배율 동일 (${m1[i].toFixed(3)} vs ${m2[i].toFixed(3)})`, Math.abs(m1[i] - m2[i]) < 1e-9);
  }
}

/* ── 5. no-op — ultBurst 미지정이면 종전과 완전히 동일 ──────────────────── */
{
  /* 기존 __tests__/damageModel.test.ts 의 ×3/×5 단언과 별개로, "필드 없음 = 1.0"을
   * 여기서 직접 못박는다. 누군가 `ultBurst ?? 1` 을 지우면 여기서 잡힌다. */
  const base = {
    mult: 1, isSkill: true, clsSkillMult: 1, isFifth: true, sTier: 5,
    ultSlot: 0, rage: 1, rebirthDmgMult: 1, runSkillPct: 0,
  };
  /* 기본공격 경로(ultSlot 0, isSkill false) = 정확히 1.0 */
  const atk = { ...base, isSkill: false, isFifth: false, sTier: 1 };
  ok('ultBurst 미지정 + 기본공격 = 1.0', damageMultiplier(atk) === 1.0);
  ok('ultBurst=1.4 + 기본공격 = 여전히 1.0 (무시됨)', damageMultiplier({ ...atk, ultBurst: 1.4 }) === 1.0);

  ok('ultBurst=1 + 1차 궁극기 = FIFTH1_MULT', damageMultiplier({ ...base, ultSlot: 1, ultBurst: 1 }) === FIFTH1_MULT);
  ok('ultBurst=1 + 2차 궁극기 = FIFTH2_MULT', damageMultiplier({ ...base, ultSlot: 2, ultBurst: 1 }) === FIFTH2_MULT);
  /* 미지정 = 1 = 종전과 완전히 같은 값. 기존 호출부는 한 줄도 안 바뀐다. */
  ok('ultBurst 없음 + 1차 = 종전 ×3', damageMultiplier({ ...base, ultSlot: 1 }) === FIFTH1_MULT);
  ok('ultBurst 없음 + 2차 = 종전 ×5', damageMultiplier({ ...base, ultSlot: 2 }) === FIFTH2_MULT);
  ok('ultBurst 미지정 === ultBurst:1 (동치)',
    damageMultiplier({ ...base, ultSlot: 1 }) === damageMultiplier({ ...base, ultSlot: 1, ultBurst: 1 }));
  /* 실제로 곱해지는지 — 보정이 _ultMult 에 곱해진다. */
  ok('ultBurst=1.4 + 1차 = 3.0 × 1.4',
    Math.abs(damageMultiplier({ ...base, ultSlot: 1, ultBurst: 1.4 }) - FIFTH1_MULT * 1.4) < 1e-9);
  ok('ultBurst=0.65 + 2차 = 5.0 × 0.65',
    Math.abs(damageMultiplier({ ...base, ultSlot: 2, ultBurst: 0.65 }) - FIFTH2_MULT * 0.65) < 1e-9);
  /* 일반 스킬(ultSlot 0)은 ultBurst 를 줘도 값이 안 변한다 — 비궁극기 피해 불변. */
  ok('ultSlot 0 + ultBurst=2 → 일반 스킬 값 불변',
    damageMultiplier(base) === damageMultiplier({ ...base, ultBurst: 2 }));
  /* 슬롯 3+ 도 종전과 동일(폭락 방지 계약 유지). */
  ok('ultSlot 3 + ultBurst=2 → 일반 스킬 값 불변',
    damageMultiplier({ ...base, ultSlot: 3 }) === damageMultiplier({ ...base, ultSlot: 3, ultBurst: 2 }));
}

/* ── 6. 슬롯 0/기타 → 배율 1 (일반 스킬 경로에 새지 않는다) ─────────────── */
{
  for (const slot of [0, 3, -1, 99]) {
    ok(`슬롯 ${slot} → 배율 1`, ultBurstMultOf(slot, 'warbringer') === 1);
  }
  /* 미등록 직업은 계열 폴백을 타고도 유한·클램프 안. */
  for (const k of ['unknown_class', '', 'warrior']) {
    const m = ultBurstMultOf(1, k, 'warrior');
    ok(`미등록 ${JSON.stringify(k)} → ${m.toFixed(3)} 클램프 안`, Number.isFinite(m) && m >= BURST_FLOOR && m <= BURST_CEIL);
  }
  /* 실측 대역과 액세서 일치 — ultBurstMultOf 가 ult5*HoldOf 를 실제로 쓰는지. */
  ok('ultBurstMultOf(1, dreadnought) === burstMultOf(ult5HoldOf(dreadnought))',
    ultBurstMultOf(1, 'dreadnought') === burstMultOf(ult5HoldOf('dreadnought'), BURST_REF1));
  ok('ultBurstMultOf(2, dreadnought) === burstMultOf(ult5bHoldOf(dreadnought))',
    ultBurstMultOf(2, 'dreadnought') === burstMultOf(ult5bHoldOf('dreadnought'), BURST_REF2));
}

/* ── 7. 총량 정규화 — 창 × 배율이 직업 간에 크게 벌어지지 않는다 ────────── */
{
  /* 이게 규칙의 목적 그 자체. 정규화 전에는 dreadnought/warrior = 5배였다. */
  const totals = keys.map((k) => ULT5_HOLD_MS[k] * ultBurstMultOf(1, k));
  const lo = Math.min(...totals), hi = Math.max(...totals);
  ok(`창×배율 총량 비 ${(hi / lo).toFixed(2)}배 (정규화 전 5.00배 → 3.0배 이하)`, hi / lo <= 3.0);
  ok(`총량 비가 정규화 전보다 개선됨`, hi / lo < 5.0);
}

console.log(`\nALL CHECKS PASS: burst-mult — ${checks} checks`);
console.log(`  EXP=${BURST_EXP} REF1=${BURST_REF1} REF2=${BURST_REF2} FLOOR=${BURST_FLOOR} CEIL=${BURST_CEIL}`);
console.log(`  평균 배율: 1차 ${avg(m1).toFixed(4)} / 2차 ${avg(m2).toFixed(4)}  (직업 ${keys.length}종)`);
