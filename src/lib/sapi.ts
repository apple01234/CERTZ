/**
 * v1.4.22 — serverless 계정 API 공용 헬퍼 (②안 Vercel 마이그레이션)
 *  accounts/index.js의 프로토콜을 그대로 계승한다:
 *   · CORS 화이트리스트(APK 웹뷰 https://localhost + *.vercel.app + *.space-z.ai + SERTZ_ORIGIN)
 *   · 토큰 3중 경로: Authorization Bearer → 쿠키(sertz_auth) → ?token= 쿼리(네이티브 프리플라이트 회피)
 *   · scrypt 솔트 해시(기존 계정 해시 그대로 검증 가능) · 14일 세션 · 관리자 롤(env)
 *   · v1.0.16 (S4) — 세션 토큰은 DB에 SHA-256 해시로만 저장(원문 저장 폐기). 클라 응답 형식 불변.
 *   · 레이트리밋(인스턴스 단위 — 베스트에포트, 플랫폼 DDoS 방어와 병행)
 */

import { NextRequest, NextResponse } from "next/server";
import { scryptSync, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import type { DbShape, UserRec, ListingRec } from "./ghdb";
import { ITEMS } from "@/game/data"; // vc146 (#9) — 거래 가능 품목 동적 구성 (gmOnly만 제외)
import { clsToBranch } from "@/game/classes"; // v1.0.14 피드백#2 — 클래스키 → 계열(8 기본 직업) 정규화

export const COOKIE = "sertz_auth";
/* v1.0.16 (S4) — 세션 TTL 30일 → 14일 단축. 해시 저장과 함께 토큰 유출 시의 실효 창을 절반으로 줄인다. */
export const TOKEN_TTL_MS = 14 * 24 * 3600 * 1000; // 14일

/** v1.0.16 (S4) — 세션 토큰 DB 저장 키. 원문을 절대 저장하지 않고 SHA-256 hex 64자로만 보관한다.
 *  · 클라는 여전히 원문 토큰을 받아 Bearer/쿠키/?token= 으로 제시하고, 서버가 검증 시점에 해시해 대조한다
 *    — 응답 형식·발급 흐름은 전혀 바뀌지 않는다(클라 호환 100%).
 *  · 효과: CERTZ-DB 덤프만으로는 세션 탈취가 불가능하다(256bit 원문 복원 불가). S2의 "토큰 원문 저장"
 *    리스크를 저장소 단에서 제거한다. 쿼리 토큰 경로는 APK 프리플라이트 회피용으로 유지한다.
 *  · 이전 배포의 원문 토큰은 해시 키와 대조되지 않아 자동 무효 — 재로그인 1회 필요(DB 부트스트랩 직후라 비용 최소). */
export function tokenHash(raw: string): string {
  return createHash("sha256").update(String(raw)).digest("hex");
}
/* v1.0.2 계승 — 관리자 아이디 목록 (env, 쉼표 구분. 기본 admin·apple01234) */
export const ADMIN_USERS = (process.env.SERTZ_ADMIN_USERS || "admin,apple01234")
  .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
export const MARKET_FEE_PCT = 10;
export const MARKET_MAX_LISTINGS = 3;
/* v1.0.6 계승 — 등록 가능 아이템 화이트리스트.
 *  vc146 (#9) — 유저 지시 "유저 거래소에서 대부분의 물건 거래 가능하게(엘릭서 등 포함)":
 *  보스 드롭 9종 고정 화이트리스트를 폐지하고, ITEMS 전체에서 GM 전용(gmOnly)만 제외한
 *  전체 목록을 동적으로 구성한다 — 무기/방어구/장신구/물약/엘릭서/스크롤 등 대부분 등록 가능.
 *  장착 중(무기/방어구/장신구)·미보유는 ownsListableItem에서 실보유 검증으로 차단 (기존 유지). */
export const MARKET_LISTABLE: Set<string> = new Set(
  Object.keys(ITEMS).filter((k) => !ITEMS[k as keyof typeof ITEMS]?.gmOnly)
);

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
  const t = db.tokens[tokenHash(token)]; // v1.0.16 (S4) — 키가 해시로 바뀐 것 외 동일
  if (!t || t.expiresAt < Date.now()) return null; // 만료 정리는 쓰기 경로에서 일괄
  return db.users[t.userId] || null;
}

