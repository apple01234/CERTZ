import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.0-beta";
const LATEST_CODE = 121;
const VERSION_NOTE =
  "v1.0.0-beta — 정식 출시(베타): v1.4.28까지의 전체 기능 포함 — ①채팅·파티 부활(Vercel 릴레이 폴링) ②자동전투 튜닝(포위 시 선제 물약·HP 안전망 40%) ③채팅 입력·전송 버튼 대화창 가림 픽스 ④세로 좁은 화면 물약·자동 버튼 공격 버튼 인접 재배치 · Google Play AAB 출시용 · APK: GitHub 릴리스 v1.0.0-beta";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.0-beta/SERTZ-v1.0.0-beta.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
