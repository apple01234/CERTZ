import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.5-beta";
const LATEST_CODE = 137;
const VERSION_NOTE =
  "v1.0.5-beta (vc137) — v1.4.31: 보스 개편(유저 제공 9보스 아틀라스 — 대형화·배경제거·풀애니)·토벌전 HP x30·니플헤임 암전 강화+프리즈 완화·교실 파티 게임 3종(팀 킬전·보물 사냥·퀴즈쇼)+목표 대폭 상향";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.5-beta/SERTZ-v1.0.5-beta.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
