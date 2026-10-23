import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.1.0";
const LATEST_CODE = 161;
const VERSION_NOTE =
  "v1.1.0 (vc161) — BGM 전면 교체: 유튜브 「어항 앞에 마우스」의 AI 테마 플레이리스트에서 곡을 선별해 게임 전체 BGM을 새로 채웠다. 필드 9챕터 고유곡·마을 6곡 순환·보스 5곡(전부 다른 원곡, 기존 피치 변형 폐기)·타이틀/실내/수중/전투 전용곡까지 25슬롯. 곡마다 음량을 실측해 게인을 맞춰(편차 5.6dB→0) 구역 전환 시 음량이 튀지 않는다. 기존 Kevin MacLeod 51곡은 제거(BGM 용량 160MB→61MB).";
const APK_MIRROR =
  /* vc159 — APK는 릴리스 태그 v1.0.17에 있다(이전 태그는 vc158까지 보유). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.1.0/SERTZ-vc161.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
