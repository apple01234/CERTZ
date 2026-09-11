"use client";

/**
 * v4.9.0 — 계정 클라이언트 (유저 지시 #4: 자체 회원가입/로그인 + SNS 연동 + 클라우드 세이브)
 *  서버: accounts/index.js (같은 오리진 /api/auth/*) — 쿠키 세션이라 credentials 필수는 아님
 *  (same-origin fetch는 기본으로 쿠키 전송) — APK 웹뷰/웹 공통.
 * v1.0.3 (#거래소크래시) — APK/EXE 네이티브에서는 same-origin(웹뷰 내장 서버)에 /api 서버가 없어
 *  인증·거래소·클라우드 세이브가 전부 실패(또는 HTML 폴백 → JSON 파싱 실패)했다.
 *  → 멀티플레이 서버 주소(localStorage sertz.server.url, net.ts와 동일 출처)를 API base로 사용.
 *  웹은 기존대로 same-origin. 모든 fetch 경로에 apiBase()를 접두한다.
 * v1.0.7 (#APK로그인) — APK 웹뷰(https://localhost)에선 크로스오리진이라 ① POST+JSON 프리플라이트가
 *  서버 무CORS로 전부 실패하고 ② SameSite=Lax 쿠키가 저장/전송되지 않아 로그인 세션이 유지되지 않았다.
 *  → 서버가 CORS+OPTIONS를 응답하고 로그인/가입 응답 본문에 token을 동봉한다.
 *    클라는 token을 localStorage에 저장해 Authorization: Bearer 로 전송한다 (웹은 쿠키 병행, 기존 동작 유지).
 * v1.0.15 (#로그인안됨3차) — 근본 원인: 기본 서버 sertz4가 v1.0.7 중간 상태(스테일)로 server.js에
 *  OPTIONS 프리플라이트 핸들러가 없다 → APK 웹뷰(https://localhost)의 POST+application/json은
 *  프리플라이트(OPTIONS)가 Next 폴백 404 HTML로 떨어져 전부 실패 — "채팅(WS)은 되는데 로그인이 안 됨".
 *  → 모든 POST를 Content-Type: text/plain;charset=UTF-8 (CORS 세이프리스트)으로 보내
 *  단순 요청(simple request)으로 강등해 프리플라이트 자체를 제거. readBody는 JSON.parse만 하므로
 *  서버(구·신 모두) 무수정 호환 — sertz4 실측 200+토큰 확인. 웹 same-origin은 영향 없음.
 *  부수: 로그인 성공 유저를 localStorage에 캐시 — 구서버에선 Bearer GET(/me)도 프리플라이트로
 *  막혀 패널 재오픈 시 로그아웃처럼 보이는 것을 캐시로 보완.
 */

import { Capacitor } from "@capacitor/core";

/* v1.0.7 — Bearer 세션 토큰 저장소 (APK 웹뷰 쿠키 불가 대응; 웹은 쿠키가 우선이라 없어도 됨) */
const TOKEN_KEY = "sertz.auth.token";
/* v1.0.15 — 로그인 유저 캐시: 구서버(stale)에선 Bearer GET(/me)도 프리플라이트 404로 실패해
 *  패널을 다시 열면 로그아웃 상태처럼 보였다. 마지막 로그인 유저를 저장해 /me 실패 시 대신 표시. */
const USER_KEY = "sertz.auth.user";
function getToken(): string {
  try { return window.localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
function setToken(t: string) {
  try {
    if (t) window.localStorage.setItem(TOKEN_KEY, t);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch { /* 무시 */ }
}
/** v1.0.15 — 마지막 로그인 유저 캐시 조회 (/me 실패 폴백용) */
export function getCachedUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw || !getToken()) return null; // 토큰이 없으면 캐시도 무효
    const u = JSON.parse(raw) as AuthUser;
    return u?.id ? u : null;
  } catch { return null; }
}
function setCachedUser(u: AuthUser | null) {
  try {
    if (u) window.localStorage.setItem(USER_KEY, JSON.stringify(u));
    else window.localStorage.removeItem(USER_KEY);
  } catch { /* 무시 */ }
}
/** SNS 콜백 리다이렉트(/?sns=ok#auth_token=…)의 토큰을 저장하고 해시를 제거 — 패널 마운트 시 1회 호출 */
export function consumeAuthTokenFromHash(): void {
  try {
    const h = window.location.hash || "";
    const m = h.match(/auth_token=([A-Za-z0-9]+)/);
    if (m) {
      setToken(m[1]);
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  } catch { /* 무시 */ }
}

/** 계정/거래소 API 베이스 URL — 웹 ""(same-origin) · APK/EXE 설정된 게임 서버 주소 */
function apiBase(): string {
  try {
    if (Capacitor.isNativePlatform() || /electron/i.test(navigator.userAgent)) {
      const raw = window.localStorage.getItem("sertz.server.url");
      const u = raw?.trim();
      if (u && /^https?:\/\//i.test(u)) return u.replace(/\/$/, "");
    }
  } catch {
    /* localStorage 접근 불가 — same-origin 폴백 */
  }
  return "";
}

export type AuthUser = { id: string; name: string; provider: string; createdAt?: number; /** v1.0.2 — 서버 검증 롤 (admin만 GM 진입) */ role?: string };
export type SnsProviders = Record<string, { name: string; configured: boolean }>;

async function post(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const tok = getToken(); // v1.0.7 — Bearer 세션 (쿠키 불가 환경: APK 웹뷰)
    /* v1.0.15 — text/plain은 CORS 세이프리스트라 프리플라이트가 발생하지 않는다(단순 요청).
     *  구서버(stale sertz4) OPTIONS 404에서도 로그인/가입이 통과된다. 본문은 JSON 문자열 그대로 —
     *  서버 readBody는 Content-Type을 검사하지 않는다(실측 확인). */
    const r = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (r.status === 401) setToken(""); // 만료/무효 토큰 정리
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "서버에 연결할 수 없어요" } };
  }
}

