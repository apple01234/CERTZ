import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.2.0";
const LATEST_CODE = 172;
const VERSION_NOTE =
  "v1.2.0 (vc172) — 칭호를 추가했다. 업적 16종 각각에 칭호가 하나씩 붙고(사냥꾼·토벌자·살육의 화신·게이트의 전설·카오스 정복자 등), 업적을 수령하면 그 칭호가 열린다. 연 바르가 원정대의 업적 탭에서 골라 장착하면 캐릭터 이름표 앞에 「토벌자」 세르츠처럼 표시된다. 칭호는 스탯을 주지 않는다. 수치를 붙이면 '칭호를 안 단 사람이 손해'라는 압박이 생겨 취향 선택이 강제가 되기 때문에 자랑거리로만 남겼다. 달성만 하고 수령하지 않은 업적의 칭호는 쓸 수 없게 막았다 — 보상을 받는 동선이 의미를 잃지 않도록. 구 세이브는 칭호 필드가 없어도 그대로 동작하고, 개편으로 사라진 칭호가 세이브에 남아 있으면 조용히 무시한다.";
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
