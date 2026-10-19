import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.18";
const LATEST_CODE = 160;
const VERSION_NOTE =
  "v1.0.18 (vc160) — 재미·디자인·BGM 3축 개선: ①회피(구르기) 신설 — Space 키/모바일 회피 버튼. MP 소모 없는 짧은 쿨 기동으로 무적 280ms가 붙어 보스 패턴을 보고 피하는 능동 전투가 가능해졌다(기존엔 회피 입력 자체가 없어 '맞고 물약'으로 수렴). ②BGM 재배치 — 44곡 중 14곡이 미재생이었고 쿠소디아 필드가 타이틀곡을 재사용했다. 챕터 필드곡을 전부 고유곡으로 교체(필드 중복 0). ③BGM 음량 정규화 — 44곡 RMS 실측 편차 5.3dB를 곡별 게인으로 보정(구역 전환 시 음량이 튀던 문제). ④타이틀 정리 — 라이선스 원문 3줄을 접이식 1줄로, 버전 배지의 기능 나열을 게임 소개 문구로 교체";
const APK_MIRROR =
  /* vc159 — APK는 릴리스 태그 v1.0.17에 있다(이전 태그는 vc158까지 보유). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.18/SERTZ-vc160.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
