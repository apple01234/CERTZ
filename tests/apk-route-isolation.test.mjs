/**
 * vc276/vc277 — APK·EXE 정적 export 격리 목록 회귀 방지.
 *
 * 왜 필요한가 (실제 사고):
 *   `/api/contest` 라우트를 vc274 에서 신설했는데 android-build.yml 과 exe-build.yml
 *   **둘 다** ROUTE_DIRS 에 넣지 않았다. 그 결과 APK·EXE 빌드가 함께 실패했다:
 *     Error: export const dynamic = "force-static" ... not configured on route "/api/contest"
 *     Error: Failed to collect page data for /api/contest
 *   소스 테스트 656개는 전부 통과했고, 빌드 로그를 열어야만 드러났다.
 *   vc276 에서 android-build.yml 만 고쳤고, vc277 에서 EXE 가 같은 이유로 실패해
 *   exe-build.yml 도 고쳤다. 그래서 이 테스트는 **두 파일을 모두** 검사한다.
 *
 * 고정하는 것:
 *  ① `src/app/api/*` 의 모든 라우트가 **두 워크플로 모두**의 ROUTE_DIRS 에 있거나,
 *     정적 export 가 가능한(= force-static/revalidate 를 가진) 라우트여야 한다
 *  ② ROUTE_DIRS 에 적힌 이름이 실제로 존재하는 디렉터리여야 한다 (오타 방지)
 *  ③ 두 워크플로의 격리 목록이 **서로 같아야** 한다 (한쪽만 고치는 사고 방지)
 *  ④ 워크플로가 계속 next build 를 APK_EXPORT=1 로 돌려야 한다
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);
const WORKFLOWS = ["android-build.yml", "exe-build.yml"];

function readWf(name) {
  const p = fileURLToPath(new URL(`.github/workflows/${name}`, ROOT));
  assert.ok(existsSync(p), `워크플로 없음: ${name}`);
  return readFileSync(p, "utf8");
}

/** 워크플로에서 ROUTE_DIRS 값을 뽑는다 */
function routeDirs(src, name) {
  const m = src.match(/ROUTE_DIRS="([^"]+)"/);
  assert.ok(m, `${name} 에서 ROUTE_DIRS 를 찾지 못함`);
  return m[1].split(/\s+/).filter(Boolean);
}

/** src/app/api 아래 라우트 디렉터리 목록 */
function apiRouteDirs() {
  const dir = fileURLToPath(new URL("src/app/api/", ROOT));
  return readdirSync(dir).filter((n) => {
    try { return statSync(`${dir}${n}`).isDirectory(); } catch { return false; }
  });
}

for (const wf of WORKFLOWS) {
  test(`[${wf}] 모든 API 라우트가 격리 목록에 있거나 스스로 정적 설정을 가진다`, () => {
    const isolated = new Set(routeDirs(readWf(wf), wf));
    const missing = [];
    for (const name of apiRouteDirs()) {
      if (isolated.has(name)) continue;
      const routeFile = fileURLToPath(new URL(`src/app/api/${name}/route.ts`, ROOT));
      if (!existsSync(routeFile)) { missing.push(`${name} (route.ts 없음)`); continue; }
      const src = readFileSync(routeFile, "utf8");
      const staticallyExportable =
        /export\s+const\s+dynamic\s*=\s*["']force-static["']/.test(src) ||
        /export\s+const\s+revalidate\s*=/.test(src);
      if (!staticallyExportable) {
        missing.push(`${name} (ROUTE_DIRS 누락 + force-static/revalidate 없음)`);
      }
    }
    assert.deepEqual(missing, [],
      `${wf} 의 APK/EXE 정적 export 가 실패한다. ROUTE_DIRS 에 추가하라:\n  ${missing.join("\n  ")}`);
  });

  test(`[${wf}] ROUTE_DIRS 의 이름이 실제 디렉터리와 일치한다 (오타 방지)`, () => {
    const actual = new Set(apiRouteDirs());
    const phantom = routeDirs(readWf(wf), wf).filter((d) => !actual.has(d));
    assert.deepEqual(phantom, [], `${wf}: 존재하지 않는 라우트 ${phantom.join(", ")}`);
  });

  test(`[${wf}] APK_EXPORT=1 next build 로 export 한다`, () => {
    assert.match(readWf(wf), /APK_EXPORT=1 npx next build/, `${wf}: APK_EXPORT 빌드 호출이 사라짐`);
  });
}

test("android-build.yml 의 export 결과 검증이 남아 있다", () => {
  assert.match(readWf("android-build.yml"), /test -f \.next-apk\/index\.html/,
    "export 결과 검증이 사라짐");
});

test("두 워크플로의 격리 목록이 서로 같다 (한쪽만 고치는 사고 방지)", () => {
  const a = routeDirs(readWf("android-build.yml"), "android-build.yml").sort();
  const b = routeDirs(readWf("exe-build.yml"), "exe-build.yml").sort();
  assert.deepEqual(a, b,
    "android-build.yml 과 exe-build.yml 의 ROUTE_DIRS 가 다르다. 한쪽만 고치면 다른 쪽 빌드가 실패한다.");
});
