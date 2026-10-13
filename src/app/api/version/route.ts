import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.5-beta";
const LATEST_CODE = 145;
const VERSION_NOTE =
  "v1.0.5-beta (vc145) — 피드백 16종 반영: ①랭킹 갱신(자동저장→클라우드 즉시 푸시+90초 주기) ②랭킹 100위까지 스크롤(리스트 높이 확대) ③툰 셰이더 강도 대폭 완화(대비 1.09→1.04·채도 1.22→1.10·림라이트 축소) ④친구 창 기본 단축키 R(설정에서 재배치 가능) ⑤PC 우상단 UI 확대(1024+ 1.08/1280+ 1.18/1600+ 1.28 배) ⑥미니맵 위 현재 위치 표시(예: 3-2 · 쿠소디아) ⑦유저 제공 RPG UI 팩(ui2) 프레임·버튼·입력창 재적용(9-슬라이스 — 흐려짐 없음) ⑧게임 화면에서 캐릭터 선택 바로가기 아이콘 신설 ⑨스킬 화력 대폭 상향(전 스킬 ×1.25+차수 사다리 확대 — 스킬이 평타보다 확실히 강함) ⑩B키=자동전투 전용(친구창 오점유 수정) ⑪셰이더 강도 조절바 즉시 반영(툰·발광 동시 제어) ⑫궁수 너프: 크리 100% 초과분은 크리뎀% 대신 공격력 평가산(135%→+35 ATK) ⑬식인초 스폰 6그루 보장+히트박스 확대+거리 판정 폴백(밟으면 확실히 번다) ⑭1:1 거래 버튼 크래시 수정(이벤트 채널 재귀 제거) ⑮보스 패턴 검은 네모 완전 삭제(예고 링·맹독장판 가산 블렌드) ⑯[긴급]스타포스 아이템 귀속(장비 교체 시 이전 장비의 강화 수치 유출 차단 — 기존 세이브 자동 마이그레이션)";
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
