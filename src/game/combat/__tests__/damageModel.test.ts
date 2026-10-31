/**
 * vc209 (#ponytail ①) — 데미지 계산 경계값 고정
 *
 * 실행: node --experimental-strip-types src/game/combat/__tests__/damageModel.test.ts
 *       또는 npx tsx ...
 * (러너가 없어 자체 실행 가능하게 작성 — assert 만 사용)
 */
import assert from "node:assert/strict";
import { calcDamage, damageMultiplier, type DamageInput } from "../damageModel.ts";

let pass = 0;
let fail = 0;
function t(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
}

/** 기본 입력 — 전부 "없음" 상태 */
const base: DamageInput = {
  atkTotal: 1000,
  mult: 1,
  isSkill: false,
  clsSkillMult: 1,
  isFifth: false,
  sTier: 1,
  ultSlot: 0,
  rage: 1,
  rebirthDmgMult: 1,
  runSkillPct: 0,
  crit: false,
  critDmg: 2,
};

console.log("\n[기본 공격]");
t("배율 1 → atkTotal 그대로", () => {
  assert.equal(calcDamage(base), 1000);
});

t("크리티컬 → critDmg 배", () => {
  assert.equal(calcDamage({ ...base, crit: true, critDmg: 2 }), 2000);
});

t("critDmg 0 → 데미지 0 (경계)", () => {
  assert.equal(calcDamage({ ...base, crit: true, critDmg: 0 }), 0);
});

t("cknowledge: atkTotal 0 → 0", () => {
  assert.equal(calcDamage({ ...base, atkTotal: 0 }), 0);
});

t("반올림: 1000.5 → 1001", () => {
  assert.equal(calcDamage({ ...base, atkTotal: 1000.5 }), 1001);
});

t("반올림: 1000.4 → 1000", () => {
  assert.equal(calcDamage({ ...base, atkTotal: 1000.4 }), 1000);
});

console.log("\n[스킬 배율 사다리]");
t("1차 스킬 = ×(1.0)×1.25", () => {
  const m = damageMultiplier({ ...base, isSkill: true, sTier: 1 });
  assert.equal(m, 1 * 1.25);
});

t("5차 스킬 = ×(1+0.22×4)×1.25 = ×2.35", () => {
  const m = damageMultiplier({ ...base, isSkill: true, sTier: 5 });
  /* Player.ts:7778 주석은 "5차 ×2.36"이라 적혀 있지만 실측은 2.35 다.
   *  (1 + 0.22*4) * 1.25 = 1.88 * 1.25 = 2.35 — 주석이 반올림 표기 오류다.
   *  코드가 맞고 주석이 틀렸으므로 테스트는 실측값을 고정한다. */
  assert.equal(Math.round(m * 100) / 100, 2.35);
});

t("차수가 오르면 단조 증가", () => {
  const vals = [1, 2, 3, 4, 5].map((s) => damageMultiplier({ ...base, isSkill: true, sTier: s }));
  for (let i = 1; i < vals.length; i++) assert.ok(vals[i] > vals[i - 1], `sTier ${i + 1}`);
});

t("sTier 0 → max(0,-1)=0 이라 1차와 동일", () => {
  assert.equal(
    damageMultiplier({ ...base, isSkill: true, sTier: 0 }),
    damageMultiplier({ ...base, isSkill: true, sTier: 1 }),
  );
});

console.log("\n[궁극기 고정 배율]");
t("제1궁극기 ×3.0 — 사다리 무시", () => {
  const m = damageMultiplier({ ...base, isSkill: true, sTier: 5, ultSlot: 1 });
  assert.equal(m, 3.0);
});

t("제2궁극기 ×5.0 — 사다리 무시", () => {
  const m = damageMultiplier({ ...base, isSkill: true, sTier: 5, ultSlot: 2 });
  assert.equal(m, 5.0);
});

t("궁극기 중엔 5차 +12% 미적용", () => {
  const withFifth = damageMultiplier({ ...base, isSkill: true, ultSlot: 1, isFifth: true });
  assert.equal(withFifth, 3.0);
});

t("제2궁극기가 제1보다 강함", () => {
  const a = damageMultiplier({ ...base, isSkill: true, ultSlot: 1 });
  const b = damageMultiplier({ ...base, isSkill: true, ultSlot: 2 });
  assert.ok(b > a);
});

console.log("\n[5차 각성]");
t("5차 스킬 +12%", () => {
  const m = damageMultiplier({ ...base, isSkill: true, isFifth: true, sTier: 1 });
  assert.equal(Math.round(m * 100) / 100, Math.round(1.12 * 1.25 * 100) / 100);
});

t("5차여도 기본공격엔 +12% 없음", () => {
  const m = damageMultiplier({ ...base, isSkill: false, isFifth: true });
  assert.equal(m, 1);
});

console.log("\n[버프 곱연산]");
t("rage 2배", () => {
  assert.equal(calcDamage({ ...base, rage: 2 }), 2000);
});

t("rebirth 1.5배", () => {
  assert.equal(calcDamage({ ...base, rebirthDmgMult: 1.5 }), 1500);
});

t("rage × rebirth 곱연산", () => {
  assert.equal(calcDamage({ ...base, rage: 2, rebirthDmgMult: 1.5 }), 3000);
});

t("인런 카드 +50% (스킬만)", () => {
  const skill = damageMultiplier({ ...base, isSkill: true, sTier: 1, runSkillPct: 50 });
  assert.equal(Math.round(skill * 100) / 100, Math.round(1.5 * 1.25 * 100) / 100);
});

t("인런 카드는 기본공격에 미적용", () => {
  assert.equal(damageMultiplier({ ...base, isSkill: false, runSkillPct: 50 }), 1);
});

t("runSkillPct 0 → 배율 1", () => {
  assert.equal(damageMultiplier({ ...base, isSkill: true, sTier: 1, runSkillPct: 0 }), 1.25);
});

t("clsSkillMult 2배", () => {
  assert.equal(damageMultiplier({ ...base, isSkill: true, sTier: 1, clsSkillMult: 2 }), 2.5);
});

console.log("\n[음수/비정상 방어]");
/* vc209 — ultSlot 3+ 는 현재 도달 불가(설정 지점은 1·2 뿐)지만,
 *  도달하면 배율이 1.25 → 1 로 **폭락**한다(궁극기보다 약해짐).
 *  방어적으로 계약을 명시: 미정의 슬롯은 "궁극기 아님"이 아니라
 *  "최소한 스킬 배율은 유지"해야 한다. 실제로는 1·2 외 값이 오지 않으므로
 *  지금은 현 동작을 고정하고, 값이 늘어나면 이 테스트가 먼저 깨진다. */
t("ultSlot 3 → 정상 스킬로 취급 (폭락 방지)", () => {
  const m5 = damageMultiplier({ ...base, isSkill: true, sTier: 5, ultSlot: 3 });
  assert.equal(Math.round(m5 * 100) / 100, 2.35, "ultSlot 3 은 5차 배율 유지");
  const m1 = damageMultiplier({ ...base, isSkill: true, sTier: 1, ultSlot: 3 });
  assert.equal(Math.round(m1 * 100) / 100, 1.25, "ultSlot 3 은 1차 배율 유지");
});

t("mult 0 → 0", () => {
  assert.equal(calcDamage({ ...base, mult: 0 }), 0);
});

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
