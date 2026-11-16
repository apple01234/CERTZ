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
 * 궁극기 타격 식별 (2026-11-15) — **시전 단위**다. 종전엔 "tag 한 값과 같은 피해"로 골라
 *  시전 중 기본공격이 우연히 같은 값이면 예산 인출로 바뀌었다. 이제 Player.ultCtx(지금 실행 중인
 *  궁극기 코드의 예산)가 있을 때만 인출한다. 궁극기가 만든 지연 실행·장판·투사체는 만들 때의
 *  예산을 들고 가서 맞힐 때 다시 켠다(Player.inUlt). 피해량 값은 보지 않는다. */
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

/** 인출할 예산이 없을 때 돌려주는 값 — 0 이면 호출부(Enemy/Boss.takeDamage)가 타격 자체를 버린다.
 *  최소 1 을 남기면 잔존 장판이 틱마다 1 씩 계속 넣어 상한을 조금씩 넘긴다(실측 60틱 → +60). */
export const MIN_DRAW = 0;

export type UltBudget<T extends object = object> = {
  /** 이 시전의 직접 타격이 표적에게 피해를 넣기 직전 호출 — 예산 인출액을 돌려준다.
   *  wave 지급 중이면 받은 값을 그대로 돌려준다.
   *  시전이 닫힌(close) 뒤에도 **이 시전의 남은 예산 안에서만** 돌려준다 — 잔존 장판·늦은 투사체가
   *  상한을 넘기지 않게. 남은 예산이 없으면 MIN_DRAW. */
  draw(target: T, dmg: number): number;
  /** 시전 종료 — 이후 이 시전이 만든 잔존 공격은 남은 예산에서만 인출한다(총 피해 상한 유지). */
  close(): void;
  /** i 번째 wave 가 이 표적에게 줄 피해. 마지막 wave 는 남은 전액. */
  payout(index: number, target: T): number;
  /** 지급 없이 이 표적의 남은 예산을 소멸시킨다 — 방어막(피해 무효)으로 마지막 wave 까지
   *  막힌 경우, 남은 몫을 잔존 장판이 나중에 꺼내 쓰지 못하게 한다(방어막이 의미를 갖도록). */
  settle(index: number, target: T): void;
  /** 이미 한 번이라도 맞은 표적들 — wave 가 범위 밖이어도 끝까지 지급한다. */
  targets(): T[];
  /** wave 지급 타격을 넣는 동안은 인출하지 않는다. */
  paying(fn: () => void): void;
};

export function createUltBudget<T extends object = object>(waves: number, perTarget: number): UltBudget<T> {
  let closed = false;
  const left = new Map<T, { direct: number; rest: number }>();
  let next = 0; // 아직 지급하지 않은 첫 wave
  let inPayout = false;
  const weightFrom = (i: number) => { let w = 0; for (let k = i; k < waves; k++) w += waveWeight(k, waves); return w; };
  const total = weightFrom(0);
  /* 늦게 들어온 표적은 남은 wave 몫만 받는다(끝날 때 들어와 전액을 한 방에 받지 않게).
   *  2026-11-16 — 시전이 **닫힌 뒤** 처음 맞는 표적은 남은 wave 가 없으므로 그 규칙을 쓰면 예산이
   *  0 이 되어 잔존 장판이 아무 피해도 못 준다. 이때는 그 표적의 **전액**을 준다 — 상한은
   *  "표적당 예산"이지 "시전당 예산"이 아니므로, 표적마다 예산 하나를 갖는 것이 설계 그대로다. */
  const of = (t: T, from = closed ? 0 : next) => {
    let st = left.get(t);
    if (!st) {
      const rest = Math.round(perTarget * (total > 0 ? weightFrom(Math.min(from, waves)) / total : 0));
      st = { direct: rest * DIRECT_SHARE, rest };
      left.set(t, st);
    }
    return st;
  };
  return {
    draw(target, dmg) {
      if (inPayout) return dmg;
      /* 2026-11-16 (외부 평가 P0) — 종전엔 닫힌 뒤(close) 굴린 값을 그대로 돌려줬다. 그래서
       *  30초 잔존 장판·늦게 도착한 투사체가 예산 밖 피해를 계속 넣어, 한 시전이 한 표적에게
       *  준 총 피해가 예산의 4배까지 넘겼다(실측: 예산 100,000 → 실제 400,000).
       *  이제 닫힌 뒤에도 **이 표적의 남은 예산 안에서만** 인출한다.
       *  · 시전 중에 이미 예산을 받은 표적 → 남은 몫에서만.
       *  · 시전이 끝난 뒤 처음 맞는 표적 → 그 표적의 예산은 아직 손대지 않았으므로 전액에서.
       *  ⇒ 표적 하나가 이 시전에서 받는 총 피해는 언제나 예산(perTarget) 이하다. */
      const st = of(target);
      /* 굴린 값(dmg)은 쓰지 않는다 — 직접 타격은 연출·타이밍만 담당하고 지급액은 예산이 정한다
       * (직업별 타수·배율 차이가 총 피해를 흔들지 않게 하는 원래 설계).
       * 닫힌 뒤에도 **같은 인출 규칙**을 쓴다. 달라지는 것은 wave 가 더 이상 예산을 채우지
       * 않는다는 것뿐이라, 잔존 장판·늦은 투사체는 남은 몫까지만 꺼내 쓸 수 있다. */
      const out = Math.max(0, Math.min(Math.round(st.direct * DIRECT_DRAW), st.rest));
      st.direct -= out;
      st.rest -= out;
      return Math.max(MIN_DRAW, out);
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
    close() { closed = true; },
    /* 2026-11-16 (외부 평가 P0) — 마지막 wave 까지 방어막이 유지되면 그 표적의 남은 예산은
     *  끝내 지급되지 않는다. 그 몫을 **소멸**시킨다. 소멸시키지 않으면 닫힌 뒤 잔존 장판이
     *  "남은 예산"으로 꺼내 써서, 방어막으로 막은 피해가 몇 초 뒤 그대로 들어간다(방어막 무의미). */
    settle(index, target) {
      const st = of(target, index);
      st.rest = 0;
      st.direct = 0;
      next = Math.max(next, index + 1);
    },
    paying(fn) {
      inPayout = true;
      try { fn(); } finally { inPayout = false; }
    },
  };
}
