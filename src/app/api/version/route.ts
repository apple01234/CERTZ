import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.3.3";
const LATEST_CODE = 181;
const VERSION_NOTE =
  "v1.3.3 (vc181) — 지시 19건+3건 중 1차 배치. ①사망 패널티 도입: 필드에서 죽으면 경험치 5%·골드 3%를 잃는다(최대 5만G, 마을·실내 면제, 장비 손실 없음). ②보스전 멈춤 수리: 보스 처치 슬로우모션이 timeScale 0.28에 영구 고정되면 게임이 3.5배 느려져 멈춘 것처럼 보였다 — 실제 시각 기준 복원 + update 워치독 2중 안전망. ⑤경험치 바를 더 얇게(8~9px). ⑥이펙트 검정 네모 제거: 파티클 이미터가 없는 텍스처를 쓰면 Phaser 플레이스홀더가 검은 사각형으로 그려졌다 — 텍스스처 없는 이미터는 생성하지 않는다. ⑦보스 크기 정규화(320px 기준, 히트박스도 표시 크기 기준). ⑧시즌 패스 완주가 며칠 만에 끝나던 문제 — 레벨당 XP 100→260, 보스 30→24·일일 40→30. ⑨보스 장신구가 레이드에서 무조건 2개 나오던 것 → 1개 + 45% 확률 추가. ⑭종결무기 5,600→42,000G(부수: thief 전용 회귀 제거). ⑮장비 장착 레벨 제한 신설(등급별 1/10/25/45/70, 상점 구매는 허용). ⑯패널 24개를 absolute→fixed(스크롤 시 확인창이 밀려나던 문제). 추가①시간 지나 꺼지는 알림을 최상단(z-80)으로. 추가②경험치 책이 레벨 대비 무의미했던 것 → 현재 레벨 요구치의 40%. 추가③해적 직업 랭킹 미등록(BRANCH_KEYS 누락).";
const APK_MIRROR =
  /* vc179 — APK는 릴리스 태그 v1.3.1에 있다. */
  "https://github.com/apple01234/CERTZ/releases/download/v1.3.3/SERTZ-vc181.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
