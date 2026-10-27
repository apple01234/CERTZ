#!/usr/bin/env node
/**
 * verify-ultimates.js — 궁극기 커버리지 계약 검사 (vc195)
 *
 * 기획서 부록 A #004 / #006 / P0 #3:
 *   "10개 최종 직업의 SKILL5_INFO / SKILL5B_INFO / PROFILES 키 커버리지를 검사하되,
 *    누락이 DEFAULT_PROFILE 로 조용히 숨지 않게 한다."
 *
 * tsc 는 문자열 키 집합의 불일치를 잡지 못한다. 이 스크립트가 그 역할을 한다.
 *
 * 실행: node tools/verify-ultimates.js
 * 실패 시 exit 1.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** 기획서 §4 가 정본으로 삼는 10개 최종 직업 (5계열 × 2) */
const FINAL_JOBS = [
  "warbringer", "crusader",      // 전사
  "deadeye", "skylord",          // 궁수
  "arclord", "eternal",          // 마법사
  "shadowlord", "blademaster",   // 도적
  "seaking", "dreadnought",      // 해적
];

/**
 * 객체 리터럴 본문에서 **깊이 1** 의 키를 뽑는다.
 * 들여쓰기에 의존하지 않는다 — PROFILES 처럼 한 줄에 여러 키가 있는 형태도 잡아야 한다.
 */
function topKeys(src, name) {
  const m = new RegExp(name + "[^=]*=\\s*\\{").exec(src);
  if (!m) return null;
  const start = m.index + m[0].length;
  const keys = [];
  let depth = 1;
  let i = start;
  let atKeyStart = true; // 깊이 1에서 키가 시작될 수 있는 위치인지

  while (i < src.length && depth > 0) {
    const c = src[i];

    if (depth === 1 && atKeyStart) {
      // 공백/주석/줄바꿈 건너뛰기
      if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === ",") {
        i++;
        continue;
      }
      // 블록 주석
      if (c === "/" && src[i + 1] === "*") {
        const end = src.indexOf("*/", i + 2);
        i = end < 0 ? src.length : end + 2;
        continue;
      }
      // 라인 주석
      if (c === "/" && src[i + 1] === "/") {
        const end = src.indexOf("\n", i + 2);
        i = end < 0 ? src.length : end + 1;
        continue;
      }
      // 키 식별자
      const km = /^([a-zA-Z_$][\w$]*)\s*:/.exec(src.slice(i, i + 80));
      if (km) {
        keys.push(km[1]);
        i += km[0].length;
        atKeyStart = false;
        continue;
      }
      atKeyStart = false;
    }

    if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 1) atKeyStart = true; // 값 객체가 끝났다 → 다음 키 가능
    } else if (c === "," && depth === 1) {
      atKeyStart = true;
    }
    i++;
  }
  return keys;
}

/** 함수 본문에서 case "x": 목록을 뽑는다 */
function casesOf(src, fnName) {
  const m = new RegExp("(?:private |public )?" + fnName + "\\([^)]*\\)[^{]*\\{").exec(src);
  if (!m) return null;
  let i = m.index + m[0].length;
  let depth = 1;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    i++;
  }
  const body = src.slice(m.index, i);
  return [...body.matchAll(/case "([a-z0-9_]+)":/g)].map((x) => x[1]);
}

const classesSrc = read("src/game/classes.ts");
const playerSrc = read("src/game/entities/Player.ts");
const ultSrc = read("src/game/fx/ultLayers.ts");

const report = [];
let fail = 0;

function check(label, ok, detail) {
  report.push(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) fail++;
}

// ── 1) 데이터 테이블 존재 및 누락 ────────────────────────────────
const s5 = topKeys(classesSrc, "SKILL5_INFO");
const s5b = topKeys(classesSrc, "SKILL5B_INFO");
const prof = topKeys(ultSrc, "PROFILES");

