import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.1.1";
const LATEST_CODE = 162;
const VERSION_NOTE =
  "v1.1.1 (vc162) — 유저 지시 4건 반영: ①회피(구르기) 기능을 완전히 제거했다(Space 키·모바일 버튼·키 설정 항목 포함). ②어두운 지역에 밝은 BGM이 나오던 배정 오류를 고쳤다 — 이제 챕터 정서를 먼저 정하고 그 정서의 곡만 쓴다(설원·동굴·룬광산·저승·세계수뿌리에는 느리고 어두운 곡만, 밝은 로비·서커스·아침 곡은 배제). ③10구역 중 3구역마다 BGM이 바뀐다(1~3/4~6/7~9 각각 다른 곡 + 10구역 보스 전용). ④BGM 51슬롯을 스테이지 분위기에 맞춰 전면 재배정했다. 곡별 RMS 실측(-20.0~-13.0dB) 게인 보정 유지.";
const APK_MIRROR =
  /* vc159 — APK는 릴리스 태그 v1.0.17에 있다(이전 태그는 vc158까지 보유). */
  "https://github.com/apple01234/CERTZ/releases/download/v1.1.1/SERTZ-vc162.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
