import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.4-beta";
const LATEST_CODE = 125;
const VERSION_NOTE =
  "v1.0.4-beta — 유저 버그 리포트 3건: ①랭킹 부적절 닉네임 항목 운영 제거(서버 DB 조치) ②구글 로그인 실패 원인별 안내 강화+플러그인 설정 보완(Firebase 콘솔 연동값 등록 후 정상 동작) ③초반 1~3챕터 BGM 원곡(Kevin MacLeod) 복구";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.4-beta/SERTZ-v1.0.4-beta.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
