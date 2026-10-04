import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.1-beta";
const LATEST_CODE = 122;
const VERSION_NOTE =
  "v1.0.1-beta — 결제·광고 실연동: ①구글 플레이 인앱 결제(에메랄드 충전 4종·현금 패키지 3종) 소비(consume) 흐름 확정 — 재구매 차단 버그 픽스 ②결제 성공 직후 종료 시 미지급 결제 부팅 자동 복구(이중 지급 차단) ③충전소에 Play 등록 실가격 표시 ④AdMob 보상형 광고 실연동(AD_ID 권한 복원 — v1.4.3 잔재 제거) · 콘솔 상품 등록 가이드: download/결제_광고_연동_가이드.txt";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.1-beta/SERTZ-v1.0.1-beta.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
