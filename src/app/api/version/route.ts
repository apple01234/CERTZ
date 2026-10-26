import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.4.1";
const LATEST_CODE = 190;
const VERSION_NOTE =
  "v1.4.1 (vc190) — ①최적화가 퀄리티를 깎지 않도록 수리(사용자 지침): 코스튬을 온디맨드로 돌린 뒤 캐릭터가 1프레임에 얼어붙던 3중 버그를 잡았다 — tickBodyPending 호출부 0건(대화 중 게이트에 막힘)·loadBodyPrefix/applyBodyLook 이 idle0 한 장만 있어도 '로드 완료'로 오판해 나머지 27프레임을 영구 미로드. 이제 필요한 프레임이 전부 있어야 완료로 본다. 실측 3종 28/28·4/4·OK. ②부팅 에셋 3,325→1,525건(54%↓, 37.3→36.0MB): 타이틀이 65종×28프레임 1,820건을 일괄 로드하던 것을 착용 외형만 받도록 원복. 나머지는 그 외형을 입는 순간 로드. ③WorldScene 분할 3차(cameraFx·spawnPoints·fxAtoms) — 스모크 3종으로 회귀 0 확인. ④부팅 측정 함정 정정: performance Resource Timing 버퍼 기본 250개 — 안 키우면 '250건'이 측정치로 둔갑한다(20,000으로 확장 후 실측). 회귀: boot 5/5 · combat 6/6 · save 7/7 · tsc 0 · eslint 0.";
const APK_MIRROR =
  /* vc179 — APK는 릴리스 태그 v1.3.1에 있다. */
  "https://github.com/apple01234/CERTZ/releases/download/v1.4.1/SERTZ-vc190.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
