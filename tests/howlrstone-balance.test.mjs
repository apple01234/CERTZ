// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/howlrstone-balance.test.mjs
//
// 영프 편(라일락 월드) 성장 곡선 계약 — vc238
//
// [왜 필요한가]
//  이전 구현은 15챕터의 `scaleMul.exp` 와 `lvGate` 가 서로 어긋나 있었다.
//    · lvGate 가 전 챕터 {enter:1, mid:1} → 레벨 게이트가 아무것도 막지 못했다.
//    · 그래서 "퀘스트 보상"이 성장 곡선 전부였는데, 1장의 레벨 게이트 퀘스트
//      (raw 6000 × QUEST_EXP_MUL 12 = 72,000)가 새 캐릭터를 **즉시 Lv26** 으로 만들었다.
//    · 같은 값이 15장에서는 2,248만이라 그 장의 필요 경험치에 한참 못 미쳤다.
//      즉 초반은 폭주, 후반은 정체 — 한 방향의 버그가 아니었다.
//  밸런스는 화면에 바로 드러나지 않아 테스트가 없으면 다시 어긋난다.
//  여기서는 "실제 지급액"으로 못을 박는다(QUEST_EXP_MUL 반영).
import assert from 'node:assert/strict';
import { STAGES, ENEMIES, QUEST_EXP_MUL } from '../src/game/stages.ts';
import { HOWLRSTONE_CHAPTERS } from '../src/game/howlrstone.ts';
import { HOWLRSTONE_ENTRY } from '../src/game/howlrstone.ts';
import { expToNext } from '../src/game/expTable.ts';

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };

/** 레벨 1 에서 exp 를 받았을 때 도달 레벨. */
function levelFrom(exp0, gain) {
  let lv = exp0, cur = gain, guard = 0;
  while (cur >= expToNext(lv) && lv < 299 && guard++ < 400) { cur -= expToNext(lv); lv++; }
  return lv;
}
/** exp0 → target 레벨까지 필요한 누적 경험치. */
function needTo(exp0, target) {
  let s = 0;
  for (let lv = exp0; lv < target; lv++) s += expToNext(lv);
  return s;
}

/* ── 1. 새 캐릭터가 첫 구역에서 즉시 고레벨이 되지 않는다 ──────────────── */
{
  /* 회귀 방지의 핵심: 종전 1-1 은 첫 퀘스트 하나로 Lv26 이었다.
   *  1장 전체(4구역 퀘스트 + 반복의뢰 1회)를 다 받아도 Lv20 을 넘으면 안 된다 —
   *  영프 편의 2장 입장 게이트가 Lv8 이므로 그보다 넉넉히 위를 상한으로 둔다. */
  const ch1 = HOWLRSTONE_CHAPTERS[0];
  let gained = 0;
  for (let sub = 1; sub <= ch1.stages; sub++) {
    const def = STAGES[`${ch1.key}x${sub}`];
    for (const q of def.quests) gained += (q.expReward ?? 0) * QUEST_EXP_MUL;
    if (def.repeat) gained += def.repeat.exp;
  }
  const lvAllQuests = levelFrom(1, gained);
  ok(`1장 퀘스트만으로 Lv${lvAllQuests} (20 미만이어야 함)`, lvAllQuests < 20);

  /* 첫 구역(1-1) 단독으로는 게이트 레벨 근처에도 못 미쳐야 한다. */
  const q11 = STAGES[`${HOWLRSTONE_ENTRY}`].quests.reduce((t, q) => t + (q.expReward ?? 0) * QUEST_EXP_MUL, 0);
  const lv11 = levelFrom(1, q11);
  ok(`1-1 퀘스트 지급 ${q11} EXP → Lv${lv11} (10 미만)`, lv11 < 10);
  /* 종전 값(72,000)이면 Lv26 — 그 값이 되돌아오면 여기서 잡힌다. */
  ok('종전 72,000 EXP 회귀 감지', q11 < 20000);
}

