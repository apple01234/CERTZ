import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.14";
const LATEST_CODE = 156;
const VERSION_NOTE =
  "v1.0.14 (vc156) — 유저 피드백 11건: ①PC 온라인 전면 장애 복구(Vercel DB 토큰 만료 — 로그인·채팅·랭킹·거래소 전체) ②admin 비번 복구 경로 재확보 ③직업별 랭킹 전직차수→8계열 기준 개편(버서커·가디언·스나이퍼·윈드러너·아크메이지·세이지·어세신·스와시버클러) ④퀘스트·콘텐츠 아이콘 더보기→가방 옆 상단 배치 ⑤퀘스트 창 더보기 아래 배치 ⑥미니맵 하단 중앙 복귀(렌더 최상위 유지) ⑦유령 체력바 검은 네모 제거+사망 잔존(스프라이트·HP바) 3중 방어 ⑧시련의 탑(심연의 탑) 보스 오엔딩 버그 수정 ⑨BM 궁극기 블랙아웃 시네마 연출(절개·종결 암전) ⑩死 한자 옆 콤보 카운터 표시+종료 후 미소멸 버그 근본 수리(5중 클린업) ⑪게이트 웨이브=바르가 수비전 입장 버튼 복원+조각 상점 UI 복원+룬 안내 정정";
const APK_MIRROR =
  /* vc138 — API DELETE 장애 기간 안전 경로 (server.js 주석 참조) */
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.9/SERTZ-vc156.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