async function get(path: string): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const tok = getToken(); // v1.0.7 — Bearer 세션
    const r = await fetch(`${apiBase()}${path}`, {
      cache: "no-store",
      ...(tok ? { headers: { Authorization: `Bearer ${tok}` } } : {}),
    });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (r.status === 401) setToken("");
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "서버에 연결할 수 없어요" } };
  }
}

export async function authMe(): Promise<AuthUser | null> {
  const r = await get("/api/auth/me");
  const u = (r.data.user as AuthUser) ?? null;
  if (u) setCachedUser(u); // v1.0.15 — /me 성공 시 캐시 최신화
  /* v1.0.15 — 구서버에선 Bearer GET도 프리플라이트 404로 실패한다. 토큰이 살아있고
   *  캐시된 유저가 있으면 그걸로 대신 로그인 상태를 유지한다(오프라인 폴백과 동일 원리). */
  return u ?? getCachedUser();
}

export async function authRegister(id: string, pw: string, name: string) {
  const r = await post("/api/auth/register", { id, pw, name });
  if (r.ok && typeof r.data.token === "string") setToken(r.data.token); // v1.0.7 — Bearer 세션 저장
  if (r.ok && r.data.user) setCachedUser(r.data.user as AuthUser); // v1.0.15 — 유저 캐시
  return r;
}

export async function authLogin(id: string, pw: string) {
  const r = await post("/api/auth/login", { id, pw });
  if (r.ok && typeof r.data.token === "string") setToken(r.data.token); // v1.0.7 — Bearer 세션 저장
  if (r.ok && r.data.user) setCachedUser(r.data.user as AuthUser); // v1.0.15 — 유저 캐시
  return r;
}

export async function authLogout() {
  const r = await post("/api/auth/logout");
  setToken(""); // v1.0.7 — 로컬 토큰 정리 (성공 여부 무관)
  setCachedUser(null); // v1.0.15 — 유저 캐시 정리
  return r;
}

export async function fetchSnsProviders(): Promise<SnsProviders> {
  const r = await get("/api/auth/sns");
  return (r.data.providers as SnsProviders) ?? {};
}

/** 클라우드 세이브 백업 — 게임 세이브 객체를 그대로 저장 */
export async function cloudSaveUpload(data: unknown): Promise<{ ok: boolean; error?: string; updatedAt?: number }> {
  const r = await post("/api/auth/cloud-save", { data });
  if (!r.ok) return { ok: false, error: String(r.data.error ?? "백업 실패") };
  return { ok: true, updatedAt: r.data.updatedAt as number };
}

/** 클라우드 세이브 복원 — 저장된 세이브 객체 반환 (없으면 null) */
export async function cloudSaveDownload(): Promise<{ ok: boolean; data: unknown; error?: string }> {
  const r = await get("/api/auth/cloud-save");
  if (!r.ok) return { ok: false, data: null, error: String(r.data.error ?? "복원 실패") };
  return { ok: true, data: r.data.data ?? null };
}

/* ================= v1.0.1 — 유저 거래판 (마켓) 클라이언트 =================
 *  서버: /api/market (accounts/index.js) — 로그인 쿠키 세션 기반.
 *  등록/구매/취소/수령 성공 시 클라이언트가 세이브(골드/보유)를 조작한다 — 서버는 ledger만. */

export type MarketListing = { id: string; seller: string | null; mine: boolean; itemKey: string; up: number; price: number; ts: number };
export type MarketState = {
  listings: MarketListing[];
  pending: { gold: number; count: number };
  feePct: number;
  maxListings: number;
  guest?: boolean;
};

export async function marketGet(): Promise<{ ok: boolean; error?: string; state?: MarketState }> {
  const r = await get("/api/market");
  if (!r.ok) return { ok: false, error: String(r.data.error ?? "거래판 조회 실패") };
  /* v1.0.3 (#거래소크래시) — listings 배열이 없는 응답(HTML 폴백·구버전 서버)은 state로 취급하지 않는다.
   *  기존엔 빈 객체가 그대로 state가 돼 mk.listings.filter에서 앱 크래시로 이어졌다. */
  const d = r.data as Partial<MarketState> | null;
  if (!d || !Array.isArray(d.listings)) return { ok: false, error: "거래판 응답이 올바르지 않아요" };
  return { ok: true, state: d as MarketState };
}

export async function marketList(itemKey: string, up: number, price: number) {
  return post("/api/market/list", { itemKey, up, price });
}

export async function marketCancel(id: string) {
  return post("/api/market/cancel", { id });
}

export async function marketBuy(id: string) {
  return post("/api/market/buy", { id });
}

export async function marketCollect() {
  return post("/api/market/collect", {});
}
