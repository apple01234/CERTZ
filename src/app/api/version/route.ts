import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.4.28 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.28";
const LATEST_CODE = 120;
const VERSION_NOTE =
  "v1.4.28 — 변경: ①채팅 입력·전송 버튼이 NPC 대화창에 가려져 탭이 대화 진행으로 먹히던 문제 수정(입력행 z-40 상승) ②세로 좁은 화면 물약·자동 버튼을 공격 버튼 바로 왼쪽으로 재배치(~270px → 83px — v1.4.25 가로 화면 픽스와 동일 위상) ③v1.4.27 포함: 채팅·파티 부활(릴레이 폴링)·발신자명 픽스 · APK: GitHub 릴리스 v1.4.28";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.28/SERTZ-v1.4.28.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
