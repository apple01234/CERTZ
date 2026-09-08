/**
 * SERTZ 계정 서버 (v4.9.0 — 유저 지시 #4 "SNS 연동 회원가입 + 자체 회원가입/로그인")
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

/* ---------------- 파일 DB (디바운드 저장) ---------------- */
let db = { users: {}, tokens: {}, saves: {} };
let saveTimer = null;
function loadDb() {
  try {
    if (existsSync(DB_FILE)) db = JSON.parse(readFileSync(DB_FILE, "utf8"));
    db.users ||= {};
    db.tokens ||= {};
    db.saves ||= {};
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
  return u ? { id: u.id, name: u.name, provider: u.provider, createdAt: u.createdAt } : null;
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
      const b = await readBody(req);
      const id = String(b.id || "").trim().toLowerCase();
      const pw = String(b.pw || "");
      const name = String(b.name || "").trim().slice(0, 8) || id.slice(0, 8);
      if (!/^[a-z0-9_]{3,20}$/.test(id)) return sendJson(res, 400, { error: "아이디는 영문 소문자/숫자/_ 3~20자" });
      if (pw.length < 6) return sendJson(res, 400, { error: "비밀번호는 6자 이상" });
      if (db.users[id]) return sendJson(res, 409, { error: "이미 존재하는 아이디예요" });
      const salt = randomBytes(16).toString("hex");
      const user = { id, name, provider: "local", salt, hash: hashPw(pw, salt), createdAt: Date.now() };
      db.users[id] = user;
      persistDb();
      sendJson(res, 200, { user: publicUser(user) }, issueToken(res, user));
      return true;
    }

    /* 로그인 */
    if (url === "/api/auth/login" && method === "POST") {
      const b = await readBody(req);
      const id = String(b.id || "").trim().toLowerCase();
      const user = db.users[id];
      if (!user || user.provider !== "local") return sendJson(res, 401, { error: "아이디 또는 비밀번호가 틀렸어요" });
      const hash = Buffer.from(hashPw(String(b.pw || ""), user.salt), "hex");
      const stored = Buffer.from(user.hash, "hex");
      if (hash.length !== stored.length || !timingSafeEqual(hash, stored))
        return sendJson(res, 401, { error: "아이디 또는 비밀번호가 틀렸어요" });
      sendJson(res, 200, { user: publicUser(user) }, issueToken(res, user));
      return true;
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

/** server.js에서 호출 — Next handle을 감싸 /api/auth/* 를 계정 모듈이 먼저 처리한다 */
function attachAccountsBefore(handleNext) {
  return (req, res) => {
    if ((req.url || "").startsWith("/api/auth/")) {
      handle(req, res).catch((e) => {
        console.error("[SERTZ-accounts] 가로채기 실패 — Next로 전달", e);
        handleNext(req, res);
      });
      return;
    }
    handleNext(req, res);
  };
}

module.exports = { attachAccountsBefore, handleAccountRequest: handle };
