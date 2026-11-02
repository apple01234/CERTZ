#!/usr/bin/env node
/**
 * pixelfx → Phaser 4 브리지 실브라우저 검증 (v1.0.0)
 *
 * 정적 서버를 띄우고 public/fxtest.html 을 Playwright(Chromium)로 열어
 * 실제로 atlas 로드 → 애니메이션 생성 → 스프라이트 재생까지 되는지 본다.
 *
 * 실행: node tools/verify-pixelfx.mjs
 * 종료코드 0 = 통과.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4399;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".ts": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/") p = "/public/fxtest.html";
    /* /node_modules 와 /src 는 루트 기준, 그 외는 public/ 우선 */
    let file = p.startsWith("/node_modules") || p.startsWith("/src") || p.startsWith("/.fxtest")
      ? join(ROOT, p)
      : (p === "/public/fxtest.html" ? join(ROOT, "public/fxtest.html") : join(ROOT, "public", p));
    await stat(file);
    const buf = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404).end("not found");
  }
});

await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
console.log(`정적 서버 :${PORT}`);

const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(String(e)));

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load", timeout: 30000 });

let ok = false;
try {
  await page.waitForFunction("window.__FX_OK !== undefined", { timeout: 20000 });
  ok = await page.evaluate("window.__FX_OK");
} catch {
  ok = false;
}

const out = await page.evaluate("document.getElementById('out').textContent");
console.log("--- 페이지 출력 ---");
console.log(out);
if (errs.length) {
  console.log("--- 콘솔 오류 ---");
  console.log(errs.slice(0, 8).join("\n"));
}

await browser.close();
server.close();

console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);
