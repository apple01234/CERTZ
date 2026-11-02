// 테스트 전용 — 저장소 HEAD 의 소스를 "실제 파일"로 물질화해 import 한다.
//
// [왜 data: URL 이 아니라 파일인가]
//  종전 테스트들은 `import("data:text/javascript;base64,...")` 로 HEAD 버전을
//  읽었다. 이 방식은 소스에 상대 import 가 하나라도 있으면 즉시 죽는다 —
//  data: URL 에는 기준 디렉터리가 없어 `./howlrstone` 을 해석할 수 없기 때문이다
//  (ERR_UNSUPPORTED_RESOLVE_REQUEST / TypeError: Invalid URL).
//  stages.ts 는 vc231 부터 `./howlrstone` 을 import 하므로 이 경로가 막혔다.
//
// [해결]
//  HEAD 내용을 src/ 옆의 임시 파일로 쓰고 그 파일을 import 한다. 상대 import 는
//  디스크 기준으로 정상 해석되고, 끝나면 지운다. 파일명에 random suffix 를 붙여
//  병렬 실행에서도 충돌하지 않는다.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { stripTypeScriptTypes } from "node:module";

/**
 * 저장소 HEAD 에 있는 `relPath` 를 임시 파일로 물질화해 import 한 모듈을 돌려준다.
 *
 * @param {string} relPath 저장소 루트 기준 경로(예: "src/game/stages.ts")
 * @param {string} [rev]    git 리비전(기본 "HEAD")
 * @returns {Promise<any>}  import 된 모듈 네임스페이스
 */
export async function importFromGit(relPath, rev = "HEAD") {
  const src = execFileSync("git", ["show", `${rev}:${relPath}`], { encoding: "utf8" });

  // 원본과 같은 디렉터리에 두어야 상대 import 가 그대로 해석된다.
  const abs = path.resolve(relPath);
  const dir = path.dirname(abs);
  const base = path.basename(abs, path.extname(abs));
  // 원본 확장자를 유지한다(.ts → strip-only 로더가 처리).
  const ext = path.extname(abs);
  const tmp = path.join(dir, `.head-${base}-${process.pid}-${Math.random().toString(36).slice(2, 8)}${ext}`);

  // stripTypeScriptTypes 를 거치지 않고 그대로 쓴다 —
  // node --experimental-strip-types 로더가 .ts 를 직접 처리하므로
  // 타입 제거를 두 번 할 필요가 없고, 실수로 문자열 치환되는 위험도 없다.
  fs.writeFileSync(tmp, src, "utf8");
  try {
    return await import(`${tmp}?t=${Date.now()}`);
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* 정리 실패는 테스트 결과에 영향 없음 */ }
  }
}

/** 위 함수가 필요 없을 때를 위한 재노출 — 기존 테스트 호환. */
export { stripTypeScriptTypes };
