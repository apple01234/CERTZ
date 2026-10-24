import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.1.5";
const LATEST_CODE = 167;
const VERSION_NOTE =
  "v1.1.5 (vc167) — 누적 플레이 기록(스탯 창: 플레이시간·처치·보스·사망·최고타격·최고레벨, 세이브 저장), 인벤토리 장비 비교(장착템 대비 공/방/HP 차이), HUD HP 바 피격 흔들림, 설정 UI 확대 100~140%, 스킬 쿨타임 역방향 표시 버그 수정, 수량 +10 누적 버그 수정, 인벤토리 검색, 스킬 입력 버퍼링, 모달 포커스 트랩.";
const APK_MIRROR =
  /* vc159 — APK는 릴리스 태그 v1.0.17에 있다(이전 태그는 vc158까지 보유). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.1.5/https://github.com/apple01234/CERTZ/releases/download/v1.1.5/SERTZ-vc167.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
