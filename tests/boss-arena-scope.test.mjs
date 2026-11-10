/**
 * task-20 회귀 — 보스 아레나 축소 / 보스맵 일반몹 제거 / 퀘스트 격리.
 *
 * [왜 이 테스트가 필요한가]
 *  유저 요구사항 원문:
 *   · 8.2 "현재 보스맵은 지나치게 넓고 일반 사냥터처럼 구성되어 있다. 보스맵에는 보스가
 *     자신의 능력으로 몬스터를 소환하는 경우를 제외하고 일반 몬스터를 배치하지 않는다.
 *     보스맵에 연결되는 퀘스트는 해당 보스의 토벌 목표만 사용한다."
 *   · #23 "보스 아레나의 과도한 크기 축소"
 *
 *  종전 상태(vc287 시점 실측):
 *   · 아레나 격자 22.1×10.7, 걸을 수 있는 셀 164개  ← 일반 구역(61개)의 **2.70배**
 *   · 원인은 `width: spec.width + sub * 130`. 구역 번호가 클수록 커지는 공식이라
 *     10구역(보스)이 한 챕터에서 가장 큰 맵이었다.
 *   · 보스맵 잡몹 190마리(18개 맵 × cap-1). `subEnemyMix` 의 10구역 분기가 그대로 깔았다.
 *
 *  이 테스트는 셋을 고정한다:
 *   1) 아레나가 일반 구역보다 **작다**
 *   2) 보스맵에 일반몹이 **0마리**
 *   3) 보스맵 처치가 hunt 퀘스트 카운터를 **올리지 않는다**
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { STAGES, stageSize, ARENA_SCALE, BOSS_SUB } from "../src/game/stages.ts";
import { authoredRoomLayout } from "../src/game/authoredLayouts.ts";
import { recordHuntKill, huntScope, huntProgressOf } from "../src/game/questProgress.ts";

/** 스테이지의 테마가 실제로 arena 인지 (sp.boss 플래그가 아니라 렌더 테마 기준). */
function isArena(stage) {
  const lay = authoredRoomLayout(stage.key, stage.width, stage.height);
  return lay?.authored?.theme === "arena";
}

function walkable(stage) {
  const lay = authoredRoomLayout(stage.key, stage.width, stage.height);
  if (!lay) return null;
  return lay.open.filter(Boolean).length;
}

const arenaStages = Object.values(STAGES).filter(isArena);
const normalStages = Object.values(STAGES).filter(
  (s) => !isArena(s) && authoredRoomLayout(s.key, s.width, s.height),
);

test("아레나 스테이지가 실제로 존재한다 (빈 배열로 통과 방지)", () => {
  assert.ok(arenaStages.length >= 10, `아레나 스테이지가 ${arenaStages.length}개뿐이다`);
  assert.ok(normalStages.length >= 50, `비교군이 ${normalStages.length}개뿐이다`);
});

test("아레나는 일반 구역보다 작다 (걸을 수 있는 면적)", () => {
  const avg = (list) => list.reduce((t, s) => t + walkable(s), 0) / list.length;
  const arenaWalk = avg(arenaStages);
  const normalWalk = avg(normalStages);
  /* 종전 2.70배 → 이제 일반의 0.85배 미만이어야 "작다"고 말할 수 있다. */
  assert.ok(
    arenaWalk < normalWalk,
    `아레나 걸을 수 있는 면적(${arenaWalk.toFixed(0)})이 일반(${normalWalk.toFixed(0)}) 이상이다`,
  );
  assert.ok(
    arenaWalk / normalWalk < 0.85,
    `아레나/일반 비율이 ${(arenaWalk / normalWalk).toFixed(3)} — 0.85 미만이어야 한다(종전 2.70)`,
  );
});

test("아레나는 보스 패턴이 요구하는 최소 공간을 넘는다", () => {
  /* Boss.ts 실측: startZones 가 플레이어 주변 ±220px(X)/±180px(Y) 에 반경 92px 장판을 깐다.
   *  → 필요한 최소 지름 624 × 544px. 이보다 작으면 "피할 곳이 없는" 불공정 패턴이 된다. */
  const MIN_W = 624;
  const MIN_H = 544;
  for (const s of arenaStages) {
    assert.ok(s.width >= MIN_W, `${s.key} 폭 ${s.width} < 최소 ${MIN_W}`);
    assert.ok(s.height >= MIN_H, `${s.key} 높이 ${s.height} < 최소 ${MIN_H}`);
  }
  /* 위 테스트(작다)와 이 테스트(충분히 크다) 사이의 창이 이 설계의 전부다. */
});

