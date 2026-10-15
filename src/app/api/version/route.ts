import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.13";
const LATEST_CODE = 155;
const VERSION_NOTE =
  "v1.0.13 (vc155) — 유저 피드백 20건 일괄 반영: ①심연의탑 리스폰 몬스터에 층 배율 미적용 버그 근본 수정 ②심연의탑/몬스터파크 보상 nerf ③퀘스트 완료 경험치 대폭 상향 ④블레이드마스터 궁극기 「무한 검무」 50연타 재편+화력 상향 ⑤공동 토벌전 보스 대폭 강화 ⑥보스 체력 공유 파티 한정 ⑦일일 상자·긴급귀환 캐릭터당 분리 ⑧캐릭터별 랭킹+직업별 랭킹 탭 ⑨닉네임 전역 중복 방지 ⑩MQTT [GM] 표시 ⑪상대 정보창+1:1 거래 ⑫파티원 스킬 표시 수리 ⑬캐릭터 선택창 로그인 버튼 숨김 ⑭퀘스트 트래커 상단 정렬 ⑮기능 아이콘 기능명 통일 ⑯튜토리얼 이그니 하이라이트 ⑰오라 6종+수집 펫 2종 ⑱iOS unsigned IPA 워크플로 자동화";
const APK_MIRROR =
  /* vc138 — API DELETE 장애 기간 안전 경로 (server.js 주석 참조) */
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.9/SERTZ-vc155.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
