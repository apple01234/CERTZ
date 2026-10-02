import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (v1.4.24 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.24";
const LATEST_CODE = 116;
const VERSION_NOTE =
  "v1.4.24 — 변경: ①APK 연결 상태 표시 수정 — 소켓 판정(②안에서 항상 실패 → 무조건 “연결 실패” 오타보)을 계정 API 헬스체크로 교체, 서버 정상 시 “서버 연결됨” 표시 ②v1.4.23 포함: 이동·스킬 시 검은 화면 반짝임 수정·계정/거래소 Vercel 직결 · APK: GitHub 릴리스 v1.4.24";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.24/SERTZ-v1.4.24.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
