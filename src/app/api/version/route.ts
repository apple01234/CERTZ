import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (v1.4.21 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.21";
const LATEST_CODE = 113;
const VERSION_NOTE =
  "v1.4.21 — 변경: ①APK 기본 접속 주소를 Vercel 미러(sertz.vercel.app)로 전환 — 미러 주소는 자동으로 게임 서버 본체(sertz11)의 소켓·계정·거래소 API로 우회 연결 ②미러 호스트 자동 인식 로직 추가(서버 주소 교체 시 APK 재설치 불필요) · APK: GitHub 릴리스 v1.4.21";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.21/SERTZ-v1.4.21.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
