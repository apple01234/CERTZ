import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.3.6";
const LATEST_CODE = 184;
const VERSION_NOTE =
  "v1.3.6 (vc184) — ①여캐 헤어 차별화: 사이드뱅·옆머리·가슴앞 머리·리본·머리 명암·턱선 정리로 두상만 봐도 여성으로 구분된다(168프레임 전수, Vision 품질 7.5→8.8). ②상태 해시 검증: FNV-1a로 3초마다 서버와 상태를 대조해 동기화 이탈을 감지한다(되감지 않음 — 잘못된 되감기가 정상 상태를 망친다). 누적 수정: 적 방어력(체급별 정액+비율)·검은 사각형 VFX 알파 추출(12종)·20Hz 고정 틱 AI(18~19Hz 실측)·시드 결정론 난수(?seed 재현)·보스 아틀라스 7종 격자·WebGL 컨텍스트 유예 15초.";
const APK_MIRROR =
  /* vc179 — APK는 릴리스 태그 v1.3.1에 있다. */
  "https://github.com/apple01234/CERTZ/releases/download/v1.3.6/SERTZ-vc184.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
