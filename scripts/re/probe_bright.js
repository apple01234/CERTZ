const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ executablePath: "/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome",
    args: ["--no-sandbox","--disable-dev-shm-usage","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto("http://127.0.0.1:3047", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(8000);
  await p.evaluate(() => { const g=window.__SERTZ__.game; g.scene.start("world",{stage:"village",fresh:true}); });
  await p.waitForTimeout(12000);
  const info = await p.evaluate(() => {
    const g = window.__SERTZ__.game;
    const w = g.scene.getScene("world");
    const cam = w.cameras.main;
    // 캔버스 2D 컨텍스트로 실제 픽셀 읽기 (WebGL 이면 toDataURL)
    const cv = document.querySelector("canvas");
    let brightness = null;
    try {
      const tmp = document.createElement("canvas");
      tmp.width = 64; tmp.height = 64;
      const ctx = tmp.getContext("2d");
      ctx.drawImage(cv, 0, 0, 64, 64);
      const d = ctx.getImageData(0,0,64,64).data;
      let s=0; for (let i=0;i<d.length;i+=4) s += d[i]+d[i+1]+d[i+2];
      brightness = Math.round(s/(3*(d.length/4)));
    } catch(e) { brightness = "err:"+String(e).slice(0,40); }
    return {
      brightness,
      camAlpha: cam.alpha, camZoom: cam.zoom, camScroll: {x:Math.round(cam.scrollX), y:Math.round(cam.scrollY)},
      stageW: w.stageW, stageH: w.stageH,
      worldObjs: w.children.list.length,
      titleAlive: !!g.scene.getScene("title")?.children?.list?.length,
      bgColor: cam.backgroundColor?.rgba ?? null,
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})();
