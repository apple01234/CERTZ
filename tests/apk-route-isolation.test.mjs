/**
 * vc276 — APK 정적 export 격리 목록 회귀 방지.
 *
 * 왜 필요한가 (실제 사고):
 *   `/api/contest` 라우트를 vc274 에서 신설했는데 android-build.yml 의 ROUTE_DIRS 에
 *   넣지 않았다. 그 결과 **vc274·vc275·vc276 세 빌드가 연속 실패**했다:
 *     Error: export const dynamic = "force-static" ... not configured on route "/api/contest"
 *     Error: Failed to collect page data for /api/contest
 *   소스 테스트 653개는 전부 통과했고, APK 빌드 로그를 열어야만 드러났다.
 *
 * 고정하는 것:
 *  ① src/app/api/* 아래 모든 라우트 디렉터리가 ROUTE_DIRS 에 있거나, 정적 export 가
 *     가능한(= force-static/dynamic 설정을 가진) 라우트여야 한다
 *  ② ROUTE_DIRS 에 적힌 이름이 실제로 존재하는 디렉터리여야 한다 (오타 방지)
 *  ③ 워크플로가 계속 next build 를 APK_EXPORT=1 로 돌려야 한다
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);
const WF = readFileSync(new URL(".github/workflows/android-build.yml", ROOT), "utf8");

/** 워크플로에서 ROUTE_DIRS 값을 뽑는다 */
function routeDirs() {
  const m = WF.match(/ROUTE_DIRS="([^"]+)"/);
  assert.ok(m, "android-build.yml 에서 ROUTE_DIRS 를 찾지 못함");
  return m[1].split(/\s+/).filter(Boolean);
}

/** src/app/api 아래 라우트 디렉터리 목록 */
function apiRouteDirs() {
  const dir = fileURLToPath(new URL("src/app/api/", ROOT));
  return readdirSync(dir).filter((n) => {
    try { return statSync(`${dir}${n}`).isDirectory(); } catch { return false; }
  });
}

test("모든 API 라우트가 정적 export 격리 목록에 있거나 스스로 정적 설정을 가진다", () => {
  const isolated = new Set(routeDirs());
  const missing = [];
  for (const name of apiRouteDirs()) {
    if (isolated.has(name)) continue;
    // 격리하지 않는 라우트는 output:export 에서 동작하도록 설정돼 있어야 한다
    const routeFile = fileURLToPath(new URL(`src/app/api/${name}/route.ts`, ROOT));
    if (!existsSync(routeFile)) { missing.push(`${name} (route.ts 없음 — 구조 확인 필요)`); continue; }
    const src = readFileSync(routeFile, "utf8");
    const staticallyExportable =
      /export\s+const\s+dynamic\s*=\s*["']force-static["']/.test(src) ||
      /export\s+const\s+revalidate\s*=/.test(src);
    if (!staticallyExportable) {
      missing.push(`${name} (ROUTE_DIRS 누락 + force-static/revalidate 없음)`);
    }
  }
  assert.deepEqual(
    missing, [],
    `APK 정적 export 가 실패한다. 다음 라우트를 android-build.yml 의 ROUTE_DIRS 에 추가하거나 force-static 을 설정하라:\n  ${missing.join("\n  ")}`,
  );
});

test("ROUTE_DIRS 의 이름이 실제 디렉터리와 일치한다 (오타 방지)", () => {
  const actual = new Set(apiRouteDirs());
  const phantom = routeDirs().filter((d) => !actual.has(d));
  assert.deepEqual(phantom, [], `ROUTE_DIRS 에 존재하지 않는 라우트가 있다: ${phantom.join(", ")}`);
});

test("APK export 는 여전히 APK_EXPORT=1 + next build 로 수행된다", () => {
  assert.match(WF, /APK_EXPORT=1 npx next build/, "APK_EXPORT=1 next build 호출이 사라짐");
  assert.match(WF, /test -f \.next-apk\/index\.html/, "export 결과 검증이 사라짐");
});
