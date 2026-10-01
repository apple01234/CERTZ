/**
 * 범용 유한 상태 머신 (Finite State Machine)
 *
 * 게임 AI의 행동 상태를 데이터로 분리한다. 각 상태는 enter/update/exit 훅을 가지며,
 * update()가 상태 이름을 반환하면 그 즉시 전이한다 — 조건 분기가 상태 안으로 들어가므로
 * switch-case 남발 없이 상태 추가(예: 원거리형 몬스터의 keepDistance 상태)가 자유롭다.
 *
 * 사용 예 (거리 기반 3밴드 AI):
 *   LONG  (dist > aggro)        → wander : 배회, 플레이어 접근 시 MID로
 *   MID   (dist <= aggro)       → chase  : 추격, 근접하면 SHORT로
 *   SHORT (dist <= 공격범위)    → windup : 예고 동작 후 공격 → cooldown(회복)
 */
export interface FSMState<C> {
  name: string;
  /** 상태 진입 시 1회 호출 (prev: 이전 상태, 초기 진입이면 null) */
  enter?(ctx: C, prev: string | null): void;
  /** 매 프레임 호출 — 상태 이름을 반환하면 그 상태로 전이, void면 유지 */
  update?(ctx: C, dt: number): string | void;
  /** 상태 탈출 시 1회 호출 (next: 다음 상태) */
  exit?(ctx: C, next: string | null): void;
}

export class FSM<C> {
  private states = new Map<string, FSMState<C>>();

  /** 현재 상태 이름 (초기값 null — 첫 set()까지) */
  current: string | null = null;

  /** 현재 상태에 머문 시간 (ms) — 상태 전이 시 0으로 리셋 */
  timeInState = 0;

  constructor(private ctx: C) {}

  /** 상태 등록 (가변 인자로 한 번에 등록 가능) */
  add(...states: FSMState<C>[]): this {
    for (const s of states) this.states.set(s.name, s);
    return this;
  }

  /** 상태 전이. force=true면 같은 상태로의 전이도 exit/enter를 다시 실행 */
  set(name: string, force = false) {
    if (name === this.current && !force) return;
    const prev = this.current;
    if (prev !== null) this.states.get(prev)?.exit?.(this.ctx, name);
    this.current = name;
    this.timeInState = 0;
    this.states.get(name)?.enter?.(this.ctx, prev);
  }

  /** 매 프레임 호출 — update 훅의 반환값(상태 이름)이 있으면 전이 */
  update(dt: number) {
    if (this.current === null) return;
    this.timeInState += dt;
    const next = this.states.get(this.current)?.update?.(this.ctx, dt);
    if (typeof next === "string") this.set(next);
  }
}
