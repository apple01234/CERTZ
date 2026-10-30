const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ executablePath: "/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome",
    args: ["--no-sandbox","--disable-dev-shm-usage","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const logs = []; p.on("console", m => logs.push(m.text().slice(0,100)));
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0,200)));
  await p.goto("http://127.0.0.1:3047", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(10000);
  const pre = await p.evaluate(() => {
    const t = window.__SERTZ__.game.scene.getScene("title");
    return { deferDone: t?.deferDone, launched: t?.launched,
             totalToLoad: t?.load?.totalToLoad, isLoading: t?.load?.isLoading?.() ?? null,
             deferFlag: window.__SERTZ_DEFER_DONE__ ?? null,
             status: t?.scene.settings.status };
  });
  console.log("진입 전:", JSON.stringify(pre));
  await p.evaluate(() => { window.__SERTZ__.EventBus.emit("game:new", {}); });
  await p.waitForTimeout(4000);
  const mid = await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    const t = g.scene.getScene("title");
    return { scenes: g.scene.getScenes(true).map(x=>x.scene.key),
             launched: t?.launched, deferDone: t?.deferDone, status: t?.scene.settings.status };
  });
  console.log("2초 후:", JSON.stringify(mid));
  console.log("콘솔(뒤 6):", JSON.stringify(logs.slice(-6)));
  console.log("에러:", errs.slice(0,3));
  await b.close();
})();
