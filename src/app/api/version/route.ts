import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.1.3";
const LATEST_CODE = 164;
const VERSION_NOTE =
  "v1.1.3 (vc164) — ①상점 구매 확정창이 스크롤을 내리면 화면 밖으로 밀리던 버그를 고쳤다(스크롤 컨테이너 안 absolute → 뷰포트 fixed, 로비 캐릭터 삭제창도 동일 원인이라 함께 수정). ②디자인·게임성 개편: 스킬 버튼에 남은 쿨다운 초 표시, 피해량 구간별 색·크기 차등(약/평/강/압도), 보스 페이즈 전환 0.18초 슬로우모션, 피격 시 화면 가장자리에 공격 방향 호 표시, 중독·출혈·감속 상태이상을 HUD에 남은 시간 게이지로 표시, 상점 수량 10/MAX 단축 버튼, 로딩 팁 5→24개.";
const APK_MIRROR =
  /* vc159 — APK는 릴리스 태그 v1.0.17에 있다(이전 태그는 vc158까지 보유). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.1.3/SERTZ-vc164.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
