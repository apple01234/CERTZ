import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.5-beta";
const LATEST_CODE = 126;
const VERSION_NOTE =
  "v1.0.5-beta — 구글 로그인 완성: Firebase 콘솔 연동값(google-services.json·SHA-1 등록) 투입 — 네이티브 구글 계정 선택창·ID토큰 발급 정상화(vc125까지의 '구글 로그인 서버 설정 미완료' 안내 해소)";
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