test("일반 구역 크기는 종전 공식(sub*130 / sub*30)과 완전히 동일하다", () => {
  for (const s of normalStages) {
    const sub = Number(/(\d+)$/.exec(s.key)?.[1] ?? s.sub ?? 1);
    /* 종전 크기에서 이번에 바뀐 아레나만 다르므로, 일반 구역은 역산이 성립해야 한다. */
    const specW = s.width - sub * 130;
    const specH = s.height - sub * 30;
    const restored = stageSize(specW, specH, sub, sub + 1, true); // sub !== stageCount → 일반 경로
    assert.equal(restored.width, s.width, `${s.key} 폭이 변했다`);
    assert.equal(restored.height, s.height, `${s.key} 높이가 변했다`);
  }
});

test("stageSize 는 보스 구역에서만 비율을 적용한다", () => {
  const W = 2100, H = 1150;
  const boss = stageSize(W, H, BOSS_SUB, BOSS_SUB, true);
  assert.equal(boss.width, Math.round(W * ARENA_SCALE));
  assert.equal(boss.height, Math.round(H * ARENA_SCALE));
  /* 마지막 구역이 아니면 종전 그대로 */
  const mid = stageSize(W, H, 7, BOSS_SUB, true);
  assert.equal(mid.width, W + 7 * 130);
  assert.equal(mid.height, H + 7 * 30);
  /* 보스가 없는 챕터의 마지막 구역도 종전 그대로 */
  const noBoss = stageSize(W, H, 5, 5, false);
  assert.equal(noBoss.width, W + 5 * 130);
});

test("보스맵에 일반몹이 한 마리도 없다", () => {
  const offenders = [];
  for (const s of arenaStages) {
    const n = s.enemies.reduce((t, g) => t + g.count, 0);
    if (n !== 0) offenders.push(`${s.key}=${n}`);
  }
  assert.deepEqual(offenders, [], `보스맵에 잡몹이 남아 있다: ${offenders.join(", ")}`);
});

test("전투 목표가 있는 일반 구역에는 몬스터가 있다 (치료·재건·이동은 비전투)", () => {
  const empty = normalStages.filter((s) => s.enemies.reduce((t, g) => t + g.count, 0) === 0 && s.quests.some(q => q.type === "hunt" || q.type === "boss"));
  assert.deepEqual(
    empty.map((s) => s.key),
    [],
    `일반 구역인데 몹이 없는 곳: ${empty.map((s) => s.key).join(", ")}`,
  );
});

test("보스맵 퀘스트는 보스/도달 목표만 쓴다 (일반 처치 퀘스트 없음)", () => {
  for (const s of arenaStages) {
    const hunts = s.quests.filter((q) => q.type === "hunt");
    assert.deepEqual(
      hunts.map((q) => q.id),
      [],
      `${s.key} 에 일반 처치 퀘스트가 있다`,
    );
  }
});

test("보스맵 처치는 hunt 퀘스트 진행도를 올리지 않는다", () => {
  const progress = {};
  const scope = huntScope("howlrstone1x10", "q-1");
  /* 같은 종을 잡아도 bossMap 이면 반영되지 않아야 한다. */
  const applied = recordHuntKill(progress, scope, ["wolf", "minion"], "wolf", 10, { bossMap: true });
  assert.equal(applied, false, "보스맵 처치가 집계됐다");
  assert.equal(huntProgressOf(progress, scope), 0, "보스맵 처치로 카운터가 올랐다");
});

test("일반 구역 처치는 종전대로 집계된다 (과잉 차단 방지)", () => {
  const progress = {};
  const scope = huntScope("howlrstone1x3", "q-1");
  assert.equal(recordHuntKill(progress, scope, ["wolf"], "wolf", 10, { bossMap: false }), true);
  assert.equal(huntProgressOf(progress, scope), 1);
  /* opts 를 아예 안 넘기는 기존 호출도 그대로 동작해야 한다 */
  assert.equal(recordHuntKill(progress, scope, ["wolf"], "wolf", 10), true);
  assert.equal(huntProgressOf(progress, scope), 2);
});
