/**
 * vc251 진단 — EXE(Electron) 클라이언트 로그인 재현.
 *
 * [배경] 사용자 보고: "pc 클라이언트에서 로그인 안됨".
 *  Electron 은 `http://127.0.0.1:<port>` 에서 정적 export(electron/game)를 서빙하고
 *  `/api/*` 를 `https://sertz.vercel.app` 로 프록시한다.
 *
 * [가설 검증] 앞서 "Secure 쿠키 때문"이라고 판단했지만 직접 재보니 Chromium 은
 *  `http://127.0.0.1` 에서도 Secure 쿠키를 저장했다 → **가설 폐기**.
 *  이제 실제 Electron 을 띄워 로그인 요청이 어디로·어떻게 나가고 무엇을 돌려받는지 본다.
 *
 * [방법] electron/main.js 를 그대로 require 하지 않고(창이 뜸), 같은 서버 로직을 재현해
 *  Playwright(Chromium)로 electron/game 을 로드한 뒤 로그인을 시도한다.
 *  → 렌더러가 실제로 보는 오리진·apiBase·응답을 정확히 관찰할 수 있다.
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

if (!fs.existsSync(path.join(GAME_DIR, "index.html"))) {
  console.error("electron/game 없음 — scripts/stage-electron-game.sh 먼저 실행");
  process.exit(2);
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".woff2": "font/woff2" };

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  let fp = path.join(GAME_DIR, urlPath);
  if (!fp.startsWith(GAME_DIR)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    const alt = urlPath.endsWith("/") ? path.join(GAME_DIR, urlPath, "index.html") : path.join(GAME_DIR, urlPath + ".html");
    fp = fs.existsSync(alt) ? alt : path.join(GAME_DIR, "404.html");
  }
  if (!fs.existsSync(fp)) { res.writeHead(404); res.end("not found"); return; }
  const ext = path.extname(fp).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(fp).pipe(res);
}

function proxyApi(req, res, body) {
  const upstream = new URL(API_UPSTREAM + req.url);
  const headers = { ...req.headers };
  for (const h of Object.keys(headers)) if (HOP.test(h)) delete headers[h];
  delete headers.host; delete headers.origin; delete headers.referer;
  const mod = upstream.protocol === "https:" ? https : http;
  const preq = mod.request(
    { protocol: upstream.protocol, hostname: upstream.hostname, port: 443, path: upstream.pathname + upstream.search, method: req.method, headers },
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
  preq.on("error", (e) => { if (!res.headersSent) { res.writeHead(502, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: false, error: "proxy error " + String(e.message).slice(0, 40) })); } });
  if (body !== undefined) preq.end(body); else req.pipe(preq);
}

const server = http.createServer((req, res) => {
  if ((req.url || "").startsWith("/api/")) {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => proxyApi(req, res, chunks.length ? Buffer.concat(chunks) : undefined));
  } else serveStatic(req, res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}`;
console.log(`Electron 오리진: ${BASE}`);

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SERTZ/2.1.0 Chrome/130.0.0.0 Electron/44.1.0 Safari/537.36" });
const page = await ctx.newPage();
const netLog = [];
page.on("request", (r) => { if (r.url().includes("/api/")) netLog.push(`${r.method()} ${r.url().replace(BASE, "")}`); });
page.on("response", async (r) => {
  if (!r.url().includes("/api/")) return;
  let body = "";
  try { body = (await r.text()).slice(0, 120); } catch { /* ignore */ }
  netLog.push(`  → ${r.status()} ${body.replace(/\s+/g, " ")}`);
});
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 160)));

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

/* 렌더러가 판단한 apiBase / 네이티브 여부 */
const env = await page.evaluate(() => ({
  origin: location.origin,
  ua: navigator.userAgent.slice(0, 80),
  isElectronUA: /electron/i.test(navigator.userAgent),
}));
console.log("렌더러:", JSON.stringify(env));

/* 실제 앱과 같은 경로로 로그인 — POST + text/plain (프리플라이트 회피 전략) */
const login = await page.evaluate(async () => {
  const r = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({ id: "admin", pw: "sertz2026!" }),
  });
  let b = {}; try { b = await r.json(); } catch { /* ignore */ }
  return { status: r.status, hasToken: typeof b.token === "string", tokenLen: (b.token || "").length, err: b.error ?? null, user: b?.user?.id ?? null };
});
console.log("로그인:", JSON.stringify(login));

/* 저장된 쿠키 */
const cookies = (await ctx.cookies()).filter((c) => c.name === "sertz_auth");
console.log("sertz_auth 쿠키:", cookies.length ? JSON.stringify(cookies.map((c) => ({ secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite }))) : "(없음)");

console.log("\n--- /api 요청 로그 ---");
console.log(netLog.slice(0, 12).join("\n") || "(없음)");
if (pageErrors.length) console.log("\npageerror:", pageErrors.slice(0, 3).join(" | "));

await browser.close();
server.close();
