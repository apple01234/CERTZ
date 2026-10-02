import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (v1.4.23 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.23";
const LATEST_CODE = 115;
const VERSION_NOTE =
  "v1.4.23 — 변경: ①이동·스킬 사용 시 검은 화면 반짝임 수정(desynchronized 제거·GPU 불안정 브레이커·Canvas 폴백 재부팅) ②계정·거래소·랭킹·클라우드세이브 Vercel 직결(구 게임서버 의존 제거 — sertz11/5 자동 이행) · APK: GitHub 릴리스 v1.4.23";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.23/SERTZ-v1.4.23.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