check("SKILL5_INFO 파싱", Array.isArray(s5), s5 ? `${s5.length}키` : "미발견");
check("SKILL5B_INFO 파싱", Array.isArray(s5b), s5b ? `${s5b.length}키` : "미발견");
check("ultLayers PROFILES 파싱", Array.isArray(prof), prof ? `${prof.length}키` : "미발견");

if (s5 && s5b && prof) {
  for (const [label, arr] of [
    ["SKILL5_INFO", s5],
    ["SKILL5B_INFO", s5b],
    ["PROFILES", prof],
  ]) {
    const missing = FINAL_JOBS.filter((k) => !arr.includes(k));
    check(`${label} — 10직업 누락 0`, missing.length === 0, missing.length ? "누락: " + missing.join(", ") : "");
  }
}

// ── 2) 실행 분기 커버리지 ───────────────────────────────────────
const c5 = casesOf(playerSrc, "useSkill5");
const c5b = casesOf(playerSrc, "useSkill5b");

check("useSkill5 파싱", Array.isArray(c5), c5 ? `${c5.length} case` : "미발견");
check("useSkill5b 파싱", Array.isArray(c5b), c5b ? `${c5b.length} case` : "미발견");

if (c5 && c5b) {
  for (const [label, arr] of [
    ["useSkill5", c5],
    ["useSkill5b", c5b],
  ]) {
    const missing = FINAL_JOBS.filter((k) => !arr.includes(k));
    check(`${label} — 10직업 분기 누락 0`, missing.length === 0, missing.length ? "누락: " + missing.join(", ") : "");
  }
}

// ── 3) resolveSkill5Of 가 10직업 전부를 최종직업으로 인정하는가 ──
const tier4 = /TIER4_ULTIMATES[^=]*=\s*\[([\s\S]*?)\]/.exec(classesSrc);
if (tier4) {
  const listed = [...tier4[1].matchAll(/"([a-z0-9_]+)"/g)].map((x) => x[1]);
  const missing = FINAL_JOBS.filter((k) => !listed.includes(k));
  check(
    "TIER4_ULTIMATES — 10직업 등록",
    missing.length === 0,
    `등록 ${listed.length}개` + (missing.length ? `, 누락: ${missing.join(", ")}` : ""),
  );
} else {
  check("TIER4_ULTIMATES 파싱", false, "미발견");
}

// ── 4) ultSlot 예외 안전성 (기획서 P0 #1) ───────────────────────
const directReset = (playerSrc.match(/this\.ultSlot = 0;/g) || []).length;
const finallyRestore = (playerSrc.match(/this\.ultSlot = prev;/g) || []).length;
check(
  "ultSlot try/finally 복원 (P0 #1)",
  directReset === 0 && finallyRestore >= 2,
  `finally ${finallyRestore}곳 / 직접초기화 ${directReset}곳`,
);

// ── 5) s5b 원격 연출 전용 분기 (기획서 P0 #2) ──────────────────
const worldSrc = read("src/game/scenes/WorldScene.ts");
const s5bBranches = (worldSrc.match(/kind === "s5b"/g) || []).length;
check("s5b 원격 전용 분기 존재 (P0 #2)", s5bBranches >= 1, `${s5bBranches}곳`);

// ── 6) getAllTargetsIn 스크래치 버퍼 순회 중 재호출 금지 (vc195) ──
/**
 * getAllTargetsIn() 은 **공유 스크래치 버퍼**(targetScratch)를 반환한다.
 * 따라서 `for (const e of this.getAllTargetsIn(r))` 본문 안에서 같은 함수를
 * 다시 부르면 out.length = 0 으로 **순회 중인 배열이 재구성**된다. for...of 는
 * 내부 인덱스를 계속 증가시키며 같은 배열을 읽으므로:
 *   · 순회 중 대상이 죽으면 배열이 줄어 **뒤 원소를 건너뛴다** (피해 누락)
 *   · 순회 중 적이 스폰되면 배열이 늘어 **원래 대상이 아닌 적까지 맞는다**
 * 실측(tools/verify-scratch.mjs): 6마리 중 4마리만 피해 / 스폰 시 12마리 피해.
 * (실제 사례: 이터널 제2궁극기 「흑소멸」 — 620 반경 재현 피해)
 * 이 검사는 그 패턴이 다시 들어오지 못하게 막는다.
 */
