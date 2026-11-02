#!/usr/bin/env node
/**
 * pixelfx 81종 전수 검증 (v1.0.0)
 *
 * public/assets/fx 의 모든 시트를 실제 브라우저(Chromium)에서 Phaser 4 로
 * 로드 → 애니메이션 등록 → 재생까지 확인한다.
 *
 * 실행: node tools/verify-pixelfx-all.mjs
 */
import { createServer } from "node:http";
import { readFile, stat, readdir } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FXDIR = join(ROOT, "public/assets/fx");
const PORT = 4401;

const keys = (await readdir(FXDIR)).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
console.log(`시트 ${keys.length}종`);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".webp": "image/webp",
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/") p = "/public/fxall.html";
    const file = p.startsWith("/node_modules") || p.startsWith("/.fxtest")
      ? join(ROOT, p)
      : join(ROOT, "public", p.replace(/^\/public/, ""));
    await stat(file);
    const buf = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(buf);
  } catch { res.writeHead(404).end("nf"); }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
/* 시트 키를 페이지에 주입 */
await page.addInitScript(`window.__FX_KEYS = ${JSON.stringify(keys)};`);
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load", timeout: 60000 });

let ok = false;
try {
  await page.waitForFunction("window.__FX_OK !== undefined", { timeout: 90000 });
  ok = await page.evaluate("window.__FX_OK");
} catch { ok = false; }

console.log("--- 출력 ---");
console.log(await page.evaluate("document.getElementById('out').textContent"));
if (errs.length) console.log("--- pageerror ---\n" + errs.slice(0, 5).join("\n"));

await browser.close();
server.close();
console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"} (${keys.length}종)`);
process.exit(ok ? 0 : 1);
