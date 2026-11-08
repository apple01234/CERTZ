/**
 * `/api/version` 응답의 파생 정합성 계약.
 *
 * [왜 필요한가]
 *  이 엔드포인트는 APK 다운로드 링크를 만든다. 링크가 어긋나면 유저는
 *  404 를 받거나 **옛 버전을 받는다.** 실제로 vc241 이전에 `code:0`·
 *  `SERTZ-vc0.apk` 를 응답한 사고가 있었다.
 *
 * [실측 — vc288, 프로덕션 빌드 + server.js]
 *  {
 *    "latest": "2.2.5",
 *    "code": 261,
 *    "apk":  ".../releases/download/v2.2.5/SERTZ-vc261.apk",
 *    "exe":  ".../releases/download/v2.2.5/SERTZ-vc261-setup.exe",
 *    "guide": "/apk-guide.html"
 *  }
 *  build.gradle(versionCode 261 / versionName "2.2.5") 과 정확히 일치했다.
 *
 * [이 테스트가 하는 일]
 *  서버를 띄우지 않고도 검증 가능한 것만 고정한다:
 *   ① route.ts 가 package.json 에서 버전을 읽는다 (하드코딩 아님)
 *   ② APK/EXE URL 이 같은 버전·코드에서 만들어진다 (둘이 따로 놀면 하나는 404)
 *   ③ guide 경로가 실제 파일로 존재한다
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";

const ROUTE = "src/app/api/version/route.ts";

test("version 라우트가 package.json 에서 버전을 읽는다", () => {
  const src = readFileSync(ROUTE, "utf8");
  assert.match(src, /from\s+["'][^"']*package\.json["']/, "package.json import 가 없다 — 버전이 하드코딩될 수 있다");
});

test("APK 와 EXE URL 이 같은 베이스에서 만들어진다 (하나만 옛 버전이면 404)", () => {
  const src = readFileSync(ROUTE, "utf8");
  /* 실제 구조: RELEASE_BASE 를 한 번 만들고 APK·EXE 가 그것을 공유한다.
   * 이 구조가 더 견고하다 — 태그를 두 번 적으면 어긋날 수 있기 때문이다.
   * 그래서 "두 URL 이 같은 베이스 변수를 쓰는가"를 검사한다. */
  const base = /const RELEASE_BASE\s*=\s*`([^`]+)`/.exec(src);
  assert.ok(base, "RELEASE_BASE 정의를 찾지 못했다");
  assert.match(base[1], /\$\{LATEST_TAG\}/, "RELEASE_BASE 가 버전 태그에서 파생되지 않는다");

  const apk = /`\$\{RELEASE_BASE\}\/SERTZ-vc\$\{LATEST_CODE\}\.apk`/.exec(src);
  const exe = /`\$\{RELEASE_BASE\}\/SERTZ-vc\$\{LATEST_CODE\}-setup\.exe`/.exec(src);
  assert.ok(apk, "APK URL 이 RELEASE_BASE 를 쓰지 않는다 — 태그가 따로 놀면 404 가 난다");
  assert.ok(exe, "EXE URL 이 RELEASE_BASE 를 쓰지 않는다");
});

test("guide 경로가 실제 파일로 존재한다", () => {
  const src = readFileSync(ROUTE, "utf8");
  const m = /guide:\s*["']([^"']+)["']/.exec(src);
  assert.ok(m, "guide 필드를 찾지 못했다");
  const rel = m[1].replace(/^\//, "");
  const candidates = [`public/${rel}`, rel];
  assert.ok(
    candidates.some((p) => existsSync(p)),
    `guide 경로 ${m[1]} 에 해당하는 파일이 없다 (${candidates.join(" 또는 ")})`,
  );
});

test("버전 응답에 note 필드가 있다 (릴리스 설명용)", () => {
  /* 앱이 업데이트 안내를 띄울 때 쓴다. 없으면 UI 가 빈 문자열을 보여 준다. */
  const src = readFileSync(ROUTE, "utf8");
  assert.match(src, /note[:\s]/, "note 필드가 없다");
});
