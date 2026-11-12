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
 *     (이 규칙은 **시전 시간**에만 해당한다 — 딜배율은 아래 #9 규칙이 따로 정한다)
 *
 * ── 극딜 지속시간 ↔ 딜배율 (유저 지시 #9) ──────────────────────────────
 * 종전 위 문장이 이 파일의 **유일한** 규칙처럼 적혀 있었지만, 사실은 반쪽이었다.
 *   "직업별로 극딜 지속시간이 짧은 직업들은 딜 배율을 높게 하고,
 *    긴 직업들은 짧은 직업에 비해 딜 배율을 좀 적게 해"
 *
 * 창이 길다 = 같은 배율로 더 오래 때린다 = 총 피해가 그냥 더 크다. 손대지 않으면
 * 시전이 긴 4차 직업이 극딜 총량에서 항상 이기고, 짧은 창 직업(전사/궁수/도적 1차·
 * 2차 라인)은 구조적으로 불리하다. 그래서 **창 길이의 역수**로 배율을 보정한다:
 *
 *   짧은 창 → 높은 배율 (몰아서 터뜨린다 · spiky)
 *   긴 창   → 낮은 배율 (고르게 갈린다 · steady)
 *   ⇒ 창 길이 × 배율 ≈ 일정 = "한 번의 극딜" 총량이 직업 간에 비슷해진다.
 *
 * 배율은 **궁극기 피해에만** 곱한다(일반 스킬·기본공격 불변). 1차·2차는 각자 자기
 * 분포로 정규화하므로, 2차가 1차보다 센 기존 비율(×5 ÷ ×3 = 1.67배)은 그대로 남는다.
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

/* ================= 극딜 지속시간 → 딜배율 정규화 (유저 지시 #9) =================
 *
 *  mult(hold) = clamp( (REF / hold) ^ EXP , FLOOR, CEIL )
 *
 * 상수 근거 — 실제 분포(35직업, ULT5_HOLD_MS 실측):
 *   1차: min 6,000 · 중앙 13,000 · 평균 14,557 · max 30,000
 *   2차: min 12,000 · 중앙 26,000 · 평균 29,114 · max 60,000
 *   → 2차는 **전 직업 예외 없이 정확히 1차의 2배**다. 그래서 REF 도 2배로 두면
 *     두 슬롯이 **같은 배율표**를 공유한다(계산도, 검증도 한 벌).
 *
 * EXP = 0.5 (제곱근) — 시간은 선형, 체감 화력은 그만큼 아니다. 1.0(완전 반비례)이면
 *   dreadnought(0.40배) → warrior(2.0배)로 5배 차이가 나 "긴 창 직업이 쓰레기"가 되고,
 *   0.35면 1.76배로 너무 밋밋해 유저가 요구한 차등이 체감되지 않는다.
 *   0.5 는 양 끝 2.2배 → 클램프 후 2.15배 — "확실히 다르지만 누구도 못 쓰는 직업은 없다".
 *
 * REF = 12,000 / 24,000 — 분포의 **기하평균(12,942 / 25,884)** 보다 살짝 아래.
 *   REF 를 그대로 12,000 으로 두는 쪽이 읽기 쉽고, 클램프가 양 끝 4직업에서만
 *   걸려 나머지 31직업은 순수 곡선을 탄다. 평균 배율 0.991 (−0.9%) — 전역 파워크리프 없음.
 *
 * FLOOR = 0.65 / CEIL = 1.40 — 이 이상 벌어지면 직업 선택이 "어떤 극딜을 쓰느냐"가
 *   아니라 "얼마나 세게 때리느냐" 하나로 납작해진다. 10배 같은 배율은 금지.
 *   (실제로 걸리는 곳: 천장 = warrior·ranger·thief 6,000ms / 바닥 = dreadnought 30,000ms)
 *
 * ponytail: 선형 곡선 1개로 충분하다. 지수·구간별 커브가 필요해지면
 *   REF/EXP 를 늘리지 말고 표(per-class)로 바꾸는 게 낫다 — 그때는 테스트의
 *   단조성 단언을 표 검증으로 교체할 것. */
export const BURST_EXP = 0.5;
export const BURST_REF1 = 12000;
export const BURST_REF2 = 24000;
export const BURST_FLOOR = 0.65;
export const BURST_CEIL = 1.4;

/** 시전 시간 → 극딜 배율. 짧을수록 높다 (단조 감소). */
export function burstMultOf(holdMs: number, refMs: number): number {
  const v = Math.pow(refMs / Math.max(1, holdMs), BURST_EXP);
  return Math.max(BURST_FLOOR, Math.min(BURST_CEIL, v));
}

/** 궁극기 슬롯(1|2)의 극딜 배율. 슬롯 0/그 외는 1 (일반 스킬 불변). */
export function ultBurstMultOf(
  slot: number,
  key: string | null | undefined,
  fam?: string | null,
): number {
  if (slot === 1) return burstMultOf(ult5HoldOf(key, fam), BURST_REF1);
  if (slot === 2) return burstMultOf(ult5bHoldOf(key, fam), BURST_REF2);
  return 1;
}

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

/* ═══ 2026-11-12 — 1차 궁극기 직업 간 총 피해 보정 (240 지시서 121·126) ═══
 * 위 #9 규칙의 목표는 "한 번의 극딜 총량이 직업 간에 비슷"인데, 실제 브라우저 실측(공격력 25,
 * 고정 표적 1마리, 치명타 끔 — docs/qa/2026-11-12/ult-waves)에서 4차 10종의 총 피해는
 *   거리 60px : 439 ~ 16,788   /   거리 150px : 439 ~ 16,788 (중앙값 약 1,800)
 * 이었다. 대부분 직업은 표적 거리에 따라 2배 안팎으로 흔들려 정밀 보정의 근거가 못 되지만,
 * 두 거리 모두에서 같은 값으로 벗어난 둘은 구조적 격차다:
 *   deadeye 16,788 (화살 100여 발이 전부 확정 치명으로 한 표적에 꽂힌다) → ×0.25 = 약 4,200 (여전히 최상위)
 *   seaking    439 (직접 타격 4회뿐)                                      → ×3.0  = 약 1,300
 * ponytail: 나머지 8종과 skylord(회오리가 고정 표적을 지나쳐 측정 불가)는 손대지 않았다.
 *  다수 표적·이동 표적까지 재는 측정 장치가 생기면 이 표를 전 직업으로 넓힌다. */
export const ULT5_BUDGET_SCALE: Record<string, number> = { deadeye: 0.25, seaking: 3.0 };
