const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ executablePath: "/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome",
    args: ["--no-sandbox","--disable-dev-shm-usage","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto("http://127.0.0.1:3047", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(9000);
  await p.evaluate(() => { window.__SERTZ__.EventBus.emit("game:new", {}); });
  await p.waitForTimeout(13000);
  const before = await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    const cv = document.querySelector("canvas");
    const t = document.createElement("canvas"); t.width=64; t.height=64;
    const c = t.getContext("2d"); c.drawImage(cv,0,0,64,64);
    const d = c.getImageData(0,0,64,64).data; let s=0;
    for (let i=0;i<d.length;i+=4) s+=d[i]+d[i+1]+d[i+2];
    const title = g.scene.getScene("title");
    return { bright: Math.round(s/(3*(d.length/4))),
      titleStatus: title?.scene.settings.status, titleVis: title?.scene.settings.visible,
      titleObjs: title?.children?.list?.length ?? 0 };
  });
  console.log("수정 전:", JSON.stringify(before));

  // 타이틀 씬 완전 제거 + 월드 카메라 재개
  const after = await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    try {
      const t = g.scene.getScene("title");
      t.children.list.slice().forEach(o => { try { o.destroy(); } catch {} });
      g.scene.stop("title");
      g.scene.remove("title");
    } catch {}
    const w = g.scene.getScene("world");
    w.cameras.main.fadeIn(1, 0, 0, 0);
    w.cameras.main.setAlpha(1);
    w.cameras.main.centerOn(w.stageW*0.5, w.stageH*0.55);
    const cv = document.querySelector("canvas");
    const t2 = document.createElement("canvas"); t2.width=64; t2.height=64;
    const c = t2.getContext("2d"); c.drawImage(cv,0,0,64,64);
    const d = c.getImageData(0,0,64,64).data; let s=0;
    for (let i=0;i<d.length;i+=4) s+=d[i]+d[i+1]+d[i+2];
    return { bright: Math.round(s/(3*(d.length/4))), scenes: g.scene.getScenes(true).map(x=>x.scene.key) };
  });
  await p.waitForTimeout(2000);
  const final = await p.evaluate(() => {
    const cv = document.querySelector("canvas");
    const t = document.createElement("canvas"); t.width=64; t.height=64;
    const c = t.getContext("2d"); c.drawImage(cv,0,0,64,64);
    const d = c.getImageData(0,0,64,64).data; let s=0;
    for (let i=0;i<d.length;i+=4) s+=d[i]+d[i+1]+d[i+2];
    return { bright: Math.round(s/(3*(d.length/4))) };
  });
  console.log("수정 후:", JSON.stringify(after), "2초 뒤:", JSON.stringify(final));
  const cv = await p.$("canvas");
  await cv.screenshot({ path: "/root/.hermes/cache/scratch/shot_ingame.png" });
  await b.close();
})();
