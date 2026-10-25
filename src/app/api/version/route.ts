import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.2.5";
const LATEST_CODE = 177;
const VERSION_NOTE =
  "v1.2.5 (vc177) — v1.2.4 배포본 검증에서 발견된 회귀 3건을 수리했다. ①낡은 단검에 도적 전용 제한이 붙어 전사·마법사·궁수·해적이 자기 기본 무기를 장착하지 못하던 버그를 되돌렸다. ②새로 만든 궁수·해적 전용 무기 6종이 상점에 진열되지 않아 획득 방법이 없던 문제를 골드 상점 진열로 수리했다. ③상점에서 내가 쓸 수 없는 다른 직업 전용 무기가 보이던 문제를 고쳐 내 계열 전용 무기만 보인다.";
const APK_MIRROR =
  /* vc177 — APK는 릴리스 태그 v1.2.5에 있다(이전 태그는 vc176까지 보유). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.2.5/SERTZ-vc177.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
