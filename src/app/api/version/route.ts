import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.1.8";
const LATEST_CODE = 170;
const VERSION_NOTE =
  "v1.1.8 (vc170) — 낚시를 추가했다. 필드에서 H키를 누르면 바늘이 좌우로 움직이고, 초록 성공 구간에서 공격 키로 멈추면 물고기를 잡는다. 물고기는 지역마다 다르다(설원=빙어·오로라송어, 화산=화염어·용암룡어, 심연=공허어·근원의 고기 등 20종). 5연속 성공하면 상위 등급 확률이 올라간다. 도감을 채우면 몬스터 컬렉션 창에서 확인할 수 있고, 첫 획득 시 심연 코인을 준다. 실패해도 미끼 외 손해가 없다. 이 게임의 첫 비전투 콘텐츠다.";
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
