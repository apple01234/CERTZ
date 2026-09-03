/* 오디오 캐시 로드 추적 — bgm_* 요청 실패/캐시 상태 진단 */
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const reqFail = [];
  page.on("requestfailed", (r) => { if (r.url().includes("bgm")) reqFail.push(r.url() + " :: " + (r.failure()?.errorText || "?")); });
  page.on("response", (r) => { if (r.url().includes("bgm") && r.status() !== 200) reqFail.push(r.url() + " :: HTTP " + r.status()); });
  await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const g = (window).__SERTZ__?.game;
    if (!g) return { no: "game" };
    const keys = g.cache.audio.getKeys();
    return {
      total: keys.length,
      bgm: keys.filter((k) => k.startsWith("bgm_")).length,
      sample: keys.filter((k) => k.startsWith("bgm_")).slice(0, 5),
      scene: g.scene.isActive("boot") ? "boot" : g.scene.isActive("title") ? "title" : "world/other",
    };
  });
  console.log(JSON.stringify({ info, reqFail: reqFail.slice(0, 8) }, null, 1));
  await browser.close();
})();
