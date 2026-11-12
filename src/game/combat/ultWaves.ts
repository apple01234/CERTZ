/**
 * vc278 — 궁극기 지속 타격(wave) 시스템.
 *
 * ── 왜 필요한가 (실측) ──
 * 4차 10종 궁극기의 시전 시간(hold)과 실제 타격 시점을 대조한 결과:
 *
 *   직업          시전(hold)   최대 타격시점   공백        타격비율
 *   arclord        26,000ms        560ms    25,440ms     2.2%
 *   blademaster    22,000ms          0ms    22,000ms     0.0%
 *   crusader       24,000ms        280ms    23,720ms     1.2%
 *   deadeye        22,000ms        240ms    21,760ms     1.1%
 *   dreadnought    30,000ms      1,300ms    28,700ms     4.3%
 *   eternal        26,000ms        300ms    25,700ms     1.2%
 *   seaking        28,000ms        200ms    27,800ms     0.7%
 *   shadowlord     22,000ms        260ms    21,740ms     1.2%
 *   skylord        22,000ms        240ms    21,760ms     1.1%
 *   warbringer     24,000ms        260ms    23,740ms     1.1%
 *
 * 즉 **60초를 기다려 24초 동안 얼어 있는데 때리는 건 0.26초**다. 연출은 도는데
 * 피해가 없다시피 하니 "궁극기가 밋밋하다"로 체감된다. blademaster 는 지연 호출이
 * 아예 0개라 즉발로 끝난다.
 *
 * ── 설계 ──
 * 시전 시간(hold)을 N 구간으로 나눠 각 구간 끝에 소량 피해를 뿌린다.
 * 총 피해량은 **호출부가 주는 계수를 그대로** 쓰므로(아래 share) 기존 밸런스를
 * 깨지 않는다 — 기존 `rd()` 합계를 wave 로 옮기는 것이 아니라,
 * wave 는 **추가 타격**이며 배율은 호출부가 정한다.
 *
 * 순수 계산부(planUltWaves)와 실행부(spawnUltWaves)를 분리한다.
 * 계산부는 Phaser 를 쓰지 않아 노드 테스트에서 그대로 검증된다.
 */

export type WaveTiming = {
  /** 각 웨이브 발동 시각(ms, 시전 시작 기준) */
  at: number[];
  /** 웨이브 간격(ms) */
  interval: number;
};

/**
 * 시전 시간을 웨이브 일정으로 나눈다.
 *
 * - 첫 웨이브는 인트로 연출이 끝난 뒤(startMs)에 온다 — 인트로와 겹치면 안 보인다.
 * - 마지막 웨이브는 종결 연출 전(endPadMs)에 끝난다.
 * - 최소 간격(minIntervalMs)보다 촘촘하면 개수를 줄인다(프레임 부하 방지).
 */
export function planUltWaves(
  holdMs: number,
  opts?: { startMs?: number; endPadMs?: number; minIntervalMs?: number; maxWaves?: number },
): WaveTiming {
  const start = opts?.startMs ?? 600;
  const endPad = opts?.endPadMs ?? 700;
  const minIv = opts?.minIntervalMs ?? 220;
  const maxW = opts?.maxWaves ?? 24;

  const span = Math.max(0, holdMs - start - endPad);
  if (holdMs <= 0) return { at: [], interval: 0 };
  if (span <= 0) {
    /* 창이 인트로+종결 패딩보다 짧다 — 그래도 한 번은 때려야 궁극기가 무의미해지지 않는다.
     * 시작과 끝 사이의 중앙에 1회. hold 자체가 0 이하인 경우는 위에서 이미 걸렀다. */
    return { at: [Math.round(Math.min(holdMs, Math.max(0, holdMs / 2)))], interval: 0 };
  }

  // 목표 간격은 span 을 최대 웨이브 수로 나눈 값과 최소 간격 중 큰 쪽
  let interval = Math.max(minIv, Math.round(span / maxW));
  let count = Math.floor(span / interval);
  if (count < 1) {
    // 창이 최소 간격보다 짧으면 한 번만, 창 중앙에
    return { at: [Math.round(start + span / 2)], interval: 0 };
  }
  if (count > maxW) count = maxW;

  const at: number[] = [];
  for (let i = 0; i < count; i++) {
    // 첫 웨이브는 start, 마지막은 start+span 근처에 오도록 균등 배치
    at.push(Math.round(start + (span * i) / Math.max(1, count - 1 || 1)));
  }
  interval = count > 1 ? Math.round(span / (count - 1)) : 0;
  return { at, interval };
}

/** 웨이브가 몇 번째인지에 따른 강도 배율 — 뒤로 갈수록 조금씩 강해진다(고조). */
export function waveIntensity(index: number, total: number): number {
  if (total <= 1) return 1;
  const t = index / (total - 1); // 0..1
  return 0.7 + 0.6 * t; // 0.7 → 1.3
}
