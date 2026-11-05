/**
 * vc251 — PC 클라이언트(Electron) 로그인 실증.
 *
 * [왜 이 방식인가]
 *  Electron 은 `http://127.0.0.1:<port>` 에 내장 HTTP 서버를 띄우고
 *  `/api/*` 요청을 `https://sertz.vercel.app` 로 **투명 프록시**한다(electron/main.js proxyApi).
 *  로그인 불가의 원인은 그 프록시가 그대로 전달하는 Set-Cookie 의 `Secure` 속성이었다.
 *  따라서 **electron/main.js 의 프록시 코드를 그대로 실행**해서
 *  127.0.0.1 오리진에서 Set-Cookie 가 실제로 어떻게 내려오는지 보는 것이 실증이다.
 *
 * 검사:
 *  1) 로컬 오리진(http)에서는 Secure 없이 내려온다 → Chromium 이 저장 가능
 *  2) 발급된 토큰으로 /api/auth/me 가 200 + user 를 돌려준다(세션 유효)
 *  3) 로그아웃 쿠키도 같은 규칙
 */
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const API_UPSTREAM = "https://sertz.vercel.app";
const HOP_HEADERS = /^(connection|keep-alive|proxy-authenticate|proxy-authorization|te|trailer|transfer-encoding|upgrade)$/i;

/* electron/main.js 의 proxyApi 와 동일 로직 (여기선 검증용으로 필요한 부분만 동일하게 재현) */
function proxyApi(req, res, body) {
  const upstream = new URL(API_UPSTREAM + req.url);
  const headers = { ...req.headers };
  for (const h of Object.keys(headers)) if (HOP_HEADERS.test(h)) delete headers[h];
  delete headers.host; delete headers.origin; delete headers.referer;
  const mod = upstream.protocol === "https:" ? https : http;
  const preq = mod.request(
    { protocol: upstream.protocol, hostname: upstream.hostname, port: upstream.port || 443, path: upstream.pathname + upstream.search, method: req.method, headers },
    (pres) => {
      const sc = pres.headers["set-cookie"];
      /* electron/main.js 와 동일: Domain 속성만 제거 (Secure 는 여기서 건드리지 않는다) */
      if (sc) pres.headers["set-cookie"] = sc.map((c) => c.replace(/;\s*domain=[^;]+/gi, ""));
      const out = {};
      for (const [k, v] of Object.entries(pres.headers)) if (!HOP_HEADERS.test(k)) out[k] = v;
      res.writeHead(pres.statusCode || 502, out);
      pres.pipe(res);
    }
  );
  preq.setTimeout(15000, () => preq.destroy(new Error("timeout")));
  preq.on("error", () => { if (!res.headersSent) { res.writeHead(502); res.end("{}"); } });
  if (body) preq.end(body); else req.pipe(preq);
}

let pass = 0, fail = 0;
const check = (n, c, d = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${d ? " — " + d : ""}`); } };

/* 로컬 서버 = Electron 내장 서버와 같은 http://127.0.0.1 오리진 */
const server = http.createServer((req, res) => {
  if ((req.url || "").startsWith("/api/")) {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => proxyApi(req, res, body || undefined));
  } else { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}`;
console.log(`Electron 오리진 흉내: ${BASE}`);

const call = (url, opts = {}) => new Promise((resolve, reject) => {
  const u = new URL(BASE + url);
  const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: opts.method || "GET", headers: opts.headers || {} }, (res) => {
    let data = "";
    res.on("data", (c) => (data += c));
    res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
  });
  req.on("error", reject);
  if (opts.body) req.write(opts.body);
  req.end();
});

/* 1) 로그인 */
const login = await call("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id: "admin", pw: "sertz2026!" }),
});
const setCookie = [].concat(login.headers["set-cookie"] || []).join(" | ");
console.log("  set-cookie:", setCookie.slice(0, 150) || "(없음)");
check("로그인 200", login.status === 200, `HTTP ${login.status}`);
check("로컬(http) 오리진 쿠키에 Secure 없음", setCookie.length > 0 && !/;\s*Secure/i.test(setCookie), setCookie.slice(0, 140));
check("쿠키에 HttpOnly 유지", /HttpOnly/i.test(setCookie), setCookie.slice(0, 120));

let token = "";
try { token = JSON.parse(login.body).token || ""; } catch { /* ignore */ }
check("응답에 세션 토큰", token.length >= 32, token ? `len ${token.length}` : "(없음)");

/* 2) 쿠키만으로 세션 확인 — Chromium 이 실제로 보내는 형태 그대로 */
if (setCookie) {
  const cookiePair = setCookie.split("|")[0].split(";")[0].trim();
  const me = await call("/api/auth/me", { headers: { Cookie: cookiePair } });
  let uid = null;
  try { uid = JSON.parse(me.body)?.user?.id ?? null; } catch { /* ignore */ }
  check("쿠키만으로 /api/auth/me 200", me.status === 200, `HTTP ${me.status} ${me.body.slice(0, 80)}`);
  check("세션 유효(user 반환)", uid === "admin", String(uid));
}

/* 3) 로그아웃 쿠키 규칙 */
const out = await call("/api/auth/logout", { method: "POST", headers: { Cookie: setCookie.split("|")[0].split(";")[0].trim() } });
const outCookie = [].concat(out.headers["set-cookie"] || []).join(" | ");
check("로그아웃 200", out.status === 200, `HTTP ${out.status}`);
check("로그아웃 쿠키(http) Secure 없음", outCookie.length > 0 && !/;\s*Secure/i.test(outCookie), outCookie.slice(0, 120));

server.close();
console.log(`\nRESULT ${pass}/${pass + fail} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
