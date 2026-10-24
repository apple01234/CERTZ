import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.1.9";
const LATEST_CODE = 171;
const VERSION_NOTE =
  "v1.1.9 (vc171) — 다섯 번째 계열 '해적'을 추가했다. 전사·궁수·마법사·도적 넷뿐이던 1차 전직에 해적이 들어오고, 2차 레이더/코세어 → 3차 스톰캡틴/파우더마스터 → 4차 씨킹/드레드노트까지 7개 직업이 늘었다. 해적은 다른 계열과 전투 리듬이 다르다. 검을 한 번 크게 휘두르는 대신 포격과 해일로 넓게 쓸어버리고, 3차부터는 아군 가속까지 붙는다. Z(포격·커틀러스 난무)·C(연막 측면·갈고리 그네)·V(뇌우 소환·지뢰 부설·만조·전탄 발사)·B(침몰의 종·무쌍 포격)까지 8개 스킬을 새로 만들었고, 계열 궁극기 2종(만조 — 대양 항로 / 폭풍항로 — 침몰의 종)도 따로 있다. 전직 스토리 퀘스트와 대사도 4차수 전부 채웠다. 함께 고친 것: 직업 계열을 4개로 하드코딩하던 24곳을 전부 5계열로 바꿨고(파티·유니온·전직 스토리·랭킹), APK 다운로드 주소에 이전 버전 URL이 덧붙어 있던 오류를 바로잡았다.";
const APK_MIRROR =
  /* vc159 — APK는 릴리스 태그 v1.0.17에 있다(이전 태그는 vc158까지 보유). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.1.5/https://github.com/apple01234/CERTZ/releases/download/v1.1.8/SERTZ-vc170.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
