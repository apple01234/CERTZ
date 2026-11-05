/**
 * vc251 후속 진단 — PC(Electron) 로그인이 실제로 어디서 실패하는지.
 *
 * [배경] Establish: 운영(Vercel https)은 Set-Cookie 에 Secure 정상.
 *  Electron 은 http://127.0.0.1 오리진에서 게임을 띄우고 /api 를 프록시한다.
 *  프록시→Vercel 구간이 https 이므로 서버는 "https 요청"으로 판정한다.
 *
 * [확인할 것] 최신 Chromium/Electron 이 `http://127.0.0.1` 오리진에서
 *  Secure 쿠키를 실제로 저장하는지/버리는지. 추측하지 말고 쿠키 저장소를 직접 본다.
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3108";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const consoleMsgs = [];
page.on("console", (m) => consoleMsgs.push(`${m.type()}: ${m.text()}`.slice(0, 160)));

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });

/* 페이지 컨텍스트에서 실제 앱 API 경로로 로그인 (same-origin 프록시) */
const res = await page.evaluate(async () => {
  const r = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "admin", pw: "sertz2026!" }),
    credentials: "include",
  });
  let body = {};
  try { body = await r.json(); } catch { /* ignore */ }
  return { status: r.status, hasToken: typeof body.token === "string", tokenLen: (body.token || "").length };
});
console.log("로그인:", JSON.stringify(res));

/* 1) 브라우저가 실제로 저장한 쿠키 */
const cookies = await ctx.cookies();
const authCookies = cookies.filter((c) => c.name === "sertz_auth");
console.log("저장된 sertz_auth 쿠키:", authCookies.length ? JSON.stringify(authCookies.map((c) => ({ name: c.name, domain: c.domain, path: c.path, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite }))) : "(없음 — 저장 거부됨)");

/* 2) 쿠키 없이(토큰만) /me — 앱의 실제 주 경로 */
const meByToken = await page.evaluate(async () => {
  const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "admin", pw: "sertz2026!" }), credentials: "include" });
  const j = await r.json();
  const m = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${j.token}` }, credentials: "include" });
  let b = {}; try { b = await m.json(); } catch { /* ignore */ }
  return { status: m.status, user: b?.user?.id ?? null };
});
console.log("Bearer 로 /me:", JSON.stringify(meByToken));

/* 3) 쿠키만으로(브라우저가 보낸 그대로) /me */
const meByCookie = await page.evaluate(async () => {
  const m = await fetch("/api/auth/me", { credentials: "include" });
  let b = {}; try { b = await m.json(); } catch { /* ignore */ }
  return { status: m.status, user: b?.user?.id ?? null };
});
console.log("쿠키/credentials 로 /me:", JSON.stringify(meByCookie));

/* 4) 새로고침 후에도 세션이 유지되는가 (PC '로그인 안됨'의 핵심 증상) */
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const afterReload = await page.evaluate(async () => {
  const m = await fetch("/api/auth/me", { credentials: "include" });
  let b = {}; try { b = await m.json(); } catch { /* ignore */ }
  const tok = (() => { try { return Object.keys(localStorage).filter((k) => /token/i.test(k)); } catch { return []; } })();
  return { status: m.status, user: b?.user?.id ?? null, tokenKeys: tok };
});
console.log("새로고침 후 /me:", JSON.stringify(afterReload));

console.log("\n콘솔(쿠키 경고 포함):", consoleMsgs.filter((m) => /cookie|secure|auth|201|401/i.test(m)).slice(0, 6).join(" | ") || "(없음)");

await browser.close();
