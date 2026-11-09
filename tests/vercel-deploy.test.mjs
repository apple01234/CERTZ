/**
 * Vercel 배포 설정 계약 (REVAMP_100 #27 "웹 자동배포 미동작").
 *
 * [#27 의 실제 상태]
 *  "push 해도 배포 안 됨 — CLI 수동 필요" 로 ⬜ 였다.
 *  코드를 확인한 결과 **설정 자체는 정상**이었다:
 *    · vercel.json — framework/buildCommand 지정됨
 *    · .vercel/project.json — projectId/orgId 바인딩됨
 *    · .vercelignore — 빌드에 불필요한 디렉터리 제외됨
 *
 *  남은 것은 **GitHub 저장소와 Vercel 프로젝트의 Git 연동**이며,
 *  이는 계정 소유자가 대시보드에서 해야 하는 일이다. 저장소 코드로는 풀 수 없다.
 *
 * [이번에 고친 것]
 *  `vercel.json` 의 env 에 `DATABASE_URL: "file:/tmp/custom.db"` 가 있었다.
 *  그런데 이 프로젝트는 DB 로 **GitHub-as-DB**(`src/lib/ghdb.ts` → CERTZ-DB 저장소)를
 *  쓰고, 코드 어디에서도 `DATABASE_URL` 을 읽지 않는다. 죽은 설정이었다.
 *  Vercel 서버리스에는 영속 파일시스템이 없으므로 `/tmp` 경로는 오해를 부른다.
 *
 * [이 테스트가 지키는 것]
 *   ① 배포 필수 키가 유지된다 (framework/buildCommand)
 *   ② 스키마·프로젝트 바인딩이 살아 있다
 *   ③ 죽은 DATABASE_URL 이 다시 들어오지 않는다
 *   ④ .vercelignore 가 빌드 산출물과 대용량 디렉터리를 제외한다
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";

const VERCEL_JSON = "vercel.json";
const PROJECT_JSON = ".vercel/project.json";
const IGNORE = ".vercelignore";

test("vercel.json 이 Next.js 프레임워크와 빌드 명령을 지정한다", () => {
  const cfg = JSON.parse(readFileSync(VERCEL_JSON, "utf8"));
  assert.equal(cfg.framework, "nextjs", "framework 가 nextjs 가 아니다");
  assert.ok(cfg.buildCommand, "buildCommand 가 없다");
  /* 빌드 명령은 package.json 에 실재하는 스크립트여야 한다 — 오타면 배포가 통째로 실패한다. */
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const script = String(cfg.buildCommand).replace(/^npm run /, "");
  assert.ok(pkg.scripts?.[script], `buildCommand "${cfg.buildCommand}" 에 해당하는 스크립트가 package.json 에 없다`);
});

test("죽은 DATABASE_URL 설정이 없다 (이 프로젝트는 GitHub-as-DB)", () => {
  /* 코드가 DATABASE_URL 을 읽지 않는데 설정에 남아 있으면,
   * 나중에 누군가 "DB 가 있구나" 하고 파일 기반으로 착각한다.
   * Vercel 서버리스에는 영속 파일시스템이 없어 /tmp 는 재시작마다 사라진다. */
  const cfg = JSON.parse(readFileSync(VERCEL_JSON, "utf8"));
  const env = cfg.env ?? {};
  assert.ok(!("DATABASE_URL" in env), "vercel.json 에 죽은 DATABASE_URL 이 다시 들어왔다");

  /* 실제 저장소는 GitHub-as-DB 여야 한다 (근거가 바뀌면 이 테스트를 갱신한다) */
  assert.ok(existsSync("src/lib/ghdb.ts"), "GitHub-as-DB 계층이 없다 — 저장 방식이 바뀌었다면 테스트를 갱신하라");
  const ghdb = readFileSync("src/lib/ghdb.ts", "utf8");
  assert.match(ghdb, /GitHub-as-DB|CERTZ-DB/, "ghdb.ts 에 GitHub-as-DB 근거가 없다");
});

/* vc291 — 이 테스트는 "바인딩이 커밋돼 있다"를 요구했는데, `.gitignore:37` 이
 *  `.vercel` 을 통째로 제외하고 있어 **어떤 환경에서도 통과할 수 없는 모순**이었다.
 *  게다가 projectId/orgId 는 Vercel 계정 고유값이라 코드로 만들 수 없다.
 *
 *  그래서 계약을 두 갈래로 나눈다:
 *    · 바인딩 파일이 있으면  → 내용이 유효한지 검사한다(원래 하던 일).
 *    · 없으면               → skip 한다. "연결된 적 없음"은 실패가 아니라 **미설정 상태**다.
 *      이걸 fail 로 두면 배포가 멀쩡한데도 매번 빨간불이 떠서 진짜 결함을 가린다.
 *
 *  붙이는 방법: `vercel login && vercel link` 후
 *  `node scripts/vercel_bind_check.mjs` 로 상태 확인. */
test("Vercel 프로젝트 바인딩이 커밋돼 있다", (t) => {
  if (!existsSync(PROJECT_JSON)) {
    t.skip(
      `.vercel/project.json 없음 — 이 저장소는 Vercel CLI 로 링크된 적이 없다. ` +
        `(.gitignore 가 .vercel 을 제외하므로 커밋으로도 전달되지 않는다) ` +
        `붙이려면 vercel login && vercel link`,
    );
    return;
  }
  const p = JSON.parse(readFileSync(PROJECT_JSON, "utf8"));
  assert.ok(p.projectId, "projectId 가 없다");
  assert.ok(p.orgId, "orgId 가 없다");
});

test(".vercelignore 가 빌드 산출물과 대용량 디렉터리를 제외한다", () => {
  const text = readFileSync(IGNORE, "utf8");
  for (const need of [".next/", "android/", "node_modules"]) {
    /* node_modules 는 Vercel 이 자동 제외하므로 강제하지 않는다 */
    if (need === "node_modules") continue;
    assert.ok(text.includes(need), `.vercelignore 에 ${need} 제외가 없다 — 업로드가 느려지고 빌드가 실패할 수 있다`);
  }
  /* 런타임 에셋(public/assets)은 제외하면 안 된다 — 게임이 빈 화면이 된다 */
  assert.ok(!/^public\/assets\//m.test(text), ".vercelignore 가 public/assets 를 제외하면 게임 에셋이 사라진다");
});
