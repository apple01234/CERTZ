#!/usr/bin/env node
/**
 * vc229 — 레거시 `accounts/index.js` 가 압축 세이브를 깨뜨리지 않는지 검증.
 *
 * ## 배경
 *
 * 세이브를 압축 저장(vc229)으로 바꿨다. `db.saves[uid].data` 가 이제
 * 문자열(`BR:…`)일 수 있는데, 레거시 node 서버(`accounts/index.js`)는
 * `s.data.lv` 처럼 **평문 객체로 읽는 코드**를 여럿 갖고 있다.
 * 만약 그 경로가 살아 있으면:
 *   · 랭킹이 빈 값으로 표시된다 (`Number(undefined)` → 0 → `continue`)
 *   · `Object.entries(db.saves)` 중 압축본을 만나면 예외가 나 **부팅 복원 전체가 실패**한다
 *
 * 그래서 "그 코드가 실제로 도달 가능한가"를 **도달성 분석**으로 확인한다.
 * 코드를 고치지 않고도 안전함을 증명할 수 있으면 그게 최선이다.
 *
 * ## 판정 기준
 *
 * 위험 함수가 (a) export 되고 (b) 런타임 경로에서 호출되고 (c) 그 런타임 경로가
 * server.js 에 연결돼야 "도달 가능"이다. 셋 중 하나라도 끊기면 죽은 코드다.
 *
 * 실행: node tests/legacy-accounts-compat.test.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

const legacy = fs.readFileSync(path.join(ROOT, "accounts/index.js"), "utf8");
const server = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
const legacyLines = legacy.split("\n");

/** 문자열에서 주석을 제거 — 주석에 적힌 함수명에 속지 않기 위해 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** 지정 행이 속한 함수 이름 */
function ownerOf(src, lineNo) {
  const lines = src.split("\n");
  for (let i = lineNo - 1; i >= 0; i--) {
    const m = lines[i].match(/^(?:async )?function ([A-Za-z_$][\w$]*)\s*\(/);
    if (m) return m[1];
  }
  return null;
}

const legacyCode = stripComments(legacy);
const serverCode = stripComments(server);

console.log("1) 서버가 레거시를 어떻게 붙이는가");
ok("server.js 가 attachAccountsBefore 를 쓴다", /attachAccountsBefore/.test(serverCode));
/* 핵심: attachAccountsBefore 는 Next 로 위임하는 미들웨어다 */
ok("attachAccountsBefore 가 handleNext 로 위임한다",
  /attachAccountsBefore[\s\S]{0,4000}handleNext\(req, res\)/.test(legacyCode));

console.log("\n2) 위험 함수가 export 되지 않는다 (외부에서 못 부른다)");
{
  const seg = legacyCode.slice(legacyCode.lastIndexOf("module.exports"));
  ok("handle 이 export 되지 않는다", !/^\s*handle\s*[,:]/m.test(seg) && !/handle\s*:/.test(seg.replace(/handleAccountRequest|handleMarketRequest/g, "")),
    seg.slice(0, 160));
  ok("rankEntries 가 export 되지 않는다", !/rankEntries/.test(seg));
  ok("rankListFor 가 export 되지 않는다", !/rankListFor/.test(seg));
  ok("ownsListableItem 이 export 되지 않는다", !/ownsListableItem/.test(seg));
  /* stub 은 export 되지만 항상 false — 데이터를 건드리지 않는다 */
  ok("handleAccountRequest 는 상수 false 스텁", /function handleAccountRequestStub\(\)\s*\{\s*return false;/.test(legacyCode));
  ok("handleMarketRequest 는 상수 false 스텁", /function handleMarketRequestStub\(\)\s*\{\s*return false;/.test(legacyCode));
}

console.log("\n3) 위험 함수가 내부에서도 호출되지 않는다");
{
  ok("handle( 이 호출되지 않는다 (정의 제외)",
    (legacyCode.match(/\bhandle\s*\(/g) || []).length === 1,
    `호출 ${(legacyCode.match(/\bhandle\s*\(/g) || []).length}회`);
  /* rankEntries 는 정의 + rankListFor 내부 호출 = 2회가 정상이다.
   *  둘 다 죽은 경로(rankListFor 는 아무도 안 부른다)이므로 도달 불가. */
  ok("rankEntries 는 정의 + 죽은 호출자에서만 불린다",
    (legacyCode.match(/\brankEntries\s*\(/g) || []).length === 2,
    `발견 ${(legacyCode.match(/\brankEntries\s*\(/g) || []).length}회`);
  ok("rankListFor( 호출 0회 (정의 제외)",
    (legacyCode.match(/\brankListFor\s*\(/g) || []).length === 1,
    `발견 ${(legacyCode.match(/\brankListFor\s*\(/g) || []).length}회`);
  ok("handleMarket( 호출 0회 (정의 제외)",
    (legacyCode.match(/\bhandleMarket\s*\(/g) || []).length === 1,
    `발견 ${(legacyCode.match(/\bhandleMarket\s*\(/g) || []).length}회`);
}

console.log("\n4) 평문 saves 접근이 어느 함수에 있는지 (도달 불가 확인)");
{
  const risky = [];
  legacyLines.forEach((l, i) => {
    /* 주석 줄은 제외 */
    if (/^\s*(\*|\/\/)/.test(l)) return;
    if (/\bs\.data\.|\bsave\.data\.|\bcs\.lv\b|\be\.data\./.test(l)) {
      const fn = ownerOf(legacy, i + 1);
      risky.push({ line: i + 1, fn, text: l.trim().slice(0, 60) });
    }
  });
  const fns = [...new Set(risky.map((r) => r.fn))];
  console.log(`     평문 접근 ${risky.length}곳, 함수: ${fns.join(", ")}`);
  /* 위험 함수는 handle/rankEntries/handleMarket 뿐이어야 한다 */
  const ALLOWED_DEAD = new Set(["handle", "rankEntries", "rankListFor", "handleMarket"]);
  const live = fns.filter((f) => !ALLOWED_DEAD.has(f));
  ok("평문 접근이 모두 죽은 함수 안에 있다", live.length === 0, `살아있는 곳: ${live.join(", ")}`);
}

console.log("\n5) 부팅 경로(restore)가 세이브를 '내용으로' 읽지 않는다");
{
  /* restoreFromGithubIfFresh 는 부팅 시 무조건 실행된다 → 유일하게 살아있는 위험 경로 */
  const i = legacyCode.indexOf("async function restoreFromGithubIfFresh");
  const end = legacyCode.indexOf("\nvoid restoreFromGithubIfFresh", i);
  const body = legacyCode.slice(i, end > 0 ? end : i + 4000);
  ok("restore 함수를 찾음", body.length > 500);
  ok("restore 안에서 s.data.lv 를 읽지 않는다", !/\bs\.data\.|\be\.data\./.test(body));
  ok("restore 안에서 rankEntries 를 부르지 않는다", !/rankEntries/.test(body));
  /* saves 는 통째로 병합(불투명)만 한다 */
  ok("saves 를 불투명하게 병합한다", /for \(const \[kk, vv\] of Object\.entries\(src\)\)/.test(body) || /db\[k\]\[kk\] = vv/.test(body));
}

console.log("\n6) 신 포맷이 레거시로 새어나가지 않는다");
{
  /* Next 가 sole writer 인지: 레거시가 db.saves 를 쓰는 코드가 도달 가능한가 */
  const writes = [];
  legacyLines.forEach((l, i) => {
    if (/^\s*(\*|\/\/)/.test(l)) return;
    if (/db\.saves\[[^\]]+\]\s*=/.test(l)) writes.push({ line: i + 1, fn: ownerOf(legacy, i + 1) });
  });
  const liveWrites = writes.filter((w) => !["handle", "handleMarket"].includes(w.fn));
  ok("도달 가능한 saves 쓰기가 없다", liveWrites.length === 0,
    liveWrites.map((w) => `${w.line}:${w.fn}`).join(", "));
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
