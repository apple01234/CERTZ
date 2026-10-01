import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (v1.4.16 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.16";
const LATEST_CODE = 108;
const VERSION_NOTE =
  "v1.4.16 — 신규: 원소 반응 시스템 — 유리 상성 조합에서 특수 반응 발동! 화염>자연 폭발(주변 스플래시)·자연>냉기 결빙(둔화)·냉기>화염 융해·빛↔어둠 소멸(기절) — 반응명 텍스트+원소색 폭발+이중 충격파 연출, 같은 적 1.6초 쿨다운 · QA: ?renderer=canvas 비상 통로";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.16/SERTZ-v1.4.16.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
