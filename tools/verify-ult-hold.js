/**
 * 궁극기 시전 시간 대역 검증 (v1.4.41 — 유저 지시 #3)
 *
 * 유저 지시: "1차 궁극기 최소 5초 최대 30초 / 2차 궁극기 최소 10초 최대 1분"
 *
 * 종전 문제: `useSkill5` 끝의 `delayedCall(300, …)` 하나가 경직을 결정해,
 *   연출은 1.3초까지 가는데 조작은 0.3초에 풀렸다. 60초를 기다려 0.3초 정지가 전부였다.
 *
 * 이 스크립트는 모든 직업이 대역 안에 있는지, 그리고 Player.ts 가 실제로 그 값을
 * 쓰는지(300ms 하드코딩이 되살아나지 않았는지)를 검사한다.
 *
 *   node tools/verify-ult-hold.js
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const results = [];
function check(name, fn) {
  try { fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " — " + e.message]); }
}

const holdSrc = fs.readFileSync(path.join(root, "src/game/ultHold.ts"), "utf8");
const playerSrc = fs.readFileSync(path.join(root, "src/game/entities/Player.ts"), "utf8");
const classesSrc = fs.readFileSync(path.join(root, "src/game/classes.ts"), "utf8");

/* ultHold.ts 의 매핑을 파싱 */
function parseMap(name) {
  const i = holdSrc.indexOf(`export const ${name}`);
  if (i < 0) throw new Error(`${name} 없음`);
  const start = holdSrc.indexOf("{", i);
  let depth = 0, end = -1;
  for (let j = start; j < holdSrc.length; j++) {
    if (holdSrc[j] === "{") depth++;
    else if (holdSrc[j] === "}") { depth--; if (depth === 0) { end = j; break; } }
  }
  const body = holdSrc.slice(start + 1, end).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const out = {};
  for (const m of body.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(\d+)/g)) out[m[1]] = parseInt(m[2], 10);
  return out;
}

const H5 = parseMap("ULT5_HOLD_MS");
const H5B = parseMap("ULT5B_HOLD_MS");

/* classes.ts 의 모든 직업 키 */
const classKeys = [...classesSrc.matchAll(/key:\s*"([a-z]+)"\s*,\s*tier:/g)].map((m) => m[1]);
const FAMILIES = ["warrior", "ranger", "mage", "thief", "pirate"];

const MIN5 = 5000, MAX5 = 30000, MIN5B = 10000, MAX5B = 60000;

check(`1차 시전 시간이 전부 ${MIN5 / 1000}~${MAX5 / 1000}초 대역 안`, () => {
  const bad = Object.entries(H5).filter(([, v]) => v < MIN5 || v > MAX5).map(([k, v]) => `${k}=${v}`);
  if (bad.length) throw new Error(`대역 이탈 ${bad.length}건: ${bad.join(", ")}`);
});

check(`2차 시전 시간이 전부 ${MIN5B / 1000}~${MAX5B / 1000}초 대역 안`, () => {
  const bad = Object.entries(H5B).filter(([, v]) => v < MIN5B || v > MAX5B).map(([k, v]) => `${k}=${v}`);
  if (bad.length) throw new Error(`대역 이탈 ${bad.length}건: ${bad.join(", ")}`);
});

check("모든 직업 키에 1차 시전 시간이 정의됨", () => {
  const missing = classKeys.filter((k) => !(k in H5) && !FAMILIES.includes(k));
  if (missing.length) throw new Error(`미정의 ${missing.length}건: ${missing.join(", ")}`);
});

check("모든 직업 키에 2차 시전 시간이 정의됨", () => {
  const missing = classKeys.filter((k) => !(k in H5B) && !FAMILIES.includes(k));
  if (missing.length) throw new Error(`미정의 ${missing.length}건: ${missing.join(", ")}`);
});

check("계열 폴백 5종이 정의됨", () => {
  const missing = FAMILIES.filter((f) => !(f in H5) || !(f in H5B));
  if (missing.length) throw new Error(`계열 누락: ${missing.join(", ")}`);
});

check("2차가 1차보다 길다 (쿨 120초 > 60초)", () => {
  const bad = Object.keys(H5).filter((k) => (H5B[k] ?? 0) <= (H5[k] ?? 0)).map((k) => `${k}: ${H5[k]} → ${H5B[k]}`);
  if (bad.length) throw new Error(`역전 ${bad.length}건: ${bad.slice(0, 5).join(", ")}`);
});

check("최종 티어(4차)가 계열 폴백보다 길다", () => {
  const t4 = ["warbringer", "crusader", "deadeye", "skylord", "arclord", "eternal", "shadowlord", "blademaster", "seaking", "dreadnought"];
  const bad = t4.filter((k) => (H5[k] ?? 0) < 20000).map((k) => `${k}=${H5[k]}`);
  if (bad.length) throw new Error(`4차가 너무 짧음: ${bad.join(", ")}`);
});

/* Player.ts 가 실제로 이 값을 쓰는가 — 300ms 하드코딩 회귀 방지 */
check("Player.ts 가 ult5HoldOf 를 경직 해제에 쓴다", () => {
  if (!/delayedCall\(\s*ult5HoldOf\(/.test(playerSrc)) throw new Error("ult5HoldOf 호출이 없음");
});
check("Player.ts 가 ult5bHoldOf 를 경직 해제에 쓴다", () => {
  if (!/delayedCall\(\s*ult5bHoldOf\(/.test(playerSrc)) throw new Error("ult5bHoldOf 호출이 없음");
});
check("궁극기 마무리에 300ms 하드코딩이 남아 있지 않다", () => {
  const zone = playerSrc.slice(playerSrc.indexOf("useSkill5() {"));
  const bad = [...zone.matchAll(/공통 마무리[\s\S]{0,220}?delayedCall\((\d+)/g)].map((m) => m[1]);
  const still300 = bad.filter((v) => parseInt(v, 10) <= 1000);
  if (still300.length) throw new Error(`경직 해제가 ${still300.join(",")}ms 로 남아 있음`);
});

/* 연출도 시전 시간에 비례하는가 */
check("연출 timeScale 이 시전 시간에서 계산된다", () => {
  const n = (playerSrc.match(/ult5HoldOf\(resolveSkill5Of/g) || []).length;
  if (n < 1) throw new Error("1차 연출이 시전 시간을 참조하지 않음");
  if (!/timeScale:\s*Math\.max\(1,\s*Math\.min\([\d.]+,\s*ult5bHoldOf/.test(playerSrc)) {
    throw new Error("2차 연출이 시전 시간을 참조하지 않음");
  }
});

const fail = results.filter(([s]) => s === "FAIL");
for (const [s, n] of results) console.log(`  ${s === "PASS" ? "✓" : "✗"} ${n}`);
console.log(`\n1차 대역 ${MIN5}-${MAX5}ms · 2차 대역 ${MIN5B}-${MAX5B}ms · 직업 ${classKeys.length}개`);
console.log(
  fail.length === 0
    ? `ALL CHECKS PASS (${results.length}항목)`
    : `${fail.length}건 실패 / 총 ${results.length}항목`
);
process.exit(fail.length === 0 ? 0 : 1);
