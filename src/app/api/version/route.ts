import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.3-beta";
const LATEST_CODE = 124;
const VERSION_NOTE =
  "v1.0.3-beta — 긴급 픽스: 기기에서 인앱 결제·부팅 복구·충전소 실가격 사용 시 "NativePurchases.then() is not implemented" 크래시(재부팅 오버레이)가 발생하던 버그 수정 — 결제 플러그인 접근을 프록시 thenable 함정 없는 구조로 재설계. v1.0.2-beta 설치 기기는 이 버전으로 업데이트 필요";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.3-beta/SERTZ-v1.0.3-beta.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