/* v1.0.15 보안 — 관리자 판정은 저장된 role과 env 관리자 **아이디**로만 한다.
 *  종전엔 표시 이름(name)도 비교했는데, register 라우트가 이름을 검증하지 않아
 *  name="admin"으로 가입하면 관리자 권한을 얻는 권한 상승 경로가 있었다.
 *  이름은 유저가 자유롭게 정할 수 있으므로 권한 판정에 절대 쓰지 않는다. */
export function isAdminUser(u: UserRec | null): boolean {
  return !!u && (u.role === "admin" || ADMIN_USERS.includes(String(u.id || "").toLowerCase()));
}

export function issueToken(db: DbShape, user: UserRec): { token: string; cookie: string } {
  const token = randomBytes(32).toString("hex");
  db.tokens[tokenHash(token)] = { userId: user.id, expiresAt: Date.now() + TOKEN_TTL_MS }; // v1.0.16 (S4) — 해시 키 저장
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
      listings: all.map((l) => ({ id: l.id, seller: l.sellerName, mine: false, itemKey: l.itemKey, up: l.up ?? 0, price: l.price, qty: l.qty ?? 1, ts: l.ts })),
      pending: { gold: 0, count: 0 },
      feePct: MARKET_FEE_PCT,
      maxListings: MARKET_MAX_LISTINGS,
      guest: true,
    };
  }
  const pay = db.payouts[uid] || { gold: 0, count: 0 };
  return {
    listings: all.map((l) => ({ id: l.id, seller: l.seller === uid ? null : l.sellerName, mine: l.seller === uid, itemKey: l.itemKey, up: l.up ?? 0, price: l.price, qty: l.qty ?? 1, ts: l.ts })),
    pending: { gold: pay.gold || 0, count: pay.count || 0 },
    feePct: MARKET_FEE_PCT,
    maxListings: MARKET_MAX_LISTINGS,
  };
}

/** vc153 (#신규8) — 클라우드 세이브 owned(멀티셋)에서 itemKey 보유 개수 */
export function ownedCountOf(db: DbShape, uid: string, itemKey: string): number {
  const save = db.saves[uid]?.data;
  if (!save || typeof save !== "object") return 0;
  const owned = Array.isArray(save.owned) ? save.owned : [];
  return owned.filter((k) => k === itemKey).length;
}

/* ---------------- 거래소 에스크로 (v1.4.41 — 감사 #1 무한 복제 수리) ----------------
 *  문제: 종전엔 등록해도 클라우드 세이브의 owned 가 그대로 남았다. 서버는 "가지고 있는지"만
 *  확인하고 실제로 빼앗지 않았으므로, 물건을 걸어놓고 팔아도 내 세이브에는 그대로 있었다.
 *  게다가 owned 는 클라가 업로드하는 값이라, 등록 후 예전 세이브를 다시 올리면 복원됐다.
 *  해법: 등록 시점에 서버가 owned 에서 수량을 빼서 등록글이 보관(에스크로)하고,
 *  취소·구매 시에만 돌려준다. 업로드 경로에서도 에스크로분을 다시 차감해 복원을 막는다. */

/** 내 활성 등록분의 아이템별 수량 합계 (에스크로 잔량) */
export function escrowedCounts(db: DbShape, uid: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of Object.values(db.market.listings)) {
    if (l.seller !== uid) continue;
    out[l.itemKey] = (out[l.itemKey] ?? 0) + (l.qty ?? 1);
  }
  return out;
}

/** 세이브 owned 에서 에스크로 수량을 제거한다(보유량을 넘지 않게). 제거한 개수 반환.
 *  클라가 이미 로컬에서 뺀 경우 0개가 제거되고, 예전 세이브를 되올린 경우 정확히 다시 빠진다. */
