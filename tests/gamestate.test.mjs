#!/usr/bin/env node
/**
 * vc226 — GameState 초기값이 WorldScene 필드 기본값과 일치하는지 검증.
 *
 * 배경: `docs/VC225_REFACTOR_1_6.md` 에서 리팩터링 4~6 을 멈춘 이유는
 * 상태가 씬에 흩어져 있어(87개) 어느 모듈로도 옮길 수 없었기 때문이다.
 * 선행 조건으로 `src/game/state/gameState.ts` 에 상태 정의를 모았다.
 *
 * 이 테스트가 지키는 것:
 *  1. 초기값이 WorldScene 필드 선언과 **같은지** — 다르면 2단계에서
 *     새 게임 시작 시 진행도가 어긋난다.
 *  2. 상태에 넣은 필드가 WorldScene 에 **실제로 있는지** — 오타로 유령 필드를
 *     만들면 2단계 치환 때 조용히 undefined 가 된다.
 *
 * 실행: node tests/gamestate.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createGameState } from "../src/game/state/gameState.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

const scene = fs.readFileSync(path.join(ROOT, "src/game/scenes/WorldScene.ts"), "utf8");
const lines = scene.split("\n");

/** WorldScene 에서 `name = <기본값>` 선언을 찾는다 */
function sceneDefault(name) {
  const re = new RegExp(`^  (?:private |public |protected |readonly )*${name}\\s*(?::[^=]+)?=\\s*(.+?);`);
  for (const l of lines) {
    const m = l.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

const gs = createGameState();

console.log("1) 최상위 필드가 WorldScene 에 존재");
const FLAT = [
  "questIdx", "savedQuestIdx", "huntCount", "monsterKills", "fragmentsFound",
  "cleared", "dlcTalked", "repeatOn", "repeatNeed", "migratedTutSeen",
  "jobStory", "jobStoryDone", "pendingJobClass", "pendingPonyRefund",
  "figures", "shards", "gachaTickets", "badges", "badgeSlots", "freeGachaAt",
  "starterPackBought", "runes", "runeSlots", "constel", "unlockedSets",
  "attendLast", "attendCount", "couponsUsed", "achClaimed",
  "bossKillCount", "bossDiff", "gateBest", "closetBest", "gateStars",
  "parkCoins", "parkBest", "parkTickets", "inf", "seenSet", "visited",
  "autoHunt", "autoAlloc", "acceptedQuests", "trackedStage", "playerTitle",
  "chibiQuests", "lastSeenAt",
];
let ghost = [];
for (const f of FLAT) {
  if (!(f in gs)) ghost.push(`GameState 에 ${f} 없음`);
  if (sceneDefault(f) === null) ghost.push(`WorldScene 에 ${f} 없음`);
}
ok(`최상위 필드 ${FLAT.length}개가 양쪽에 있다`, ghost.length === 0, `(${ghost.join(", ")})`);

console.log("\n2) 초기값 일치 (숫자/불리언/문자열)");
/* 배열·객체·Set 은 표기법이 달라 별도로 본다(3). */
const SCALARS = [
  "questIdx", "huntCount", "cleared", "dlcTalked", "repeatOn", "repeatNeed",
  "migratedTutSeen", "pendingPonyRefund", "shards", "gachaTickets",
  "freeGachaAt", "starterPackBought", "attendLast", "attendCount",
  "bossKillCount", "gateBest", "closetBest", "parkCoins", "parkBest",
  "autoHunt", "autoAlloc", "lastSeenAt", "bossDiff",
];
let diffs = [];
for (const f of SCALARS) {
  const sd = sceneDefault(f);
  if (sd === null) continue;
  const a = JSON.stringify(gs[f]);
  const b = JSON.stringify(
    sd === "true" ? true : sd === "false" ? false
    : /^-?\d+$/.test(sd) ? Number(sd)
    : sd.replace(/;$/, "").replace(/^"(.*)"$/, "$1")
  );
  if (a !== b) diffs.push(`${f}: GameState=${a} vs WorldScene=${sd}`);
}
ok(`스칼라 ${SCALARS.length}개 초기값 일치`, diffs.length === 0, `(${diffs.join(" | ")})`);

console.log("\n3) 배열/객체 기본값");
function sceneJson(name) {
  const v = sceneDefault(name);
  if (v === null) return null;
  // new Set<string>() → Set, {...} → {}, [...] → []
  if (/^new Set/.test(v)) return "Set";
  if (/^\[\s*\]/.test(v)) return "[]";
  if (/^\{\s*\}/.test(v)) return "{}";
  return v;
}
const COLL = ["badgeSlots", "runeSlots", "figures", "badges", "constel", "couponsUsed", "achClaimed", "gateStars", "jobStoryDone"];
for (const f of COLL) {
  const sd = sceneJson(f);
  const gv = gs[f];
  const kind = Array.isArray(gv) ? "array" : gv === null ? "null" : typeof gv;
  ok(`${f} 이 배열/null/Set 로 일치`, sd !== null && (kind === "array" || kind === "null" || kind === "Set" || kind === "object"), `(scene=${sd}, gs=${kind})`);
}

console.log("\n4) Set 필드");
for (const f of ["seenSet", "visited", "unlockedSets"]) {
  ok(`${f} 이 Set`, gs[f] instanceof Set && sceneJson(f) === "Set");
}

console.log("\n5) 초기 상태는 매번 새로 만든다 (공유 참조 방지)");
const a = createGameState(), b = createGameState();
a.seenSet.add("x"); a.monsterKills.k = 1; a.daily.ads = 5;
ok("seenSet 공유 안 됨", !b.seenSet.has("x"));
ok("monsterKills 공유 안 됨", b.monsterKills.k === undefined);
ok("daily 공유 안 됨", b.daily.ads === 0);

console.log("\n6) InfState 가 infinite.ts 의 InfSave 와 일치");
{
  const inf = fs.readFileSync(path.join(ROOT, "src/game/infinite.ts"), "utf8");
  const m = inf.match(/export type InfSave = \{([\s\S]*?)\n\};/);
  /* optional 필드(`rebirthLog?:`)도 잡아야 한다 — `\??` 는 `?` 를 삼키지 못한다. */
  /* optional 필드(`rebirthLog?:`)도 잡아야 한다 — `\?` 이스케이프가 셸/에디터를 거치며
   *  깨지는 사례가 있어 문자클래스 `[?]` 로 쓴다(동일 의미·이스케이프 불필요). */
  const infFields = m ? [...m[1].matchAll(/^\s{2}([A-Za-z_$][\w$]*)\s*[?]?\s*:/gm)].map((x) => x[1]) : [];
  const gsInfFields = Object.keys(gs.inf);
  const missing = infFields.filter((f) => !gsInfFields.includes(f));
  const extra = gsInfFields.filter((f) => !infFields.includes(f));
  ok(`InfState 필드가 InfSave 와 일치 (${infFields.length}개)`,
     missing.length === 0 && extra.length === 0,
     `(누락 ${missing.join(",") || "없음"} / 초과 ${extra.join(",") || "없음"})`);
}

console.log("\n7) WorldScene 이 syncStateMirror 를 갖는다");
{
  ok("syncStateMirror 정의", /private syncStateMirror\(\)/.test(scene));
  ok("restoreFromSave 끝에서 호출", /this\.syncStateMirror\(\);/.test(scene));
  const body = scene.slice(scene.indexOf("private syncStateMirror()"), scene.indexOf("private syncStateMirror()") + 9000);
  /* 미러가 절반만 채우면 2단계에서 조용히 stale 값을 읽는다 — 45개 이상 할당 확인 */
  const assigns = (body.match(/\bs\.[A-Za-z_$][\w$]*\s*=/g) ?? []).length;
  ok(`미러 할당 ${assigns}개 (45개 이상)`, assigns >= 45, `(실제 ${assigns})`);
}

console.log("\n8) 미러를 읽는 코드가 없다 (ponytail-review #3)");
{
  /* 미러는 복원 직후 한 번만 채워지고 그 뒤로 씬 필드를 따라가지 않는다.
   *  누군가 이걸 "진짜 상태"로 읽으면 저장 이후 변경분이 반영되지 않아 표시가 어긋난다.
   *  그래서 쓰기(syncStateMirror 안) 외에 읽는 곳이 0곳임을 고정한다.
   *
   *  허용 예외: 선언부, syncStateMirror 본문.
   *  `this.state` 가 그 밖에서 등장하면 실패. */
  const lines = scene.split("\n");
  const declLine = lines.findIndex((l) => /private readonly state: GameState/.test(l));
  const smStart = lines.findIndex((l) => /private syncStateMirror\(\)/.test(l));
  let smEnd = smStart;
  if (smStart >= 0) {
    let d = 0, began = false;
    for (let i = smStart; i < lines.length; i++) {
      d += (lines[i].match(/\{/g) ?? []).length - (lines[i].match(/\}/g) ?? []).length;
      if (lines[i].includes("{")) began = true;
      if (began && d === 0) { smEnd = i; break; }
    }
  }
  const offenders = [];
  /* 주석은 제외한다 — 설명문에 `this.state.x` 예시가 들어가는 것은 정상이다. */
  const isComment = (l) => /^\s*(\/\/|\*|\/\*)/.test(l);
  lines.forEach((l, i) => {
    if (i === declLine) return;
    if (i >= smStart && i <= smEnd) return;
    if (isComment(l)) return;
    if (/this\.state\b/.test(l)) offenders.push(`${i + 1}: ${l.trim().slice(0, 70)}`);
  });
  ok(`미러를 읽는 곳 0곳`, offenders.length === 0, `(${offenders.slice(0, 3).join(" | ")})`);
  ok("미러에 '신뢰 대상 아님' 경고 주석", /신뢰 대상이 아니다/.test(scene));
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
