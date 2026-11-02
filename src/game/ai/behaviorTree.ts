/**
 * behaviorTree.ts — vc234 비헤이비어 트리 런타임 (CERTZ)
 *
 * [왜 추가하는가]
 *  `ai/utility.ts` + `ai/morale.ts` 로 **연속적 등급 판단**은 이미 갖춰져 있다
 *  (싸울까/물러날까/도망칠까). 빠진 것은 **구조와 우선순위**다:
 *    · "죽었으면 즉시 정지" · "게이트 방어 중이면 진군" · "어그로 밖이면 배회" 같은
 *      *순서가 있는 분기*는 Utility 점수로 표현하기 나쁘다. 점수는 "얼마나 원하는가"를
 *      답하지만 "무조건 이것 먼저"는 답하지 못한다.
 *    · 기존 Enemy 는 이 분기를 `tick()` 안의 긴 if/return 으로 처리했다(게이트 진군,
 *      프롤로그 유예, 거리 스로틀…). 분기가 늘 때마다 함수가 길어지고 서로를 가린다.
 *
 *  BT 는 그 부분을 트리 모양으로 바꾼다. **모양이 곧 설계도**라서, 어떤 조건이 어떤
 *  행동을 이기는지 한눈에 보인다.
 *
 * [설계 근거 — agd-ai-behavior-trees-utility-ai]
 *  · 상태는 3값(Success/Failure/Running). 이 계약이 합성을 가능하게 한다.
 *  · Running 은 "다음 틱에 여기서 재개"를 뜻한다. 루트부터 재시작하면 안 된다.
 *  · 메모리 Sequence 는 `[조건, 행동]` 에서 행동이 Running 이면 조건을 다시 보지
 *    않는다 → "시야를 잃어도 계속 추격". 그래서 **ReactiveSequence** 를 별도 제공한다.
 *  · Cooldown 은 Reset 에서 초기화하지 않는다. 초기화하면 분기를 깜빡여 우회된다.
 *  · 트리·노드는 스폰 시 1회 생성. 틱마다 노드/배열/클로저를 만들지 않는다.
 *
 *  Utility 와의 역할 분담(하이브리드):
 *    BT   = 구조 · 우선순위 · 중단        (이 파일)
 *    UTIL = 그 안에서의 등급 판단         (utility.ts / morale.ts)
 */

/* 상태 3값.
 * enum 을 쓰지 않는 이유: node --experimental-strip-types(strip-only)가 enum 을
 * 지원하지 않아 단위 테스트로 검증할 수 없다. const 객체 + union 타입이면
 * 같은 안전성을 얻으면서 런타임 그대로 실행된다. */
export const Status = {
  Success: 0,
  Failure: 1,
  Running: 2,
} as const;
export type Status = (typeof Status)[keyof typeof Status];

/** 노드가 공유하는 타입화된 메모리. 노드끼리 직접 참조하지 않게 한다. */
export class Blackboard {
  private readonly nums = new Map<string, number>();
  private readonly bools = new Map<string, boolean>();

  num(k: string, def = 0): number {
    const v = this.nums.get(k);
    return v === undefined ? def : v;
  }
  set(k: string, v: number): void {
    this.nums.set(k, v);
  }
  bool(k: string): boolean {
    return this.bools.get(k) ?? false;
  }
  setBool(k: string, v: boolean): void {
    this.bools.set(k, v);
  }
  clear(): void {
    this.nums.clear();
    this.bools.clear();
  }
}

export abstract class Node {
  /** 부모가 이 서브트리를 포기할 때 — 진행 중 상태를 버린다. */
  reset(): void {
    /* 기본 무상태 */
  }
  abstract tick(bb: Blackboard, dt: number): Status;
}

/** 자식 중 첫 비-실패를 반환 (OR / 폴백). Running 자식에서 재개. */
export class Selector extends Node {
  private cur = 0;
  private readonly children: Node[];
  constructor(children: Node[]) {
    super();
    this.children = children;
  }
  tick(bb: Blackboard, dt: number): Status {
    for (; this.cur < this.children.length; this.cur++) {
      const s = this.children[this.cur].tick(bb, dt);
      if (s === Status.Running) return Status.Running;
      if (s === Status.Success) {
        this.cur = 0;
        return Status.Success;
      }
    }
    this.cur = 0;
    return Status.Failure;
  }
  reset(): void {
    this.cur = 0;
    for (const c of this.children) c.reset();
  }
}

