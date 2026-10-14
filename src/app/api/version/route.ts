import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.10";
const LATEST_CODE = 152;
const VERSION_NOTE =
  "v1.0.10 (vc152) — 신규 3종 마무리: ①NPC 선택지 키보드 조작 — 상점·전직관 목록을 방향키 ↑/↓로 훑고 E키로 확정(패널 개방 중 게임 키 자동 잠금·선택행 금테+▶ 마커·자동 스크롤) ②닉네임 중복 금지 — 계정·캐릭터 이름 전역 유니크(회원가입·캐릭터 생성 실시간 검사·삭제 시 반납) ③이펙트 검은 네모 배경 제거 — vfx2 팩 38종 루미넌스 키 처리(이펙트만 남기고 투명화) + setup-exe 전환(NSIS 설치기만 생산 — portable 폐지)";
const APK_MIRROR =
  /* vc138 — API DELETE 장애 기간 안전 경로 (server.js 주석 참조) */
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.9/SERTZ-vc152.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
