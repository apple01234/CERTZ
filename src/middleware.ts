import { NextRequest, NextResponse } from "next/server";

/**
 * 웹 플레이 종료·앱 전환 정책 — 서버 비용 절감 (2026-10-04)
 *
 *  배경: APK는 번들 에셋(135MB)을 기기에서 로컬 실행하므로 서버 부담이 전혀 없다.
 *        반면 웹 브라우저 플레이어는 /assets(133MB)+게임 JS를 Vercel 대역폭으로
 *        내려받는다 — 서버 비용의 사실상 전부.
 *  정책: 외부 호스트에서 게임 엔트리("/") 접속 시 앱 다운로드 안내(/apk-guide.html)로
 *        리다이렉트한다 — 에지에서 차단하므로 게임 JS·에셋 대역폭은 0이 된다.
 *  유지: /api/*(계정·거래소·랭킹·채팅·파티·버전), /apk-guide.html, /support, /privacy
 *        — matcher가 "/" 한정이라 자연 유지된다.
 *  예외: localhost 계열(로컬 개발·EXE same-origin server.js), *.space-z.ai(개발·QA 프리뷰)
 *        은 그대로 게임을 서빙한다.
 *  APK 무영향: 네이티브 웹뷰는 https://localhost(번들 에셋)에서 실행 — 이 엔드포인트에
 *        접속하지 않는다. 계정 API(DEFAULT_API_BASE)도 /api/*라 무관.
 *  복구 방법: 이 파일을 삭제(또는 matcher 비우기)하고 재배포하면 웹 플레이가 복귀한다.
 */

const SKIP_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);
const SKIP_SUFFIXES = [".localhost", ".space-z.ai"];

export function middleware(req: NextRequest) {
  const raw = (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    ""
  ).toLowerCase();
  const host = raw.split(":")[0].trim();
  if (SKIP_HOSTS.has(host) || SKIP_SUFFIXES.some((s) => host.endsWith(s))) {
    return NextResponse.next();
  }
  const url = req.nextUrl.clone();
  url.pathname = "/apk-guide.html";
  url.search = "";
  return NextResponse.redirect(url, 307);
}

export const config = { matcher: ["/"] };
