const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ executablePath: "/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome",
    args: ["--no-sandbox","--disable-dev-shm-usage","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto("http://127.0.0.1:3047", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(9000);
  await p.evaluate(() => { window.__SERTZ__.EventBus.emit("game:new", {}); });
  await p.waitForTimeout(13000);
  const info = await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    const w = g.scene.getScene("world");
    const rects = w.children.list.filter(o => o.type === "Rectangle" && o.width >= 600)
      .map(o => ({ d: o.depth, a: o.alpha, fill: o.fillColor, sf: o.scrollFactorX,
                   w: Math.round(o.width), h: Math.round(o.height), vis: o.visible }));
    // UI 씬 전체
    const all = g.scene.getScenes(false).map(s => ({ k: s.scene.key, st: s.scene.settings.status, vis: s.scene.settings.visible }));
    return { rects, all, camBg: w.cameras.main.backgroundColor?.rgba };
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})();
