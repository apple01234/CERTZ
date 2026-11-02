/**
 * enemyBrain.ts — vc234: 적 tick() 의 **계층 분기**를 BT 로 옮긴 결과.
 *
 * [무엇을 옮겼나 — 그리고 무엇을 옮기지 않았나]
 *  Enemy.tick() 안에는 서로 다른 성격의 코드가 섞여 있었다:
 *    (a) 상태 갱신        — 지속피해·기절·넉백 감쇠·HP바 동기화
 *    (b) **우선순위 분기** — 프롤로그 유예 / 게이트 진군 / 거리 스로틀 / 사기 / FSM
 *    (c) 이동 적용        — setVelocity, 애니메이션, 방향
 *
 *  (b) 만 BT 로 옮긴다. (a)와 (c)는 매 프레임 무조건 실행되어야 하는 부수효과라
 *  트리 안에 넣으면 "Running 으로 남아 다음 틱에 재개"되는 성질과 충돌한다.
 *  즉 BT 는 **"지금 무엇을 할지"만** 결정하고, 실행은 Enemy 가 한다.
 *
 *  이 분리는 스킬 지침의 "leaves are small and side-effect-explicit" 를 따른다.
 *
 * [트리 모양 — 위에서부터 우선순위]
 *   Selector
 *   ├─ ReactiveSequence [죽음/더미]        → 정지
 *   ├─ ReactiveSequence [프롤로그 유예]     → 정지
 *   ├─ ReactiveSequence [기절]             → 정지
 *   ├─ ReactiveSequence [게이트 진군]       → 코어로 이동
 *   ├─ ReactiveSequence [사기=도주]         → 이탈 이동
 *   └─ Action  [전투 FSM 실행]             → 기존 FSM/Utility 경로
 *
 *  왜 ReactiveSequence 인가:
 *   조건이 매 틱 재검사되어야 한다. 예를 들어 게이트 진군 중에 플레이어가
 *   어그로 안으로 들어오면 즉시 전투 분기로 내려와야 한다. 메모리 Sequence 라면
 *   진군 Action 이 Running 인 동안 조건이 다시 평가되지 않아 계속 진군한다.
 */

import { Action, Blackboard, Condition, ReactiveSequence, Selector, Status } from "./behaviorTree";

/** BT 가 결정한 이번 틱의 행동 종류 */
export type BrainAction =
  | "halt" // 아무것도 하지 않음(죽음/더미/유예/기절)
  | "gate" // 게이트 코어로 진군
  | "flee" // 사기 판단상 이탈
  | "combat"; // FSM/Utility 경로

/**
 * 매 프레임 채워지는 사실. **객체 재사용** — 틱마다 할당하지 않는다.
 */
export interface BrainFacts {
  alive: boolean;
  dummy: boolean;
  prologueSafe: boolean;
  stunned: boolean;
  hasGateTarget: boolean;
  distToPlayer: number;
  aggro: number;
  /** 사기 판단 결과가 fight 가 아닌가 */
  fleeing: boolean;
}

/** 한 마리당 1개. 생성 후 재사용. */
export class EnemyBrain {
  private readonly bb = new Blackboard();
  private readonly root: Selector;
  private readonly facts: BrainFacts = {
    alive: true,
    dummy: false,
    prologueSafe: false,
    stunned: false,
    hasGateTarget: false,
    distToPlayer: 0,
    aggro: 0,
    fleeing: false,
  };
  private decided: BrainAction = "combat";

  constructor() {
    const halt = new Action(() => {
      this.decided = "halt";
      /* Success 반환 — Running 을 돌려주면 Selector 가 이 자식에 고정되어
       * 다음 틱에 상위 조건(gateGo 등)을 재평가하지 못한다. */
      return Status.Success;
    });
    const gate = new Action(() => {
      this.decided = "gate";
      /* Success 반환 — Running 을 돌려주면 Selector 가 이 자식에 고정되어
       * 다음 틱에 상위 조건(gateGo 등)을 재평가하지 못한다. */
      return Status.Success;
    });
    const flee = new Action(() => {
      this.decided = "flee";
      /* Success 반환 — Running 을 돌려주면 Selector 가 이 자식에 고정되어
       * 다음 틱에 상위 조건(gateGo 등)을 재평가하지 못한다. */
      return Status.Success;
    });
    const combat = new Action(() => {
      this.decided = "combat";
      /* Success 반환 — Running 을 돌려주면 Selector 가 이 자식에 고정되어
       * 다음 틱에 상위 조건(gateGo 등)을 재평가하지 못한다. */
      return Status.Success;
    });

    /* 각 분기는 "조건이 참일 때만" 그 행동을 고른다.
     * 게이트 진군은 **플레이어가 어그로 밖일 때만** — 안이면 전투가 우선. */
    /* vc234 — Selector 는 Running 자식에 고정된다(다음 틱에 그 자식부터 재개).
     *  그래서 `gate → combat` 전환이 한 번 일어나면, 다시 gate 조건이 참이 되어도
     *  combat(마지막 자식)이 Running 에 머물러 gate 로 돌아오지 못했다(테스트로 발견).
     *
     *  해결: 각 분기를 **매 틱 조건부터 재평가**하는 ReactiveSequence 로 만들고,
     *  Selector 의 자식이 Running 을 반환하지 않도록(Action 이 Success 를 반환)
     *  매 틱 루트를 처음부터 훑게 한다. 판정 결과는 `decided` 에 담기므로
     *  "이번 틱의 결정"은 그대로 유지된다. */
    this.root = new Selector([
      new ReactiveSequence([new Condition((b) => b.bool("stop")), halt]),
      new ReactiveSequence([new Condition((b) => b.bool("gateGo")), gate]),
      new ReactiveSequence([new Condition((b) => b.bool("shouldFlee")), flee]),
      combat,
    ]);
  }

  /**
   * 매 프레임 호출. `f` 는 호출부가 채운 사실 객체(재사용).
   * 반환값에 따라 Enemy 가 실제 이동/FSM 을 수행한다.
   */
  think(f: BrainFacts, dt: number): BrainAction {
    /* 사실 → 블랙보드. 불리언만 쓰므로 Map 조회 비용이 작다. */
    const bb = this.bb;
    bb.clear();

    /* stop = 죽음 · 더미 · 프롤로그 유예 · 기절 (모두 "아무것도 안 함") */
    bb.setBool("stop", !f.alive || f.dummy || f.prologueSafe || f.stunned);

    /* gateGo = 게이트 목표가 있고, 플레이어가 어그로 밖 */
    bb.setBool("gateGo", f.hasGateTarget && f.distToPlayer > f.aggro);

    /* shouldFlee = 사기 판단이 fight 가 아님 */
    bb.setBool("shouldFlee", f.fleeing);

    this.root.tick(bb, dt);
    return this.decided;
  }

  /** 리스폰/재사용 시 */
  reset(): void {
    this.root.reset();
    this.bb.clear();
    this.decided = "combat";
  }
}
