import { NextRequest, NextResponse } from "next/server";

/**
 * 웹 플레이 정책 — PC(데스크톱) 웹 플레이 복귀 (2026-10-06, 유저 지시)
 *
 *  경위: 2026-10-04 대역폭 절감을 위해 외부 호스트의 "/" 접근을 전부 APK 안내로
 *        리다이렉트했다. 유저 요청("PC에서도 즐기게")으로 데스크톱 브라우저는
 *        웹에서 바로 플레이할 수 있도록 복귀.
 *
 *  정책: 모바일 브라우저(Android/iPhone 등 Mobi UA)는 /apk-guide.html로 리다이렉트 —
 *        네이티브 앱이 최적 경험이고 셀룰러 133MB 에셋 낭비 방지.
 *        데스크톱 UA는 게임을 그대로 서빙. iPad는 UA가 Macintosh라 데스크톱 취급(웹 허용).
 *
 *  유지: /api/*(계정·거래소·랭킹·채팅·파티·버전), /apk-guide.html, /support, /privacy
 *        — matcher가 "/" 한정이라 자연 유지된다.
 *
 *  예외: localhost 계열(로컬 개발·EXE same-origin server.js), *.space-z.ai(개발·QA 프리뷰)
 *        은 UA 무관하게 게임을 서빙한다.
 *
 *  APK 무영향: 네이티브 웹뷰는 https://localhost(번들 에셋)에서 실행 — 이 엔드포인트에
 *        접속하지 않고, export 빌드 때 이 파일 자체를 격리한다(build_apk.sh).
 *
 *  모바일 웹도 완전 개방하려면: 이 파일을 삭제(또는 matcher 비우기)하고 재배포.
 */

const SKIP_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);
const SKIP_SUFFIXES = [".localhost", ".space-z.ai"];
const MOBILE_UA = /Android|iPhone|iPod|Windows Phone|IEMobile|BlackBerry|webOS|Opera Mini|\bMobi\b/i;

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
  const ua = req.headers.get("user-agent") || "";
  if (!MOBILE_UA.test(ua)) {
    return NextResponse.next(); // 데스크톱(PC) — 웹 플레이 허용
  }
  const url = req.nextUrl.clone();
  url.pathname = "/apk-guide.html";
  url.search = "";
  return NextResponse.redirect(url, 307);
}

export const config = { matcher: ["/"] };
