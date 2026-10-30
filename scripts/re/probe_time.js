const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ executablePath: "/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome",
    args: ["--no-sandbox","--disable-dev-shm-usage","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto("http://127.0.0.1:3047", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(10000);
  const a = await p.evaluate(() => {
    const t = window.__SERTZ__.game.scene.getScene("title");
    return { started: t.started, launched: t.launched, status: t.scene.settings.status,
             timePaused: t.time.paused, timeScale: t.time.timeScale, now: Math.round(t.time.now) };
  });
  console.log("클릭 전:", JSON.stringify(a));
  await p.evaluate(() => { window.__SERTZ__.EventBus.emit("game:new", {}); });
  for (const ms of [300, 900, 2000, 4000]) {
    await p.waitForTimeout(ms);
    const s = await p.evaluate(() => {
      const g = window.__SERTZ__.game; const t = g.scene.getScene("title");
      return { scenes: g.scene.getScenes(true).map(x=>x.scene.key), started: t?.started,
               launched: t?.launched, status: t?.scene.settings.status,
               timePaused: t?.time?.paused, now: Math.round(t?.time?.now ?? 0),
               fadeOutRunning: !!t?.cameras?.main?.fadeEffect?.isRunning };
    });
    console.log(`+${ms}ms:`, JSON.stringify(s));
  }
  await b.close();
})();
