import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.1.5";
const LATEST_CODE = 166;
const VERSION_NOTE =
  "v1.1.5 (vc166) — 누적 플레이 기록을 추가했다. 스탯 창에서 이 캐릭터의 누적 플레이 시간·처치 수·보스 처치·사망·단일 최고 타격·최고 레벨을 볼 수 있고, 세이브에 저장되어 재접속해도 이어진다(기존엔 세션 메모리에 킬 수만 있어 기록이 남지 않았다). 설정에서 UI를 100~140%까지 확대할 수 있다(글자·버튼이 함께 커지고 게임 화면은 그대로). 직전 수정: 스킬 쿨타임이 진행시간으로 표시되던 역방향 버그, 수량 +10 버튼이 누적되지 않던 버그, 인벤토리 검색, 스킬 입력 버퍼링, 모달 포커스 트랩.";
const APK_MIRROR =
  /* vc159 — APK는 릴리스 태그 v1.0.17에 있다(이전 태그는 vc158까지 보유). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.1.5/SERTZ-vc166.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
