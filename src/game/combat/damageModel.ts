/**
 * vc209 (#ponytail ①) — 데미지 계산 순수함수
 *
 * 왜 뽑았나
 *   `Player.rollDamage()` 는 순수 계산과 부수효과(링버퍼 기록)가 섞여 있어
 *   테스트할 수 없었다. 계산 부분만 여기로 옮겨 **경계값을 고정**한다.
 *   Player 는 이 함수를 호출하고, 로그 적산은 Player 에 남긴다.
 *
 * 이 파일이 지켜야 하는 계약 (docs/AUDIT_ponytail_vc209.md Must #3)
 *   · atkTotal × 배율 × 크리배율, 정수 반올림
 *   · 스킬 배율: f(mult, clsSkillMult, fifth, runSkill, tierScl, ultMult) × rage × rebirth
 *   · avg 미만 값이 나오면 회귀 — 테스트가 잡는다
 */

/** 5차 각성 시 스킬 피해 (기본공격 제외) */
export const FIFTH_SKILL_MULT = 1.12;
/** 1차 궁극기 고정 배율 */
export const FIFTH1_MULT = 3.0;
/** 2차 궁극기 고정 배율 */
export const FIFTH2_MULT = 5.0;
/** 스킬 공통 배율 */
export const SKILL_PWR = 1.25;
/** n차 스킬 사다리 계수 (1차 ×1.25 … 5차 ×2.36) */
export const TIER_LADDER = 0.22;

export type DamageInput = {
  /** 누적 공격력 */
  atkTotal: number;
  /** 스킬 고유 배율 (기본공격은 1) */
  mult: number;
  isSkill: boolean;
  /** 직업 보정 (classes.ts skillMult) */
  clsSkillMult: number;
  /** 5차 각성 여부 */
  isFifth: boolean;
  /** 스킬 차수 1~5 */
  sTier: number;
  /** 궁극기 슬롯 0=없음, 1=제1궁극기, 2=제2궁극기 */
  ultSlot: number;
  /** 분노/자기공격력 버프 배율 (1 = 없음) */
  rage: number;
  /** 환생 데미지 배율 (1 = 없음) */
  rebirthDmgMult: number;
  /** 인런 카드 스킬 피해 % (0 = 없음) */
  runSkillPct: number;
  /** 크리티컬 여부 */
  crit: boolean;
  /** 크리티컬 피해 배율 */
  critDmg: number;
};

/**
 * 최종 배율을 계산한다 (반올림 전).
 * rollDamage 의 m 계산식과 **완전히 동일**해야 한다 — 한쪽만 고치면 조용히 갈라진다.
 */
export function damageMultiplier(d: Omit<DamageInput, "atkTotal" | "crit" | "critDmg">): number {
  /* vc209 — `isUlt` 를 `ultSlot > 0` 으로 잡으면 미정의 슬롯(3+)에서 사다리·5차·궁극기
   *  배율이 **모두** 꺼져 스킬이 기본공격보다 20% 약해진다(1.25 → 1.0).
   *  지금은 1·2 만 설정되지만, 슬롯이 늘거나 잘못된 값이 들어오면 조용히 데미지가
   *  폭락한다. 그래서 "궁극기 슬롯"을 1·2 로 **명시**해 판정한다. */
  const isUlt = d.ultSlot === 1 || d.ultSlot === 2;
  const fifth = d.isSkill && d.isFifth && !isUlt ? FIFTH_SKILL_MULT : 1;
  const ultMult = d.ultSlot === 1 ? FIFTH1_MULT : d.ultSlot === 2 ? FIFTH2_MULT : 1;
  const runSkl = d.isSkill && d.runSkillPct > 0 ? 1 + d.runSkillPct / 100 : 1;
  const tierScl =
    d.isSkill && !isUlt ? (1 + TIER_LADDER * Math.max(0, d.sTier - 1)) * SKILL_PWR : 1;
  return (
    (d.isSkill ? d.mult * d.clsSkillMult * fifth * runSkl * tierScl * ultMult : d.mult) *
    d.rage *
    d.rebirthDmgMult
  );
}

/** 최종 데미지 (정수). rollDamage 의 반환값 dmg 와 동일해야 한다. */
export function calcDamage(d: DamageInput): number {
  const m = damageMultiplier(d);
  return Math.round(d.atkTotal * m * (d.crit ? d.critDmg : 1));
}
