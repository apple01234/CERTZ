/**
 * v1.4.22 — serverless 계정 API 공용 헬퍼 (②안 Vercel 마이그레이션)
 *  accounts/index.js의 프로토콜을 그대로 계승한다:
 *   · CORS 화이트리스트(APK 웹뷰 https://localhost + *.vercel.app + *.space-z.ai + SERTZ_ORIGIN)
 *   · 토큰 3중 경로: Authorization Bearer → 쿠키(sertz_auth) → ?token= 쿼리(네이티브 프리플라이트 회피)
 *   · scrypt 솔트 해시(기존 계정 해시 그대로 검증 가능) · 30일 세션 · 관리자 롤(env)
 *   · 레이트리밋(인스턴스 단위 — 베스트에포트, 플랫폼 DDoS 방어와 병행)
 */

import { NextRequest, NextResponse } from "next/server";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import type { DbShape, UserRec, ListingRec } from "./ghdb";

export const COOKIE = "sertz_auth";
export const TOKEN_TTL_MS = 30 * 24 * 3600 * 1000; // 30일
/* v1.0.2 계승 — 관리자 아이디 목록 (env, 쉼표 구분. 기본 admin·apple01234) */
export const ADMIN_USERS = (process.env.SERTZ_ADMIN_USERS || "admin,apple01234")
  .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
export const MARKET_FEE_PCT = 10;
export const MARKET_MAX_LISTINGS = 3;
/* v1.0.6 계승 — 등록 가능 아이템 화이트리스트(보스 전용 드롭) */
export const MARKET_LISTABLE = new Set([
  "bd_guardian", "bd_behemoth", "bd_nidhog", "bd_surt", "bd_fenrir",
  "bd_skoll", "bd_gram", "bd_abysslord", "bd_abudditos",
]);

/* ---------------- CORS (계승: originAllowed + suffixes) ---------------- */
const CORS_ALLOWED_ORIGINS = new Set([
  "https://localhost", "http://localhost", "https://localhost:3000", "http://localhost:3000",
  ...(String(process.env.SERTZ_ORIGIN || "") ? String(process.env.SERTZ_ORIGIN).split(",").map((s) => s.trim()).filter(Boolean) : []),
]);
const CORS_ALLOW_SUFFIXES = [".vercel.app", ".space-z.ai"];

function originAllowed(origin: string): boolean {
  if (CORS_ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const h = new URL(origin).hostname.toLowerCase();
    return CORS_ALLOW_SUFFIXES.some((s) => h.endsWith(s) && h.length > s.length);
  } catch {
    return false;
  }
}

const CORS_BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  if (origin && originAllowed(origin)) {
    return { ...CORS_BASE_HEADERS, "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  }
  return { ...CORS_BASE_HEADERS };
}

/** JSON 응답 (CORS + no-store 자동 부착) */
export function json(req: NextRequest, status: number, body: unknown, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body as object, {
    status,
    headers: { "Cache-Control": "no-store", ...corsHeaders(req), ...headers },
  });
}

