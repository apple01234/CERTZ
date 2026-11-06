// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/quest-spawnable.test.mjs
//
// 퀘스트 완료 가능성 계약 — 토벌 대상이 실제로 스폰되는가 / 기준선이 퀘스트별인가
//
// [왜 필요한가]
//  유저 신고: "거대한 해적선 퀘스트를 어떻게 깨나요?"
//  원인은 데이터 오타가 아니라 **생성기 두 개가 갈라진 것**이었다.
//   · stages.ts 의 본편 buildStage() 는 "beat 토벌 대상이 mix 에 없으면 편입" 로직이 있었고
//   · 영프 편 생성기(같은 파일, 다른 블록)는 그 로직을 복사하지 않아 빠졌다.
//  결과: 영프 편 hunt 퀘스트 12개가 스폰되지 않는 몬스터를 가리켜 영구 미완료.
//  같은 클래스가 [반복] 의뢰에도 있었고 규모가 훨씬 컸다 — 챕터 풀 앞 3종을 고정 배정해
//  bounty 970건 중 462건이 그 맵에 없는 몬스터를 가리켰다.
//
// [두 번째 축]
//  hunt 퀘스트 기준선(huntBaseline)이 종전엔 몬스터키 전역 지도라, 한 번 잡힌 기준선이
//  세이브 내내 유지돼 앞 구역 킬이 다음 구역 토벌을 즉시 채웠다. WorldScene 은 Phaser
//  없이 import 할 수 없으므로 기준선 로직은 아래에 순수 함수로 옮겨 검증한다.
import assert from 'node:assert/strict';
import { STAGES } from '../src/game/stages.ts';

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };

/* ── 1. 모든 hunt 퀘스트의 대상이 그 스테이지에 실제 스폰된다 ──────────────── */
/* 회귀 방지의 핵심 — 누가 스테이지를 추가하고 대상 몬스터를 mix 에 안 넣으면 여기서 깨진다. */
const huntQuests = [];
const collectLikeQuests = [];
for (const [key, def] of Object.entries(STAGES)) {
  if (!def.quests?.length) continue;
  const mixKeys = new Set((def.enemies ?? []).map((g) => g.key));
  for (const q of def.quests) {
    if (q.type === 'hunt') huntQuests.push({ stage: key, q, mixKeys, def });
    if (q.type === 'collect' || q.type === 'boss') collectLikeQuests.push({ stage: key, q, def });
  }
}
for (const { stage, q, mixKeys } of huntQuests) {
  const keys = q.targetKeys ?? (q.targetKey ? [q.targetKey] : []);
  ok(`${stage}/${q.id}: 토벌 대상이 지정돼 있다`, keys.length > 0);
  ok(
    `${stage}/${q.id}: 대상 [${keys.join(',')}] 중 최소 1종이 스폰된다`,
    keys.some((k) => mixKeys.has(k)),
  );
}
ok(`hunt 퀘스트 전수 검사 (${huntQuests.length}건)`, huntQuests.length > 200);

/* collect 은 맵의 파편을 줍고 boss 는 bossKey 스폰 경로를 쓴다 — 다른 경로라 따로 본다. */
for (const { stage, q, def } of collectLikeQuests) {
  if (q.type === 'boss') ok(`${stage}/${q.id}: 보스 퀘스트는 보스 스테이지에만`, def.boss === true && !!def.bossKey);
}

/* ── 2. [반복] 의뢰 대상도 그 스테이지에 실제 스폰된다 ────────────────────── */
/* 970건 중 462건이 깨져 있었다 — 본편·DLC·영프 전 구역. */
const bounties = [];
for (const [key, def] of Object.entries(STAGES)) {
  const r = def.repeat;
  if (!r) continue;
  const mixKeys = new Set((def.enemies ?? []).map((g) => g.key));
  const keys = r.bounties?.length ? r.bounties.map((b) => b.targetKey) : [r.targetKey];
  for (const k of keys) bounties.push({ stage: key, key: k, mixKeys });
}
for (const { stage, key, mixKeys } of bounties) {
  ok(`${stage}: 반복 의뢰 대상 ${key} 가 스폰된다`, mixKeys.has(key));
}
ok(`반복 의뢰 전수 검사 (${bounties.length}건)`, bounties.length > 500);

