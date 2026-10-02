import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (v1.4.26 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.26";
const LATEST_CODE = 118;
const VERSION_NOTE =
  "v1.4.26 — 변경: ①멀티 UI 철거(멀티 아이콘·파티·채팅·서버주소 설정 — 멀티플레이 제외 확정, 오프라인 모드 정리) ②자동전투 개선: 포위 시 선제 물약·HP 안전망 40%·MP 회복선 35%·후퇴 중 반격 유지 ③v1.4.25 포함: 물약·자동 버튼 공격 버튼 바로 아래 이동 · APK: GitHub 릴리스 v1.4.26";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.26/SERTZ-v1.4.26.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
