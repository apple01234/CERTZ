// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/quest-progress.test.mjs
//
// 퀘스트 처치 카운트 독립성 — 맵/퀘스트 간 오염 방지
//
// [유저 신고]
//  "서로 다른 맵이나 서로 다른 퀘스트에서 처치한 몬스터 수가 다른 퀘스트에도 잘못 반영된다"
//
// [원인]
//  종전엔 전역 종족 누계(killTotals)에서 "퀘스트 수락 시점 기준선"을 빼는 방식이었다.
//  기준선을 잡은 뒤의 **모든** 킬이 그 퀘스트에 더해지므로 맵 구분이 사라진다:
//    mapA 퀘스트 3/8 진행 중 → mapB 에서 같은 몬스터 5마리 사냥 → mapA 로 복귀 = 8/8 완료.
//  실제로 mapA 에서 잡은 것은 3마리뿐이다.
//
// [해결]
//  src/game/questProgress.ts — (스테이지:퀘스트) 단위 독립 카운터. 기준선 차감 없음.
import assert from 'node:assert/strict';
import {
  huntScope, huntProgressOf, recordHuntKill, seedHuntProgress,
} from '../src/game/questProgress.ts';

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };

const A = { targetKey: 'wraith', need: 8 };
const B = { targetKey: 'wraith', need: 8 };
const keys = (q) => (q.targetKeys ?? (q.targetKey ? [q.targetKey] : []));

/* ── 1. 핵심 회귀: A맵 처치가 B맵 퀘스트에 반영되지 않는다 ───────────────── */
{
  const p = {};
  const a = huntScope('mapA', 'qA');
  const b = huntScope('mapB', 'qB');

  for (let i = 0; i < 3; i++) recordHuntKill(p, a, keys(A), 'wraith', A.need);
  ok('mapA 3킬 → mapA 퀘스트 3', huntProgressOf(p, a) === 3);
  ok('mapA 3킬 → mapB 퀘스트 0 (오염 없음)', huntProgressOf(p, b) === 0);

  for (let i = 0; i < 5; i++) recordHuntKill(p, b, keys(B), 'wraith', B.need);
  ok('mapB 5킬 → mapB 퀘스트 5', huntProgressOf(p, b) === 5);
  ok('mapB 5킬 → mapA 퀘스트는 여전히 3', huntProgressOf(p, a) === 3);
  ok('★ 구 동작이면 mapA 가 8/8 로 완료됐다 — 회귀 방지', huntProgressOf(p, a) === 3 && huntProgressOf(p, a) !== 8);
}

/* ── 2. 같은 몬스터를 쓰는 두 퀘스트가 서로 독립 ─────────────────────────── */
{
  const p = {};
  const q1 = huntScope('mapX', 'quest-1');
  const q2 = huntScope('mapX', 'quest-2');
  recordHuntKill(p, q1, ['golem'], 'golem', 5);
  recordHuntKill(p, q1, ['golem'], 'golem', 5);
  ok('퀘스트1 = 2', huntProgressOf(p, q1) === 2);
  ok('퀘스트2 = 0 (같은 맵·같은 몬스터여도 독립)', huntProgressOf(p, q2) === 0);
  recordHuntKill(p, q2, ['golem'], 'golem', 5);
  ok('퀘스트2 = 1, 퀘스트1 은 2 그대로', huntProgressOf(p, q2) === 1 && huntProgressOf(p, q1) === 2);
}

/* ── 3. 대상 종이 아니면 집계하지 않는다 ─────────────────────────────────── */
{
  const p = {};
  const s = huntScope('mapY', 'q');
  ok('대상 아님 → false', recordHuntKill(p, s, ['wolf'], 'golem', 5) === false);
  ok('대상 아님 → 진행도 0', huntProgressOf(p, s) === 0);
  ok('대상 맞음 → true', recordHuntKill(p, s, ['wolf', 'golem'], 'golem', 5) === true);
  ok('대상 맞음 → 1', huntProgressOf(p, s) === 1);
}

/* ── 4. 목표치 초과 집계 금지 + 완료 후 추가 집계 금지 ───────────────────── */
{
  const p = {};
  const s = huntScope('mapZ', 'q');
  for (let i = 0; i < 5; i++) recordHuntKill(p, s, ['rat'], 'rat', 3);
  ok('need=3 인데 5번 잡아도 3 에서 멈춘다', huntProgressOf(p, s) === 3);
  ok('완료 후 추가 처치는 false 를 돌려준다', recordHuntKill(p, s, ['rat'], 'rat', 3) === false);
  ok('완료 후에도 3 유지', huntProgressOf(p, s) === 3);
}

