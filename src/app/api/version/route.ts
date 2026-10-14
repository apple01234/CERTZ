import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.9";
const LATEST_CODE = 149;
const VERSION_NOTE =
  "v1.0.9 (vc149) — 피드백 26종 반영. ①계정123456 데이터 복구: 고아 캐릭터(sertz_char_*) 부팅 시 자동 재편입 + 슬롯 메타 이중 백업 + 클라우드 전 캐릭터 백업/복원(업데이트 시 캐릭터 소실 근본 치료) ②타이틀 로그인·PC(exe) 온라인: vc148 exe 프록시 https 수리 재배포(프록시 POST 실측 PASS) ③1:1 거래 수신 토픽 미구독 근본 수정(접속 시 즉시 구독) ④물약 회복량 20종 전 티어 인상 ⑤보스 에메랄드 챕터 스케일링(2→16) ⑥미니맵 NPC 노란 점 ⑦HUD 개편: 소리·스탯 더보기 이동, 퀘스트 최상단+창 내 토글, 더보기-설정 인접 배치, 우상단 className 손상 수리 ⑧단축키 배지 기기별 정확 표기(터치 기기 숨김) ⑨캐릭터 선택창 현재 직업 표기 ⑩아이콘 캐시버스팅 재시도 ⑪쉐이더 강도 0~200 확대 ⑫랭킹 터치 스크롤 복구(touch-action) ⑬아크로드 종막극 마무리 gv 강화 ⑭제2궁극기 30초 여운 필드 ⑮이터널 별하늘·에너지웹·시간정지 강화 ⑯GameVFX 3D 팩 81종 통합+비마법 계열 마법진 전면 대체(전사 불서클/궁수 부채꼴/도적 심연) ⑰NPC 구역 대사 6종 확장·구어체 ⑱GM 무한 엘릭서 재검증 ⑲유령 체력바 제거(destroyAll) ⑳300ms UI 타이머 분산 최적화";
const APK_MIRROR =
  /* vc138 — API DELETE 장애 기간 안전 경로 (server.js 주석 참조) */
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.9/SERTZ-vc149.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
