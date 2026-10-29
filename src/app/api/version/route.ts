import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.39";
const LATEST_CODE = 201;
const VERSION_NOTE =
  "v1.4.39 (vc201) — ①데스크톱 클라이언트 자동 업데이트: 앱 시작 3초 후 /api/version 을 조회해 새 빌드가 있으면 다이얼로그로 알리고, 설치파일을 받아 바로 실행한다(제목줄에 진행률 %). 이제 EXE 를 다시 받으러 릴리스 페이지에 갈 필요가 없다. ②이펙트 알파 채널 복구 — 게임 이펙트 8종이 알파값이 전부 255(불투명)라 원형 이펙트가 회색 사각형으로 그려지던 문제를 고품질 이펙트 27종으로 교체. ③스킬 이펙트 3겹 다층 연출.";
const APK_MIRROR =
  /* vc179 — APK는 릴리스 태그 v1.3.1에 있다. */
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.39/SERTZ-vc201.apk";
/* v1.4.39 — 데스크톱 클라이언트 자동 업데이트용 EXE 주소.
 *  종전엔 클라이언트가 스스로 업데이트를 확인하는 코드가 아예 없어, 새 빌드마다
 *  사용자가 릴리스 페이지에서 직접 받아 재설치해야 했다.
 *  electron/main.js 의 checkForUpdates() 가 이 값을 읽어 자동 다운로드·설치한다. */
const EXE_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.39/SERTZ-vc201-setup.exe";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    exe: EXE_MIRROR,
    guide: "/apk-guide.html",
  });
}
