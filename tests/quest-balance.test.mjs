/**
 * 퀘스트 밸런스 자동 검증 — vc238 (P4).
 *
 * [유저 요구 원문]
 *  "게임 후반으로 갈수록 처치형 퀘스트의 요구량이 분명하게 증가하도록 변경하라."
 *  "특히 9분 제한에 260마리를 요구하는 퀘스트라면 해당 맵에서 실제로 그만큼
 *   처치할 수 있는 몬스터가 소환되는지 자동 테스트한다."
 *
 * [이 파일이 지키는 것]
 *  1. 곡선 단조 증가 — 후반에 요구량이 줄어드는 구간이 없어야 한다.
 *  2. 급변 금지 — 레벨 1 차이에서 2배를 넘지 않는다(절벽 금지).
 *  3. 범위 — Lv100 이 유저 목표(후반 400~650) 안에 있어야 한다.
 *  4. 분포 — 후반 챕터가 초반 수준(<50)에 머물지 않아야 한다.
 *  5. **처치 가능량** — 각 hunt 퀘스트의 need 가 그 맵에서 실제로 처치 가능한 수를
 *     넘지 않아야 한다. `maxKillsIn` 이 그 상한을 계산한다(순수 함수).
 *
 * [왜 maxKillsIn 이 순수 함수인가]
 *  밸런스를 바꿀 때마다 "이거 진짜 잡을 수 있나?"를 손으로 계산하면 반드시 틀린다.
 *  스폰 수·리스폰 주기·제한시간만 받아 상한을 돌려주는 순수 함수로 고정해 두면,
 *  수치를 바꾸는 순간 테스트가 먼저 깨져서 알려준다.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { STAGES, CHAPTERS, questNeedByLv, zoneSpawnCap, HUNT_NEED_FLOOR } from "../src/game/stages.ts";

/* ─────────────────────────── 게임 실측 상수 ─────────────────────────── */

/** 사망 후 리스폰 지연 — `WorldScene.ts` 의 `Phaser.Math.Between(3200, 4800)` 과 동일. */
const RESPAWN_MIN_MS = 3200;
const RESPAWN_MAX_MS = 4800;

/** QuestDef 에는 시간제한 필드가 없다 — 모든 사냥 퀘스트는 제한 없이 진행된다.
 *  그래서 "넉넉한 기준"(작업 지시서)인 10분을 쓴다. 9분 모드(도장·파크)는 90초이고
 *  사냥 퀘스트를 발급하지 않으므로 이 계산과 무관하다. */
const NO_LIMIT_WINDOW_MS = 600_000;

/**
 * N초 안에 그 맵에서 **최대** 몇 마리까지 처치 가능한가 (순수 함수).
 *
 * [모델]
 *  `spawnCount` 마리가 동시에 살아 있다. 한 마리를 잡으면 평균 `respawnCycle` 후
 *  같은 수만큼 다시 채워진다. 즉 웨이브 단위로 생각하면
 *   · 0초: spawnCount 마리 처치 가능
 *   · cycle 마다 spawnCount 마리씩 추가
 *  => 처치 상한 = spawnCount × (1 + floor(window / cycle))
 *
 * [왜 하한(최소)이 아니라 상한인가]
 *  이 테스트는 "물리적으로 잡을 수 있는가"의 **낙관적 천장**을 본다. 여기서도
 *  실패하면 그 퀘스트는 어떤 플레이로도 완료 불가다. 통과했다고 쉬운 것은 아니며,
 *  이동·쿨다운·젠 분산은 고려하지 않는다(그건 플레이테스트 영역).
 *  리스폰 주기는 최소값(빠른 재젠)을 써서 천장을 높게 잡는다 — 반대로 하면
 *  "느린 리스폰 때문에 불가능"을 놓친다.
 *
 * @returns 최대 처치 가능 마릿수 (0 이상 정수)
 */
