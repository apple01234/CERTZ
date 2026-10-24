import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.1.7";
const LATEST_CODE = 169;
const VERSION_NOTE =
  "v1.1.7 (vc169) — 안드로이드 뒤로가기를 누르면 앱이 바로 종료되던 문제를 고쳤다(이제 '메뉴로 나갈까요?' 확인이 뜬다). 패널을 여러 개 겹쳐 열었을 때 ESC가 전부 닫던 문제를 수정해 가장 위 패널만 닫힌다. PC에서 이동 방향이 스킬 방향 보조에 반영되지 않던 문제를 고쳤다(터치 우선, 키보드 차선). 탭 전환·목록 진입에 짧은 애니메이션을 넣어 끊김을 줄였다.";
const APK_MIRROR =
  /* vc159 — APK는 릴리스 태그 v1.0.17에 있다(이전 태그는 vc158까지 보유). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.1.5/https://github.com/apple01234/CERTZ/releases/download/v1.1.7/SERTZ-vc169.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
