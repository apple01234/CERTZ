import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.34";
const LATEST_CODE = 198;
const VERSION_NOTE =
  "v1.4.34 (vc198) — 긴급수정 9건. ①[치명] 효과음 누락 시 게임이 통째로 멈추던 크래시 수정(Audio key not found). ②포탈 탈 때마다 최대 HP가 늘어나던 버그 수정. ③효과음 36종을 원본으로 복구(먹먹하던 소리). ④타일맵 47종 원본 복구. ⑤집 가구가 한 칸에 몰리던 배치 버그 수정(24x22 격자). ⑥전사 스킬 사용 시 캐릭터가 멈추던 프레임 정지 완화. ⑦바닥에 흩어져 있던 불필요한 오브젝트 정리. ⑧직업별 무기 오버레이의 잔상·크기·회전 제거. ⑨WASD 모드에서 마우스 조준·클릭 공격 추가.";
const APK_MIRROR =
  /* vc179 — APK는 릴리스 태그 v1.3.1에 있다. */
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.34/SERTZ-vc198.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
