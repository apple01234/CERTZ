import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.3.9";
const LATEST_CODE = 187;
const VERSION_NOTE =
  "v1.3.8 (vc186) — ①스킬 아이콘 30개 교체: 4차 직업의 s3·s4 아이콘이 전부 단순 사각형 플레이스홀더였고 s5는 없었다. 제공 팩의 사람이 그린 skill_frame에 직업별 시그니처를 도트로 작화해 10직업×3슬롯=30개를 새로 만들었다(직업별 색 통일, Vision 9.8/10). ②5차 궁극기 아이콘이 모든 직업에서 동일했다 — s5Icon 하드코딩을 제거하고 직업별로 연결. 2차 궁극기 버튼이 1차 아이콘을 재사용하던 버그도 수정. 이전 사이클 누적: 4·5차 3D 연출 직업별 분화·5차 스킬 멈춤 수리(프레임 313→75ms)·쉐이더·고대비 튜토리얼(6→8단계)·유니온 보스 난이도(HP 21배 과다→정상)·Vercel CDN 캐시 복구(폴링 부하 40%↓).";
const APK_MIRROR =
  /* vc179 — APK는 릴리스 태그 v1.3.1에 있다. */
  "https://github.com/apple01234/CERTZ/releases/download/v1.3.8/SERTZ-vc186.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