export function deductEscrow(save: Record<string, unknown>, esc: Record<string, number>): number {
  const owned = Array.isArray(save.owned) ? (save.owned as unknown[]) : null;
  if (!owned) return 0;
  let removed = 0;
  for (const [key, qty] of Object.entries(esc)) {
    for (let i = 0; i < qty; i++) {
      const idx = owned.indexOf(key);
      if (idx < 0) break;
      owned.splice(idx, 1);
      removed++;
    }
  }
  return removed;
}

/** 에스크로 해제 — 취소·구매 시 판매자/구매자 세이브에 수량을 되돌려 넣는다. */
export function creditOwned(db: DbShape, uid: string, itemKey: string, qty: number, up: number): void {
  const rec = db.saves[uid];
  if (!rec || !rec.data || typeof rec.data !== "object") return; // 세이브 없는 계정은 지급 불가(등록 자체가 막혀 실제로는 도달하지 않음)
  const d = rec.data;
  const owned = Array.isArray(d.owned) ? (d.owned as unknown[]) : [];
  for (let i = 0; i < qty; i++) owned.push(itemKey);
  d.owned = owned;
  if (up > 0) {
    const accUp = (d.accUp && typeof d.accUp === "object" ? d.accUp : {}) as Record<string, number>;
    accUp[itemKey] = up;
    d.accUp = accUp;
  }
  rec.updatedAt = Date.now();
}

