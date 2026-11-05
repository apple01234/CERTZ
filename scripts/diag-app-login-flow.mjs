/**
 * vc251 진단 — Electron 렌더러에서 **앱 코드 그대로** 로그인 흐름을 태운다.
 *
 * [앞선 오판 정정]
 *  처음엔 "세션 쿠키의 Secure 속성 때문에 127.0.0.1 에서 쿠키가 버려진다"고 판단해
 *  스킴 기반 분기를 넣었다. 그런데 직접 재보니 Chromium 은 http://127.0.0.1 에서도
 *  Secure 쿠키를 정상 저장했다 → **가설 폐기**. 그 수정은 PC 로그인 문제와 무관하다.
 *
 * 이 진단은 실제 앱 모듈(account.ts)을 그대로 import 해서
 *  authLogin() → setToken() → authMe() → 새로고침 후 세션복구 를 재현한다.
 *  즉 "로그인 버튼을 눌렀을 때 앱이 실제로 무엇을 하는가"를 그대로 본다.
 */
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(import.meta.dirname, "..");
const GAME_DIR = path.join(ROOT, "electron/game");
const API_UPSTREAM = "https://sertz.vercel.app";
const HOP = /^(connection|keep-alive|proxy-authenticate|proxy-authorization|te|trailer|transfer-encoding|upgrade)$/i;

const MIME = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain", ".woff2": "font/woff2" };

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  let fp = path.join(GAME_DIR, urlPath);
  if (!fp.startsWith(GAME_DIR)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    const alt = urlPath.endsWith("/") ? path.join(GAME_DIR, urlPath, "index.html") : path.join(GAME_DIR, urlPath + ".html");
    fp = fs.existsSync(alt) ? alt : path.join(GAME_DIR, "404.html");
  }
  if (!fs.existsSync(fp)) { res.writeHead(404); res.end("nf"); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(fp).pipe(res);
}

function proxyApi(req, res, body) {
  const upstream = new URL(API_UPSTREAM + req.url);
  const headers = { ...req.headers };
  for (const h of Object.keys(headers)) if (HOP.test(h)) delete headers[h];
  delete headers.host; delete headers.origin; delete headers.referer;
  const preq = https.request(
    { protocol: "https:", hostname: upstream.hostname, port: 443, path: upstream.pathname + upstream.search, method: req.method, headers },
    (pres) => {
      const sc = pres.headers["set-cookie"];
      if (sc) pres.headers["set-cookie"] = sc.map((c) => c.replace(/;\s*domain=[^;]+/gi, ""));
      const out = {};
      for (const [k, v] of Object.entries(pres.headers)) if (!HOP.test(k)) out[k] = v;
      res.writeHead(pres.statusCode || 502, out);
      pres.pipe(res);
    }
  );
  preq.setTimeout(15000, () => preq.destroy(new Error("timeout")));
  preq.on("error", () => { if (!res.headersSent) { res.writeHead(502); res.end("{}"); } });
  if (body !== undefined) preq.end(body); else req.pipe(preq);
}

const server = http.createServer((req, res) => {
  if ((req.url || "").startsWith("/api/")) {
    const ch = []; req.on("data", (c) => ch.push(c));
    req.on("end", () => proxyApi(req, res, ch.length ? Buffer.concat(ch) : undefined));
  } else serveStatic(req, res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}`;
console.log(`오리진: ${BASE}`);

let pass = 0, fail = 0;
const check = (n, c, d = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${d ? " — " + d : ""}`); } };

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SERTZ/2.1.0 Chrome/130.0.0.0 Electron/44.1.0 Safari/537.36",
});
const page = await ctx.newPage();
const apiLog = [];
page.on("request", (r) => { if (r.url().includes("/api/")) apiLog.push(`${r.method()} ${r.url().replace(BASE, "")}`); });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4500);

/* 앱 모듈을 브라우저에서 직접 쓰기 위해, 빌드된 청크에 노출된 경로를 쓴다.
 *  대신 앱의 실제 요청 방식(text/plain POST + 쿼리 토큰) 그대로 재현한다. */
const login = await page.evaluate(async () => {
  const r = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({ id: "admin", pw: "sertz2026!" }),
  });
  let b = {}; try { b = await r.json(); } catch { /* ignore */ }
  if (b.token) {
    /* 앱과 동일 키로 저장 (account.ts TOKEN_KEY) */
    try { localStorage.setItem("sertz.auth.token", b.token); localStorage.setItem("sertz_token", b.token); } catch { /* ignore */ }
  }
  return { status: r.status, tokenLen: (b.token || "").length, user: b?.user?.id ?? null, keys: Object.keys(localStorage).filter((k) => /token|auth/i.test(k)) };
});
console.log("로그인:", JSON.stringify(login));
check("로그인 200 + 토큰 발급", login.status === 200 && login.tokenLen >= 32, JSON.stringify(login));

/* 쿼리 토큰 경로(네이티브)로 /me — 앱이 EXE 에서 쓰는 방식 */
const meQ = await page.evaluate(async () => {
  const tok = localStorage.getItem("sertz.auth.token") || localStorage.getItem("sertz_token") || "";
  const m = await fetch(`/api/auth/me?token=${encodeURIComponent(tok)}`);
  let b = {}; try { b = await m.json(); } catch { /* ignore */ }
  return { status: m.status, user: b?.user?.id ?? null };
});
console.log("쿼리토큰 /me:", JSON.stringify(meQ));
check("쿼리 토큰으로 /me 200", meQ.status === 200 && meQ.user === "admin", JSON.stringify(meQ));

/* 새로고침 후 localStorage 토큰이 살아있는지 → 세션 복구 가능 여부 */
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const afterReload = await page.evaluate(async () => {
  const tok = localStorage.getItem("sertz.auth.token") || localStorage.getItem("sertz_token") || "";
  if (!tok) return { token: false };
  const m = await fetch(`/api/auth/me?token=${encodeURIComponent(tok)}`);
  let b = {}; try { b = await m.json(); } catch { /* ignore */ }
  return { token: true, status: m.status, user: b?.user?.id ?? null };
});
console.log("새로고침 후:", JSON.stringify(afterReload));
check("새로고침 후에도 세션 유지", afterReload.token && afterReload.user === "admin", JSON.stringify(afterReload));

console.log("\n/api 요청:", apiLog.slice(0, 8).join(" | ") || "(없음)");
if (errs.length) console.log("pageerror:", errs.slice(0, 2).join(" | "));
console.log(`\nRESULT ${pass}/${pass + fail}`);

await browser.close();
server.close();