export function maxKillsIn(
  spawnCount,
  respawnMinMs,
  respawnMaxMs,
  windowMs,
) {
  const spawn = Math.max(0, Math.floor(spawnCount) || 0);
  if (spawn === 0) return 0;
  const win = Math.max(0, windowMs) || 0;
  if (win === 0) return 0;
  /* 천장을 높게 잡으려면 **빠른** 리스폰(최소값)을 쓴다. */
  const cycle = Math.max(1, Math.floor(respawnMinMs) || 1);
  /* respawnMaxMs 는 현재 모델에서 쓰지 않지만, 시그니처에 남겨 호출부가
   *  "최소~최대"를 그대로 넘기게 한다(나중에 평균/최악 시나리오를 추가할 때 필요). */
  void Math.max(cycle, Math.floor(respawnMaxMs) || cycle);
  return spawn * (1 + Math.floor(win / cycle));
}

/* ─────────────────────────── 수집 헬퍼 ─────────────────────────── */

/** STAGES 전수의 hunt 퀘스트를 평탄화한다. */
function allHunts() {
  const rows = [];
  for (const [stageKey, def] of Object.entries(STAGES)) {
    const spawn = (def.enemies ?? []).reduce((t, g) => t + (g.count ?? 0), 0);
    for (const q of def.quests ?? []) {
      if (q.type !== "hunt") continue;
      rows.push({
        stage: stageKey,
        questId: q.id,
        need: q.need ?? 0,
        spawn,
        /* 챕터 키 — `howlrstone12x3` → `howlrstone12`, `dlcstargate5` → `dlcstargate` */
        chapter: stageKey.replace(/x\d+$/, "").replace(/\d+$/, ""),
      });
    }
  }
  return rows;
}

/** 구간별 분포 — 작업 지시서의 6구간. */
function bucketOf(n) {
  if (n < 50) return "<50";
  if (n < 120) return "50-119";
  if (n < 250) return "120-249";
  if (n < 400) return "250-399";
  if (n < 650) return "400-649";
  return "650+";
}

function distribution(rows) {
  const out = { "<50": 0, "50-119": 0, "120-249": 0, "250-399": 0, "400-649": 0, "650+": 0 };
  for (const r of rows) out[bucketOf(r.need)]++;
  return out;
}

/* ═══════════════════════════ 1. 곡선 ═══════════════════════════ */

test("questNeedByLv: Lv1~300 전 구간에서 단조 비감소", () => {
  let prev = questNeedByLv(1);
  for (let lv = 2; lv <= 300; lv++) {
    const cur = questNeedByLv(lv);
    assert.ok(cur >= prev, `Lv${lv} 에서 감소: ${prev} → ${cur}`);
    prev = cur;
  }
});

test("questNeedByLv: Lv100 이 유저 목표 후반 범위(400~650) 안", () => {
  const v = questNeedByLv(100);
  assert.ok(v >= 400 && v <= 650, `Lv100=${v} — 400~650 밖`);
});

test("questNeedByLv: 인접 레벨 차이가 2배를 넘지 않는다 (절벽 금지)", () => {
  /* 구간 경계에서 값이 튀던 vc143 의 8→60(7.5배) 같은 회귀를 잡는다. */
  for (let lv = 2; lv <= 300; lv++) {
    const a = questNeedByLv(lv - 1);
    const b = questNeedByLv(lv);
    assert.ok(b <= a * 2, `Lv${lv - 1}→${lv} 급변: ${a} → ${b} (${(b / a).toFixed(1)}배)`);
  }
});

test("questNeedByLv: 구간 표의 앵커 값이 정확하다", () => {
  assert.equal(questNeedByLv(1), 20);
  assert.equal(questNeedByLv(20), 50);
  assert.equal(questNeedByLv(35), 120);
  assert.equal(questNeedByLv(50), 250);
  assert.equal(questNeedByLv(70), 400);
  assert.equal(questNeedByLv(100), 650);
  assert.equal(questNeedByLv(300), 1000);
});

