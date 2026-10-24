import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.1.4";
const LATEST_CODE = 165;
const VERSION_NOTE =
  "v1.1.4 (vc165) — ①스킬 쿨타임 표시가 진행시간으로 나오던 버그를 고쳤다(남은 1초가 3초로, 남은 3초가 1초로 표시되던 역방향 계산). 이제 쿨 시작 시 최대값에서 줄어든다. ②인벤토리에 아이템 이름 검색을 추가했다(195종 중 원하는 것 즉시 찾기). ③스킬 키 입력 버퍼링 — 공격 중에 누른 스킬이 씹히지 않고 동작이 끝난 뒤 발동한다. ④모달 Tab 포커스 트랩 — 모달이 열린 상태에서 뒤쪽 UI로 포커스가 새지 않는다. ⑤상점 구매 확정창이 스크롤에 따라 밀리던 버그 수정(고정 위치).";
const APK_MIRROR =
  /* vc159 — APK는 릴리스 태그 v1.0.17에 있다(이전 태그는 vc158까지 보유). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.1.4/SERTZ-vc165.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
