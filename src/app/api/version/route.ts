import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.7";
const LATEST_CODE = 147;
const VERSION_NOTE =
  "v1.0.7 (vc147) — 피드백 30종 반영: ①쉐이더 기본 밝기 복원+툰 강화(감광 폐지·대비/채도/림 증폭) ②강도 슬라이더 역방향 근본 수정(올릴수록 밝고 툰닝) ③제2궁극기 버튼 1차 궁극기 바로 옆 배치(그리드 폭 버그) ④모바일 미니맵 하단 정중앙 복귀(+44px 치우침 제거) ⑤1:1 거래 수신 [수락/거절] 즉시 표시(스냅샷 복원 채널) ⑥원격 액션 스로틀 개별화(내 화면과 상대 화면 유실 차단) ⑦Drive VFX 적극 활용+계열별 지면 시그니처(마법진은 마법사만) ⑧데드아이 제2궁극기 저격 트레이서 100련 가시화 ⑨앱 아이콘 YGGDRASIL 전면 교체 ⑩보물상자 검은 상자 잔여 제거(cfxr_star ADD) ⑪스킬/공격 버튼 단축키 키탭 ⑫랭킹 열면 즉시 업로드+15초 폴링+수동 갱신 ⑬시련의 탑 동시 20마리 캡+목표까지 반복 충원 ⑭전 맵 50마리 하드캡(파크/게이트 포함) ⑮콘텐츠 허브 랭킹 탭 중복 철거 ⑯1차 궁극기 x300%·제2궁극기 x500% 피해 배율 ⑰220렙 각성의 대가 12단계 스토리 퀘스트로 제2궁극기 획득 ⑱시작 화면 로그인 ⑲니플헤임 설원톤 복원(암전 0.52→0.30) ⑳우상단 자동전투 로봇 중복 철거 ㉑투구/후드 치장 7종 얼굴 복원 ㉒최적화: 30FPS 절전 모드 토글 ㉓유니온 영향력 x2.5+유니온 레벨 보너스 ㉔신화 등급 장비 4종(최종 스펙업층) ㉕전 챕터 사연+기믹 퀘스트 18종 추가 ㉖맵별 NPC 3종 다양화+반복 의뢰 수주/보고 시스템";
const APK_MIRROR =
  /* vc138 — API DELETE 장애 기간 안전 경로 (server.js 주석 참조) */
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.7/SERTZ-vc147.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
