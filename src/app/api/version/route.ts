import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.5-beta";
const LATEST_CODE = 131;
const VERSION_NOTE =
  "v1.0.5-beta (vc131) — 보스 전면 리메이크 v5.0: 설계도 9종 반영 신규 스프라이트 11종(idle/walk/atk/die+특수기술 sp1~3 · 12FPS 풀애니)+스콜&하티 '얼음 봉황' 표기";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.5-beta/SERTZ-v1.0.5-beta.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
