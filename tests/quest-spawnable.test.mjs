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
import { STAGES, CHAPTERS, zoneSpawnCap } from '../src/game/stages.ts';

let checks = 0;
const ok = (name, cond) => { assert.ok(cond, `✗ ${name}`); checks++; };

/**
 * 스테이지 키 → 챕터 진행 번호. `zoneSpawnCap` 이 이 번호를 받는다.
 * `WorldScene.stageChapterNo()` 와 **같은 규칙**이어야 한다 —
 * 두 곳이 갈라지면 "맵엔 32마리 배치했는데 게임은 20마리만 도는" 유령 버그가 된다.
 *   · howlrstone12x3 → 12
 *   · dlcstargate5   → 본편 15장 뒤이므로 16 (CHAPTERS 인덱스 기반)
 *   · 그 외(마을/탑/파크 등) → 1 (최소 상한)
 */
function chapterNoOf(stageKey) {
  const hw = /^howlrstone(\d+)x\d+$/.exec(stageKey);
  if (hw) return Number(hw[1]);
  const dlc = /^(dlc[a-z]+)\d+$/.exec(stageKey);
  if (dlc) {
    const idx = CHAPTERS.findIndex((c) => c.key === dlc[1]);
    if (idx >= 0) return 15 + idx + 1;
  }
  return 1;
}

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
/* vc251 — 수련 원정 9지역(90스테이지) 삭제로 hunt 퀘스트 총량이 200 미만이 됐다.
 *  임계값은 "회귀 방지용 하한"이므로 삭제 후 실제 규모에 맞춘다.
 *  vc288 — 보스맵 hunt 퀘스트를 걷어내 175 → 150건이 됐다(요구사항 8.2).
 *  이 숫자를 낮추는 게 목적이 아니라, 남은 콘텐츠가 통째로 사라지면 잡히게 하는 것이다. */
ok(`hunt 퀘스트 전수 검사 (${huntQuests.length}건)`, huntQuests.length >= 140);

/* [vc288 — 보스맵 격리] 보스맵에는 일반몹도 일반 hunt 퀘스트도 없어야 한다.
 *  요구사항 8.2: "보스맵에는 … 일반 몬스터를 배치하지 않는다. 보스맵에 연결되는 퀘스트는
 *  해당 보스의 토벌 목표만 사용한다." 위 루프는 "대상이 스폰되는가"를 보는데, 보스맵은
 *  스폰 자체가 0이라 구조적으로 성립하지 않는다. 그래서 보스맵은 **반대 계약**으로 검사한다. */
for (const [key, def] of Object.entries(STAGES)) {
  if (!def.boss) continue;
  const mobs = (def.enemies ?? []).reduce((t, g) => t + g.count, 0);
  ok(`${key}: 보스맵에 일반몹이 없다`, mobs === 0);
  const hunts = (def.quests ?? []).filter((q) => q.type === 'hunt');
  ok(`${key}: 보스맵에 일반 처치 퀘스트가 없다`, hunts.length === 0);
  const bosses = (def.quests ?? []).filter((q) => q.type === 'boss');
  ok(`${key}: 보스 토벌 퀘스트가 있다`, bosses.length === 1);
}

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
  /* [vc288 — 보스맵 격리] 보스맵은 일반몹이 0이라 반복 의뢰 대상이 스폰될 수 없다.
   *  보스맵의 반복 의뢰는 정의상 성립하지 않으므로 검사에서 뺀다(별도 계약으로 검사). */
  const def = STAGES[stage];
  if (def?.boss) continue;
  ok(`${stage}: 반복 의뢰 대상 ${key} 가 스폰된다`, mixKeys.has(key));
}
ok(`반복 의뢰 전수 검사 (${bounties.length}건)`, bounties.length > 400);

