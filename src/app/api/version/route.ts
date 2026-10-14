import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.11";
const LATEST_CODE = 153;
const VERSION_NOTE =
  "v1.0.11 (vc153) — 유저 제보 일괄: ①123456 로그인 불가 근본 수정 — 타이틀 화면 '로그인/계정' 버튼이 스크롤 오버레이(z-40)에 덮여 클릭이 전부 흡수되던 버그(z-[60] 승격, 라이브 E2E로 123456 로그인 성공 검증) ②5차전직 2차각성 퀘스트 '각성의 대가'를 퀘스트 로그에 신설 섹션으로 표시(진행도 바·단계 표기·수주 가능/완료 상태) ③각성 퀘스트 중 왕관 등 치장 착용이 대화 중 무음 차단되던 것 허용+실패 배너 ④거래소 다수 등록 — 상점처럼 −/숫자입력/+/MAX로 개수 지정(1~99, 보유 수량 서버 실검증·부분 구매·수량 표기) ⑤카오스 보스 에메랄드 보스마다 차등(수르트 19~나그라파르 66 — 보스 exp 계층 가중치, 재도전 창에 보스별 미리보기) ⑥도적 계열 제2궁극기 개편 「사(死)의 일섬」 3D 시네마틱(붉은 死 연출·Three.js 발도 참격·hitstop·즉발450%+출혈25%×5초·원격 死 근사) ⑦스바르트알프헤임 보스 개편(GreenSlash/Vanish/ShieldCast/MagicBurst/PortalTeleport 상태머신)";
const APK_MIRROR =
  /* vc138 — API DELETE 장애 기간 안전 경로 (server.js 주석 참조) */
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.9/SERTZ-vc153.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
