import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.3.0";
const LATEST_CODE = 178;
const VERSION_NOTE =
  "v1.3.0 (vc178) — 지적 4건과 버그 2건을 고쳤다. ①씹덕 캐릭터가 공포영화 인형처럼 보이던 문제 — 턱 아래 어두운 띠(복화술 인형의 턱 절개선처럼 보였다)를 없애고 눈 하이라이트를 키웠으며 볼터치를 옅게 줄였다. ②씹덕 캐릭터를 마을마다 1명만 배치한다(마을 10곳에 6종이 고르게 나뉜다). ③해적 계열 스킬이 전부 안 되던 문제 — 1차 해적이 스킬표에 없어 전사 스킬이 나갔고 5차 궁극기 2종이 도적 스킬로 떨어졌다. 전용 스킬과 궁극기(만조·폭풍항로)를 새로 연결했다. ④집 꾸미기를 만들었다 — 마을 내 집에 들어가 우측 하단 꾸미기에서 가구 8종을 사서 배치·회수할 수 있고 배치는 저장된다. ⑤해적 기본공격·스킬이 조준 방향에 따라 이펙트가 안 바뀌던 버그 — 탄환이 회전하지 않아 위아래로 쏴도 가로로 누워 있었고 총구 화염도 방향이 없었다. 방향성 머즐과 탄환 회전을 넣었다.";
const APK_MIRROR =
  /* vc177 — APK는 릴리스 태그 v1.2.5에 있다(이전 태그는 vc176까지 보유). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.3.0/SERTZ-vc178.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
