import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (v1.4.19 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.19";
const LATEST_CODE = 111;
const VERSION_NOTE =
  "v1.4.19 — 변경: ①필드/마을에 간헐적으로 생기던 '검은 사각형+녹색 대각선' 글리치 근원 제거 — v1.4.11 나무 배치 풀 kd_plant 3종의 부트 로드 누락 수정 + 등록된 텍스처만 배치하는 안전망 ②게임 UI 스킨을 Tailwind CSS 기반으로 전환(ui2 비트맵 스트레치 프레임 → 앰버/스톤 유틸리티 디자인 — 패널·버튼·탭·입력·게이지 전체, 픽셀 폰트와 게임 감성은 유지) · APK: GitHub 릴리스 v1.4.19";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.19/SERTZ-v1.4.19.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
