const { chromium } = require("playwright");
const CHROME = "/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome";
const URL = process.env.URL || "http://127.0.0.1:3047";
const OUT = "/root/.hermes/cache/scratch";

(async () => {
  const b = await chromium.launch({ executablePath: CHROME,
    args: ["--no-sandbox","--disable-dev-shm-usage","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on("pageerror", e => errs.push(String(e).slice(0,140)));
  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(8000);

  await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    g.scene.start("world", { stage: "village", fresh: true });
  });
  await p.waitForTimeout(11000);

  /* scene.stop() 은 update 루프만 멈춘다 — 그리기 목록은 남아 어두운 오버레이가 계속 덮는다.
   *  setVisible(false) 로 렌더 파이프라인에서 빼야 한다. */
  const bright = await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    try { g.scene.setVisible(false, "title"); } catch {}
    try { g.scene.stop("title"); } catch {}
    const t = g.scene.getScene("title");
    if (t?.children?.list) t.children.list.slice().forEach(o => { try { o.destroy(); } catch {} });
    const w = g.scene.getScene("world");
    const cam = w.cameras.main;
    // 개활지로 이동 — 맵 중앙
    cam.centerOn(w.stageW * 0.5, w.stageH * 0.55);
    const cv = document.querySelector("canvas");
    const tmp = document.createElement("canvas");
    tmp.width = 64; tmp.height = 64;
    const ctx = tmp.getContext("2d");
    ctx.drawImage(cv, 0, 0, 64, 64);
    const d = ctx.getImageData(0,0,64,64).data;
    let s=0; for (let i=0;i<d.length;i+=4) s += d[i]+d[i+1]+d[i+2];
    return { brightness: Math.round(s/(3*(d.length/4))), zoom: cam.zoom, stageW: w.stageW, stageH: w.stageH };
  });
  await p.waitForTimeout(2500);
  console.log("밝기/상태:", JSON.stringify(bright));

  const cv = await p.$("canvas");
  await cv.screenshot({ path: `${OUT}/shot_ingame.png` });
  // 스킬 버튼 영역 확대
  const vp = p.viewportSize();
  await p.screenshot({ path: `${OUT}/shot_skills2.png`,
    clip: { x: vp.width*0.52, y: vp.height*0.60, width: vp.width*0.48, height: vp.height*0.40 } });
  console.log("pageerror:", errs.length, errs.slice(0,2));
  await b.close();
})();
