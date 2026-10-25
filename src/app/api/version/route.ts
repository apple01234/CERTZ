import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.3.2";
const LATEST_CODE = 180;
const VERSION_NOTE =
  "v1.3.2 (vc180) — ①해적 대각선 공격 수리: 해적 기본공격과 사격 스킬이 4방향으로 스냅된 조준값을 그대로 써서 대각선으로 쏘면 상·하·좌·우 중 하나로 눌려 발사됐다. 애니메이션 프레임은 4방향 시트를 유지하되 탄환 각도는 8방향 자유 조준으로 분리했다. ②경험치 바를 메이플처럼 화면 맨 밑에 전체 폭으로 옮겼다 — 좌상단의 176px 얇은 바에서는 현재 비율이 눈에 들어오지 않았다. 90% 이상이면 발광하고 남은 %를 숫자로 병기한다.";
const APK_MIRROR =
  /* vc179 — APK는 릴리스 태그 v1.3.1에 있다. */
  "https://github.com/apple01234/CERTZ/releases/download/v1.3.2/SERTZ-vc180.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
