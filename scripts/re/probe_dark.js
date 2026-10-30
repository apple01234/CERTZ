const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ executablePath: "/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome",
    args: ["--no-sandbox","--disable-dev-shm-usage","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto("http://127.0.0.1:3047", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(8000);
  await p.evaluate(() => { window.__SERTZ__.game.scene.start("world",{stage:"village",fresh:true}); });
  await p.waitForTimeout(11000);
  await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    try { g.scene.getScene("title").scene.setVisible(false); } catch {}
    try { g.scene.stop("title"); } catch {}
    const t = g.scene.getScene("title");
    if (t?.children?.list) t.children.list.slice().forEach(o => { try { o.destroy(); } catch {} });
  });
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    const w = g.scene.getScene("world");
    const cam = w.cameras.main;
    const list = w.children.list.map(o => ({
      t: o.type, d: o.depth ?? 0, a: o.alpha ?? 1, v: o.visible,
      w: Math.round(o.width||0), h: Math.round(o.height||0),
      x: Math.round(o.x||0), y: Math.round(o.y||0),
      tex: o.texture?.key ?? null,
    }));
    // 큰 면적 + 높은 depth 순
    const big = list.filter(o => o.w >= 600 && o.h >= 400).sort((a,b)=>b.d-a.d).slice(0,10);
    const highDepth = list.filter(o => o.d >= 40).sort((a,b)=>b.d-a.d).slice(0,8);
    return {
      camFade: { running: !!cam.fadeEffect?.isRunning, alpha: cam.fadeEffect?.alpha ?? null },
      camTint: cam.tintTopLeft, camAlpha: cam.alpha,
      total: list.length, big, highDepth,
      sceneCams: g.scene.getScenes(true).map(s=>s.scene.key),
    };
  });
  console.log(JSON.stringify(info, null, 1).slice(0, 2600));
  await b.close();
})();
