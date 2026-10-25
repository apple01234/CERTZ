/**
 * vc183 (사용자 지시 — "적에게도 방어력 개념 만들어") — 적/보스 피해 감소.
 *
 * 설계 의도:
 *  종전엔 플레이어만 방어력(applyDefense)을 갖고 적은 무조건 100% 피해를 받았다.
 *  그래서 "단단한 골렘"과 "물렁한 박쥐"가 맞는 느낌이 같았고, 고차 스킬의 피해량이
 *  그대로 꽂혀 후반 적이 종이처럼 녹았다.
 *
 *  감산식을 두 겹으로 쓴다:
 *   · 정액 감산(def)      — 초반 체감. "딱딱한 놈은 확실히 덜 박힌다".
 *   · 비율 감소(defPct)   — 후반 스케일. 공격력이 수만이 되어도 감소가 유효하다.
 *  정액만 쓰면 후반에 무의미해지고, 비율만 쓰면 초반 차이가 안 느껴진다.
 *
 *  안전 규칙:
 *   · 최소 피해 1 보장 — 방어력이 공격력을 넘어도 0이 되지 않는다(진행 불가 방지).
 *   · def/defPct 미지정(0)이면 종전과 완전히 동일 — 기존 밸런스 회귀 없음.
 *   · 감소율 상한 75% — 방어력 스택으로 보스가 무적이 되는 것을 막는다.
 */

export type Defender = { def?: number; defPct?: number };

/** 감소율 상한 — 이 이상은 어떤 경우에도 허용하지 않는다. */
export const MAX_REDUCTION = 0.75;

/**
 * 적이 받는 최종 피해를 계산한다.
 * @param raw 원본 피해(원소 상성·특화 보너스 반영 후)
 * @param defender def/defPct 를 가진 적 또는 보스
 */
export function mitigateEnemyDamage(raw: number, defender: Defender | null | undefined): number {
  const flat = Math.max(0, defender?.def ?? 0);
  const pct = Math.min(MAX_REDUCTION, Math.max(0, defender?.defPct ?? 0));
  if (flat === 0 && pct === 0) return Math.max(1, Math.round(raw));
  const afterFlat = raw - flat;
  if (afterFlat <= 0) return 1; // 방어력이 공격을 삼켜도 최소 1은 들어간다
  return Math.max(1, Math.round(afterFlat * (1 - pct)));
}
