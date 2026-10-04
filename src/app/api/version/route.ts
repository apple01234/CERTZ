import { NextResponse } from "next/server";

/* v1.0.17 버전 게이트의 서버리스(Vercel) 대응 라우트.
 *  - server.js(커스텀 서버)가 살아있는 셀프호스트/플랫폼 배포에서는 server.js가
 *    /api/version을 먼저 가로채므로 이 라우트는 도달하지 않는다(무해).
 *  - Vercel 등 서버리스 배포에서는 이 라우트가 응답한다.
 *  - server.js의 LATEST_VERSION/VERSION_NOTE/APK_MIRROR 와 수동 싱크 유지 (1.0.0-beta 기준).
 *  - force-static: 버전 응답은 빌드 시점에 고정이므로 정적 프리렌더로 무료 서빙. */
export const dynamic = "force-static";

const LATEST_VERSION = "1.0.2-beta";
const LATEST_CODE = 123;
const VERSION_NOTE =
  "v1.0.2-beta — 구글 로그인·초반 브금·조작UI 복귀: ①구글 통합 로그인(Firebase Auth — 앱 네이티브 구글창·웹 팝업, 서버 ID토큰 검증 후 기존 계정 체계와 동일 세션) ②초반 1~3챕터 BGM 3곡 오리지널 합성 음원 교체(bgm_village1·field1·title2) ③조작 UI 배치 예전 형태 복귀(우하단 [자동+물약][스킬][공격] 행 — 버튼 색·모양은 유지) ④ads.txt/app-ads.txt 배포(pub-5675573589406258) ⑤Firebase Analytics·Crashlytics 연동 준비 · 구글로그인 설정 가이드: download/결제_광고_연동_가이드.txt";
const APK_MIRROR =
  "https://github.com/apple01234/CERTZ/releases/download/v1.0.2-beta/SERTZ-v1.0.2-beta.apk";

export async function GET() {
  return NextResponse.json({
    latest: LATEST_VERSION,
    code: LATEST_CODE,
    note: VERSION_NOTE,
    apk: APK_MIRROR,
    guide: "/apk-guide.html",
  });
}
