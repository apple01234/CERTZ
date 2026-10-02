import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (v1.4.27 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.27";
const LATEST_CODE = 119;
const VERSION_NOTE =
  "v1.4.27 — 변경: ①채팅·파티 부활(서버리스 릴레이 폴링 — Vercel 직결, 소켓 불필요) ②채팅 수신 폴링 미기동·발신자명(이름없음) 픽스 ③PC 포탈 이동 후 화면 축소 픽스 ④v1.4.26 포함: 자동전투 개선(포위 시 선제 물약·HP 안전망 40%·MP 회복선 35%·후퇴 중 반격) · APK: GitHub 릴리스 v1.4.27";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.27/SERTZ-v1.4.27.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
