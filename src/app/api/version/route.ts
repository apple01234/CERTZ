import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.5-beta";
const LATEST_CODE = 144;
const VERSION_NOTE =
  "v1.0.5-beta (vc144) — 피드백 12종 반영: ①PC 자동전투 단축키(B키, 설정에서 재배치 가능) ②[GM]완전 엘릭서 자동물약 등록 가능 ③1:1 플레이어 거래(아이템·골드·에메랄드 — 근처 플레이어 요청→양쪽 확정 교환) ④심연의 탑 리워크(층별 지정 마릿수 처치제+파워(체력·속도·공격) 배율 증가+5층마다 12보스 고정 로테이션) ⑤후반 4챕터(7~10장) 4구역부터 몬스터 체력 ×10 ⑥보스마다 고유 공격 패턴+이펙트(수르트 추적화염기둥·니드호그 맹독장판·스콜 빙결신성·나그라파르 뇌우·아부디토스 마룡성역·심연군주 결정산개·가름 점멸참격) ⑦검은 네모 폭발(손상된 지균 데칼) 삭제 ⑧5분마다 자동저장 ⑨Three.js 3D VFX 오버레이(phas3d식 — 보스 격파/패턴/층 클리어) ⑩쿠소디아 멈춤 근본 수정(챕터카드 watchdog 우회+탑/황금몬스터 절대HP 오류) ⑪툰 셰이딩 파이프라인(셀룰룩 포스터라이즈+명암 — 설정에서 on/off) ⑫유저 에셋 34종 통합(UNI VFX·Hovl·Cartoon FX 크롭";
const APK_MIRROR =
  /* vc138 — API DELETE 장애 기간 안전 경로 (server.js 주석 참조) */
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.5-beta/SERTZ-vc144.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
