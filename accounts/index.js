/**
 * SERTZ 계정 서버 (v4.9.0 — 유저 지시 #4 "SNS 연동 회원가입 + 자체 회원가입/로그인")
 *  v1.0.1 — 유저 거래판(마켓) 추가: 계정 연계 아이템 거래 + 10% 정산 수수료(BM 수익)
 *
 *  - server.js의 httpServer 요청을 Next handle 이전에 가로채 JSON API를 같은 포트에서 처리
 *    (multiplayer/index.js와 동일한 부착 패턴 — FC standalone 주입 경로도 동일)
 *  - 저장소: db/accounts.json (파일 DB — 의존성 0, APK 웹뷰/로컬/FC 전부 동작)
 *  - 자체 가입: ID+비밀번호 (scrypt 솔트 해시, node:crypto)
 *  - 세션: HttpOnly 쿠키 토큰 (30일)
 *  - SNS 연동: 구글/카카오/네이버 OAuth 2.0 authorization-code 플로우.
 *    환경변수(SERTZ_GOOGLE_ID/SECRET · SERTZ_KAKAO_ID/SECRET · SERTZ_NAVER_ID/SECRET)가
 *    없으면 해당 프로바이더는 configured:false — 클라이언트가 안내 문구를 보여준다.
 *    (앱 등록 후 키만 넣으면 코드 수정 없이 즉시 활성화되는 스캐폴딩)
 *  - 클라우드 세이브: 로그인 유저의 게임 세이브 백업/복원 (localStorage 덤프 통째로 저장)
 */
const { scryptSync, randomBytes, timingSafeEqual } = require("node:crypto");
const { readFileSync, writeFileSync, mkdirSync, existsSync } = require("node:fs");
const path = require("node:path");

const DB_DIR = path.join(process.cwd(), "db");
const DB_FILE = path.join(DB_DIR, "accounts.json");
const TOKEN_TTL_MS = 30 * 24 * 3600 * 1000; // 30일
const COOKIE = "sertz_auth";
/* ---------------- v1.0.2 보안 계층 (유저 지시 Phase 12/29) ----------------
 *  · 관리자 롤: SERTZ_ADMIN_USERS(env, 쉼표 구분)에 있는 아이디만 role="admin" — 클라 flag로 판단하지 않음
 *  · Rate Limit: IP+버킷 인메모리 카운터 (정상 플레이에는 영향 없는 수준)
 *  · Audit Log: db/audit.log JSONL — 가입/로그인/거래/관리자 조회 추적 */
/* v1.0.3 (#GM안내) — 관리자 아이디 목록. env 미설정 시 기본값 admin, apple01234 사용:
 *  이 아이디로 회원가입/로그인하면 role=admin → 마을에 GM NPC가 나타나고 인터랙션으로 GM 패널 진입.
 *  (기존엔 env가 비면 아무도 admin이 되는 방법이 없어 "GM 로그인 어케함?" 상태가 됐다) */
const ADMIN_USERS = (process.env.SERTZ_ADMIN_USERS || "admin,apple01234")
  .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
