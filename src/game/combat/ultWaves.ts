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

/* ═══ 2026-11-13 — 궁극기 개편: 표적당 고정 예산 (유저 지시 "시전시간은 직업마다 다르게, 총 딜은 같게") ═══
 * [종전] 총 피해 = 직업 case 가 굴린 타격의 합. 타수·배율·적중률이 직업마다 달라 실측 38배 차이였다
 *  (docs/qa/2026-11-12/ult-waves). 2차 궁극기는 wave 도 없었다.
 * [지금] 궁극기 한 번이 **표적 하나에게 주는 총 피해는 예산(perTarget) 하나로 고정**이다.
 *  · 직업 case 의 타격(연출·타이밍은 그대로)은 굴린 값을 쓰지 않고 예산에서 조금씩 꺼내 쓴다(draw).
 *    합쳐서 예산의 DIRECT_SHARE 를 넘지 못한다 — 타수가 4든 125든 같다.
 *  · 나머지는 시전 시간(hold) 전체에 깔린 wave 가 지급하고, 마지막 wave 가 남은 전액을 준다(종결).
 *  ⇒ 시전 시간이 긴 직업은 천천히, 짧은 직업은 몰아서 — 총량은 같다.
 * 궁극기 타격 식별은 "tag 한 값과 같은 피해"다(값에 꼬리표를 달 수 없다). 시전 중 기본공격이
 *  우연히 같은 값이면 그 한 대가 예산 인출로 바뀐다 — 총량은 여전히 예산 이하다. */
export const ULT_BUDGET_MULT = 28;
export const DIRECT_SHARE = 0.5;
export const DIRECT_DRAW = 0.12;
export const WAVE_FINALE_SHARE = 0.4;

/** i 번째 wave 의 지급 가중치 — 고조(0.7→1.3) 뒤 마지막 한 번이 종결(전체 가중치의 FINALE_SHARE). */
export function waveWeight(index: number, total: number): number {
  if (total <= 1 || index < total - 1) return waveIntensity(index, total);
  let others = 0;
  for (let k = 0; k < total - 1; k++) others += waveIntensity(k, total);
  return (others * WAVE_FINALE_SHARE) / (1 - WAVE_FINALE_SHARE);
}

export type UltBudget<T extends object = object> = {
  /** 궁극기 타격으로 굴린 값을 등록한다(그대로 돌려준다). */
  tag(dmg: number): number;
  /** 표적이 피해를 받기 직전 호출 — 등록된 값이면 예산 인출액으로 바꿔 돌려준다. */
  draw(target: T, dmg: number): number;
  /** i 번째 wave 가 이 표적에게 줄 피해. 마지막 wave 는 남은 전액. */
  payout(index: number, target: T): number;
  /** 이미 한 번이라도 맞은 표적들 — wave 가 범위 밖이어도 끝까지 지급한다. */
  targets(): T[];
  /** wave 지급 타격을 넣는 동안은 인출하지 않는다. */
  paying(fn: () => void): void;
};

export function createUltBudget<T extends object = object>(waves: number, perTarget: number): UltBudget<T> {
  const tags = new Set<number>();
  const left = new Map<T, { direct: number; rest: number }>();
  let next = 0; // 아직 지급하지 않은 첫 wave
  let inPayout = false;
  const weightFrom = (i: number) => { let w = 0; for (let k = i; k < waves; k++) w += waveWeight(k, waves); return w; };
  const total = weightFrom(0);
  /* 늦게 들어온 표적은 남은 wave 몫만 받는다(끝날 때 들어와 전액을 한 방에 받지 않게). */
  const of = (t: T, from = next) => {
    let st = left.get(t);
    if (!st) {
      const rest = Math.round(perTarget * (total > 0 ? weightFrom(Math.min(from, waves)) / total : 0));
      st = { direct: rest * DIRECT_SHARE, rest };
      left.set(t, st);
    }
    return st;
  };
  return {
    tag(dmg) { tags.add(dmg); return dmg; },
    draw(target, dmg) {
      if (inPayout || !tags.has(dmg)) return dmg;
      const st = of(target);
      const out = Math.max(0, Math.min(Math.round(st.direct * DIRECT_DRAW), st.rest));
      st.direct -= out; st.rest -= out;
      return Math.max(1, out);
    },
    payout(index, target) {
      const st = of(target, index);
      next = Math.max(next, index + 1);
      const w = weightFrom(index);
      const amount = index >= waves - 1 || w <= 0 ? st.rest : Math.round((st.rest * waveWeight(index, waves)) / w);
      st.rest -= amount;
      st.direct = Math.min(st.direct, st.rest);
      return amount;
    },
    targets() { return [...left.keys()]; },
    paying(fn) {
      inPayout = true;
      try { fn(); } finally { inPayout = false; }
    },
  };
}
