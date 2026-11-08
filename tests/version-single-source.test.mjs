/**
 * 버전 단일 출처 계약 (AGENTS.md "버전 싱크 6곳").
 *
 * [왜 필요한가]
 *  AGENTS.md 는 버전을 6곳에서 맞추라고 요구한다:
 *    android/app/build.gradle · server.js · next.config.ts · public/apk-guide.html
 *    download/APK_다운로드_안내.txt · src/components/game/Overlays.tsx (배지)
 *
 *  손으로 6곳을 맞추면 반드시 하나를 빠뜨린다. 실제로 vc236 시점에
 *  `/api/version` 이 `code:0 · SERTZ-vc0.apk` 를 응답한 사고가 있었다
 *  (next.config.ts 주석 11행에 기록돼 있다).
 *
 *  지금은 구조가 달라졌다 — 대부분의 지점이 버전을 **하드코딩하지 않고 파생**한다.
 *  그래서 이 테스트가 지키는 것은 "6곳에 같은 숫자를 적었나"가 아니라
 *  **"숫자를 적는 곳이 한 군데뿐인가"** 이다.
 *
 * [측정 결과 — vc288]
 *  숫자를 실제로 적는 곳: build.gradle (versionCode/versionName) + package.json(버전)
 *  파생하는 곳: next.config.ts · server.js · src/app/api/version/route.ts
 *               public/apk-guide.html · download/APK_다운로드_안내.txt (버전 미기재)
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";

const GRADLE = "android/app/build.gradle";
const AV_JSON = "android-version.json";
const PKG = "package.json";

/** build.gradle 의 versionCode / versionName. */
function gradleVersion() {
  const src = readFileSync(GRADLE, "utf8");
  const code = /versionCode\s+(\d+)/.exec(src)?.[1];
  const name = /versionName\s+"([\d.]+)"/.exec(src)?.[1];
  assert.ok(code, "build.gradle 에서 versionCode 를 찾지 못했다");
  assert.ok(name, "build.gradle 에서 versionName 을 찾지 못했다");
  return { code: Number(code), name };
}

test("build.gradle 의 versionCode 와 versionName 이 서로 맞는다", () => {
  const g = gradleVersion();
  /* 2.2.5 → vc261 처럼 규칙이 있다고 단정하지 않고, 둘 다 존재·양수만 확인한다.
   * (규칙을 테스트로 고정하면 버전 정책이 바뀔 때 같이 깨진다) */
  assert.ok(g.code > 0, "versionCode 가 0 이다");
  assert.match(g.name, /^\d+\.\d+\.\d+$/, `versionName 이 3단 형식이 아니다: ${g.name}`);
});

test("android-version.json 이 build.gradle 과 정확히 같다", () => {
  /* 이 파일은 Vercel 처럼 android/ 가 없는 환경을 위한 커밋된 사본이다.
   * 어긋나면 배포된 APK 링크가 옛 버전을 가리킨다. */
  assert.ok(existsSync(AV_JSON), "android-version.json 이 없다");
  const av = JSON.parse(readFileSync(AV_JSON, "utf8"));
  const g = gradleVersion();
  assert.equal(av.code, g.code, `android-version.json code(${av.code}) ≠ build.gradle(${g.code})`);
  assert.equal(av.name, g.name, `android-version.json name(${av.name}) ≠ build.gradle(${g.name})`);
});

test("package.json 버전과 build.gradle versionName 이 같다", () => {
  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  const g = gradleVersion();
  assert.equal(pkg.version, g.name, `package.json(${pkg.version}) ≠ build.gradle(${g.name})`);
});

test("버전 파생처가 build.gradle 을 1순위로 읽는다", () => {
  /* android/ 가 있는 로컬·CI 에서는 build.gradle 이 진실이다. */
  for (const f of ["next.config.ts"]) {
    const src = readFileSync(f, "utf8");
    assert.match(src, /android\/app\/build\.gradle/, `${f} 가 build.gradle 을 읽지 않는다`);
    assert.match(src, /versionCode\\s\+\(\\d\+\)|versionCode\\\\s\+\(\\\\d\+\)/, `${f} 에 versionCode 정규식이 없다`);
  }
});

test("버전 파생처가 android-version.json 폴백을 갖는다", () => {
  /* Vercel 빌드에는 android/ 가 없다. 폴백이 없으면 code:0 이 된다. */
  const targets = ["next.config.ts", "server.js", "src/app/api/version/route.ts"];
  for (const f of targets) {
    const src = readFileSync(f, "utf8");
    assert.match(src, /android-version\.json/, `${f} 에 android-version.json 폴백이 없다`);
  }
});

test("깨진 폴백 URL(SERTZ-vc0.apk)이 다시 생기지 않았다", () => {
  /* vc241 이전 사고: android/ 가 없는 환경에서 versionCode 가 빈 문자열이 되어
   * `/releases/download/.../SERTZ-vc.apk` 나 `vc0.apk` 링크가 나갔다.
   *
   * 주석은 제외한다 — next.config.ts 11행에 이 사고를 **설명하는** 주석이 있고,
   * 그것까지 위반으로 세면 이력 기록을 못 하게 된다(실제로 한 번 걸렸다). */
  const files = ["next.config.ts", "server.js", "src/app/api/version/route.ts"];
  for (const f of files) {
    const code = readFileSync(f, "utf8")
      .split("\n")
      .filter((l) => !/^\s*(\*|\/\/)/.test(l))
      .join("\n");
    assert.ok(!/SERTZ-vc0\.apk/.test(code), `${f} 의 실제 코드에 SERTZ-vc0.apk 하드코딩이 있다`);
  }
});

test("버전을 숫자로 박아 둔 곳이 파생처에 없다", () => {
  /* next.config.ts · server.js · route.ts 는 파생처다. 여기에 구체 버전을 적으면
   * 그 순간부터 두 개의 진실이 생긴다. */
  const derived = ["next.config.ts", "src/app/api/version/route.ts"];
  for (const f of derived) {
    const src = readFileSync(f, "utf8")
      .split("\n")
      .filter((l) => !/^\s*(\*|\/\/)/.test(l)) // 주석 제외 (이력 설명은 허용)
      .join("\n");
    /* v1.4.5x 같은 옛 버전이 코드에 남아 있으면 잡는다 */
    assert.ok(
      !/(LATEST_VERSION|LATEST_CODE)\s*=\s*["']?\d+\.\d+\.\d+/.test(src),
      `${f} 가 버전을 하드코딩했다 — build.gradle 에서 파생해야 한다`,
    );
  }
});
