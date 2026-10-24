import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.1.6";
const LATEST_CODE = 168;
const VERSION_NOTE =
  "v1.1.6 (vc168) — 폴리시 개선: 스킬 쿨이 돌아오면 발밑에 링이 뜨고 소리가 나 알려준다(궁극기는 금색으로 강조). 경험치가 90%를 넘으면 바가 발광해 곧 레벨업임을 알린다. 골드가 늘면 숫자가 굴러 올라가 획득감이 생긴다. 설정·상점에서 Tab으로 이동할 때 포커스 위치가 보인다(키보드 접근성). 고대비 모드를 켜면 보조 텍스트가 밝아진다. 세이브 저장에 실패하면(용량 초과 등) 경고를 띄워 진행 손실을 미리 알린다.";
const APK_MIRROR =
  /* vc159 — APK는 릴리스 태그 v1.0.17에 있다(이전 태그는 vc158까지 보유). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.1.5/https://github.com/apple01234/CERTZ/releases/download/v1.1.6/SERTZ-vc168.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
