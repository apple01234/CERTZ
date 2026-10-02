import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (v1.4.20 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.20";
const LATEST_CODE = 112;
const VERSION_NOTE =
  "v1.4.20 — 변경: ①멀티서버 분리 아키텍처 — Vercel 정적 프론트 미러가 게임 서버(sertz11)에 직접 접속(소켓·계정·거래소·랭킹 전부 원격 연동) ②APK 기본 서버 sertz11 전환 + 구 서버(sertz4) 저장분 자동 이행 ③웹 정적 배포에서 소켓 재접속 스톰 제거(이동 시 화면 끊김 완화) · APK: GitHub 릴리스 v1.4.20";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.20/SERTZ-v1.4.20.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
