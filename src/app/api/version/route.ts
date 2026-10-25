import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.3.1";
const LATEST_CODE = 179;
const VERSION_NOTE =
  "v1.3.1 (vc179) — 지시 12건. ①해적 자동사냥이 근접 알고리즘으로 돌던 버그 — 원거리 판정에 해적이 빠져 있었다. ②튜토리얼이 글로만 알려주던 문제 — 이제 패널을 직접 열거나 스킬을 쏴야 다음으로 넘어간다(직접 해 보기). ③집 꾸미기 — 가구 90도 회전(길게 누르기/우클릭), 보유 수량만큼 여러 개 배치, 이미 놓인 칸에 다른 가구를 교체. ④⑤NPC E키 원이 위로 밀려 어긋나고 대사 말풍선과 겹치던 버그. ⑥⑩해적 3·4차 스킬이 2차 것으로 폴백되던 문제 — 전용기 2종(현측 전열포·심해 포격진)과 7직업 스킬 이름표를 넣었다. ⑦말풍선 위치 상향. ⑧전직 시련 완료 즉시 전직 적용. ⑨1·2차 스킬이 같아 보이던 원인(해적 스킬표 누락) 수리. ⑪⑫사용자 제공 VFX 팩(UNI VFX·sertz)에서 이펙트 12종을 추출해 충격파·레벨업·함포·심해 폭발에 실제 사용. ⑬연속킬 콤보를 HUD에 상시 표시(남은 시간 게이지). ⑭HP 최대치 초과·소수점 표시와 미니맵 지역명 중복 수리.";
const APK_MIRROR =
  /* vc179 — APK는 릴리스 태그 v1.3.1에 있다. */
  "https://github.com/apple01234/CERTZ/releases/download/v1.3.1/SERTZ-vc179.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
