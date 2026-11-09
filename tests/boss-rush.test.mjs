/**
 * 보스 러시 계약 (NEXT_WORK_vc291 우선순위 #2).
 *
 * [무엇인가]
 *  보스를 10웨이브 연속으로 상대하고, 웨이브를 넘길 때마다 3택1 강화를 골라
 *  런 도중에 강해지는 모드. 한 번 죽으면 런 종료.
 *
 * [왜 이 테스트가 필요한가]
 *  ① bossKey 오타 — 웨이브는 정의됐는데 BOSS_DEFS 에 없는 키를 가리키면
 *     런타임에 빈 보스가 나오고, 그 웨이브는 **클리어가 불가능**해진다.
 *     실제 게임에서 막다른 길이 되는 종류의 버그다.
 *  ② 강화 배율 누적 — 3택1 을 여러 번 골랐을 때 합이 맞아야 한다.
 *     제자리 변형을 하면 UI 갱신이 누락된다(참조 비교).
 *  ③ 기록 단조성 — 이상한 값이 들어와도 최고 기록이 줄어들면 안 된다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BOSS_RUSH_WAVES,
  RUSH_UPGRADES,
  EMPTY_BUFF,
  applyUpgrade,
  rollUpgradeChoices,
  newRun,
  currentWave,
  isCleared,
  clearWave,
  killRun,
  scaledStats,
  isValidBossKey,
  mergeBest,
  EMPTY_BEST,
} from "../src/game/bossRush.ts";
import { BOSS_DEFS } from "../src/game/stages.ts";

test("모든 웨이브의 bossKey 가 BOSS_DEFS 에 실재한다 (오타 = 막다른 웨이브)", () => {
  const missing = BOSS_RUSH_WAVES.filter((w) => !isValidBossKey(w.bossKey)).map(
    (w) => `${w.bossKey}(${w.label})`,
  );
  assert.deepEqual(missing, [], `BOSS_DEFS 에 없는 보스 키: ${missing.join(", ")} — 이 웨이브는 클리어 불가`);
});

test("웨이브는 10개이고 배율이 단조 증가한다", () => {
  assert.equal(BOSS_RUSH_WAVES.length, 10, "웨이브 수가 10 이 아니다");
  for (let i = 1; i < BOSS_RUSH_WAVES.length; i++) {
    assert.ok(
      BOSS_RUSH_WAVES[i].hpMul > BOSS_RUSH_WAVES[i - 1].hpMul,
      `${i}번째 웨이브 HP 배율이 이전보다 낮다 — 난이도가 역행한다`,
    );
    assert.ok(
      BOSS_RUSH_WAVES[i].atkMul >= BOSS_RUSH_WAVES[i - 1].atkMul,
      `${i}번째 웨이브 공격력 배율이 역행한다`,
    );
    assert.ok(
      BOSS_RUSH_WAVES[i].emerald > BOSS_RUSH_WAVES[i - 1].emerald,
      `${i}번째 웨이브 보상이 이전보다 적다`,
    );
  }
});

test("웨이브마다 라벨이 있다 (UI 에 빈 칸이 뜨지 않도록)", () => {
  for (const w of BOSS_RUSH_WAVES) {
    assert.ok(w.label && w.label.trim().length > 0, `${w.bossKey} 웨이브에 라벨이 없다`);
  }
});

test("런 생성 → 웨이브 클리어 → 완주까지 상태가 맞는다", () => {
  let run = newRun(12345);
  assert.equal(run.wave, 0);
  assert.equal(run.emerald, 0);
  assert.equal(isCleared(run), false);

  let expectedEmerald = 0;
  for (let i = 0; i < BOSS_RUSH_WAVES.length; i++) {
    const w = currentWave(run);
    assert.ok(w, `${i}번째 웨이브가 null 이다`);
    expectedEmerald += w.emerald;
    run = clearWave(run);
    assert.equal(run.emerald, expectedEmerald, `에메랄드 누적이 어긋났다 (${i}웨이브 후)`);
  }
  assert.equal(run.wave, 10);
  assert.equal(isCleared(run), true, "10웨이브를 모두 넘겼는데 클리어가 아니다");
  assert.equal(currentWave(run), null, "클리어 후에도 웨이브가 남아 있다");
});

test("사망한 런은 더 진행되지 않고 중복 정산되지 않는다", () => {
  let run = newRun(1);
  run = clearWave(run);
  const beforeDeath = run;
  run = killRun(run);
  assert.equal(run.dead, true);

  /* 죽은 뒤 클리어를 호출해도 에메랄드가 늘면 안 된다 */
  const afterClear = clearWave(run);
  assert.equal(afterClear.emerald, beforeDeath.emerald, "죽은 런이 에메랄드를 더 받았다");
  assert.equal(afterClear.wave, beforeDeath.wave, "죽은 런의 웨이브가 진행됐다");

  /* 두 번 죽여도 그대로 */
  assert.deepEqual(killRun(run), run);
});

