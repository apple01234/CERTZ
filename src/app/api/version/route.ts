import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.2.2";
const LATEST_CODE = 174;
const VERSION_NOTE =
  "v1.2.2 (vc174) — 소리와 밸런스를 실측으로 다시 잡았다. ①효과음 100개 전수 측정 결과 음량이 -91dB부터 -5dB까지 85.9dB 벌어져 있었고 19개는 파형이 잘리는 클리핑 상태였다. 피크 -1dBFS 기준으로 정규화해 클리핑 0개, 편차 12.9dB로 줄였다. 완전 무음이던 질풍 스킬 소리(1.18초 통짜 무음)도 복구했고, 볼륨 지정이 없어 최대 음량으로 터지던 10개도 채웠다. BGM 51곡은 이미 -16.5dB로 완벽히 맞아 있어 손대지 않았다. ②게임 밸런스는 두 축이 무너져 있었다. 적을 죽이는 데 1.1타(2~3챕터 즉사)부터 63.6타(7~10챕터)까지 벌어졌고, 레벨업에 필요한 처치 수는 25마리부터 210만마리까지 차이 났다(130레벨 이후 사실상 레벨업 불가). 챕터 HP·EXP 계수를 레벨 곡선에 맞춰 다시 계산해 타격 수 1.6~24타, 처치 수 35~807마리로 좁혔다. 후반 지역일수록 몬스터 경험치가 크게 오르도록 계수를 지수로 올려(35 → 2,733,600) 상위 사냥터를 갈 이유를 만들었다.";
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