/* ── 3. 편입이 총 스폰량을 부풀리지 않는다 (난이도 불변) ──────────────────── */
{
  let over = [];
  for (const [key, def] of Object.entries(STAGES)) {
    if (!def.enemies?.length) continue;
    const tot = def.enemies.reduce((t, g) => t + g.count, 0);
    /* 상한 20 (정예/보스 포함). 편입이 후원 그룹 부족으로 +3 하는 경우만 23 까지 허용. */
    if (tot > 23) over.push(`${key}=${tot}`);
  }
  ok(`스폰 총량 상한 유지 (초과: ${over.join(' ') || '없음'})`, over.length === 0);

  /* 본편/DLC 구역은 편입 후에도 정확히 20 이하로 유지돼야 한다(영프 편은 원래 8~20). */
  const mainlineOver = Object.entries(STAGES)
    .filter(([k, d]) => d.enemies?.length && !k.startsWith('howlrstone') && /^(forest|kingdom|alfheim|muspelheim|niflheim|cave|nidavellir|hel|abyss|dlc)/.test(k))
    .filter(([, d]) => d.enemies.reduce((t, g) => t + g.count, 0) > 20)
    .map(([k]) => k);
  ok(`본편/DLC 스폰 총량 20 이하 (초과: ${mainlineOver.join(' ') || '없음'})`, mainlineOver.length === 0);
}

/* ── 4. hunt 기준선은 퀘스트 스코프다 (구역 간 킬 누수 차단) ──────────────── */
/* WorldScene 은 Phaser 의존이라 import 불가 — 로직만 여기 옮겨 검증한다.
 *  소스와 갈라지지 않도록 WorldScene 이 huntScopeKey/seedHuntBaseline 을 쓰는지도 본다. */
{
  /** WorldScene.huntScopeKey 와 같은 규칙 */
  const scope = (stage, id, repeatIdx = null, cycle = 0) =>
    repeatIdx === null ? `${stage}:${id}` : `${stage}:${id}:${repeatIdx}:${cycle}`;

  const killTotals = { swampbeast: 8 };
  const baseline = {};

  /** WorldScene.seedHuntBaseline 과 같은 규칙 */
  const seed = (stage, id, keys, scoped = true, legacyMigrate = true) => {
    const base = scoped ? scope(stage, id) : null;
    for (const k of keys) {
      const bid = base ? `${base}|${k}` : k;
      if (bid in baseline) continue;
      const legacy = legacyMigrate ? baseline[k] : undefined;
      baseline[bid] = legacy ?? killTotals[k] ?? 0;
      if (legacy !== undefined) delete baseline[k];
    }
  };
  const progress = (stage, id, keys, scoped = true) => {
    const base = scoped ? scope(stage, id) : null;
    return keys.reduce((s, k) => s + (killTotals[k] ?? 0) - (baseline[base ? `${base}|${k}` : k] ?? 0), 0);
  };

  /* 핵심 회귀: 1장에서 8킬을 쌓고 2장의 같은 몬스터 퀘스트로 넘어가면 0부터여야 한다. */
  seed('howlrstone1x3', '13-hw2', ['swampbeast']);
  ok('1장 퀘스트: 이미 잡은 8킬은 진행도에 안 들어간다', progress('howlrstone1x3', '13-hw2', ['swampbeast']) === 0);
  killTotals.swampbeast = 11;
  ok('1장 퀘스트: 시작 이후 3킬만 인정', progress('howlrstone1x3', '13-hw2', ['swampbeast']) === 3);

  /* 2장의 다른 퀘스트로 넘어가면 기준선이 지금 시점(11)으로 새로 잡혀 0 이어야 한다. */
  seed('howlrstone2x2', '22-hw3', ['swampbeast']);
  ok('2장 퀘스트: 앞 구역 킬이 새지 않는다 (0부터)', progress('howlrstone2x2', '22-hw3', ['swampbeast']) === 0);
  ok('1장 퀘스트 진행도는 그대로 보존된다', progress('howlrstone1x3', '13-hw2', ['swampbeast']) === 3);

  /* 같은 퀘스트를 다시 seed 해도 기준선이 흔들리지 않는다(재저장/재입장). */
  killTotals.swampbeast = 14;
  seed('howlrstone2x2', '22-hw3', ['swampbeast']);
  ok('같은 퀘스트 재-seed 는 진행도를 보존한다 (3킬 유지)', progress('howlrstone2x2', '22-hw3', ['swampbeast']) === 3);

  /* 구세이브 승계: 예전 몬스터키 단독 키를 새 스코프 키가 이어받는다. */
  baseline.swampbeast = 5;
  killTotals.swampbeast = 9;
  seed('howlrstone2x2', 'legacy-id', ['swampbeast']);
  ok('구세이브 huntBase 를 승계해 진행도가 유지된다 (9-5=4)', progress('howlrstone2x2', 'legacy-id', ['swampbeast']) === 4);
  ok('승계 후 옛 키는 제거된다', !('swampbeast' in baseline));

  /* 스코프가 없을 때(구 동작)의 버그를 재현해 고정 — 이런 코드로 돌아가면 안 된다. */
  const old = { swampbeast: 0 };
  const oldProgress = (k) => (killTotals[k] ?? 0) - (old[k] ?? 0);
  ok('구 동작은 앞 구역 킬을 그대로 세어버린다 (이 회귀를 막는 테스트)', oldProgress('swampbeast') === 9);
}