/** 프리플라이트 — 모든 /api/auth·market·rank 라우트에 부착 */
export function options(req: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

/* ---------------- 쿠키/토큰 ---------------- */
export function parseCookies(req: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function extractToken(req: NextRequest): string {
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const c = parseCookies(req)[COOKIE];
  if (c) return c;
  try {
    const qt = req.nextUrl.searchParams.get("token") || "";
    if (/^[A-Za-z0-9]{16,128}$/.test(qt)) return qt;
  } catch { /* 무시 */ }
  return "";
}

export function sessionCookie(token: string): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${TOKEN_TTL_MS / 1000}`;
}
export function clearCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

/* ---------------- 유저/세션 ---------------- */
export function hashPw(pw: string, salt: string): string {
  return scryptSync(String(pw), salt, 64).toString("hex");
}

export function publicUser(u: UserRec | null) {
  return u ? { id: u.id, name: u.name, provider: u.provider, createdAt: u.createdAt, role: u.role === "admin" ? "admin" : "user" } : null;
}

export function currentUser(db: DbShape, req: NextRequest): UserRec | null {
  const token = extractToken(req);
  if (!token) return null;
  const t = db.tokens[token];
  if (!t || t.expiresAt < Date.now()) return null; // 만료 정리는 쓰기 경로에서 일괄
  return db.users[t.userId] || null;
}

export function isAdminUser(u: UserRec | null): boolean {
  return !!u && (u.role === "admin" || ADMIN_USERS.includes(String(u.name || "").toLowerCase()));
}

export function issueToken(db: DbShape, user: UserRec): { token: string; cookie: string } {
  const token = randomBytes(32).toString("hex");
  db.tokens[token] = { userId: user.id, expiresAt: Date.now() + TOKEN_TTL_MS };
  if (Object.keys(db.tokens).length > 4000) {
    const now = Date.now();
    for (const k of Object.keys(db.tokens)) if (db.tokens[k].expiresAt < now) delete db.tokens[k];
  }
  return { token, cookie: sessionCookie(token) };
}

/* ---------------- 레이트리밋 (인스턴스 단위 베스트에포트) ---------------- */
const buckets = new Map<string, { n: number; resetAt: number }>();

export function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "?";
}

export function rateLimit(req: NextRequest, bucket: string, max: number, windowMs: number): boolean {
  const key = `${clientIp(req)}:${bucket}`;
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt < now) { b = { n: 0, resetAt: now + windowMs }; buckets.set(key, b); }
  b.n++;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  return b.n <= max;
}

/* ---------------- 감사 로그 (파일 대신 콘솔 — Vercel 로그로 수집) ---------------- */
export function audit(event: string, detail: Record<string, unknown> = {}): void {
  console.log(`[SERTZ-audit] ${JSON.stringify({ ts: Date.now(), event, ...detail })}`);
}

/* ---------------- 거래소 스냅샷 (계승) ---------------- */
export function marketSnapshot(db: DbShape, uid: string | null) {
  const all = Object.values(db.market.listings).sort((a: ListingRec, b: ListingRec) => a.ts - b.ts);
  if (!uid) {
    return {
      listings: all.map((l) => ({ id: l.id, seller: l.sellerName, mine: false, itemKey: l.itemKey, up: l.up ?? 0, price: l.price, ts: l.ts })),
      pending: { gold: 0, count: 0 },
      feePct: MARKET_FEE_PCT,
      maxListings: MARKET_MAX_LISTINGS,
      guest: true,
    };
  }
  const pay = db.payouts[uid] || { gold: 0, count: 0 };
  return {
    listings: all.map((l) => ({ id: l.id, seller: l.seller === uid ? null : l.sellerName, mine: l.seller === uid, itemKey: l.itemKey, up: l.up ?? 0, price: l.price, ts: l.ts })),
    pending: { gold: pay.gold || 0, count: pay.count || 0 },
    feePct: MARKET_FEE_PCT,
    maxListings: MARKET_MAX_LISTINGS,
  };
}

/** v1.0.6 계승 — 등록자 실보유 검증(클라우드 세이브 owned + 장착 accessories) */
export function ownsListableItem(db: DbShape, uid: string, itemKey: string): { ok: boolean; error?: string } {
  if (!MARKET_LISTABLE.has(itemKey)) return { ok: false, error: "보스 전용 드롭(전설)만 등록할 수 있어요" };
  const save = db.saves[uid]?.data;
  if (!save || typeof save !== "object") return { ok: false, error: "클라우드 세이브 동기화 후 등록할 수 있어요 — 로그인 상태로 잠시 플레이하거나 계정 패널에서 백업해 주세요" };
  const owned = Array.isArray(save.owned) ? save.owned : [];
  if (!owned.includes(itemKey)) return { ok: false, error: "보유하지 않은 아이템은 등록할 수 없어요" };
  const acc = Array.isArray(save.accessories) ? save.accessories : [];
  if (acc.includes(itemKey)) return { ok: false, error: "장착 중인 장비는 해제한 뒤 등록하세요" };
  return { ok: true };
}

/* ---------------- 랭킹 (계승: 환생·탑·레벨·exp 정렬, GM 제외) ---------------- */
function rankScore(s: { data?: Record<string, unknown> } | undefined): number[] {
  const inf = (s?.data?.inf || {}) as Record<string, unknown>;
  return [Number(inf.rebirths || 0), Number(inf.towerBest || 0), Number(s?.data?.lv || 0), Number(s?.data?.exp || 0)];
}
function rankBetter(a: { data: Record<string, unknown> }, b: { data: Record<string, unknown> }): boolean {
  const sa = rankScore(a), sb = rankScore(b);
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sa[i] > sb[i];
  return false;
}
export function rankListFor(db: DbShape, me: UserRec | null) {
  const all: { uid: string; data: Record<string, unknown>; name: string }[] = [];
  for (const [uid, s] of Object.entries(db.saves)) {
    if (!s?.data || typeof s.data !== "object") continue;
    if (!Number((s.data as Record<string, unknown>).lv)) continue;
    const u = db.users[uid];
    if (u && u.role === "admin") continue; // GM/관리자 제외 (운영 공정성)
    const d = s.data as Record<string, unknown>;
    all.push({ uid, data: d, name: String(d.playerName || (u ? u.name : "이름없음") || "이름없음").slice(0, 8) });
  }
  all.sort((a, b) => (rankBetter(a, b) ? -1 : rankBetter(b, a) ? 1 : 0));
  const top = all.slice(0, 50).map((e, i) => ({
    rank: i + 1,
    name: e.name,
    lv: Number(e.data.lv || 0),
    cls: String(e.data.cls || ""),
    rebirths: Number((e.data.inf as Record<string, unknown> || {})?.rebirths || 0),
    tower: Number((e.data.inf as Record<string, unknown> || {})?.towerBest || 0),
  }));
  let mine = null;
  if (me) {
    const idx = all.findIndex((e) => e.uid === me.id);
    if (idx >= 0) {
      const e = all[idx];
      mine = { rank: idx + 1, total: all.length, name: e.name, lv: Number(e.data.lv || 0), rebirths: Number((e.data.inf as Record<string, unknown>)?.rebirths || 0), tower: Number((e.data.inf as Record<string, unknown>)?.towerBest || 0) };
    } else {
      mine = { rank: 0, total: all.length, note: "클라우드 백업(3분 자동)이 켜지면 랭킹에 등록돼요" };
    }
  }
  return { list: top, me: mine };
}
