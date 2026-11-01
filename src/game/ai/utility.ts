/**
 * utility.ts — vc214 Utility AI (행동 점수 기반 선택)
 *
 * 왜 추가하는가
 * -------------
 * 기존 `FSM.ts` 는 **거리 밴드 하나**로 상태를 전이한다
 * (`wander → chase → windup → cooldown`). 그래서 모든 몬스터가 같은 규칙으로
 * 움직이고, "지금 이 적에게 가장 쓸모 있는 행동"을 고르지 못한다. 예를 들어
 *  · 체력이 낮은 적도 무조건 추격한다(도주 고려 없음)
 *  · 원거리형도 근접 거리에서만 판단한다(사거리 개념 없음)
 *  · 여럿이 몰려도 각자 돌진해 서로 겹친다
 *
 * 이 모듈은 각 후보 행동을 **0~1 점수**로 평가해 가장 높은 것을 고른다.
 * `agd-ai-behavior-trees-utility-ai` 스킬의 설계를 그대로 따랐다:
 *   1) 모든 consideration 은 정규화된 0..1 을 반환한다(한 축이 다른 축을 지배하지 않게)
 *   2) 곱셈 결합 + 보상(compensation) — 인자가 늘수록 점수가 0으로 눌리는 것을 막는다
 *   3) 히스테리시스 — 현재 행동에 보너스를 줘 임계 근처에서 깜빡이지 않게 한다
 *   4) 틱마다 노드를 새로 만들지 않는다(GC 스파이크 방지) — 순수 함수 + 스크래치 배열
 *
 * FSM 은 그대로 둔다. 기존 동작이 이미 검증돼 있고(상태 전이·연출·사운드가 붙어 있음),
 * 여기서는 **어느 상태로 갈지 고르는 지점**만 Utility 로 대체 가능하게 열어 둔다.
 */

/** 응답 곡선 — 원시 사실값(raw)을 0..1 로 정규화한다. */
export const Curve = {
  /** 선형: in 이 [lo,hi] 밖이면 0/1 로 클램프 */
  linear(v: number, lo: number, hi: number): number {
    if (hi === lo) return v >= hi ? 1 : 0;
    return clamp01((v - lo) / (hi - lo));
  },

  /** 선형 역방향: 값이 작을수록 높은 점수 (거리처럼 가까울수록 좋은 축) */
  inverse(v: number, near: number, far: number): number {
    if (far === near) return v <= near ? 1 : 0;
    return clamp01((far - v) / (far - near));
  },

  /**
   * 지수: lo 에서 0, hi 에서 1 로 급격히 상승. `power` 가 클수록 문턱이 뾰족하다.
   * (예: 체력 30% 이하에서만 도주가 급격히 매력적이게)
   */
  exponential(v: number, lo: number, hi: number, power = 2): number {
    const t = Curve.linear(v, lo, hi);
    return Math.pow(t, power);
  },

  /** S자(로지스틱): mid 를 중심으로 부드럽게 전환. 경계가 애매한 판단에 적합 */
  sigmoid(v: number, mid: number, k = 8): number {
    return 1 / (1 + Math.exp(-k * (v - mid)));
  },

  /** smoothstep: 양 끝에서 미분이 0 — 움직임이 부드럽게 시작/종료된다 */
  smoothstep(v: number, lo: number, hi: number): number {
    const t = Curve.linear(v, lo, hi);
    return t * t * (3 - 2 * t);
  },
} as const;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * 곱셈 결합 + 보상.
 *
 * 그냥 곱하면 고려 항목이 4개일 때 각 0.8 이어도 0.41 이 되어 "아무것도 하고 싶지 않은"
 * 상태가 된다. 스킬 권장식은 `1 - (1-p1)(1-p2)...` 를 섞어 각 항목의 영향을
 * 항목 수에 비례해 줄인다. 여기서는 단순화해 **곱의 기하평균 쪽으로 보정**한다.
 *
 * @param product 고려 항목들의 곱 (0..1)
 * @param count   고려 항목 수
 * @param strength 0=순수 곱, 1=순수 평균. 0.5 권장
 */