const rateBuckets = new Map(); // key -> { n, resetAt }
function clientIp(req) {
  return (
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress || "?"
  );
}
function rateLimit(req, res, bucket, max, windowMs) {
  const key = `${clientIp(req)}:${bucket}`;
  const now = Date.now();
  let b = rateBuckets.get(key);
  if (!b || b.resetAt < now) { b = { n: 0, resetAt: now + windowMs }; rateBuckets.set(key, b); }
  b.n++;
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) if (v.resetAt < now) rateBuckets.delete(k);
  }
  if (b.n > max) {
    sendJson(res, 429, { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." }, { "Retry-After": String(Math.ceil((b.resetAt - now) / 1000)) });
    return false;
  }
  return true;
}
const AUDIT_FILE = path.join(DB_DIR, "audit.log");
function audit(event, detail = {}) {
  try {
    mkdirSync(DB_DIR, { recursive: true });
    const line = JSON.stringify({ ts: Date.now(), event, ...detail });
    require("node:fs").appendFileSync(AUDIT_FILE, line + "\n");
  } catch { /* 감사 로그 실패가 서비스를 막지 않게 */ }
}
function isAdminUser(u) {
  return !!u && (u.role === "admin" || ADMIN_USERS.includes(String(u.name || "").toLowerCase()));
}

/* ---------------- 파일 DB (디바운드 저장) ---------------- */
let db = { users: {}, tokens: {}, saves: {}, market: { nextId: 1, listings: {} }, payouts: {} };
let saveTimer = null;
function loadDb() {
  try {
    if (existsSync(DB_FILE)) db = JSON.parse(readFileSync(DB_FILE, "utf8"));
    db.users ||= {};
    db.tokens ||= {};
    db.saves ||= {};
    db.market ||= { nextId: 1, listings: {} }; // v1.0.1 — 유저 거래판 (구 DB 호환)
    db.market.listings ||= {};
    db.payouts ||= {}; // v1.0.1 — 판매 정산금 ledger
    // v1.0.2 — env 관리자 목록 동기화 (이미 가입된 계정도 롤 자동 승격/회수)
    for (const [uid, u] of Object.entries(db.users)) {
      /* env 매칭은 아이디 + 닉네임 둘 다 허용 (가입 시 role 부여는 아이디 기준과 동일 유지) */
      const shouldAdmin = ADMIN_USERS.includes(String(uid || "").toLowerCase()) || ADMIN_USERS.includes(String(u.name || "").toLowerCase());
      if (shouldAdmin && u.role !== "admin") u.role = "admin";
      else if (!shouldAdmin && u.role === "admin") u.role = "user";
    }
  } catch (e) {
    console.error("[SERTZ-accounts] DB 로드 실패 — 신규 생성", e);
  }
}
function persistDb() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      mkdirSync(DB_DIR, { recursive: true });
      writeFileSync(DB_FILE, JSON.stringify(db));
    } catch (e) {
      console.error("[SERTZ-accounts] DB 저장 실패", e);
    }
  }, 300);
}
loadDb();

/* ---------------- 유틸 ---------------- */
function hashPw(pw, salt) {
  return scryptSync(String(pw), salt, 64).toString("hex");
}
function publicUser(u) {
  // v1.0.2 — role 노출 (클라는 이 값으로 GM 진입 여부만 판단, 권한 자체는 서버가 보유)
  return u ? { id: u.id, name: u.name, provider: u.provider, createdAt: u.createdAt, role: u.role === "admin" ? "admin" : "user" } : null;
}
function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function currentUser(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  const t = db.tokens[token];
  if (!t || t.expiresAt < Date.now()) {
    if (t) { delete db.tokens[token]; persistDb(); }
    return null;
  }
  return db.users[t.userId] || null;
}
function readBody(req, limit = 6 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("body too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}
function sendJson(res, code, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(body);
}
function sessionCookie(token) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TOKEN_TTL_MS / 1000}`;
}
function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
function issueToken(res, user) {
  const token = randomBytes(32).toString("hex");
  db.tokens[token] = { userId: user.id, expiresAt: Date.now() + TOKEN_TTL_MS };
  // 만료 토큰 주기적 청소
  if (Object.keys(db.tokens).length > 4000) {
    const now = Date.now();
    for (const k of Object.keys(db.tokens)) if (db.tokens[k].expiresAt < now) delete db.tokens[k];
  }
  persistDb();
  return { "Set-Cookie": sessionCookie(token) };
}

/* ---------------- SNS OAuth 설정 (환경변수 게이트) ---------------- */
const SNS = {
  google: {
    name: "구글",
    env: ["SERTZ_GOOGLE_ID", "SERTZ_GOOGLE_SECRET"],
    authUrl: (id, redirect, state) =>
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(id)}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${encodeURIComponent("openid email profile")}&state=${state}`,
    token: "https://oauth2.googleapis.com/token",
    userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
    pick: (info) => ({ key: `google_${info.sub}`, name: String(info.name || info.email || "모험가").slice(0, 8) }),
  },
  kakao: {
    name: "카카오",
    env: ["SERTZ_KAKAO_ID", "SERTZ_KAKAO_SECRET"],
    authUrl: (id, redirect, state) =>
      `https://kauth.kakao.com/oauth/authorize?client_id=${encodeURIComponent(id)}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&state=${state}`,
    token: "https://kauth.kakao.com/oauth/token",
    userinfo: "https://kapi.kakao.com/v2/user/me",
    pick: (info) => ({ key: `kakao_${info.id}`, name: String(info.kakao_account?.profile?.nickname || `카카오${info.id % 10000}`).slice(0, 8) }),
  },
  naver: {
    name: "네이버",
    env: ["SERTZ_NAVER_ID", "SERTZ_NAVER_SECRET"],
    authUrl: (id, redirect, state) =>
      `https://nid.naver.com/oauth2.0/authorize?client_id=${encodeURIComponent(id)}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&state=${state}`,
    token: "https://nid.naver.com/oauth2.0/token",
    userinfo: "https://openapi.naver.com/v1/nid/me",
    pick: (info) => ({ key: `naver_${info.response?.id ?? info.resultcode}`, name: String(info.response?.nickname || info.response?.name || "모험가").slice(0, 8) }),
  },
};
const snsConfigured = (key) => !!SNS[key] && SNS[key].env.every((e) => !!process.env[e]);
const pendingStates = new Map(); // state → provider (5분 만료)

