import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.15";
const LATEST_CODE = 157;
const VERSION_NOTE =
  "v1.0.15 (vc157) — 유저 피드백 6건: ①레벨별 요구 경험치 메이플 공식표 적용(나무위키 메이플스토리/레벨 4.1~4.3 — 2026-03-19 업데이트 기준 1~299레벨 전 구간) — 심연의탑 과속 레벨업 근본 차단 ②심연의탑 난이도 개편: 몬스터 10층마다 체력 ×2·공격력 ×1.5 심층 배율 + 보스 10층마다 등장 ③맵 이동 시 스킬 쿨타임 초기화 버그 근본 수정(전환 직전 기록→새 맵 복원) ④바르가 수비전 몬스터가 게이트로 안 달려오던 버그 수정(코어 진군 AI 신설) ⑤퀘스트 경험치 ×12 리밸런싱(사냥 역전 해소 — 원작처럼 퀘스트가 성장의 주 수단) ⑥씹덕요소 복원: 감정표현 단축키(Y♥·U♪·H！·N💢)·펫 랜덤 감정표현·레벨업 LEVEL UP!! 연출·처치 하트 팝·NPC 대사 카오모지";
const APK_MIRROR =
  /* vc157 — APK는 릴리스 태그 v1.0.15에 있다(v1.0.9 태그는 vc156까지만 보유).
   *  이전엔 v1.0.9 태그를 가리켜 vc157 APK 경로가 404였다. */
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.15/SERTZ-vc157.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