test("questNeedByLv: 유저 목표표 상한(1000)을 넘지 않는다", () => {
  /* 유저 지시서: "엔드게임 650~1,000". 1000 이 절대 상한이다. */
  for (let lv = 1; lv <= 300; lv++) {
    const v = questNeedByLv(lv);
    assert.ok(v <= 1000, `Lv${lv} = ${v} — 유저 상한 1000 초과`);
  }
  /* Lv300 은 엔드게임 상단(900~1000)에 있어야 한다. */
  const top = questNeedByLv(300);
  assert.ok(top >= 900 && top <= 1000, `Lv300 = ${top} — 900~1000 밖`);
});

test("questNeedByLv: 범위를 벗어난 입력을 클램프한다", () => {
  assert.equal(questNeedByLv(0), questNeedByLv(1));
  assert.equal(questNeedByLv(-50), questNeedByLv(1));
  assert.equal(questNeedByLv(9999), questNeedByLv(300));
});

/* ═══════════════════════════ 2. 분포 ═══════════════════════════ */

test("hunt 퀘스트: 후반 챕터가 초반 수준(<50)에 머물지 않는다", () => {
  const rows = allHunts();
  assert.ok(rows.length > 0, "hunt 퀘스트가 하나도 없다");

  /* 후반 = DLC 챕터(그랜드플래닛). 이 구간 요구량이 초반 수준이면 유저 요구 미달. */
  const late = rows.filter((r) => r.chapter.startsWith("dlc"));
  assert.ok(late.length > 0, "후반(DLC) hunt 퀘스트가 없다");
  const lateLow = late.filter((r) => r.need < 50);
  assert.equal(
    lateLow.length, 0,
    `후반 퀘스트 ${lateLow.length}개가 <50: ${lateLow.slice(0, 5).map((r) => `${r.stage}=${r.need}`).join(", ")}`,
  );

  /* 실제로 "증가" 하는지 — 후반 최소값이 초반 최대값보다 커야 한다. */
  const hw = rows.filter((r) => r.chapter.startsWith("howlrstone"));
  if (hw.length && late.length) {
    const hwMin = Math.min(...hw.map((r) => r.need));
    const lateMax = Math.max(...late.map((r) => r.need));
    assert.ok(lateMax > hwMin * 4, `후반 최대(${lateMax})가 초반(${hwMin}) 대비 충분히 크지 않다`);
  }
});

test("hunt 퀘스트: 챕터 안에서도 요구량이 단조 증가한다 (후반으로 갈수록)", () => {
  const rows = allHunts();
  /* howlrstone 챕터 번호 순으로 최소 요구량을 뽑아 단조 증가를 확인. */
  const byChapter = new Map();
  for (const r of rows) {
    if (!r.chapter.startsWith("howlrstone")) continue;
    const arr = byChapter.get(r.chapter) ?? [];
    arr.push(r.need);
    byChapter.set(r.chapter, arr);
  }
  const ordered = [...byChapter.entries()]
    .map(([k, arr]) => ({ k, no: Number(k.replace("howlrstone", "")), min: Math.min(...arr) }))
    .sort((a, b) => a.no - b.no);
  for (let i = 1; i < ordered.length; i++) {
    assert.ok(
      ordered[i].min >= ordered[i - 1].min,
      `${ordered[i].k}(${ordered[i].min}) < ${ordered[i - 1].k}(${ordered[i - 1].min}) — 챕터 역행`,
    );
  }
});

test("모든 hunt 퀘스트가 유저 목표표 구간 안에 있다 (하한 20 / 상한 1000)", () => {
  const rows = allHunts();
  /* 유저 지시서 원문: 초반 20~50 … 엔드게임 650~1,000.
   *  즉 **어떤 사냥 퀘스트도 20 미만일 수 없고**, 1000 을 넘을 수 없다.
   *  중간 구간은 연속 곡선이므로 별도 상한을 두지 않는다(후반 650~1000 이 최종 상한). */
  const below = rows.filter((r) => r.need < HUNT_NEED_FLOOR);
  assert.deepEqual(
    below.map((r) => `${r.stage}/${r.questId}=${r.need}`), [],
    `유저 하한(20) 미만 퀘스트 ${below.length}건`,
  );
  const above = rows.filter((r) => r.need > 1000);
  assert.deepEqual(
    above.map((r) => `${r.stage}/${r.questId}=${r.need}`), [],
    `유저 상한(1000) 초과 퀘스트 ${above.length}건`,
  );
  /* 하한 상수가 실제로 20 인지(유저 표) 고정. */
  assert.equal(HUNT_NEED_FLOOR, 20);
});

