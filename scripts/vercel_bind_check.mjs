#!/usr/bin/env node
/**
 * Vercel 프로젝트 바인딩 정리 (vc291).
 *
 * [왜 필요한가]
 *  tests/vercel-deploy.test.mjs 가 `.vercel/project.json` 의 커밋을 요구하는데
 *  `.gitignore:37` 이 `.vercel` 을 통째로 제외한다. 두 규칙이 정면 충돌해서
 *  이 테스트는 어떤 환경에서도 통과할 수 없었다.
 *
 *  projectId/orgId 는 Vercel 계정 고유값이라 코드로 만들 수 없다. 값이 없는 상태에서
 *  테스트가 빨간불이면 "배포가 깨졌다"로 오독된다(실제로 그렇게 오독돼 왔다).
 *
 * [이 스크립트가 하는 일]
 *  1) `.vercel/project.json` 이 있으면 → 그대로 두고 통과한다 (정상 경로).
 *  2) 없고 `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` 환경변수가 있으면 → 파일을 만든다.
 *  3) 둘 다 없으면 → **이 저장소는 Vercel CLI 로 링크된 적이 없다**고 보고하고
 *     종료코드 0 으로 빠진다. 이때 테스트는 skip 되어야 한다(실패가 아니다).
 *
 * 사용:
 *   node scripts/vercel_bind_check.mjs          # 상태 점검
 *   VERCEL_ORG_ID=team_x VERCEL_PROJECT_ID=prj_y node scripts/vercel_bind_check.mjs --write
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DIR = join(ROOT, ".vercel");
const FILE = join(DIR, "project.json");

function read() {
  if (!existsSync(FILE)) return null;
  try {
    return JSON.parse(readFileSync(FILE, "utf8"));
  } catch {
    return null;
  }
}

function main() {
  const write = process.argv.includes("--write");
  const cur = read();

  if (cur?.projectId && cur?.orgId) {
    console.log(`[vercel] 바인딩 있음 — projectId=${cur.projectId} orgId=${cur.orgId}`);
    return 0;
  }

  const org = process.env.VERCEL_ORG_ID || "";
  const prj = process.env.VERCEL_PROJECT_ID || "";

  if (org && prj) {
    if (!write) {
      console.log(`[vercel] 환경변수로 받은 값이 있습니다 — --write 로 파일을 만드세요`);
      console.log(`  orgId=${org}`);
      console.log(`  projectId=${prj}`);
      return 0;
    }
    mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify({ projectId: prj, orgId: org }, null, 2) + "\n");
    console.log(`[vercel] 생성 완료 — ${FILE}`);
    return 0;
  }

  console.log("[vercel] 바인딩 없음 — 이 저장소는 Vercel CLI 로 링크된 적이 없습니다.");
  console.log("        `.gitignore` 가 .vercel 을 제외하므로 커밋으로도 전달되지 않았습니다.");
  console.log("        붙이려면: vercel login && vercel link   (그 다음 이 스크립트 재실행)");
  return 0;
}

process.exit(main());
