import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.1.2";
const LATEST_CODE = 163;
const VERSION_NOTE =
  "v1.1.2 (vc163) — BGM 분위기 매칭 2차 정밀화: 채널의 테마 70개에서 1,602곡을 확보한 뒤, 챕터 정서에 정확히 맞는 전용 테마를 직접 매칭했다(마왕성=Dark Fantasy, 동굴=Cave Exploration, 저택=Mystery Manor, 비 도시=Lofi Night City, 고대 유적=Ruins RPG, 최종결전=Final Battle). 어두운 챕터(설원·동굴·룬광산·저승·세계수뿌리)에 밝은 곡이 배정된 건 0건이며, 10구역 중 3구역마다 곡이 바뀌는 규칙은 유지된다. 회피 기능은 제거된 상태.";
const APK_MIRROR =
  /* vc159 — APK는 릴리스 태그 v1.0.17에 있다(이전 태그는 vc158까지 보유). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.1.2/SERTZ-vc163.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
