import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.2.3";
const LATEST_CODE = 175;
const VERSION_NOTE =
  "v1.2.3 (vc175) — 마을에 씹덕 스타일 NPC 6명이 생겼다. 안내원 리리(금발 리본), 학자 미오(은발 안경), 마법사 린(보라 쌍둥이꼬리), 상인 냥(고양이귀), 마녀 닉스(뾰족 모자), 요정 아리아(날개). 32x48 픽셀아트로 직접 그렸고, 큰 눈과 볼터치를 넣되 기존 NPC와 같은 픽셀 밀도·SD 비율·1px 외곽선 규칙을 지켜 이질감이 없게 했다. 저마다 위상이 다른 숨쉬기 모션과 3초 주기 말풍선이 붙어 마을이 살아있는 느낌을 준다. 감정표현 이모지는 빈도가 너무 높다는 지적을 반영해 크게 줄였다. 원인은 두 가지였다 — 처치할 때마다 14% 확률로 무제한 발생했고, emote()에 아무 쿨다운이 없었다. 확률을 4%로 낮추고 최소 간격 1.6초·동시 표시 2개 상한을 걸었다. 12분 사냥 기준 85회에서 19회로 78% 줄었다.";
const APK_MIRROR =
  /* vc159 — APK는 릴리스 태그 v1.0.17에 있다(이전 태그는 vc158까지 보유). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.1.5/https://github.com/apple01234/CERTZ/releases/download/v1.1.8/SERTZ-vc170.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
