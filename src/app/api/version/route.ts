import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (v1.4.17 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.17";
const LATEST_CODE = 109;
const VERSION_NOTE =
  "v1.4.17 — 수정: ①기본공격 버튼 우하단 코너 복귀+지름 100px 대형화 ②여캐 스프라이트 원본 레시피 재생성(남캐 동일 아트 스타일 — 긴머리+스커트 실루엣, 피부 6종) ③어태치 앵커 재산출 · APK: GitHub 릴리스 v1.4.17";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.17/SERTZ-v1.4.17.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