test("howlrstone 1~3장(초반) hunt 가 전부 유저 초반 구간 20~50 안에 있다", () => {
  /* 유저 표의 "초반 = 20~50". howlrstone 1~3장은 이 저장소의 초반 구간이다.
   *  종전엔 16(하한 미만)이 있었고, 재림은 12 로 초반보다 가벼웠다 — 둘 다 잡는다. */
  const early = allHunts().filter((r) => /^howlrstone[123]x/.test(r.stage));
  assert.ok(early.length >= 4, `초반 hunt 가 ${early.length}건뿐 — 검사 대상 부족`);
  const out = early.filter((r) => r.need < 20 || r.need > 50);
  assert.deepEqual(
    out.map((r) => `${r.stage}=${r.need}`), [],
    `초반 구간(20~50) 밖: ${out.map((r) => `${r.stage}=${r.need}`).join(", ")}`,
  );
});

test("재림(r1~r15) hunt 가 초반보다 무겁다", () => {
  /* 재림은 200레벨 환생 이후 콘텐츠다. 종전엔 need 12 로 초반(16)보다도 가벼웠다. */
  const rb = allHunts().filter((r) => /^r\d+$/.test(r.stage));
  if (rb.length === 0) return; // 재림 스테이지가 없는 구성이면 통과
  const earlyMax = Math.max(...allHunts().filter((r) => /^howlrstone[123]x/.test(r.stage)).map((r) => r.need));
  const rbMin = Math.min(...rb.map((r) => r.need));
  assert.ok(rbMin > earlyMax, `재림 최소(${rbMin})가 초반 최대(${earlyMax})보다 무겁지 않다`);
});

test("분포 출력", () => {
  const rows = allHunts();
  const d = distribution(rows);
  console.log(`\n  hunt 퀘스트 ${rows.length}개 분포:`);
  console.log(`    <50      : ${d["<50"]}`);
  console.log(`    50-119   : ${d["50-119"]}`);
  console.log(`    120-249  : ${d["120-249"]}`);
  console.log(`    250-399  : ${d["250-399"]}`);
  console.log(`    400-649  : ${d["400-649"]}`);
  console.log(`    650+     : ${d["650+"]}`);
  console.log(`    min=${Math.min(...rows.map((r) => r.need))} max=${Math.max(...rows.map((r) => r.need))}\n`);
  /* 구간이 최소 3종 이상 쓰여야 "곡선이 살아 있다"고 볼 수 있다. */
  const used = Object.values(d).filter((n) => n > 0).length;
  assert.ok(used >= 3, `구간이 ${used}종만 사용됨 — 곡선이 죽어 있다`);
});

test("반복 의뢰: 엔드게임이 650~1000 구간에 도달한다", () => {
  const needs = [...new Set(Object.values(STAGES).filter((s) => s.repeat).map((s) => s.repeat.need))];
  assert.ok(needs.length > 0, "반복 의뢰가 없다");
  const max = Math.max(...needs);
  assert.ok(max >= 650, `반복 의뢰 최대가 ${max} — 엔드게임 하한 650 미달`);
  assert.ok(max <= 1000, `반복 의뢰 최대가 ${max} — 엔드게임 상한 1000 초과`);
  /* 초반 보호 — 최소값이 높으면 신규 유저가 벽을 만난다. */
  const min = Math.min(...needs);
  assert.ok(min <= 50, `반복 의뢰 최소가 ${min} — 초반 유저 보호 실패`);
});

/* ═══════════════ 3. 처치 가능량 (유저 명시 요구) ═══════════════ */