async function exchangeCode(providerKey, code, redirect) {
  const cfg = SNS[providerKey];
  const clientId = process.env[cfg.env[0]];
  const clientSecret = process.env[cfg.env[1]];
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirect,
  });
  const tr = await fetch(cfg.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tok = await tr.json();
  if (!tok.access_token) throw new Error("token exchange failed");
  const ur = await fetch(cfg.userinfo, { headers: { Authorization: `Bearer ${tok.access_token}` } });
  const info = await ur.json();
  return cfg.pick(info);
}

/* ---------------- v1.0.1 — 유저 거래판 (마켓) ----------------
 *  계정 시스템과 직결된 BM: 판매 정산 시 10% 수수료 절단 (서버 수익).
 *  - 등록: 로그인 유저만 · 동시 3칸 · 가격 1G~10,000,000G
 *  - 구매: 로그인 유저만 · 본인 물건 구매 금지 · 구매자 클라이언트가 골드 차감+아이템 지급
 *  - 정산: 판매자 pendingGold에 90% 적립 → 로그인해 수령 (수수료 10%는 서버 수익) */
const MARKET_FEE_PCT = 10;
const MARKET_MAX_LISTINGS = 3;
/* v1.0.6 — 등록 가능 아이템 화이트리스트 (보스 전용 드롭 = 클라 TRADE_STOCK과 동일 목록).
 *  미검증 시 미보유 아이템 등록 → 2번 계정 구매 → 전설 복제 익스플로잇이 가능했다. */
const MARKET_LISTABLE = new Set([
  "bd_guardian", "bd_behemoth", "bd_nidhog", "bd_surt", "bd_fenrir",
  "bd_skoll", "bd_gram", "bd_abysslord", "bd_abudditos",
]);
/* v1.0.6 — 등록자가 실제로 그 아이템을 보유 중인지 클라우드 세이브로 검증.
 *  세이브 data 최상위 owned: ItemKey[], accessories: 장착 중 장신구[] (장착분은 등록 불가) */
function ownsListableItem(uid, itemKey) {
  if (!MARKET_LISTABLE.has(itemKey)) return { ok: false, error: "보스 전용 드롭(전설)만 등록할 수 있어요" };
  const save = db.saves[uid]?.data;
  if (!save || typeof save !== "object") return { ok: false, error: "클라우드 세이브 동기화 후 등록할 수 있어요 — 로그인 상태로 잠시 플레이하거나 계정 패널에서 백업해 주세요" };
  const owned = Array.isArray(save.owned) ? save.owned : [];
  if (!owned.includes(itemKey)) return { ok: false, error: "보유하지 않은 아이템은 등록할 수 없어요" };
  const acc = Array.isArray(save.accessories) ? save.accessories : [];
  if (acc.includes(itemKey)) return { ok: false, error: "장착 중인 장비는 해제한 뒤 등록하세요" };
  return { ok: true };
}