test("강화 적용은 원본을 변형하지 않는다 (참조 비교 UI 갱신 보장)", () => {
  const before = { ...EMPTY_BUFF };
  const snapshot = JSON.stringify(before);
  const atk = RUSH_UPGRADES.find((u) => u.kind === "atk");
  assert.ok(atk, "공격력 강화가 없다");

  const after = applyUpgrade(before, atk);
  assert.equal(JSON.stringify(before), snapshot, "applyUpgrade 가 원본을 변형했다");
  assert.notEqual(after, before, "새 객체를 돌려주지 않았다");
  assert.equal(after.atkPct, atk.amount);
});

test("강화 누적이 종류별로 정확히 합산된다", () => {
  let buff = { ...EMPTY_BUFF };
  const byKind = new Map();
  for (const u of RUSH_UPGRADES) {
    byKind.set(u.kind, (byKind.get(u.kind) ?? 0) + u.amount);
    buff = applyUpgrade(buff, u);
  }
  assert.equal(buff.atkPct, byKind.get("atk") ?? 0);
  assert.equal(buff.maxHpPct, byKind.get("maxHp") ?? 0);
  assert.equal(buff.speedPct, byKind.get("speed") ?? 0);
  assert.equal(buff.critPct, byKind.get("crit") ?? 0);
  assert.equal(buff.cdrPct, byKind.get("cooldown") ?? 0);
});

test("즉시 회복(heal)은 지속 버프에 누적되지 않는다", () => {
  const heal = RUSH_UPGRADES.find((u) => u.kind === "heal");
  assert.ok(heal, "회복 강화가 없다");
  const after = applyUpgrade(EMPTY_BUFF, heal);
  assert.deepEqual(after, EMPTY_BUFF, "heal 이 지속 버프를 바꿨다 — 매 웨이브 회복이 영구 누적된다");
});

test("3택1은 중복 없이 뽑히고, 같은 시드면 같은 결과다", () => {
  const a = rollUpgradeChoices(42, 3);
  const b = rollUpgradeChoices(42, 3);
  assert.equal(a.length, 3, "선택지가 3개가 아니다");
  assert.deepEqual(
    a.map((u) => u.key),
    b.map((u) => u.key),
    "같은 시드인데 선택지가 다르다 — 리롤 어뷰징이 가능해진다",
  );
  const keys = new Set(a.map((u) => u.key));
  assert.equal(keys.size, 3, "같은 강화가 중복으로 나왔다");
});

test("선택지는 풀 크기를 넘지 않는다 (풀이 작을 때 무한루프·중복 방지)", () => {
  const many = rollUpgradeChoices(7, 999);
  assert.equal(many.length, RUSH_UPGRADES.length, "풀보다 많은 선택지를 뽑았다");
  assert.equal(new Set(many.map((u) => u.key)).size, many.length, "중복이 섞였다");
});

test("난이도 배율이 웨이브 배율에 곱해진다", () => {
  const w = BOSS_RUSH_WAVES[0];
  const easy = scaledStats(w, { hp: 2.25, atk: 0.85 });
  const chaos = scaledStats(w, { hp: 18.6, atk: 2.55 });
  assert.ok(Math.abs(easy.hpMul - w.hpMul * 2.25) < 1e-9);
  assert.ok(chaos.hpMul > easy.hpMul, "카오스가 이지보다 약하다");
  assert.ok(chaos.atkMul > easy.atkMul);
});

test("최고 기록은 줄어들지 않는다 (단조 증가)", () => {
  let best = { ...EMPTY_BEST };
  /* 웨이브 5 까지 깬 런 */
  let run = newRun(9);
  for (let i = 0; i < 5; i++) run = clearWave(run);
  best = mergeBest(best, run);
  assert.equal(best.bestWave, 5);

  /* 더 못 간 런이 들어와도 기록이 줄면 안 된다 */
  const worse = newRun(10);
  best = mergeBest(best, worse);
  assert.equal(best.bestWave, 5, "최고 기록이 줄었다");
});

test("완주는 clears 로 집계되고 사망 런은 집계되지 않는다", () => {
  let best = { ...EMPTY_BEST };

  /* 완주 런 */
  let full = newRun(1);
  for (let i = 0; i < BOSS_RUSH_WAVES.length; i++) full = clearWave(full);
  best = mergeBest(best, full);
  assert.equal(best.clears, 1, "완주가 집계되지 않았다");
  assert.equal(best.bestWave, BOSS_RUSH_WAVES.length);

  /* 죽은 런 — 웨이브는 같아도 완주 아님 */
  let died = newRun(2);
  for (let i = 0; i < BOSS_RUSH_WAVES.length; i++) died = clearWave(died);
  died = killRun(died);
  best = mergeBest(best, died);
  assert.equal(best.clears, 1, "죽은 런이 완주로 집계됐다");
});

test("에메랄드는 음수가 되지 않는다", () => {
  const bad = { ...newRun(1), emerald: -999 };
  const best = mergeBest(EMPTY_BEST, bad);
  assert.ok(best.totalEmerald >= 0, "누적 에메랄드가 음수다");
});
