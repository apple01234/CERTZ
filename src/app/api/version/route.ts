import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.3.4";
const LATEST_CODE = 182;
const VERSION_NOTE =
  "v1.3.4 (vc182) — ①마을(필드) 가구 설치: 집 안에서만 되던 가구 배치를 마을로 확장했다. 실내는 32px 격자, 마을은 자유 좌표라 저장을 분리했고(fieldDecor), 보유 수량은 집과 공유해 같은 가구를 두 곳에 무한 복제할 수 없다. 사냥터는 전투 동선을 막아 제외했다. ②해적 대각선 공격 수리(누적): 4방향으로 스냅된 조준값을 그대로 써서 대각선으로 쏘면 축 방향으로만 나가던 문제 — 애니메이션은 4방향 시트를 유지하되 탄환 각도는 8방향 자유 조준으로 분리했다. ③경험치 바를 화면 맨 밑 전체 폭으로 이동(메이플식). ④WorldScene 초기화 함수 분할: createInner 1,011줄 → 689줄(32%↓), 동작 변경 0.";
const APK_MIRROR =
  /* vc179 — APK는 릴리스 태그 v1.3.1에 있다. */
  "https://github.com/apple01234/CERTZ/releases/download/v1.3.4/SERTZ-vc182.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