function marketSnapshot(uid) {
  const all = Object.values(db.market.listings).sort((a, b) => a.ts - b.ts);
  const pay = db.payouts[uid] || { gold: 0, count: 0 };
  return {
    listings: all.map((l) => ({ id: l.id, seller: l.seller === uid ? null : l.sellerName, mine: l.seller === uid, itemKey: l.itemKey, up: l.up ?? 0, price: l.price, ts: l.ts })),
    pending: { gold: pay.gold || 0, count: pay.count || 0 },
    feePct: MARKET_FEE_PCT,
    maxListings: MARKET_MAX_LISTINGS,
  };
}

async function handleMarket(req, res, url, method) {
  /* 조회 — 비로그인도 목록은 공개 (판매자명 익명) */
  if (url === "/api/market" && method === "GET") {
    const user = currentUser(req);
    if (!user) {
      const all = Object.values(db.market.listings).sort((a, b) => a.ts - b.ts);
      return sendJson(res, 200, {
        listings: all.map((l) => ({ id: l.id, seller: l.sellerName, mine: false, itemKey: l.itemKey, up: l.up ?? 0, price: l.price, ts: l.ts })),
        pending: { gold: 0, count: 0 }, feePct: MARKET_FEE_PCT, maxListings: MARKET_MAX_LISTINGS, guest: true,
      });
    }
    return sendJson(res, 200, marketSnapshot(user.id));
  }

  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "거래판은 로그인이 필요해요" });
  /* v1.0.2 — 거래 쓰기 공통 레이트리밋 (30회/분) */
  if (method !== "GET" && !rateLimit(req, res, "market", 30, 60 * 1000)) return true;

  /* 등록 */
  if (url === "/api/market/list" && method === "POST") {
    const b = await readBody(req);
    const itemKey = String(b.itemKey || "").slice(0, 40);
    const up = Math.max(0, Math.min(15, parseInt(b.up, 10) || 0));
    const price = parseInt(b.price, 10);
    if (!itemKey) return sendJson(res, 400, { error: "아이템 정보가 올바르지 않아요" });
    if (!Number.isFinite(price) || price < 1 || price > 10000000) return sendJson(res, 400, { error: "가격은 1G ~ 10,000,000G 사이" });
    const own = ownsListableItem(user.id, itemKey); // v1.0.6 — 화이트리스트 + 실보유(클라우드 세이브) 검증
    if (!own.ok) return sendJson(res, 403, { error: own.error });
    const mine = Object.values(db.market.listings).filter((l) => l.seller === user.id);
    if (mine.length >= MARKET_MAX_LISTINGS) return sendJson(res, 409, { error: `등록 칸이 가득 찼어요 (최대 ${MARKET_MAX_LISTINGS}칸)` });
    if (mine.some((l) => l.itemKey === itemKey)) return sendJson(res, 409, { error: "같은 아이템을 동시에 여러 칸에 등록할 수 없어요" });
    const id = `m${db.market.nextId++}`;
    db.market.listings[id] = { id, seller: user.id, sellerName: user.name, itemKey, up, price, ts: Date.now() };
    persistDb();
    audit("market_list", { ip: clientIp(req), uid: user.id, itemKey, price }); // v1.0.2
    return sendJson(res, 200, { ok: true, id, ...marketSnapshot(user.id) });
  }

  /* 취소 — 본인 등록만 */
  if (url === "/api/market/cancel" && method === "POST") {
    const b = await readBody(req);
    const l = db.market.listings[String(b.id || "")];
    if (!l) return sendJson(res, 404, { error: "이미 판매된 등록이에요" });
    if (l.seller !== user.id) return sendJson(res, 403, { error: "본인 등록만 취소할 수 있어요" });
    audit("market_cancel", { ip: clientIp(req), uid: user.id, listingId: l.id }); // v1.0.2
    const item = { itemKey: l.itemKey, up: l.up ?? 0 };
    delete db.market.listings[l.id];
    persistDb();
    return sendJson(res, 200, { ok: true, item, ...marketSnapshot(user.id) });
  }

  /* 구매 — 본인 물건 금지, 판매자 정산 90% */
  if (url === "/api/market/buy" && method === "POST") {
    const b = await readBody(req);
    const l = db.market.listings[String(b.id || "")];
    if (!l) return sendJson(res, 404, { error: "이미 판매된 등록이에요 — 새로고침해 주세요" });
    if (l.seller === user.id) return sendJson(res, 403, { error: "내 등록은 구매할 수 없어요" });
    const item = { itemKey: l.itemKey, up: l.up ?? 0, price: l.price, sellerName: l.sellerName };
    delete db.market.listings[l.id];
    db.payouts[l.seller] ||= { gold: 0, count: 0 };
    db.payouts[l.seller].gold += Math.floor((l.price * (100 - MARKET_FEE_PCT)) / 100);
    db.payouts[l.seller].count += 1;
    persistDb();
    audit("market_buy", { ip: clientIp(req), uid: user.id, listingId: l.id, itemKey: l.itemKey, price: l.price, seller: l.seller }); // v1.0.2
    return sendJson(res, 200, { ok: true, item, ...marketSnapshot(user.id) });
  }

  /* 정산 수령 — pendingGold 반환 후 0으로 */
  if (url === "/api/market/collect" && method === "POST") {
    const pay = db.payouts[user.id];
    const gold = pay?.gold || 0;
    if (gold <= 0) return sendJson(res, 400, { error: "수령할 정산금이 없어요" });
    db.payouts[user.id] = { gold: 0, count: 0 };
    persistDb();
    audit("market_collect", { ip: clientIp(req), uid: user.id, gold }); // v1.0.2
    return sendJson(res, 200, { ok: true, gold, ...marketSnapshot(user.id) });
  }

  return sendJson(res, 404, { error: "알 수 없는 마켓 요청" });
}