/* ── 5. 맵 이동해도 진행도 유지 + 세이브/로드 왕복 ───────────────────────── */
{
  let p = {};
  const a = huntScope('mapA', 'qA');
  recordHuntKill(p, a, ['wraith'], 'wraith', 8);
  recordHuntKill(p, a, ['wraith'], 'wraith', 8);
  /* 다른 맵에 다녀온다 — 진행도 객체는 그대로 (huntProg 로 저장/복원되는 값) */
  recordHuntKill(p, huntScope('mapB', 'qB'), ['wraith'], 'wraith', 8);
  ok('mapB 다녀와도 mapA 는 2', huntProgressOf(p, a) === 2);

  const saved = JSON.parse(JSON.stringify({ huntProg: p }));
  p = { ...(saved.huntProg ?? {}) };
  ok('세이브/로드 후 mapA 진행도 2 복원', huntProgressOf(p, a) === 2);
  ok('세이브/로드 후 mapB 진행도 1 복원', huntProgressOf(p, huntScope('mapB', 'qB')) === 1);
  recordHuntKill(p, a, ['wraith'], 'wraith', 8);
  ok('로드 후 이어서 카운트 → 3', huntProgressOf(p, a) === 3);
}

/* ── 6. 구세이브 이관 — 진행 중이던 토벌이 0 부터 다시 시작하지 않는다 ───── */
{
  const p = {};
  const s = huntScope('mapA', 'qA');
  seedHuntProgress(p, s, 5, 8);
  ok('구 진행도 5 가 이관된다', huntProgressOf(p, s) === 5);
  seedHuntProgress(p, s, 99, 8);
  ok('이미 값이 있으면 덮어쓰지 않는다 (진행도 보존)', huntProgressOf(p, s) === 5);
  recordHuntKill(p, s, ['wraith'], 'wraith', 8);
  ok('이관 후 이어서 카운트 → 6', huntProgressOf(p, s) === 6);

  const p2 = {};
  seedHuntProgress(p2, huntScope('m', 'q'), 999, 8);
  ok('이관값이 목표를 넘으면 목표치로 캡', huntProgressOf(p2, huntScope('m', 'q')) === 8);

  const p3 = {};
  seedHuntProgress(p3, huntScope('m', 'q'), -3, 8);
  ok('음수는 0 으로 보정', huntProgressOf(p3, huntScope('m', 'q')) === 0);

  const p4 = {};
  seedHuntProgress(p4, huntScope('m', 'q'), NaN, 8);
  ok('NaN 은 0 으로 보정', huntProgressOf(p4, huntScope('m', 'q')) === 0);
}

/* ── 7. 반복 의뢰 사이클 = 새 카운터 ────────────────────────────────────── */
{
  const p = {};
  const c1 = huntScope('mapA', 'repeat:0:0');
  const c2 = huntScope('mapA', 'repeat:0:1');
  recordHuntKill(p, c1, ['rat'], 'rat', 25);
  ok('사이클0 = 1', huntProgressOf(p, c1) === 1);
  ok('사이클1 = 0 (재수주하면 새로 센다)', huntProgressOf(p, c2) === 0);
}

/* ── 8. WorldScene 배선 — 새 카운터를 실제로 쓰는가 ─────────────────────── */
{
  const fs = await import('node:fs');
  const w = fs.readFileSync(new URL('../src/game/scenes/WorldScene.ts', import.meta.url), 'utf8');
  ok('questProgress 모듈을 import 한다', w.includes('from "../questProgress"'));
  ok('huntProgressSum 이 huntProgressOf 를 쓴다', /huntProgressSum\(q: QuestDef\): number \{\s*return huntProgressOf\(this\.huntProgress/.test(w));
  ok('처치 경로가 recordHuntKill 을 쓴다', w.includes('recordHuntKill(this.huntProgress'));
  ok('기준선 차감 공식이 사라졌다', !w.includes('this.killTotals[k] ?? 0) - (this.huntBaseline'));
  ok('세이브에 huntProg 를 쓴다', w.includes('huntProg: { ...this.huntProgress }'));
  ok('복원에 huntProg 를 쓴다', w.includes('data.save?.huntProg'));
  ok('구세이브 이관에 seedHuntProgress 를 쓴다', w.includes('seedHuntProgress(this.huntProgress'));
  /* killTotals 는 업적/컬렉션/기존 세이브 호환용으로 남는다 — 진행도 판정에 쓰이면 안 된다. */
  const progressUsesKillTotals = /huntProgressSum[\s\S]{0,200}killTotals/.test(w);
  ok('진행도 판정이 killTotals 를 다시 읽지 않는다', !progressUsesKillTotals);
}

/* ── 9. config.ts SaveData 3곳 싱크 ─────────────────────────────────────── */
{
  const fs = await import('node:fs');
  const cfg = fs.readFileSync(new URL('../src/game/config.ts', import.meta.url), 'utf8');
  ok('SaveData 에 huntProg 필드 선언', /huntProg\?: Record<string, number>/.test(cfg));
  ok('migrateSave 가 huntProg 기본값을 채운다', /if \(!d\.huntProg \|\| typeof d\.huntProg !== "object"\) d\.huntProg = \{\}/.test(cfg));
  ok('기존 huntKills/huntBase 필드는 유지 (세이브 호환)', /huntKills\?: Record<string, number>/.test(cfg) && /huntBase\?: Record<string, number>/.test(cfg));
}

console.log(
  `ALL CHECKS PASS: quest-progress — ${checks} checks / ` +
  `맵·퀘스트 독립 집계 / 초과·완료후 집계 차단 / 세이브 왕복 / 구세이브 이관`,
);
