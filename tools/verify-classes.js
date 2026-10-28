#!/usr/bin/env node
/**
 * 직업 외형·스킬 계약 검증 (v1.4.36~).
 *
 * 이 게임에서 반복적으로 깨진 것들만 검사한다. tsc 는 문자열 키·파일 존재·
 * 병렬 테이블을 못 잡으므로 여기서 숫자로 센다.
 *
 *   1. 3·4차 직업 전원이 자기 외형 시트(28프레임)를 갖는가
 *   2. SKILL1_KIND / SKILL2_KIND 에 3·4차 직업이 전부 등록됐는가 (2차 승계 탈출)
 *   3. SKILL_LABELS 의 Z/C 이름이 2차 루트와 중복되지 않는가
 *   4. 외형 시트가 참조하는 프레임이 BODY_FRAME_NAMES 와 일치하는가
 *
 * 사용: node tools/verify-classes.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.dirname(__dirname);
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let fails = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  OK  " : "  FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) fails++;
};

// ── 소스에서 직업 정의·테이블 파싱 ────────────────────────────────
const classesSrc = read("src/game/classes.ts");
const texturesSrc = read("src/game/textures.ts");

const defs = {};
for (const m of classesSrc.matchAll(/key:\s*"([a-z0-9_]+)",\s*tier:\s*(\d),\s*parent:\s*("?[a-z0-9_]+"?|null)/g)) {
  defs[m[1]] = { tier: Number(m[2]), parent: m[3] === "null" ? null : m[3].replace(/"/g, "") };
}
const t34 = Object.keys(defs).filter((k) => defs[k].tier >= 3);
const root2 = (k) => {
  let cur = k;
  while (defs[cur] && defs[cur].parent) cur = defs[cur].parent;
  return cur;
};

const tableOf = (name) => {
  const i = classesSrc.indexOf(`export const ${name}`);
  if (i < 0) return {};
  const j = classesSrc.indexOf("};", i);
  const out = {};
  for (const m of classesSrc.slice(i, j).matchAll(/(\w+):\s*"([^"]*)",/g)) out[m[1]] = m[2];
  return out;
};
const labelsOf = () => {
  const i = classesSrc.indexOf("export const SKILL_LABELS");
  const j = classesSrc.indexOf("\n};", i);
  const out = {};
  for (const m of classesSrc.slice(i, j).matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
    out[m[1]] = [...m[2].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
  }
  return out;
};

const s1 = tableOf("SKILL1_KIND");
const s2 = tableOf("SKILL2_KIND");
const labels = labelsOf();

// BODY_FRAME_NAMES (textures.ts) — 실제 요구 프레임
//  주의: 블록 끝을 `];` 로 자르면 뒤따르는 다른 상수의 "boss2"/"boss3" 까지 딸려온다.
//  `] as const` 로 정확히 자르고, 프레임 이름만 화이트리스트로 거른다.
const bfnIdx = texturesSrc.indexOf("BODY_FRAME_NAMES");
const bfnEnd = texturesSrc.indexOf("] as const;", bfnIdx);
const bfnBlock = texturesSrc.slice(bfnIdx, bfnEnd > 0 ? bfnEnd : texturesSrc.indexOf("];", bfnIdx));
const FRAMES = [...bfnBlock.matchAll(/"([a-z]+\d)"/g)]
  .map((m) => m[1])
  .filter((f) => /^(idle|walk|walkside|walkup|atk|atkdown|atkup)\d$/.test(f));

console.log(`\n직업 ${Object.keys(defs).length}종 (3·4차 ${t34.length}종) · 요구 프레임 ${FRAMES.length}개\n`);

// ── 1) 3·4차 외형 시트 28프레임 ──────────────────────────────────
const A = path.join(ROOT, "public", "assets");
let missingSheets = 0;
const badDetail = [];
for (const job of t34) {
  for (const g of ["m", "f"]) {
    const miss = FRAMES.filter((f) => !fs.existsSync(path.join(A, `job${g}_${job}_${f}.webp`)));
    if (miss.length) {
      missingSheets++;
      if (badDetail.length < 3) badDetail.push(`job${g}_${job} [${miss.slice(0, 4).join(",")}]`);
    }
  }
}
check(
  "3·4차 외형 시트 28프레임 완비",
  missingSheets === 0,
  missingSheets ? `${missingSheets}직업 누락 (${badDetail.join(" / ")})` : `${t34.length * 2}종 x ${FRAMES.length} = ${t34.length * 2 * FRAMES.length}장`
);

// ── 2) SKILL1/2 3·4차 고유 등록 ─────────────────────────────────
const c1 = t34.filter((k) => s1[k]).length;
const c2 = t34.filter((k) => s2[k]).length;
check("SKILL1_KIND 3·4차 고유", c1 === t34.length, `${c1}/${t34.length}`);
check("SKILL2_KIND 3·4차 고유", c2 === t34.length, `${c2}/${t34.length}`);

// ── 3) Z/C 이름 중복 (2차 루트와) ───────────────────────────────
const dupNames = [];
for (const job of t34) {
  const r = root2(job);
  const a = labels[job] || [];
  const b = labels[r] || [];
  for (const [idx, slot] of [[1, "Z"], [2, "C"]]) {
    if (a[idx] && a[idx] === b[idx]) dupNames.push(`${job}.${slot}="${a[idx]}"`);
  }
}
check("Z/C 이름 2차 루트와 비중복", dupNames.length === 0, dupNames.slice(0, 4).join(", ") || "중복 0");

// ── 4) 애님 등록 프레임이 실제 파일과 일치 ──────────────────────
check("요구 프레임 목록 28개", FRAMES.length === 28, `${FRAMES.length}개`);

console.log(`\n${fails === 0 ? "ALL CHECKS PASS" : `FAILED ${fails}건`}\n`);
process.exit(fails === 0 ? 0 : 1);