test("maxKillsIn: 순수 함수 기본 동작", () => {
  /* 스폰 0 이면 0 */
  assert.equal(maxKillsIn(0, 3200, 4800, 600_000), 0);
  /* 시간 0 이면 0 */
  assert.equal(maxKillsIn(20, 3200, 4800, 0), 0);
  /* 리스폰을 기다리지 않는 첫 웨이브만 잡는 경우 */
  assert.equal(maxKillsIn(20, 3200, 4800, 1000), 20);
  /* cycle=3200, window=9600 → 1 + floor(9600/3200) = 4 웨이브 */
  assert.equal(maxKillsIn(10, 3200, 4800, 9600), 40);
  /* 음수/이상 입력에 던지지 않는다 */
  assert.equal(maxKillsIn(-5, 3200, 4800, 600_000), 0);
  assert.ok(Number.isFinite(maxKillsIn(20, 0, 0, 600_000)));
});

test("maxKillsIn: 스폰이 많을수록 / 시간이 길수록 단조 증가", () => {
  let prev = 0;
  for (const spawn of [0, 1, 5, 20, 40]) {
    const cap = maxKillsIn(spawn, RESPAWN_MIN_MS, RESPAWN_MAX_MS, NO_LIMIT_WINDOW_MS);
    assert.ok(cap >= prev, `spawn=${spawn} 에서 감소`);
    prev = cap;
  }
  let prevT = 0;
  for (const win of [0, 1000, 60_000, 600_000, 1_800_000]) {
    const cap = maxKillsIn(20, RESPAWN_MIN_MS, RESPAWN_MAX_MS, win);
    assert.ok(cap >= prevT, `window=${win} 에서 감소`);
    prevT = cap;
  }
});

test("모든 hunt 퀘스트가 그 맵의 처치 가능량을 넘지 않는다", () => {
  const rows = allHunts();
  assert.ok(rows.length > 0);

  const over = [];
  const ratios = [];

  for (const r of rows) {
    assert.ok(r.spawn > 0, `${r.stage} 에 스폰이 0인데 hunt 퀘스트가 있다`);
    const cap = maxKillsIn(r.spawn, RESPAWN_MIN_MS, RESPAWN_MAX_MS, NO_LIMIT_WINDOW_MS);
    const pct = (r.need / cap) * 100;
    ratios.push({ row: r, cap, pct });
    if (r.need > cap) over.push(`${r.stage}/${r.questId}: need=${r.need} > cap=${cap}`);
  }

  /* 가장 빡빡한 5개를 보고용으로 출력. */
  ratios.sort((a, b) => b.pct - a.pct);
  console.log("\n  가장 빡빡한 퀘스트 (need / 처치상한):");
  for (const x of ratios.slice(0, 5)) {
    console.log(
      `    ${x.row.stage.padEnd(16)} need=${String(x.row.need).padStart(4)} ` +
      `spawn=${String(x.row.spawn).padStart(2)} cap=${String(x.cap).padStart(5)} → ${x.pct.toFixed(1)}%`,
    );
  }
  console.log("");

  assert.deepEqual(over, [], `처치 불가능한 퀘스트:\n${over.join("\n")}`);

  /* 천장 대비 여유가 있어야 한다. 100% 에 붙으면 이동·쿨다운 때문에 실질 불가. */
  const worst = ratios[0];
  assert.ok(
    worst.pct <= 80,
    `가장 빡빡한 퀘스트가 상한의 ${worst.pct.toFixed(1)}% (${worst.row.stage}) — 80% 이하여야 함`,
  );
});

/* ═══════════ 3-b. 구역당 동시 스폰 상한 (vc238 P4 후속) ═══════════ */

test("zoneSpawnCap: 단조 증가하고 초반은 기존 20 을 유지한다", () => {
  /* 초반 보호 — 1~3장은 종전과 같은 20 이어야 신규 유저 체감이 안 바뀐다. */
  for (const n of [1, 2, 3]) assert.equal(zoneSpawnCap(n), 20, `ch${n} 이 20 이 아니다`);
  /* 단조 비감소 */
  let prev = zoneSpawnCap(1);
  for (let n = 2; n <= 40; n++) {
    const cur = zoneSpawnCap(n);
    assert.ok(cur >= prev, `ch${n} 에서 감소: ${prev} → ${cur}`);
    prev = cur;
  }
  /* 후반은 초반보다 확실히 커야 한다(이게 이번 작업의 목적). */
  assert.ok(zoneSpawnCap(25) >= 30, `후반 상한이 ${zoneSpawnCap(25)} — 30 이상이어야 함`);
});

