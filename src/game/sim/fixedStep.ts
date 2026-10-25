/**
 * vc183 (지시 — 액터 기반 결정적 시뮬레이션 문서) — 고정 틱 시뮬레이션 루프.
 *
 * 문제:
 *  지금 몬스터 AI·투사체는 `update`/`tick` 에서 매 프레임(dt 가변) 돌아간다.
 *  60fps 기기에서는 초당 60번, 30fps 기기에서는 30번 계산한다는 뜻이다. 그래서
 *   · 기기마다 몬스터 반응 속도가 다르고 (저사양일수록 굼뜨다)
 *   · 프레임이 튀는 순간 dt 가 커져 AI 판정이 한꺼번에 몰린다 (발열 스파이크)
 *   · 문서가 말하는 "결정론"이 성립하지 않는다 (같은 입력 → 다른 결과)
 *
 * 해결:
 *  시뮬레이션을 20Hz(50ms) 고정 스텝으로 끊고, 렌더는 그 사이를 보간한다.
 *  문서(David Salz, GDC 2016)의 핵심 구조 그대로다 — 20Hz 시뮬 + 60Hz 렌더.
 *
 *  · 누적기(accumulator) 방식: 실제 경과 시간을 모아 50ms 가 차면 한 스텝 진행.
 *  · 최대 스텝 수 제한(MAX_STEPS): 기기 절전/탭 전환 후 복귀할 때 수백 스텝이
 *    몰려 "한 프레임에 몇 초치 AI" 가 도는 것을 막는다(터널링·프리즈 방지).
 *  · 나머지 시간(remainder)은 렌더 보간 계수로 쓴다 — 60fps 면 0~1 사이 값.
 *
 * 왜 20Hz 인가:
 *  · 20Hz 면 초당 AI 갱신 20회 — 60fps 대비 연산 1/3. S20+ 발열에 직접 영향.
 *  · 그런데 20Hz 는 사람이 "반응이 느리다"고 느끼는 경계(약 15Hz)보다 위라
 *    몬스터가 굼떠 보이지 않는다.
 *  · 투사체처럼 빠른 것은 시각만 보간하므로 부드럽게 보인다.
 */

/** 시뮬레이션 주기(ms) — 20Hz */
export const SIM_STEP_MS = 50;

/** 한 프레임에 허용하는 최대 스텝 — 탭 복귀 시 폭주 방지 */
export const MAX_STEPS_PER_FRAME = 4;

export class FixedStepSim {
  private acc = 0;
  /** 지금까지 진행한 총 스텝 수 — 문서의 SimulationTick 에 해당. 난수 시드 결합에 쓴다. */
  private tickCount = 0;

  /** 현재 보간 계수 0~1 — 렌더에서 "이전 상태 → 다음 상태" 사이를 얼마나 갈지 */
  get alpha(): number {
    return Math.min(1, this.acc / SIM_STEP_MS);
  }

  /** 누적 스텝 수 (결정론 검증/로그용) */
  get tick(): number {
    return this.tickCount;
  }

  /**
   * 프레임 시간을 넣고, 이번 프레임에 돌릴 스텝 수를 돌려준다.
   * 호출 측은 반환된 횟수만큼 step 콜백을 실행하면 된다.
   *
   * @param deltaMs 실제 경과 시간(ms). 이상값(0/음수/NaN)은 1스텝 상한으로 방어.
   */
  advance(deltaMs: number): number {
    /* 비정상 delta 방어 — 첫 프레임이나 탭 복귀 직후 수천 ms 가 들어온다.
     * SIM_STEP_MS*MAX_STEPS 를 넘는 값은 잘라서 폭주를 막는다. */
    const dt = Number.isFinite(deltaMs) && deltaMs > 0 ? Math.min(deltaMs, SIM_STEP_MS * MAX_STEPS_PER_FRAME) : SIM_STEP_MS;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= SIM_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      this.acc -= SIM_STEP_MS;
      this.tickCount++;
      steps++;
    }
    /* 스텝 상한에 걸려 남은 누적은 버린다 — 다음 프레임에 밀린 스텝이 쌓이면
     * 영원히 따라잡기 상태(스파이럴)에 빠진다. */
    if (this.acc > SIM_STEP_MS * MAX_STEPS_PER_FRAME) this.acc = 0;
    return steps;
  }

  /** 씬 재시작 시 초기화 */
  reset(): void {
    this.acc = 0;
    this.tickCount = 0;
  }
}

/**
 * 고정 스텝 시뮬레이션을 관리하는 믹스인 형태 헬퍼.
 * WorldScene 이 소유하고, 몬스터 AI/투사체 갱신에만 사용한다.
 * (플레이어 입력·충돌은 즉시 반응이 중요하므로 매 프레임 유지 — 여기 넣지 않는다)
 */
export type SimRunner = {
  /** 매 프레임 호출 — 내부에서 필요한 만큼 step 을 돌린다 */
  update(deltaMs: number, step: (tick: number) => void): void;
  readonly alpha: number;
  readonly tick: number;
  reset(): void;
};

export function createSimRunner(): SimRunner {
  const sim = new FixedStepSim();
  return {
    update(deltaMs: number, step: (tick: number) => void) {
      const n = sim.advance(deltaMs);
      for (let i = 0; i < n; i++) step(sim.tick);
    },
    get alpha() {
      return sim.alpha;
    },
    get tick() {
      return sim.tick;
    },
    reset() {
      sim.reset();
    },
  };
}
