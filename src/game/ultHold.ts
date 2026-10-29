/**
 * 궁극기 시전 시간 계약 (v1.4.41 — 유저 지시 #3)
 *
 * 유저 지시: "궁극기 쿨타임에 비해 시전시간이 다들 너무 짧아"
 *           → "1차 궁극기 최소 5초 최대 30초 / 2차 궁극기 최소 10초 최대 1분"
 *
 * 왜 별도 파일인가
 * ----------------
 * 종전 시전 시간은 `useSkill5` 끝의 `delayedCall(300, …)` 하나로 결정됐다.
 * **연출은 1.3초까지 가는데 경직은 0.3초에 풀려** 플레이어가 바로 움직일 수 있었고,
 * 그것이 "궁극기가 짧다"는 체감의 실제 원인이었다(60초 기다려 0.3초 정지).
 *
 * 여기서 직업별 시전 시간을 **데이터로** 못박는다. 연출·경직·타격 웨이브가 모두
 * 이 값을 읽으므로 셋이 어긋날 수 없다.
 *
 * 대역
 * ----
 *   1차(쿨 60초)  : 5,000 ~ 30,000ms
 *   2차(쿨 120초) : 10,000 ~ 60,000ms
 *   → 4차로 갈수록 길고, 5차 최종 티어가 가장 길다. 쿨타임이 긴 쪽이 시전도 길다.
 */

/** 1차 궁극기 시전 시간(ms). 계열 기본 → 3차 → 4차 순으로 길어진다. */
export const ULT5_HOLD_MS: Record<string, number> = {
  /* ── 계열 폴백 (1~2차가 5차 해금 시) ── */
  warrior: 6000,
  ranger: 6000,
  mage: 7000,
  thief: 6000,
  pirate: 6500,

  /* ── 2차 ── */
  berserker: 9000,
  guardian: 9000,
  sniper: 8500,
  windrunner: 8500,
  archmage: 10000,
  sage: 10000,
  assassin: 8500,
  swashbuckler: 8500,
  raider: 9000,
  corsair: 9000,

  /* ── 3차 ── */
  warlord: 14000,
  paladin: 14000,
  eagleeye: 13000,
  tempest: 13000,
  stormbringer: 16000,
  chronicle: 16000,
  nightblade: 13000,
  duelist: 13000,
  stormcaptain: 15000,
  powdermaster: 15000,

  /* ── 4차 (최종 티어 — 가장 길다) ── */
  warbringer: 24000,
  crusader: 24000,
  deadeye: 22000,
  skylord: 22000,
  arclord: 26000,
  eternal: 26000,
  shadowlord: 22000,
  blademaster: 22000,
  seaking: 28000,
  dreadnought: 30000,
};

/** 2차 궁극기 시전 시간(ms) — 쿨 120초. 10,000 ~ 60,000. */
export const ULT5B_HOLD_MS: Record<string, number> = {
  warrior: 12000,
  ranger: 12000,
  mage: 14000,
  thief: 12000,
  pirate: 13000,

  berserker: 18000,
  guardian: 18000,
  sniper: 17000,
  windrunner: 17000,
  archmage: 20000,
  sage: 20000,
  assassin: 17000,
  swashbuckler: 17000,
  raider: 18000,
  corsair: 18000,

  warlord: 28000,
  paladin: 28000,
  eagleeye: 26000,
  tempest: 26000,
  stormbringer: 32000,
  chronicle: 32000,
  nightblade: 26000,
  duelist: 26000,
  stormcaptain: 30000,
  powdermaster: 30000,

  warbringer: 48000,
  crusader: 48000,
  deadeye: 44000,
  skylord: 44000,
  arclord: 52000,
  eternal: 52000,
  shadowlord: 44000,
  blademaster: 44000,
  seaking: 56000,
  dreadnought: 60000,
};

export const ULT5_MIN = 5000;
export const ULT5_MAX = 30000;
export const ULT5B_MIN = 10000;
export const ULT5B_MAX = 60000;

/** 1차 시전 시간 조회. 미등록 직업은 계열 기본값으로 폴백하고, 결과는 항상 대역 안이다. */
export function ult5HoldOf(key: string | null | undefined, fam?: string | null): number {
  const v = (key && ULT5_HOLD_MS[key]) || (fam && ULT5_HOLD_MS[fam]) || 6000;
  return Math.max(ULT5_MIN, Math.min(ULT5_MAX, v));
}

/** 2차 시전 시간 조회. */
export function ult5bHoldOf(key: string | null | undefined, fam?: string | null): number {
  const v = (key && ULT5B_HOLD_MS[key]) || (fam && ULT5B_HOLD_MS[fam]) || 12000;
  return Math.max(ULT5B_MIN, Math.min(ULT5B_MAX, v));
}