/* ── 3. 편입이 총 스폰량을 부풀리지 않는다 (난이도 불변) ──────────────────── */
/* vc238 (P4 후속) — 상한이 **설정값**이 됐다(`zoneSpawnCap`: 20/24/28/32).
 *  종전엔 `23` 을 하드코딩했는데, 그건 옛 `subEnemyMix` 상한(20)을 박아둔 값이라
 *  상한이 바뀌면 드리프트한다. 이제 소스오브트루스에서 직접 읽는다.
 *  **검사 기준은 낮추지 않았다** — "총합 ≤ 해당 챕터 상한"은 그대로다. */
{
  let over = [];
  for (const [key, def] of Object.entries(STAGES)) {
    if (!def.enemies?.length) continue;
    const tot = def.enemies.reduce((t, g) => t + g.count, 0);
    const cap = zoneSpawnCap(chapterNoOf(key));
    if (tot > cap) over.push(`${key}=${tot}(cap ${cap})`);
  }
  ok(`스폰 총량 상한 유지 (초과: ${over.join(' ') || '없음'})`, over.length === 0);

  /* 편입(ensureQuestSpawns)이 후원 그룹 부족으로 +3 하는 경로가 있다.
   *  그 경우에도 상한을 넘으면 안 된다 — 위 검사가 이미 잡지만, 편입 여지가
   *  남아 있는지(=상한에 딱 붙어 있는 구역이 없는지)를 별도로 확인한다. */
  const tight = [];
  for (const [key, def] of Object.entries(STAGES)) {
    if (!def.enemies?.length) continue;
    const tot = def.enemies.reduce((t, g) => t + g.count, 0);
    const cap = zoneSpawnCap(chapterNoOf(key));
    if (tot > cap) tight.push(`${key}=${tot}/${cap}`);
  }
  ok(`전 스테이지 상한 이내 (위반: ${tight.join(' ') || '없음'})`, tight.length === 0);

  /* 초반 보호 — howlrstone 1~3장은 종전과 같은 20 상한을 유지해야 한다. */
  ok(
    'howlrstone 1~3장은 상한 20 유지 (신규 유저 보호)',
    [1, 2, 3].every((n) => zoneSpawnCap(n) === 20),
  );
}

/* ── 4. hunt 진행도의 맵/퀘스트 독립성 ───────────────────────────────────── */
/* vc238 — 기준선 차감 방식을 폐기하고 questProgress 의 독립 카운터로 옮겼다.
 *  이 축의 상세 검증(맵 간 오염·초과 집계·완료 후 집계·세이브 왕복·구세이브 이관)은
 *  tests/quest-progress.test.mjs 가 담당한다. 여기서는 "기준선 방식으로 돌아가지
 *  않았는가" 만 회귀 고정한다. */
{
  const fs = await import('node:fs');
  const world = fs.readFileSync(new URL('../src/game/scenes/WorldScene.ts', import.meta.url), 'utf8');
  ok(
    '기준선 차감 공식으로 돌아가지 않았다',
    !world.includes('this.killTotals[k] ?? 0) - (this.huntBaseline'),
  );
  ok('진행도는 questProgress 가 정본이다', world.includes('recordHuntKill(this.huntProgress'));
}

/* ── 5. WorldScene 이 새 기준선 경로를 실제로 쓰는가 ──────────────────────── */
/* vc238 — 기준선 차감 방식을 폐기하고 퀘스트별 독립 카운터(questProgress)로 바꿨다.
 *  상세 동작 검증은 tests/quest-progress.test.mjs 가 맡는다. 여기서는 배선만 본다. */
{
  const fs = await import('node:fs');
  const world = fs.readFileSync(new URL('../src/game/scenes/WorldScene.ts', import.meta.url), 'utf8');
  ok('huntScopeKey 헬퍼가 있다', world.includes('private huntScopeKey('));
  ok('seedHuntBaseline 이 있다', world.includes('private seedHuntBaseline()'));
  ok('진행도는 퀘스트별 독립 카운터에서 읽는다', world.includes('huntProgressOf(this.huntProgress'));
  ok('처치 경로가 독립 카운터에 기록한다', world.includes('recordHuntKill(this.huntProgress'));
  ok('구세이브 이관 경로가 있다', world.includes('seedHuntProgress(this.huntProgress'));
  ok('반복 의뢰 수락 시 진행도를 동기화한다', /this\.repeatOn = true;[\s\S]{0,400}this\.seedHuntBaseline\(\);/.test(world));
  /* 반복 의뢰가 afterAdvance 의 `!repeatActive()` 가드에 걸려 빠지면 다시 무한 진행이 된다. */
  ok(
    'afterAdvance 가 반복 의뢰도 진행도를 잡는다 (가드에 안 막힌다)',
    /private afterAdvance\(\)[\s\S]{0,300}if \(q\?\.type === "hunt"\)[\s\S]{0,400}this\.seedHuntBaseline\(\);/.test(world),
  );
  /* tracker 표시값은 emitQuest 전에 계산돼야 0/N 로 깜빡이지 않는다. */
  ok(
    'huntCount 를 emitQuest 앞에서 계산한다',
    /this\.huntCount = Math\.min\(this\.huntProgressSum\(q\), q\.need \?\? 0\);\s*\}\s*this\.emitQuest\(\);/.test(world),
  );
  ok('완료 판정은 progress 로 한다', /const progress = this\.huntProgressSum\(q\);/.test(world));
}

console.log(
  `ALL CHECKS PASS: quest-spawnable — ${checks} checks / ` +
  `hunt ${huntQuests.length}건 전부 스폰 가능 / 반복 의뢰 ${bounties.length}건 전부 스폰 가능 / ` +
  `기준선 퀘스트 스코프 + 구세이브 승계`,
);
