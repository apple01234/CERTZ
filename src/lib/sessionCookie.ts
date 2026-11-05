/**
 * vc251 — 세션 쿠키 직렬화 (순수 모듈).
 *
 * [왜 sapi.ts 에서 분리했나]
 *  sapi.ts 는 `next/server` 를 import 하므로 Node 테스트에서 직접 로드할 수 없다.
 *  그런데 "Electron(http)에서는 Secure 를 빼고, https 에서는 붙인다"는 판정은
 *  **틀리면 PC 로그인이 통째로 죽거나(빼야 하는데 안 뺌) 세션이 평문으로 흐르는(붙여야 하는데 안 붙임)**
 *  보안 경계라서 반드시 테스트로 고정해야 한다.
 *  → 쿠키 문자열 생성만 여기로 떼어내 순수 함수로 만들고, sapi.ts 가 이를 재-export 한다.
 */

export const COOKIE = "sertz_auth";
export const TOKEN_TTL_MS = 14 * 24 * 3600 * 1000; // 14일

/** 요청이 실제로 https 로 서빙됐는가.
 *
 *  우선순위:
 *   1) `x-forwarded-proto` — Vercel 등 프록시 뒤에서는 이 헤더가 진짜 스킴을 알려준다
 *      (값이 "https,http" 처럼 체인일 수 있어 첫 값만 본다).
 *   2) 헤더가 없으면 요청 URL 의 프로토콜 (로컬 dev·Electron 은 http).
 *   3) 판단 불가하면 **true(안전한 쪽)** — Secure 를 붙이는 쪽이 기본값이다.
 */
export function isHttpsRequest(headersGet?: (name: string) => string | null, url?: string): boolean {
  const proto = (headersGet?.("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
  if (proto) return proto === "https";
  if (url) {
    try {
      return new URL(url).protocol === "https:";
    } catch {
      return true;
    }
  }
  return true;
}

/** 세션 쿠키. Electron 의 http://127.0.0.1 오리진에서는 Secure 를 붙이지 않는다. */
export function sessionCookieString(token: string, https: boolean): string {
  const secure = https ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${TOKEN_TTL_MS / 1000}`;
}

/** 삭제 쿠키 — sessionCookieString 과 **같은 Secure 규칙**을 써야 http 오리진에서도 지워진다. */
export function clearCookieString(https: boolean): string {
  const secure = https ? "; Secure" : "";
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`;
}