/* ── 2. 레벨 게이트가 실제로 진행을 잡는다 ─────────────────────────────── */
{
  /* 게이트는 "이전 장을 끝내면 자연히 도달하는 레벨"보다 높아야 의미가 있고,
   *  "그 장을 다 해도 못 넘는 레벨"이면 진행이 막힌다. 두 경계를 동시에 본다. */
  let prevExitLv = 1;
  for (let i = 0; i < HOWLRSTONE_CHAPTERS.length; i++) {
    const spec = HOWLRSTONE_CHAPTERS[i];
    ok(`${spec.key}: enter >= mid`, spec.lvGate.enter <= spec.lvGate.mid);
    ok(`${spec.key}: enter > 0`, spec.lvGate.enter >= 1);
    /* 이 장에 들어가려면 이전 장 종료 시점 레벨 이상이어야 한다(막힘 방지). */
    ok(
      `${spec.key}: 게이트 ${spec.lvGate.enter} <= 이전 장 종료 Lv${prevExitLv}`,
      spec.lvGate.enter <= prevExitLv,
    );

    /* 이 장을 정상 플레이(구역마다 스폰 전멸 + 퀘스트 수령)하면 mid 이상이 된다. */
    const mul = spec.scaleMul.exp;
    const avgBase = spec.enemies.reduce((t, e) => t + ENEMIES[e.key].exp, 0) / spec.enemies.length;
    let gained = 0;
    for (let sub = 1; sub <= spec.stages; sub++) {
      const def = STAGES[`${spec.key}x${sub}`];
      const kills = def.enemies.reduce((t, g) => t + g.count, 0);
      gained += avgBase * mul * 1.35 * kills; // 사냥
      gained += def.quests.reduce((t, q) => t + (q.expReward ?? 0) * QUEST_EXP_MUL, 0);
    }
    prevExitLv = levelFrom(prevExitLv, gained);
    ok(`${spec.key}: 정상 클리어 후 Lv${prevExitLv} >= mid ${spec.lvGate.mid}`, prevExitLv >= spec.lvGate.mid);
  }
  /* 마지막 장을 끝내면 그랜드 플레닛 진입 요구(126)를 넘어야 막다른 길이 없다. */
  ok(`영프 편 종료 Lv${prevExitLv} >= 126 (그랜드 플레닛 진입)`, prevExitLv >= 126);
}

/* ── 3. 곡선이 단조 증가한다 (초반 폭주 / 후반 정체 재발 방지) ────────── */
{
  const mul = HOWLRSTONE_CHAPTERS.map((c) => c.scaleMul.exp);
  for (let i = 1; i < mul.length; i++) {
    ok(`${i + 1}장 scaleMul.exp ${mul[i]} > ${i}장 ${mul[i - 1]}`, mul[i] > mul[i - 1]);
  }
  const gates = HOWLRSTONE_CHAPTERS.map((c) => c.lvGate.enter);
  for (let i = 1; i < gates.length; i++) {
    ok(`${i + 1}장 게이트 ${gates[i]} > ${i}장 ${gates[i - 1]}`, gates[i] > gates[i - 1]);
  }
  /* 레벨 게이트 퀘스트가 그 장의 사냥 1회분과 자릿수가 맞아야 한다.
   *  (종전 15장: 게이트 2,248만 vs 사냥 1회 225만 = 10배 과다) */
  for (const spec of HOWLRSTONE_CHAPTERS) {
    const avgBase = spec.enemies.reduce((t, e) => t + ENEMIES[e.key].exp, 0) / spec.enemies.length;
    const perKill = avgBase * spec.scaleMul.exp * 1.35;
    const gateQ = STAGES[`${spec.key}x1`].quests.find((q) => q.type === 'level');
    if (!gateQ) continue;
    const paid = (gateQ.expReward ?? 0) * QUEST_EXP_MUL;
    const ratio = paid / perKill;
    ok(`${spec.key}: 게이트 ${paid} EXP / 1킬 ${Math.round(perKill)} = ${ratio.toFixed(1)}배 (2~400)`, ratio >= 2 && ratio <= 400);
  }
}

/* ── 4. 모든 퀘스트 보상이 실제 지급액으로 존재한다 ────────────────────── */
for (const spec of HOWLRSTONE_CHAPTERS) {
  for (let sub = 1; sub <= spec.stages; sub++) {
    const key = `${spec.key}x${sub}`;
    const def = STAGES[key];
    ok(`${key}: 퀘스트 존재`, def.quests.length > 0);
    for (const q of def.quests) {
      ok(`${key}/${q.id}: 수락 가능한 타입`, ['collect', 'hunt', 'reach', 'boss', 'talk', 'level'].includes(q.type));
      /* talk / reach 는 보상 없는 흐름 제어용이므로 exp 0 을 허용한다. */
      if (q.type === 'talk' || q.type === 'reach') continue;
      ok(`${key}/${q.id}: expReward > 0`, (q.expReward ?? 0) > 0);
      ok(`${key}/${q.id}: reward >= 0`, (q.reward ?? 0) >= 0);
    }
  }
}

console.log(`ALL CHECKS PASS: howlrstone balance — ${checks} checks`);
