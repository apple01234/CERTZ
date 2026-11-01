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

/**
 * vc219 — 버프 합산 상한.
 *
 *  곱셈 시절엔 상한이 없어 조합이 하나 늘 때마다 배율이 지수로 뛰었다(최대 29.7배).
 *  합산으로 바꾼 뒤에도 무한정 커지면 의미가 없으므로 레이어 총합을 자른다.
 *
 *  2.0 을 고른 근거 (atkTotal 852 = 현실 최대, 최종 보스 HP 95,000):
 *    CAP 0.5 → 보스 12.5방  (너무 단단 — 템포 없음)
 *    CAP 1.0 → 보스  9.4방
 *    CAP 1.5 → 보스  7.5방
 *    CAP 2.0 → 보스  6.3방  ← 기본공격(111방)과의 편차 44배 → 18배
 *    CAP 3.0 → 보스  4.7방  (여전히 짧다)
 *
 *  상한에 실제로 닿는 조합은 rage 1.5 + 환생 2.0 + 카드 50% = 2.0 이다.
 *  즉 "모든 버프를 동시에 켠 극단"에서만 걸리고, 평시에는 자유롭게 선형으로 는다.
 */
export const BUFF_SUM_CAP = 2.0;

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
 *
 * vc219 — 버프 퍼센트를 **합산**으로 바꿨다 (스킬 `agd-rpg` §1 권고).
 *
 *  종전에는 rage × rebirthDmgMult × (1+runSkillPct/100) 를 **모두 곱**했다.
 *  그래서 최대 조합이 29.7배까지 올라가 최종 보스가 2.5방에 죽는 반면,
 *  버프 없는 기본공격으로는 111방이 걸려 **같은 보스에서 44배 편차**가 났다.
 *
 *  스킬 문서의 지침:
 *    "Sum within a layer by default and reserve multiplicative stacking for a few rare effects."
 *
 *  이제 버프는 **한 레이어로 합산**한다:
 *    buffSum = (rage-1) + (rebirth-1) + runSkillPct/100
 *    최종 = 스킬배율 × (1 + buffSum)
 *
 *  ─ 왜 "1 + 합" 인가: 각 버프가 "없음"일 때 0 이 되도록 (rage=1 → 0) 기준을 옮긴다.
 *    그래야 버프가 없는 상태의 배율이 정확히 1 이고, 여러 개가 겹쳐도 선형으로만 는다.
 *  ─ 상한: 합이 무한정 커지지 않게 BUFF_SUM_CAP 으로 자른다. 곱셈 시절엔 상한이
 *    없어서 조합이 늘 때마다 지수로 뛰었다.
 *
 *  호환: rage=1, rebirth=1, runSkillPct=0 (버프 없음) 이면 결과가 종전과 **완전히 같다**.
 *  단일 버프만 걸린 경우도 종전과 같다((1+(x-1)) = x, (1+p) = 1+p). 즉
 *  **2개 이상 겹칠 때만** 종전보다 약해진다 — 그게 의도한 수정 지점이다.
 */
export function damageMultiplier(d: Omit<DamageInput, "atkTotal" | "crit" | "critDmg">): number {
  /* vc209 — `isUlt` 를 `ultSlot > 0` 으로 잡으면 미정의 슬롯(3+)에서 사다리·5차·궁극기
   *  배율이 **모두** 꺼져 스킬이 기본공격보다 20% 약해진다(1.25 → 1.0).
   *  지금은 1·2 만 설정되지만, 슬롯이 늘거나 잘못된 값이 들어오면 조용히 데미지가
   *  폭락한다. 그래서 "궁극기 슬롯"을 1·2 로 **명시**해 판정한다. */
  const isUlt = d.ultSlot === 1 || d.ultSlot === 2;
  const fifth = d.isSkill && d.isFifth && !isUlt ? FIFTH_SKILL_MULT : 1;
  const ultMult = d.ultSlot === 1 ? FIFTH1_MULT : d.ultSlot === 2 ? FIFTH2_MULT : 1;
  const tierScl =
    d.isSkill && !isUlt ? (1 + TIER_LADDER * Math.max(0, d.sTier - 1)) * SKILL_PWR : 1;

  /* --- 버프 레이어: 합산 (vc219) --- */
  /* 각 버프를 "1 기준 초과분"으로 바꿔 더한다. 버프가 없으면 정확히 0. */
  const rageAdd = Math.max(0, (d.rage || 1) - 1);
  const rebirthAdd = Math.max(0, (d.rebirthDmgMult || 1) - 1);
  /* 인런 카드는 종전에도 스킬에만 적용됐다 — 그 제약은 유지한다. */
  const runAdd = d.isSkill && d.runSkillPct > 0 ? d.runSkillPct / 100 : 0;
  const buffSum = Math.min(BUFF_SUM_CAP, rageAdd + rebirthAdd + runAdd);

  const skillBase = d.isSkill
    ? d.mult * d.clsSkillMult * fifth * tierScl * ultMult
    : d.mult;

  return skillBase * (1 + buffSum);
}

/** 최종 데미지 (정수). rollDamage 의 반환값 dmg 와 동일해야 한다. */
export function calcDamage(d: DamageInput): number {
  const m = damageMultiplier(d);
  return Math.round(d.atkTotal * m * (d.crit ? d.critDmg : 1));
}
