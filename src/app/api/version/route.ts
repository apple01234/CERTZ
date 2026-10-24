import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.2.4";
const LATEST_CODE = 176;
const VERSION_NOTE =
  "v1.2.4 (vc176) — 지적 7건을 모두 고쳤다. ①공동 토벌전을 끝내도 나갈 포탈이 없던 버그(토벌전 구역은 보스 스테이지가 아니라 포탈 생성 조건에서 빠져 있었다). ②스킬 쿨이 돌아올 때 나오던 이상한 폭발 효과를 발밑의 은은한 빛으로 교체했다. ③씹덕 NPC가 나무·건물에 가려지고 말을 걸 수 없던 문제(그리기 순서를 올리고 상호작용 목록에 등록). ④NPC 해상도를 32x48에서 64x96으로 두 배 올려 다시 그렸다(눈의 흰자·홍채·동공·반사광, 목과 턱 그림자, 옷 주름, 신발까지). ⑤해적이 총을 쓴다 — 레이더는 관통 탄환을 쏘고 3차부터 3점사, 코세어는 쏘고 파고들어 베는 총검술이 됐다. ⑥무기에 직업 제한이 없어 아무나 아무 무기를 착용하던 문제를 고쳤고, 궁수·해적 전용 무기 6종을 새로 만들었다. ⑦기본공격이 계열마다 달라졌다 — 해적은 총격, 궁수는 화살, 전사·도적은 참격.";
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