export function compensate(product: number, count: number, strength = 0.5): number {
  /* product 가 0 이면 반드시 0 이어야 한다(스킬 지침: "A 0 in any factor still vetoes
   * the action"). 예전 구현은 Math.max(product, 1e-6) 때문에 0 이 0.0158 로 새어나가
   * 배제돼야 할 행동이 선택될 수 있었다. 0 은 조기 반환으로 확정한다. */
  if (product <= 0) return 0;
  if (count <= 1) return clamp01(product);
  const geo = Math.pow(product, 1 / count);
  return clamp01(product * (1 - strength) + geo * strength);
}

/** 행동 후보 하나. `considerations` 는 순수 함수라 매 틱 새로 만들 필요가 없다. */
export type UtilityAction<C> = {
  /** 행동 식별자 (FSM 상태 이름과 맞추면 그대로 전이에 쓸 수 있다) */
  id: string;
  /** 0..1 을 반환하는 고려 항목들. 하나라도 0 이면 그 행동은 사실상 배제된다. */
  considerations: ((ctx: C) => number)[];
  /** 항목별 가중치(생략 시 1). 길이는 considerations 와 같아야 한다. */
  weights?: number[];
  /** 곱셈 보상 강도 (기본 0.5) */
  compensation?: number;
  /** 고정 가산점 — 항상 우선하고 싶은 행동(예: 피격 반응)에 쓴다 */
  bias?: number;
};

export type UtilityOptions = {
  /** 현재 행동에 주는 보너스. 임계 근처 깜빡임(jitter)을 막는다. 기본 0.06 */
  hysteresis?: number;
  /** 점수가 이 값 미만이면 아무 행동도 고르지 않는다(대기). 기본 0.05 */
  minScore?: number;
};

/**
 * Utility 평가기. **할당 없이** 동작하도록 스크래치 배열을 재사용한다.
 * (스킬 지침: "Build the tree once at spawn; keep per-tick work allocation-free")
 */
export class UtilityEvaluator<C> {
  private scores = new Map<string, number>();
  private readonly opts: Required<UtilityOptions>;
  private readonly actions: UtilityAction<C>[];

  constructor(actions: UtilityAction<C>[], opts: UtilityOptions = {}) {
    this.actions = actions;
    this.opts = {
      hysteresis: opts.hysteresis ?? 0.06,
      minScore: opts.minScore ?? 0.05,
    };
  }

  /** 행동별 점수를 계산해 Map 에 채운다(디버그 오버레이에서 그대로 읽을 수 있다) */
  evaluate(ctx: C, currentId: string | null): Map<string, number> {
    this.scores.clear();
    for (const a of this.actions) {
      let product = 1;
      const n = a.considerations.length;
      for (let i = 0; i < n; i++) {
        const w = a.weights?.[i] ?? 1;
        // 가중치는 지수로 적용한다 — w=2 면 그 항목이 더 강하게 작동
        const v = clamp01(a.considerations[i](ctx));
        product *= Math.pow(v, w);
      }
      let s = compensate(product, n, a.compensation ?? 0.5);
      s += a.bias ?? 0;
      // 히스테리시스: 지금 하고 있는 행동을 살짝 밀어준다
      if (currentId !== null && a.id === currentId) s += this.opts.hysteresis;
      this.scores.set(a.id, s);
    }
    return this.scores;
  }

  /** 가장 높은 점수의 행동 id. 모두 minScore 미만이면 null(대기). */
  select(ctx: C, currentId: string | null): string | null {
    const scores = this.evaluate(ctx, currentId);
    let bestId: string | null = null;
    let best = -Infinity;
    for (const [id, s] of scores) {
      if (s > best) {
        best = s;
        bestId = id;
      }
    }
    return best < this.opts.minScore ? null : bestId;
  }

  /** 마지막 평가 점수(읽기 전용) — 디버그 HUD 용 */
  get lastScores(): ReadonlyMap<string, number> {
    return this.scores;
  }
}
