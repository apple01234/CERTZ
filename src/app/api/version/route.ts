import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.2.1";
const LATEST_CODE = 173;
const VERSION_NOTE =
  "v1.2.1 (vc173) — 해적 계열 스킬 아이콘을 만들었다. 지난 판에서 해적은 스킬 아이콘이 없어 전사·버서커 아이콘을 돌려쓰고 있었는데, 16개를 새로 그려 넣어 7직업 전 슬롯에 전용 아이콘이 붙었다. 외부 에셋을 쓰지 않고 32x32 픽셀 버퍼를 직접 채우는 방식으로 만들었다. 함께 고친 버그: 마을을 옮기거나 재접속할 때 이벤트 리스너 6개가 해제되지 않아 씬마다 누적되던 문제. 누적되면 상점 구매·퀘스트 수락 같은 이벤트가 한 번에 여러 번 실행돼 골드가 중복 차감되거나 퀘스트가 중복 수락될 수 있었다. 리스너 등록 96개와 해제 96개가 짝을 맞추도록 정리했다.";
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