/** 자식 전부 성공해야 성공 (AND / 순차). **메모리형** — Running 자식에서 재개. */
export class Sequence extends Node {
  private cur = 0;
  private readonly children: Node[];
  constructor(children: Node[]) {
    super();
    this.children = children;
  }
  tick(bb: Blackboard, dt: number): Status {
    for (; this.cur < this.children.length; this.cur++) {
      const s = this.children[this.cur].tick(bb, dt);
      if (s === Status.Running) return Status.Running;
      if (s === Status.Failure) {
        this.cur = 0;
        return Status.Failure;
      }
    }
    this.cur = 0;
    return Status.Success;
  }
  reset(): void {
    this.cur = 0;
    for (const c of this.children) c.reset();
  }
}

/**
 * 반응형 시퀀스 — **매 틱 첫 자식부터 재검사**.
 * `[조건, Running 행동]` 에서 조건이 깨지면 즉시 중단된다(시야 상실·어그로 이탈 등).
 */
export class ReactiveSequence extends Node {
  private readonly children: Node[];
  constructor(children: Node[]) {
    super();
    this.children = children;
  }
  tick(bb: Blackboard, dt: number): Status {
    for (let i = 0; i < this.children.length; i++) {
      const s = this.children[i].tick(bb, dt);
      if (s === Status.Running) return Status.Running;
      if (s === Status.Failure) return Status.Failure;
    }
    return Status.Success;
  }
  reset(): void {
    for (const c of this.children) c.reset();
  }
}

/** 조건 리프 — 즉시 판정. */
export class Condition extends Node {
  private readonly fn: (bb: Blackboard) => boolean;
  constructor(fn: (bb: Blackboard) => boolean) {
    super();
    this.fn = fn;
  }
  tick(bb: Blackboard): Status {
    return this.fn(bb) ? Status.Success : Status.Failure;
  }
}

/** 행동 리프 — Running 을 반환하면 다음 틱에 이어서 실행된다. */
export class Action extends Node {
  private readonly fn: (bb: Blackboard, dt: number) => Status;
  constructor(fn: (bb: Blackboard, dt: number) => Status) {
    super();
    this.fn = fn;
  }
  tick(bb: Blackboard, dt: number): Status {
    return this.fn(bb, dt);
  }
}

/** 자식 결과 반전. */
export class Inverter extends Node {
  private readonly child: Node;
  constructor(child: Node) {
    super();
    this.child = child;
  }
  tick(bb: Blackboard, dt: number): Status {
    const s = this.child.tick(bb, dt);
    if (s === Status.Running) return s;
    return s === Status.Success ? Status.Failure : Status.Success;
  }
  reset(): void {
    this.child.reset();
  }
}

/**
 * 쿨다운 — 자식이 성공하면 `ms` 동안 실패로 막는다.
 * **reset() 에서 남은 시간을 지우지 않는다**(분기 깜빡임으로 우회하는 것을 방지).
 */
export class Cooldown extends Node {
  private remain = 0;
  private readonly child: Node;
  private readonly ms: number;
  constructor(child: Node, ms: number) {
    super();
    this.child = child;
    this.ms = ms;
  }
  tick(bb: Blackboard, dt: number): Status {
    if (this.remain > 0) {
      /* vc234 — 종전엔 `remain -= dt; return Failure` 라서, 차감 결과가 음수가 되면
       * `remain > 0` 이 영원히 거짓이 되어 **재실행되지 않았다**(테스트로 발견).
       * 0 으로 클램프해 다음 호출에서 반드시 자식이 실행되게 한다. */
      this.remain = Math.max(0, this.remain - dt);
      return Status.Failure;
    }
    const s = this.child.tick(bb, dt);
    if (s === Status.Success) this.remain = this.ms;
    return s;
  }
  reset(): void {
    /* 의도적으로 remain 유지 */
    this.child.reset();
  }
}

/** 항상 성공 — "이 분기를 마쳤다"로 처리하고 싶을 때. */
export class AlwaysSucceed extends Node {
  private readonly child: Node;
  constructor(child: Node) {
    super();
    this.child = child;
  }
  tick(bb: Blackboard, dt: number): Status {
    const s = this.child.tick(bb, dt);
    return s === Status.Running ? s : Status.Success;
  }
  reset(): void {
    this.child.reset();
  }
}