/** v1.0.6 계승 — 등록자 실보유 검증(클라우드 세이브 owned + 장착 accessories) */
export function ownsListableItem(db: DbShape, uid: string, itemKey: string): { ok: boolean; error?: string } {
  if (!MARKET_LISTABLE.has(itemKey)) return { ok: false, error: "거래할 수 없는 아이템이에요 (GM 전용 제외 전체 등록 가능)" };
  const save = db.saves[uid]?.data;
  if (!save || typeof save !== "object") return { ok: false, error: "클라우드 세이브 동기화 후 등록할 수 있어요 — 로그인 상태로 잠시 플레이하거나 계정 패널에서 백업해 주세요" };
  const owned = Array.isArray(save.owned) ? save.owned : [];
  if (!owned.includes(itemKey)) return { ok: false, error: "보유하지 않은 아이템은 등록할 수 없어요" };
  const acc = Array.isArray(save.accessories) ? save.accessories : [];
  if (acc.includes(itemKey)) return { ok: false, error: "장착 중인 장비는 해제한 뒤 등록하세요" };
  /* vc146 (#9) — 무기/방어구 장착 중 등록 차단 (장신구와 동일 정책) */
  const sv = save as Record<string, unknown>;
  if (sv.weapon === itemKey || sv.armor === itemKey) return { ok: false, error: "장착 중인 장비는 해제한 뒤 등록하세요" };
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

/**
 * v1.0.13 피드백#7/#16 — 캐릭터별 랭킹 + 직업별 필터 (기존 계정 단위 집계 확장).
 *  · db.saves[uid].data(활성 세이브) + db.saves[uid].chars(캐릭터 백업분, cloud-save 최대 24캐릭)를
 *    캐릭터 단위로 모두 수집 — 한 계정이 여러 캐릭터로 랭킹에 오른다.
 *  · 중복 제거: chars의 캐릭터가 활성 세이브와 playerName+lv가 같으면(활성 캐릭이 chars에도 백업된 케이스) 1회만.
 *  · v1.0.14 피드백#2 — job(계열키) 지정 시 캐릭터 cls를 "계열(8 기본 직업)"로 정규화해 비교:
 *    전직 차수(3·4차) 키로 필터해도 같은 계열로 묶인다 (warbringer → berserker 계열 등).
 *    계열로 정규되지 않는 키(1차 키 등)는 기존처럼 cls 완전 일치 폴백 — v1.0.13 링크 호환.
 *  · 하위호환: chars가 없는 세이브는 기존과 동일하게 단일 엔트리.
 *  · me 매칭: 내 계정 엔트리(uid 일치) 또는 현재 캐릭터 이름(meName) 일치 — 정렬상 첫 매치(내 최고 캐릭).
 */
export function rankListFor(db: DbShape, me: UserRec | null, meName = "", job = "") {
  type Entry = { uid: string; cid: string; data: Record<string, unknown>; name: string };
  const all: Entry[] = [];
  for (const [uid, s] of Object.entries(db.saves)) {
    if (!s?.data || typeof s.data !== "object") continue;
    if (!Number((s.data as Record<string, unknown>).lv)) continue;
    const u = db.users[uid];
    if (u && u.role === "admin") continue; // GM/관리자 제외 (운영 공정성)
    const d = s.data as Record<string, unknown>;
    const activeName = String(d.playerName || (u ? u.name : "이름없음") || "이름없음").slice(0, 8);
    all.push({ uid, cid: "active", data: d, name: activeName });
    /* v1.0.13 피드백#7 — chars 백업분 (이름 → 세이브) 캐릭터별 엔트리 확장 */
    if (s.chars && typeof s.chars === "object") {
      for (const [cid, cs] of Object.entries(s.chars)) {
        if (!cs || typeof cs !== "object" || Array.isArray(cs)) continue;
        if (!Number((cs as Record<string, unknown>).lv)) continue;
        const cname = String((cs as Record<string, unknown>).playerName || "이름없음").slice(0, 8);
        if (cname === activeName && Number((cs as Record<string, unknown>).lv) === Number(d.lv)) continue; // 활성 중복
        all.push({ uid, cid: String(cid).slice(0, 24), data: cs as Record<string, unknown>, name: cname });
      }
    }
  }
  /* v1.0.14 피드백#2 — ?job=는 이제 8계열 키(berserker/guardian/sniper/windrunner/archmage/sage/
   *  assassin/swashbuckler). 양변을 계열로 정규화해 비교 — 3·4차 캐릭도 소속 계열 랭킹에 합산된다.
   *  계열 정규가 안 되는 job(1차 키·미지 키)은 원문 그대로 cls 완전 일치 폴백(구버전 링크 호환). */
  const jobKey = String(job || "").trim().toLowerCase();
  const jobBranch = jobKey ? (clsToBranch(jobKey) ?? jobKey) : "";
  const filtered = jobKey
    ? all.filter((e) => {
        const cls = String(e.data.cls || "").toLowerCase();
        return (clsToBranch(cls) ?? cls) === jobBranch;
      })
    : all;
  filtered.sort((a, b) => (rankBetter(a, b) ? -1 : rankBetter(b, a) ? 1 : 0));
  /* vc145 (#2) — Top 50 → 100위 확장 (유저 지시 "랭킹 100위까지 스크롤 가능하게") */
  const top = filtered.slice(0, 100).map((e, i) => ({
    rank: i + 1,
    name: e.name,
    lv: Number(e.data.lv || 0),
    cls: String(e.data.cls || ""),
    rebirths: Number((e.data.inf as Record<string, unknown> || {})?.rebirths || 0),
    tower: Number((e.data.inf as Record<string, unknown> || {})?.towerBest || 0),
    cid: e.cid, // v1.0.13 — 캐릭터 식별 ("active" | 캐릭터 백업 키)
  }));
  let mine: { rank: number; total: number; name?: string; lv?: number; rebirths?: number; tower?: number; cid?: string; note?: string } | null = null;
  if (me) {
    const myName = String(meName || "").trim().slice(0, 8).toLowerCase();
    const idx = filtered.findIndex((e) => e.uid === me.id || (!!myName && e.name.toLowerCase() === myName));
    if (idx >= 0) {
      const e = filtered[idx];
      mine = { rank: idx + 1, total: filtered.length, name: e.name, lv: Number(e.data.lv || 0), rebirths: Number((e.data.inf as Record<string, unknown>)?.rebirths || 0), tower: Number((e.data.inf as Record<string, unknown>)?.towerBest || 0), cid: e.cid };
    } else {
      mine = { rank: 0, total: filtered.length, note: "클라우드 백업(3분 자동)이 켜지면 랭킹에 등록돼요" };
    }
  }
  return { list: top, me: mine };
}
