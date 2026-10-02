import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (v1.4.25 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.25";
const LATEST_CODE = 117;
const VERSION_NOTE =
  "v1.4.25 — 변경: ①모바일 물약·자동 버튼을 기본공격 버튼 바로 아래로 이동(기존 화면 반대편 230px → 74px, 엄지 도달 거리 픽스) ②v1.4.24 포함: APK 연결 상태 표시 수정(계정 API 헬스체크) ③v1.4.23 포함: 이동·스킬 시 검은 화면 반짝임 수정 · APK: GitHub 릴리스 v1.4.25";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.25/SERTZ-v1.4.25.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
