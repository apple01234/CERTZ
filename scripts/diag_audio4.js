/* 캐시 40종 도달 여부 추적 — 어느 트랙이 빠지는지 */
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("canvas", { timeout: 20000 });
  const snaps = [];
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(5000);
    const s = await page.evaluate(() => {
      const g = (window).__SERTZ__?.game;
      if (!g) return null;
      const keys = g.cache.audio.getKeys();
      const bgm = keys.filter((k) => k.startsWith("bgm_"));
      const have = new Set(bgm);
      const want = ((window).__SERTZ_DEBUG__.bgm.playlists && Object.values((window).__SERTZ_DEBUG__.bgm.playlists).flat()) || [];
      const missing = want.filter((k) => !have.has(k));
      return { total: keys.length, bgm: bgm.length, missing };
    });
    snaps.push(s);
    if (s && s.bgm >= 40) break;
  }
  console.log(JSON.stringify(snaps, null, 1));
  await browser.close();
})();
