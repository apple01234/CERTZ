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

/* ═══ 2026-11-12 — 총 피해 예산 정규화 (240 지시서 121·122) ═══
 * [실측] wave 가 기존 직접 피해 **위에** 더해져 직업별 +3% ~ +90% 였고(주석은 "늘리지 않는다"),
 *  직접 타격은 1.7~7초에 끝나는데 wave 는 시전 창 끝(21~30초)까지 이어져 종결 뒤에도 피해가 났다
 *  (docs/qa/2026-11-12/ult-waves).
 * [지금] 궁극기 한 번의 총 피해는 **직접 타격이 굴린 값 그대로**다. 직접 타격은 WAVE_SHARE 만큼
 *  줄여 넣고, 그 타격이 **실제로 적에게 들어갈 때마다** 줄인 만큼을 풀에 적립해 wave 가 나눠 지급한다.
 *  마지막 wave 는 풀의 FINALE_SHARE 이상을 가져가는 종결이다: 개막 연타(70%) → 고조되는 wave → 종결.
 * [왜 굴릴 때가 아니라 들어갈 때 적립하나] 한 번 굴린 값을 여러 번/여러 적에게 넣는 직업이 있다
 *  (deadeye 는 한 발이 2회 적중). 굴릴 때 적립하면 그런 직업만 총 피해가 줄었다(실측 82%).
 * ponytail: 직업 간 직접 피해 합 자체의 격차(실측 최대 38배)는 여기서 다루지 않는다 — 직업별
 *  배율 재설계(지시서 126~139)의 몫이다. 이 풀은 각 직업의 기존 총량을 보존만 한다. */
export const WAVE_SHARE = 0.3;
export const WAVE_FINALE_SHARE = 0.4;

/** i 번째 wave 의 지급 가중치 — 고조(0.7→1.3) 뒤 마지막 한 번이 종결(전체 가중치의 FINALE_SHARE). */
export function waveWeight(index: number, total: number): number {
  if (total <= 1 || index < total - 1) return waveIntensity(index, total);
  let others = 0;
  for (let k = 0; k < total - 1; k++) others += waveIntensity(k, total);
  return (others * WAVE_FINALE_SHARE) / (1 - WAVE_FINALE_SHARE);
}

export type WavePool = {
  /** 직접 타격이 굴린 피해 → 줄여서 넣을 피해. 남은 wave 가 없으면 줄이지 않는다. */
  reduce(dmg: number): number;
  /** 적에게 실제로 들어간 피해 통보 — reduce 가 내준 값이면 줄인 만큼을 풀에 적립한다. */
  credit(applied: number): void;
  /** i 번째 wave 가 지급할 총액(범위 안 표적들에게 나눠 준다). 표적이 없으면 다음 wave 로 이월. */
  payout(index: number, hasTargets: boolean): number;
  /** wave 지급 타격을 넣는 동안은 적립하지 않는다(자기 지급을 다시 적립하는 고리 방지). */
  paying(fn: () => void): void;
};

export function createWavePool(waves: number): WavePool {
  let pool = 0;
  let next = 0; // 아직 지급하지 않은 첫 wave
  let inPayout = false;
  const reduced = new Set<number>();
  return {
    reduce(dmg) {
      if (next >= waves || !(dmg > 0)) return dmg;
      const out = dmg - Math.round(dmg * WAVE_SHARE);
      reduced.add(out);
      return out;
    },
    credit(applied) {
      if (inPayout || next >= waves || !reduced.has(applied)) return;
      pool += Math.round((applied * WAVE_SHARE) / (1 - WAVE_SHARE));
    },
    payout(index, hasTargets) {
      next = index + 1;
      if (!hasTargets || pool <= 0) return 0;
      let rest = 0;
      for (let k = index; k < waves; k++) rest += waveWeight(k, waves);
      const amount = Math.round((pool * waveWeight(index, waves)) / rest);
      pool -= amount;
      return amount;
    },
    paying(fn) {
      inPayout = true;
      try { fn(); } finally { inPayout = false; }
    },
  };
}