const allTargetsScratch = /getAllTargetsIn\([\s\S]{0,120}?const out = this\.targetScratch/.test(playerSrc);
const pLines = playerSrc.split("\n");
const scratchViolations = [];
for (let i = 0; i < pLines.length; i++) {
  if (!/for\s*\(\s*const\s+\w+\s+of\s+this\.getAllTargetsIn\(/.test(pLines[i])) continue;
  // 이 줄부터 중괄호 깊이를 추적해 루프 본문 범위를 구한다
  let depth = 0;
  let started = false;
  let j = i;
  for (; j < pLines.length; j++) {
    for (const ch of pLines[j]) {
      if (ch === "{") { depth++; started = true; }
      else if (ch === "}") depth--;
    }
    if (j > i && started && depth <= 0) break;
  }
  for (let k = i + 1; k < j; k++) {
    // 본문에서 다시 getAllTargetsIn(...) 을 부르는가 (slice() 로 복사하지 않고)
    if (/this\.getAllTargetsIn\(/.test(pLines[k])) {
      scratchViolations.push(`L${k + 1}`);
    }
  }
  i = j;
}
check(
  "getAllTargetsIn 스크래치 순회 중 재호출 0 (vc195)",
  allTargetsScratch && scratchViolations.length === 0,
  scratchViolations.length ? `위반: ${scratchViolations.join(", ")}` : "공유 버퍼 확인 · 위반 0",
);

// ── 7) 문서 정합 — 직업 수 / 엔진 버전 (기획서 P0 #5) ────────────
const pkg = JSON.parse(read("package.json"));
const phaserDep = pkg.dependencies?.phaser || pkg.devDependencies?.phaser || "";
const classTreeSrc = read("docs/CLASS_TREE.md");
const designSrc = read("docs/DESIGN.md");

// classes.ts 안의 실제 직업 정의 수
const classDefs = (classesSrc.match(/key:\s*"[a-z0-9_]+",\s*tier:\s*\d/g) || []).length;
const treeClaim = /5계열\s*\/\s*(\d+)직업/.exec(classTreeSrc);
check(
  "CLASS_TREE 직업 수 = classes.ts 실제 정의 수",
  !!treeClaim && Number(treeClaim[1]) === classDefs,
  treeClaim ? `문서 ${treeClaim[1]} / 실제 ${classDefs}` : "문서에서 직업 수 미발견",
);

// DESIGN.md 는 "Phaser 4" 로 적혀 있어야 한다 (Phaser 3 표기는 4.2.1 실사용과 불일치)
const phaser3Mentions = (designSrc.match(/Phaser 3(?!\d*\.\d*\s*\+)/g) || []).length;
check(
  "DESIGN.md 엔진 버전 = package.json phaser",
  phaser3Mentions === 0 && designSrc.includes(`Phaser ${phaserDep.replace(/^[\^~]/, "").split(".")[0]}`),
  `문서 Phaser 3 표기 ${phaser3Mentions}곳 / 의존성 ${phaserDep}`,
);

// ── 출력 ────────────────────────────────────────────────────────
console.log("=== 궁극기 커버리지 계약 검사 (10직업 × 2궁극기) ===");
console.log(`정본 직업: ${FINAL_JOBS.length}개 — ${FINAL_JOBS.join(", ")}`);
console.log("");
for (const line of report) console.log("  " + line);
console.log("");
if (fail === 0) {
  console.log("ALL CHECKS PASS");
  process.exit(0);
} else {
  console.log(`${fail} CHECK(S) FAILED`);
  process.exit(1);
}
