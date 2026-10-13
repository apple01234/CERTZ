import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.6";
const LATEST_CODE = 146;
const VERSION_NOTE =
  "v1.0.6 (vc146) — 첫 정식 릴리스(베타 접미사 제거) · 피드백 10종 반영: ①[GM] 완전 엘릭서 무한 사용(소모 버그 근본 수리 — 퀵슬롯/자동물약/인벤 전 경로) ②5차 제2궁극기 신설(12종 전용 연출·쿨타임 120초·MP150 — Q키/보라 버튼) ③툰 셰이더 밝기 대폭 하향(감광 22% — 툰 감성 유지) ④정식 빌드 전환(1.0.6) ⑤2.5D 카메라(시점 상승+y-depth 정렬+심도 안개·설정 토글) ⑥무릉도장 실시간 피해량(누적·DPS·최고 일격 화면 표시) ⑦우측 구석 유령 이펙트 근본 수리(3D 오버레이 카메라 보정 누락 수정) ⑧챕터 레벨 제한 상향(쿠소디아 12→세계수 뿌리 126) ⑨거래소 전품목 확대(엘릭서·장비 등 GM전용 제외 전체 등록 가능) ⑩크래시 안정화(3D 오버레이 그리기 버퍼 매프레임 재할당 제거 — GPU 메모리 churn 차단)";
const APK_MIRROR =
  /* vc138 — API DELETE 장애 기간 안전 경로 (server.js 주석 참조) */
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.6/SERTZ-vc146.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
