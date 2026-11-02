// vc234 — BT 런타임 + EnemyBrain 우선순위 검증
// 실행: node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/bt-brain.test.mjs
import assert from "node:assert/strict";

const { Selector, Sequence, ReactiveSequence, Condition, Action, Inverter, Cooldown, Status, Blackboard } =
  await import("../src/game/ai/behaviorTree.ts");
const { EnemyBrain } = await import("../src/game/ai/enemyBrain.ts");

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };

/* ── 1. Status 계약 ── */
{
  const bb = new Blackboard();
  const succ = new Action(() => Status.Success);
  const fail = new Action(() => Status.Failure);
  const run = new Action(() => Status.Running);

  ok("Selector: 첫 성공 반환", new Selector([fail, succ]).tick(bb, 16) === Status.Success);
  ok("Selector: 전부 실패면 Failure", new Selector([fail, fail]).tick(bb, 16) === Status.Failure);
  ok("Sequence: 전부 성공해야 Success", new Sequence([succ, succ]).tick(bb, 16) === Status.Success);
  ok("Sequence: 하나 실패면 Failure", new Sequence([succ, fail]).tick(bb, 16) === Status.Failure);
  ok("Inverter: 성공→실패", new Inverter(succ).tick(bb, 16) === Status.Failure);
}

/* ── 2. Running 재개 — 루트부터 재시작하지 않는다 ── */
{
  const bb = new Blackboard();
  let n = 0;
  const counting = new Action(() => { n++; return n < 3 ? Status.Running : Status.Success; });
  const seq = new Sequence([counting]);
  seq.tick(bb, 16);
  seq.tick(bb, 16);
  seq.tick(bb, 16);
  ok("Running 을 재개한다(3틱 만에 성공)", seq.tick(bb, 16) === Status.Success);
}

/* ── 3. ReactiveSequence — 상위 조건이 깨지면 즉시 중단 ── */
{
  const bb = new Blackboard();
  bb.setBool("sees", true);
  let moved = 0;
  const chase = new Action(() => { moved++; return Status.Running; });
  const reactive = new ReactiveSequence([new Condition((b) => b.bool("sees")), chase]);
  ok("조건 참일 때 Running", reactive.tick(bb, 16) === Status.Running);
  bb.setBool("sees", false);
  ok("조건이 깨지면 Failure", reactive.tick(bb, 16) === Status.Failure);
  const before = moved;
  reactive.tick(bb, 16);
  ok("조건이 깨진 뒤에는 행동이 실행되지 않는다", moved === before);
}

/* ── 4. Cooldown — Reset 으로 우회할 수 없다 ── */
{
  const bb = new Blackboard();
  let ran = 0;
  const cd = new Cooldown(new Action(() => { ran++; return Status.Success; }), 100);
  ok("첫 실행 성공", cd.tick(bb, 0) === Status.Success && ran === 1);
  ok("쿨다운 중 Failure", cd.tick(bb, 16) === Status.Failure);
  cd.reset(); // 부모가 분기를 포기했다가 돌아온 상황
  ok("reset 후에도 쿨다운 유지(우회 불가)", cd.tick(bb, 16) === Status.Failure);
  /* 쿨다운은 "차감 → 다음 호출에서 실행" 순서다.
   *  100ms 를 한 번에 넣으면 그 호출은 아직 Failure(차감만) 이고,
   *  다음 호출에서 자식이 실행된다. 이 순서를 명시적으로 검증한다. */
  ok("100ms 경과 호출은 아직 Failure(차감)", cd.tick(bb, 100) === Status.Failure && ran === 1);
  ok("그 다음 호출에서 재실행", cd.tick(bb, 16) === Status.Success && ran === 2);
}

/* ── 5. EnemyBrain 우선순위 — halt > gate > flee > combat ── */
{
  const facts = {
    alive: true, dummy: false, prologueSafe: false, stunned: false,
    hasGateTarget: false, distToPlayer: 100, aggro: 200, fleeing: false,
  };

  const mk = () => new EnemyBrain();

  /* 기본: 전투 */
  ok("기본은 combat", mk().think({ ...facts }, 16) === "combat");

  /* 죽음 → halt */
  ok("죽으면 halt", mk().think({ ...facts, alive: false }, 16) === "halt");
  /* 더미 → halt */
  ok("허수아비는 halt", mk().think({ ...facts, dummy: true }, 16) === "halt");
  /* 프롤로그 유예 → halt */
  ok("프롤로그 유예는 halt", mk().think({ ...facts, prologueSafe: true }, 16) === "halt");
  /* 기절 → halt */
  ok("기절은 halt", mk().think({ ...facts, stunned: true }, 16) === "halt");

  /* 게이트: 목표 있고 어그로 밖 → gate */
  ok("게이트 목표 + 어그로 밖 → gate",
    mk().think({ ...facts, hasGateTarget: true, distToPlayer: 500, aggro: 200 }, 16) === "gate");
  /* 게이트 목표 있어도 어그로 안이면 combat 이 우선 */
  ok("게이트 목표 + 어그로 안 → combat",
    mk().think({ ...facts, hasGateTarget: true, distToPlayer: 100, aggro: 200 }, 16) === "combat");

  /* 사기 이탈 → flee */
  ok("사기 이탈은 flee", mk().think({ ...facts, fleeing: true }, 16) === "flee");

  /* 우선순위: halt 가 gate 보다 위 */
  ok("halt > gate", mk().think({ ...facts, stunned: true, hasGateTarget: true, distToPlayer: 500 }, 16) === "halt");
  /* gate 가 flee 보다 위 */
  ok("gate > flee", mk().think({ ...facts, hasGateTarget: true, distToPlayer: 500, fleeing: true }, 16) === "gate");
}

/* ── 6. Reactivity: 상위 조건이 바뀌면 즉시 반영 (같은 brain 인스턴스) ── */
{
  const facts = {
    alive: true, dummy: false, prologueSafe: false, stunned: false,
    hasGateTarget: true, distToPlayer: 500, aggro: 200, fleeing: false,
  };
  const b = new EnemyBrain();
  ok("진군 시작", b.think({ ...facts }, 16) === "gate");
  /* 플레이어가 어그로 안으로 들어옴 → 같은 brain 이 즉시 전투로 전환 */
  ok("어그로 진입 시 즉시 combat", b.think({ ...facts, distToPlayer: 80 }, 16) === "combat");
  /* 다시 빠져나가면 진군 복귀 */
  ok("어그로 이탈 시 다시 gate", b.think({ ...facts, distToPlayer: 600 }, 16) === "gate");
}

console.log(`bt-brain: ${checks} checks passed`);