/* ---------------- 요청 처리 (true 반환 = 이 모듈이 응답 완료) ---------------- */
async function handle(req, res) {
  const url = (req.url || "").split("?")[0];
  const method = (req.method || "GET").toUpperCase();

  try {
    /* SNS 상태 조회 */
    if (url === "/api/auth/sns" && method === "GET") {
      const out = {};
      for (const k of Object.keys(SNS)) out[k] = { name: SNS[k].name, configured: snsConfigured(k) };
      sendJson(res, 200, { providers: out });
      return true;
    }

    /* SNS 로그인 시작 (설정돼 있으면 OAuth로 리다이렉트, 아니면 안내 페이지) */
    const mStart = url.match(/^\/api\/auth\/sns\/(google|kakao|naver)\/start$/);
    if (mStart && method === "GET") {
      const key = mStart[1];
      if (!snsConfigured(key)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;background:#0b1020;color:#dfe7ff;display:grid;place-items:center;height:100vh"><div style="text-align:center"><h2>${SNS[key].name} 로그인 미설정</h2><p style="opacity:.75">서버에 ${SNS[key].name} OAuth 키가 아직 등록되지 않았어요.<br/>계정 패널의 자체 회원가입(아이디·비밀번호)을 이용해 주세요.</p><p style="margin-top:14px"><a href="/" style="color:#8ae0ff">← 게임으로 돌아가기</a></p></div>`);
        return true;
      }
      const host = req.headers.host || "localhost";
      const proto = req.headers["x-forwarded-proto"] || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
      const redirect = `${proto}://${host}/api/auth/sns/${key}/callback`;
      const state = randomBytes(16).toString("hex");
      pendingStates.set(state, { key, at: Date.now() });
      if (pendingStates.size > 500) {
        const now = Date.now();
        for (const [s, v] of pendingStates) if (now - v.at > 5 * 60 * 1000) pendingStates.delete(s);
      }
      res.writeHead(307, { Location: SNS[key].authUrl(process.env[SNS[key].env[0]], redirect, state) });
      res.end();
      return true;
    }

    /* SNS 콜백 — code 교환 → SNS 계정으로 자동 가입/로그인 → 게임으로 복귀 */
    const mCb = url.match(/^\/api\/auth\/sns\/(google|kakao|naver)\/callback$/);
    if (mCb && method === "GET") {
      const key = mCb[1];
      const q = new URL(req.url, "http://x").searchParams;
      const code = q.get("code");
      const state = q.get("state");
      const pend = state && pendingStates.get(state);
      pendingStates.delete(state || "");
      if (!code || !pend || pend.key !== key || Date.now() - pend.at > 5 * 60 * 1000) {
        res.writeHead(307, { Location: "/" }).end();
        return true;
      }
      try {
        const host = req.headers.host || "localhost";
        const proto = req.headers["x-forwarded-proto"] || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
        const redirect = `${proto}://${host}/api/auth/sns/${key}/callback`;
        const pick = await exchangeCode(key, code, redirect);
        let user = db.users[pick.key];
        if (!user) {
          user = { id: pick.key, name: pick.name, provider: key, salt: "", hash: "", createdAt: Date.now() };
          db.users[pick.key] = user;
        }
        persistDb();
        const headers = issueToken(res, user);
        res.writeHead(307, { Location: "/?sns=ok", ...headers });
        res.end();
      } catch (e) {
        console.error("[SERTZ-accounts] SNS 콜백 실패", e);
        res.writeHead(307, { Location: "/?sns=err" }).end();
      }
      return true;
    }

    /* 자체 회원가입 */
    if (url === "/api/auth/register" && method === "POST") {
      if (!rateLimit(req, res, "register", 10, 5 * 60 * 1000)) return true; // v1.0.2 — 무차별 가입 차단
      const b = await readBody(req);
      const id = String(b.id || "").trim().toLowerCase();
      const pw = String(b.pw || "");
      const name = String(b.name || "").trim().slice(0, 8) || id.slice(0, 8);
      if (!/^[a-z0-9_]{3,20}$/.test(id)) return sendJson(res, 400, { error: "아이디는 영문 소문자/숫자/_ 3~20자" });
      if (pw.length < 6) return sendJson(res, 400, { error: "비밀번호는 6자 이상" });
      if (db.users[id]) return sendJson(res, 409, { error: "이미 존재하는 아이디예요" });
      const salt = randomBytes(16).toString("hex");
      /* v1.0.2 — 관리자 목록(env)에 있으면 role=admin (서버가 유일한 권한 발급처) */
      const role = ADMIN_USERS.includes(id) ? "admin" : "user";
      const user = { id, name, provider: "local", salt, hash: hashPw(pw, salt), createdAt: Date.now(), role };
      db.users[id] = user;
      persistDb();
      audit("register", { ip: clientIp(req), uid: id, role });
      sendJson(res, 200, { user: publicUser(user) }, issueToken(res, user));
      return true;
    }

    /* 로그인 */
    if (url === "/api/auth/login" && method === "POST") {
      if (!rateLimit(req, res, "login", 15, 5 * 60 * 1000)) return true; // v1.0.2 — 무차별 대입 차단
      const b = await readBody(req);
      const id = String(b.id || "").trim().toLowerCase();
      const user = db.users[id];
      if (!user || user.provider !== "local") {
        audit("login_fail", { ip: clientIp(req), uid: id }); // v1.0.2
        return sendJson(res, 401, { error: "아이디 또는 비밀번호가 틀렸어요" });
      }
      const hash = Buffer.from(hashPw(String(b.pw || ""), user.salt), "hex");
      const stored = Buffer.from(user.hash, "hex");
      if (hash.length !== stored.length || !timingSafeEqual(hash, stored)) {
        audit("login_fail", { ip: clientIp(req), uid: id }); // v1.0.2
        return sendJson(res, 401, { error: "아이디 또는 비밀번호가 틀렸어요" });
      }
      audit("login", { ip: clientIp(req), uid: id, role: user.role === "admin" ? "admin" : "user" }); // v1.0.2
      sendJson(res, 200, { user: publicUser(user) }, issueToken(res, user));
      return true;
    }

    /* v1.0.2 — 관리자 요약 API (서버 롤 검증 — 일반 유저/미인증 403) */
    if (url === "/api/admin/summary" && method === "GET") {
      const me = currentUser(req);
      if (!isAdminUser(me)) {
        audit("admin_denied", { ip: clientIp(req), uid: me?.id ?? null });
        return sendJson(res, 403, { error: "관리자 권한이 필요해요" });
      }
      audit("admin_summary", { ip: clientIp(req), uid: me.id });
      let recentAudit = [];
      try {
        recentAudit = readFileSync(AUDIT_FILE, "utf8").trim().split("\n").slice(-50)
          .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      } catch { recentAudit = []; }
      return sendJson(res, 200, {
        users: Object.keys(db.users).length,
        listings: Object.keys(db.market.listings).length,
        payoutGold: Object.values(db.payouts).reduce((a, b) => a + (b.gold || 0), 0),
        recentAudit,
      });
    }

    /* 로그아웃 */
    if (url === "/api/auth/logout" && method === "POST") {
      const token = parseCookies(req)[COOKIE];
      if (token) { delete db.tokens[token]; persistDb(); }
      sendJson(res, 200, { ok: true }, { "Set-Cookie": clearCookie() });
      return true;
    }

    /* 내 정보 */
    if (url === "/api/auth/me" && method === "GET") {
      sendJson(res, 200, { user: publicUser(currentUser(req)) });
      return true;
    }

    /* 클라우드 세이브 — 업로드 */
    if (url === "/api/auth/cloud-save" && method === "POST") {
      const user = currentUser(req);
      if (!user) return sendJson(res, 401, { error: "로그인이 필요해요" });
      const b = await readBody(req);
      db.saves[user.id] = { data: b.data ?? null, updatedAt: Date.now() };
      persistDb();
      sendJson(res, 200, { ok: true, updatedAt: db.saves[user.id].updatedAt });
      return true;
    }

    /* 클라우드 세이브 — 조회 */
    if (url === "/api/auth/cloud-save" && method === "GET") {
      const user = currentUser(req);
      if (!user) return sendJson(res, 401, { error: "로그인이 필요해요" });
      const s = db.saves[user.id];
      sendJson(res, 200, { data: s?.data ?? null, updatedAt: s?.updatedAt ?? null });
      return true;
    }
  } catch (e) {
    console.error("[SERTZ-accounts] 요청 처리 실패", e);
    try { sendJson(res, 500, { error: "서버 오류" }); } catch { /* 무시 */ }
    return true;
  }
  return false;
}

/** server.js에서 호출 — Next handle을 감싸 /api/auth/*, /api/market/* 를 계정 모듈이 먼저 처리한다 */
function attachAccountsBefore(handleNext) {
  return (req, res) => {
    const u = req.url || "";
    if (u.startsWith("/api/auth/") || u.startsWith("/api/admin/")) {
      handle(req, res).catch((e) => {
        console.error("[SERTZ-accounts] 가로채기 실패 — Next로 전달", e);
        handleNext(req, res);
      });
      return;
    }
    if (u.startsWith("/api/market")) {
      const url = u.split("?")[0];
      const method = (req.method || "GET").toUpperCase();
      handleMarket(req, res, url, method).catch((e) => {
        console.error("[SERTZ-market] 요청 처리 실패", e);
        try { sendJson(res, 500, { error: "서버 오류" }); } catch { /* 무시 */ }
      });
      return;
    }
    handleNext(req, res);
  };
}

/** FC standalone용 — 마켓 요청 직접 처리 (반환값 무시, 응답은 이 모듈이 완료) */
function handleMarketRequest(req, res, url, method) {
  return handleMarket(req, res, url, method);
}

module.exports = { attachAccountsBefore, handleAccountRequest: handle, handleMarketRequest };
