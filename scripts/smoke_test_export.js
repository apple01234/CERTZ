/* 정적 export(.next-apk) 스모크 테스트 — APK WebView와 동일한 정적 서빙 환경 재현 */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = "/home/z/my-project/.next-apk";
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".ogg": "audio/ogg", ".mp3": "audio/mpeg",
  ".json": "application/json", ".svg": "image/svg+xml", ".txt": "text/plain",
  ".woff2": "font/woff2", ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.join(ROOT, p);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  } else {
    res.writeHead(404); res.end("nf");
  }
});

(async () => {
  await new Promise((r) => server.listen(8899, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  const failed404 = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  page.on("response", (r) => { if (r.status() === 404) failed404.push(r.url().slice(-70)); });
  await page.goto("http://localhost:8899/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(9000); // Phaser 부팅 + 타이틀 렌더
  const canvas = await page.evaluate(() => !!document.querySelector("canvas"));
  const title = await page.evaluate(() => document.title);
  await page.screenshot({ path: "/home/z/my-project/scripts/apk-smoke-title.png" });
  // 타이틀에서 게임 시작(스토리 인트로) 시도 — canvas 클릭
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "/home/z/my-project/scripts/apk-smoke-2.png" });
  console.log("canvas:", canvas, "| title:", title);
  console.log("404s:", failed404.length ? failed404.slice(0, 8) : "none");
  console.log("consoleErrors:", errors.length ? errors.slice(0, 8) : "none");
  await browser.close();
  server.close();
  process.exit(0);
})().catch((e) => { console.error("SMOKE FAIL:", e.message); process.exit(1); });
