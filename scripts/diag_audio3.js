/* 부트 로드 네트워크 추적 — audio 요청 여부 + 콘솔 에러 */
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const audioReqs = [];
  const consoleMsgs = [];
  page.on("request", (r) => { if (r.url().includes("/audio/")) audioReqs.push(r.url().split("/").slice(-2).join("/")); });
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consoleMsgs.push(m.type() + ": " + m.text().slice(0, 120)); });
  await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => {
    const g = (window).__SERTZ__?.game;
    return g ? { audioCache: g.cache.audio.getKeys().length, sceneKeys: g.scene.scenes.map((s) => s.scene.settings.key + (s.scene.isActive() ? "*" : "")) } : { no: "game" };
  });
  console.log("audio reqs:", audioReqs.length, audioReqs.slice(0, 5));
  console.log("console:", consoleMsgs.slice(0, 6));
  console.log("info:", JSON.stringify(info));
  await browser.close();
})();
