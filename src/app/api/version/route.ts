import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.37";
const LATEST_CODE = 199;
const VERSION_NOTE =
  "v1.4.37 (vc199) — 전직 외형 + 스킬 개편. ①3·4차 20직업이 드디어 자기 모습을 갖는다(종전엔 2차 외형을 그대로 승계해 '전직해도 그대로'였다). 남녀 40종 x 28프레임 = 1,120장 신규. ②Z(주력기)·C(기동기) 3·4차 20직업 전원 고유화(종전 16직업이 2차 스킬 재사용). ③좌우 이동 시 외형이 __MISSING 으로 깨지던 walkside 4프레임 누락 수리. ④차수 사다리 유지: 스킬 배율 1차 1.25 / 2차 1.53 / 3차 1.80 / 4차 2.08 / 5차 2.36.";
const APK_MIRROR =
  /* vc179 — APK는 릴리스 태그 v1.3.1에 있다. */
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.37/SERTZ-vc199.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
