import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (v1.4.18 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.18";
const LATEST_CODE = 110;
const VERSION_NOTE =
  "v1.4.18 — 수정: ①세로 화면 이동 시 물약/자동사냥 버튼이 조이스틱과 겹쳐 발리는 문제(화면 깨짐) — 클러스터 아크 위 가로열 플로팅 ②서버 없는 배포(Vercel 등) socket.io 무한 재연결 스톰 차단(4회 후 오프라인 확정) ③모바일 주소창 리사이즈 노이즈로 줌 스냅 점프하던 것 디바운스+임계값 차단 · APK: GitHub 릴리스 v1.4.18";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.18/SERTZ-v1.4.18.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
