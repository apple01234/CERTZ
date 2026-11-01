#!/usr/bin/env node
/**
 * vc225 — 이벤트 리스너 on/off 정합성 검증.
 *
 * 배경 (`docs/VC223_ARCH_AUDIT.md` 위험도 2·3):
 *   `WorldScene` 은 `EventBus.on` 을 106곳에 등록하고 shutdown 에서 off 한다.
 *   on/off 가 어긋나면 **씬 재진입마다 리스너가 누적**되어 같은 이벤트가 N번 실행된다
 *   (골드 중복 차감, 퀘스트 중복 수락). 실제로 아래 2건이 그랬다:
 *
 *     1. `rpg:autoUpgradeStop` — on 은 `() => ...` 람다, off 도 **다른 람다**.
 *        참조가 달라 off 가 아무것도 해제하지 못했다.
 *     2. `rpg:autoUpgrade` / `autoUpgradeStop` 의 off 가 **2번씩** 적혀 있었다.
 *
 *   파일 안 주석에는 "on 97 / off 90 → 87" 처럼 **손으로 센 숫자**가 적혀 있었는데
 *   그 숫자는 계속 틀어진다. 이 테스트가 그 숫자를 대신 센다.
 *
 * 검사:
 *   1. on 에서 등록한 (이벤트, 핸들러) 쌍이 off 에도 있는가 — 리스너 누수
 *   2. off 에 같은 (이벤트, 핸들러) 가 2번 이상 있는가 — 중복 정리
 *   3. off 핸들러가 인라인 람다인가 — 참조 불일치로 절대 해제되지 않는다
 *
 * 실행: node tests/eventbus-balance.test.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCENE = path.join(ROOT, "src/game/scenes/WorldScene.ts");

let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

const src = fs.readFileSync(SCENE, "utf8");
const lines = src.split("\n");

/* `setupInput` 범위 — 이 함수가 리스너 등록의 주 무대다. */
let lo = lines.findIndex((l) => /private setupInput\s*\(/.test(l));
ok("setupInput 을 찾았다", lo >= 0);
if (lo < 0) { console.log("\n결과: 중단"); process.exit(1); }

let depth = 0, began = false, hi = lo;
for (let i = lo; i < lines.length; i++) {
  depth += (lines[i].match(/\{/g) ?? []).length - (lines[i].match(/\}/g) ?? []).length;
  if (lines[i].includes("{")) began = true;
  if (began && depth === 0) { hi = i; break; }
}
const body = lines.slice(lo, hi + 1).join("\n");
console.log(`  (setupInput ${lo + 1}~${hi + 1}행 = ${hi - lo + 1}줄)`);

/* 주석을 제거한 코드만 본다 — 주석에 적힌 예시 문자열 오탐 방지 */
const code = body
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

const RE = /EventBus\.(on|off)\(\s*["']([^"']+)["']\s*,\s*([A-Za-z_$][\w$.]*)\s*(?:as\s+never)?\s*\)/g;
const ons = [];
const offs = [];
let m;
while ((m = RE.exec(code))) {
  (m[1] === "on" ? ons : offs).push({ ev: m[2], fn: m[3] });
}

console.log("\n1) 리스너 누수 (on 등록분이 off 에 있는가)");
const offSet = new Set(offs.map((o) => `${o.ev}|${o.fn}`));
const leaked = ons.filter((o) => !offSet.has(`${o.ev}|${o.fn}`));
ok(
  `on ${ons.length}쌍 중 미해제 ${leaked.length}쌍`,
  leaked.length === 0,
  `(${leaked.map((l) => l.ev + "→" + l.fn).join(", ")})`
);

console.log("\n2) off 중복 등록");
const seen = new Map();
for (const o of offs) {
  const k = `${o.ev}|${o.fn}`;
  seen.set(k, (seen.get(k) ?? 0) + 1);
}
const dups = [...seen.entries()].filter(([, n]) => n > 1);
ok(`off 중복 ${dups.length}건`, dups.length === 0, `(${dups.map(([k, n]) => k + "×" + n).join(", ")})`);

console.log("\n3) 인라인 람다 off (참조 불일치 — 절대 해제 안 됨)");
/* off("x", () => {...}) 는 on 때 만든 람다와 다른 객체라 매칭 실패한다. */
const lambdaOff = [...code.matchAll(/EventBus\.off\(\s*["']([^"']+)["']\s*,\s*(?:\(\s*\)|function)/g)];
ok(`인라인 람다 off ${lambdaOff.length}건`, lambdaOff.length === 0,
   `(${lambdaOff.map((x) => x[1]).join(", ")})`);

console.log("\n4) 정보 — 등록 수");
console.log(`  on ${ons.length} / off ${offs.length}`);
ok("off 가 on 보다 적지 않다", offs.length >= ons.length || leaked.length === 0);

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
