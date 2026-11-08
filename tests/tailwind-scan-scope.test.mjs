/**
 * 빌드가 멈추지 않게 하는 Tailwind 스캔 범위 계약.
 *
 * [왜 필요한가]
 *  vc288 에서 `npm run build:next` 가 "Creating an optimized production build ..." 에서
 *  영원히 멈추던 원인을 찾았다. Next 가 아니라 **Tailwind(CSS 처리)** 였고,
 *  Tailwind v4 가 소스를 지정하지 않으면 프로젝트 전체를 스캔하는 것이 원인이었다.
 *
 *  실측 스캔 대상(node_modules/.git/.next 제외, 46만여 개):
 *    android 40,340 · public 7,500 · reports 1,717 · src 212
 *  실제로 Tailwind 클래스를 쓰는 곳은 src 212개뿐이다.
 *
 *  해결은 **두 줄이 한 쌍**이다:
 *    1) `@import "tailwindcss" source(none);`  ← 자동 감지 끔
 *    2) `@source "../";`                       ← src/ 만 스캔
 *  하나만 있으면 안 된다. `@source` 만 추가하면 자동 감지가 살아 있어 여전히 멈춘다
 *  (실측: 5분+ 타임아웃). 둘 다 있어야 225ms 로 끝난다.
 *
 *  이 테스트는 그 쌍이 유지되는지, 그리고 실제로 유틸리티가 생성되는지 확인한다.
 *  누군가 `source(none)` 을 지우면 빌드가 조용히 다시 멈추므로 여기서 잡는다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";

const CSS = "src/app/globals.css";

test("tailwind import 에 source(none) 이 있다 (자동 전체 스캔 차단)", () => {
  const css = readFileSync(CSS, "utf8");
  /* 주석에 적힌 예시 문구에 속지 않도록 실제 디렉티브만 본다. */
  const m = /^@import\s+"tailwindcss"([^;]*);/m.exec(css);
  assert.ok(m, `@import "tailwindcss" 디렉티브를 찾지 못했다`);
  assert.match(
    m[1],
    /source\(none\)/,
    'source(none) 이 없다 — Tailwind 가 프로젝트 전체(46만 파일)를 스캔해 빌드가 멈춘다',
  );
});

test("@source 로 src/ 만 지정한다", () => {
  const css = readFileSync(CSS, "utf8");
  const m = /^@source\s+"([^"]+)";/m.exec(css);
  assert.ok(m, "@source 디렉티브가 없다 — 유틸리티가 하나도 생성되지 않는다");
  assert.equal(m[1], "../", `@source 가 "${m[1]}" 이다 — src/app/globals.css 기준 "../" = src/ 여야 한다`);
});

test("@source 와 source(none) 이 둘 다 있어야 한다 (하나만으로는 부족)", () => {
  const css = readFileSync(CSS, "utf8");
  const hasNone = /^@import\s+"tailwindcss"[^;]*source\(none\)/m.test(css);
  const hasSource = /^@source\s+"/m.test(css);
  assert.ok(hasNone && hasSource, `source(none)=${hasNone} / @source=${hasSource} — 둘 다 필요하다`);
});

test("스캔해야 할 소스 루트가 실제로 존재한다", () => {
  /* @source "../" 가 가리키는 곳이 사라지면 유틸리티가 0개가 된다. */
  assert.ok(existsSync("src/app"), "src/app 이 없다");
  assert.ok(existsSync("src/components"), "src/components 가 없다");
});
