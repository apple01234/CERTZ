import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.3.7";
const LATEST_CODE = 185;
const VERSION_NOTE =
  "v1.3.7 (vc185) — ①4·5차 스킬 3D 연출을 직업별로 분리: 그동안 계열(5종)로만 골라 10개 4차 직업이 같은 연출을 공유했다. 이제 워브링어=대검연쇄·크루세이더=성광방벽·데드아이=관통궤적·스카이로드=회오리·아크로드=전격아크·이터널=시간고리·섀도우로드=낫+해골·블레이드마스터=쌍검부채·시킹=수압파도·드레드노트=포격탄막. ②5차 스킬 멈춤 수리: 카메라 줌 트윈이 매 프레임 누적되고 복귀 기준이 변형값이라 줌이 1.25로 고정됐다 — 프레임 313ms→75ms, 줌 정상 복귀. ③쉐이더·고대비 튜토리얼 추가(6→8단계, 설정에서 직접 조작해야 완료). ④유니온 보스 난이도 정상화: HP가 유저 화력의 21배였다 — 노말 6만→2,400. ⑤Vercel 부하 차단: 클라이언트가 no-store로 CDN 캐시를 무력화해 모든 폴링이 서버를 때리던 것을 수정(함수 호출 0, 폴링 40% 감소). ⑥파티/랭킹 아이콘 중복 분리.";
const APK_MIRROR =
  /* vc179 — APK는 릴리스 태그 v1.3.1에 있다. */
  "https://github.com/apple01234/CERTZ/releases/download/v1.3.7/SERTZ-vc185.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
