import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.38";
const LATEST_CODE = 200;
const VERSION_NOTE =
  "v1.4.38 (vc200) — 스킬 화력 밀도 개편. ①Z(주력기)·C(기동기) 쿨다운에 차수 사다리 적용(1차 1.00 → 5차 0.68) — 그동안 배율만 오르고 쿨다운이 고정이라 상위 차수의 체감 DPS 가 정체돼 있었다. ②해적 3·4차 스킬 이름 중복 2건 해소(도화선 도약 / 철갑 돌파). ③3·4차 외형 1,120장 + Z/C 20/20 고유화 유지. ④클래스 계약 검증기 추가 — 외형 프레임 누락·스킬 승계 회귀를 커밋 전에 잡는다.";
const APK_MIRROR =
  /* vc179 — APK는 릴리스 태그 v1.3.1에 있다. */
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.38/SERTZ-vc200.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