/* ── 5. WorldScene 이 새 기준선 경로를 실제로 쓰는가 ──────────────────────── */
{
  const fs = await import('node:fs');
  const world = fs.readFileSync(new URL('../src/game/scenes/WorldScene.ts', import.meta.url), 'utf8');
  ok('huntScopeKey 헬퍼가 있다', world.includes('private huntScopeKey('));
  ok('seedHuntBaseline 이 있다', world.includes('private seedHuntBaseline()'));
  ok('huntProgressSum 이 퀘스트 스코프 기준선을 읽는다', world.includes('huntBaseline[`${base}|${k}`]'));
  ok('전역 몬스터키 기준선 읽기로 돌아가지 않았다', !world.includes('this.huntBaseline[k] ?? 0'));
  ok('구세이브 승계 경로가 있다', world.includes('const legacy = this.huntBaseline[k];'));
  ok('반복 의뢰 수락 시 재-baseline 한다', /this\.repeatOn = true;[\s\S]{0,400}this\.seedHuntBaseline\(\);/.test(world));
  /* 반복 의뢰가 afterAdvance 의 `!repeatActive()` 가드에 걸려 빠지면 다시 무한 진행이 된다. */
  ok(
    'afterAdvance 가 반복 의뢰도 기준선을 잡는다 (가드에 안 막힌다)',
    /private afterAdvance\(\)[\s\S]{0,300}if \(q\?\.type === "hunt"\)[\s\S]{0,400}this\.seedHuntBaseline\(\);/.test(world),
  );
  /* tracker 표시값은 emitQuest 전에 계산돼야 0/N 로 깜빡이지 않는다. */
  ok(
    'huntCount 를 emitQuest 앞에서 계산한다',
    /this\.huntCount = Math\.min\(this\.huntProgressSum\(q\), q\.need \?\? 0\);\s*\}\s*this\.emitQuest\(\);/.test(world),
  );
  ok('완료 판정은 seed 이후 progress 로 한다', /const progress = this\.huntProgressSum\(q\);/.test(world));
}

console.log(
  `ALL CHECKS PASS: quest-spawnable — ${checks} checks / ` +
  `hunt ${huntQuests.length}건 전부 스폰 가능 / 반복 의뢰 ${bounties.length}건 전부 스폰 가능 / ` +
  `기준선 퀘스트 스코프 + 구세이브 승계`,
);