test("구역 스폰 총합이 zoneSpawnCap 을 넘지 않는다", () => {
  /* 배분 합이 상한을 넘으면 리스폰이 영구히 막혀 "배치했는데 안 나오는" 유령이 된다. */
  const overs = [];
  for (const [stageKey, def] of Object.entries(STAGES)) {
    const spawn = (def.enemies ?? []).reduce((t, g) => t + (g.count ?? 0), 0);
    if (spawn === 0) continue;
    /* 스테이지 키에서 챕터 번호를 복원 — howlrstoneN / dlcNAME(15+idx) */
    const hw = /^howlrstone(\d+)x\d+$/.exec(stageKey);
    const dlc = /^(dlc[a-z]+)\d+$/.exec(stageKey);
    let chapterNo = 1;
    if (hw) chapterNo = Number(hw[1]);
    else if (dlc) {
      const idx = CHAPTERS.findIndex((c) => c.key === dlc[1]);
      if (idx >= 0) chapterNo = 15 + idx + 1;
    }
    const cap = zoneSpawnCap(chapterNo);
    if (spawn > cap) overs.push(`${stageKey}: spawn=${spawn} > cap=${cap}`);
  }
  assert.deepEqual(overs, [], `상한 초과:\n${overs.join("\n")}`);
});

test("maxKillsIn 은 9분(540초) 같은 짧은 제한에서도 상한을 낮춘다", () => {
  /* 유저가 언급한 "9분 제한 260마리" 시나리오.
   * 스폰 20, 리스폰 3.2~4.8초라면 9분 상한은 20 × (1 + floor(540000/3200)) = 3400.
   * 즉 260 은 물리적으로 가능 — 이 테스트는 그 계산이 실제로 성립함을 고정한다. */
  const cap9min = maxKillsIn(20, RESPAWN_MIN_MS, RESPAWN_MAX_MS, 540_000);
  assert.ok(cap9min >= 260, `9분 상한 ${cap9min} — 260 을 못 넘으면 그 퀘스트는 불가능`);
  /* 반대로 30초 같은 짧은 창에서는 상한이 크게 낮아져야 한다. */
  const cap30s = maxKillsIn(20, RESPAWN_MIN_MS, RESPAWN_MAX_MS, 30_000);
  assert.ok(cap30s < 260, `30초 상한이 ${cap30s} — 시간 제한이 상한에 반영되지 않음`);
});

/* ═══════════════ 4. 세이브 호환 (need 변경이 진행도를 깨지 않는가) ═══════════════ */

test("퀘스트 진행도는 need 를 저장하지 않는다 — 진행도 보존 근거", () => {
  /* `questProgress.ts` 의 진행도는 `stage:questId` 키에 처치 수만 저장한다.
   * need 가 바뀌어도 키가 그대로면 진행도는 살아 있고, 완료 판정만 새 need 를 쓴다.
   * 여기서는 "퀘스트 id 가 안정적"임을 확인한다 — id 가 바뀌면 진행도가 고아가 된다. */
  const rows = allHunts();
  const ids = rows.map((r) => `${r.stage}:${r.questId}`);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dup, [], `중복 퀘스트 스코프: ${dup.slice(0, 5).join(", ")}`);
});

test("챕터 목록이 비어 있지 않고 lvGate 가 단조 증가한다", () => {
  assert.ok(CHAPTERS.length > 0);
  for (let i = 1; i < CHAPTERS.length; i++) {
    assert.ok(
      CHAPTERS[i].lvGate.enter >= CHAPTERS[i - 1].lvGate.enter,
      `${CHAPTERS[i].key} 의 게이트가 이전 챕터보다 낮다`,
    );
  }
});
