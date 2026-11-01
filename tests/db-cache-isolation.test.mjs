#!/usr/bin/env node
/**
 * vc228 — 감사 #2 회귀 방지: mutateDb 실패 시 캐시 오염.
 *
 * ## 왜 이 테스트가 있나
 *
 * 종전 `mutateDb` 는 `loadDb(true)` 가 준 객체(= `cache.db` 와 **동일 참조**)를
 * 콜백에 그대로 넘겼다. PUT 이 6회 모두 실패하면 캐시에는 **저장된 적 없는 변경**이
 * 남고, 다음 8초(CACHE_TTL_MS) 동안 모든 읽기가 그 거짓 상태를 본다.
 * 거래소에서 이건 "이미 팔린 물건이 안 팔린 것처럼 보임" = 실돈 버그다.
 *
 * 이 테스트는 소스를 파싱해 **구조가 유지되는지** 본다(GitHub 호출은 못 하므로).
 *
 * 실행: node tests/db-cache-isolation.test.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

const src = fs.readFileSync(path.join(ROOT, "src/lib/ghdb.ts"), "utf8");

/** mutateDb 본문만 뽑는다 */
function body(fnName) {
  const i = src.indexOf(fnName);
  if (i < 0) return "";
  let d = 0, began = false, j = i;
  while (j < src.length) {
    if (src[j] === "{") { d++; began = true; }
    else if (src[j] === "}") d--;
    if (began && d === 0) break;
    j++;
  }
  return src.slice(i, j + 1);
}

const md = body("export async function mutateDb");

console.log("1) mutateDb 가 콜백에 사본을 준다");
ok("mutateDb 본문을 찾음", md.length > 200, `(길이 ${md.length})`);
/* 핵심: fn 에 넘기는 인자가 structuredClone 결과여야 한다.
 *  주석에 `fn(db)` 라는 설명 문구가 들어 있어 그대로 정규식만 돌리면 오탐한다 —
 *  주석을 걷어낸 뒤 검사한다. */
const mdCode = md.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
ok("콜백 인자가 사본이다", /const\s+working\s*=\s*structuredClone\s*\(\s*db\s*\)/.test(mdCode),
  mdCode.match(/const working[^\n]*/)?.[0] ?? "(없음)");
ok("콜백에 working 을 넘긴다", /\bfn\s*\(\s*working\s*\)/.test(mdCode),
  mdCode.match(/\bfn\([^)]*\)/)?.[0] ?? "(없음)");
ok("콜백에 원본 db 를 넘기지 않는다", !/\bfn\s*\(\s*db\s*\)/.test(mdCode));

console.log("\n2) 업로드 본문이 사본에서 만들어진다");
ok("JSON.stringify(working)", /JSON\.stringify\s*\(\s*working\s*\)/.test(md));
ok("JSON.stringify(db) 로 올리지 않는다", !/JSON\.stringify\s*\(\s*db\s*\)/.test(md));

console.log("\n3) 캐시 교체는 성공 시에만");
const okBlock = md.slice(md.indexOf("if (put.ok)"), md.indexOf("if (put.ok)") + 260);
ok("put.ok 안에서만 cache 를 쓴다", /cache\s*=/.test(okBlock));
ok("성공 시 캐시가 사본을 가리킨다", /cache\s*=\s*\{\s*db:\s*working/.test(okBlock),
  okBlock.match(/cache\s*=[^;]*/)?.[0] ?? "(없음)");
/* 실패 분기(뒤쪽)에 cache 대입이 있으면 오염 경로가 남은 것 */
const failPart = md.slice(md.indexOf("if (put.ok)") + 260);
ok("실패 경로에서 cache 를 건드리지 않는다", !/cache\s*=/.test(failPart));

console.log("\n4) 재시도가 원본을 오염시키지 않는다");
ok("loadDb(true) 로 매 시도 새로 읽는다", /loadDb\s*\(\s*true\s*\)/.test(md));
/* 루프 안에서 clone 하므로 시도마다 새 사본 — 누적 변형이 남지 않는다 */
ok("clone 이 루프 안에 있다", /for\s*\(/.test(md) && md.indexOf("structuredClone") > md.indexOf("for ("));

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
