import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.12";
const LATEST_CODE = 154;
const VERSION_NOTE =
  "v1.0.12 (vc154) — 유저 제보 일괄+궁극기 개편: ①기본공격 X 키탭 제거(자동 버튼 위에 떠 있던 유령 X 아이콘 근본 수리 — 공격 버튼에 relative 누락돼 키탭이 클러스터 좌상단 기준으로 배치된 것이 원인) ②NPC 선택지 E키 확정 한글 IME 수리(한글 2벌식에서 물리 E키의 e.key가 'ㄷ'가 되어 확정이 안 들어가던 버그 — e.code KeyE 판정으로 교정, 상점·전직관 ↑/↓ 이동+E 확정+▶ 커서 실측) ③블레이드마스터 궁극기 개편 「극의 — 무한 검무 백연타」 — 무한 검무 100연타로 점점 빠르게 베기(시작 0.096초 간격→베기마다 단축→마지막 0.02초, 총 ~5.8초)+붉은 死 한자 블룸(절제 톤 — 투명도 0.38·발광 반폭)+HIT 카운터(10베기마다 갱신·종결 플래시 동안 잔류)+시네마 레터박스, 종결은 교차 쌍검 극의 일격 유지(화력 총량 보존 43.0배), 원격 유저에게도 100연타 근사+死 유령 동기화 ④사(死)의 일섬 한자 블룸 절제(발광 반경 25% 축소·확대 정점 1.35→1.22 — 유저 피드백 '한자 블룸이 너무 찐해') ⑤오버레이 시퀀스 타이밍 게임 시간 통일(컷 예약은 게임 시간인데 안전망만 실시간이면 저FPS에서 연출 도중 강제 해제되던 근본 수리 — 헤들리스 9FPS 실측 재현·수리) · E2E 10/10";
const APK_MIRROR =
  /* vc138 — API DELETE 장애 기간 안전 경로 (server.js 주석 참조) */
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.9/SERTZ-vc154.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
