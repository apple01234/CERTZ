/* 페이지 자체 RAF 속도 측정 (Phaser 무관) */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({
    args: ["--use-gl=swiftshader", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-features=IntensiveWakeUpThrottling"],
    executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
  });
  const p = await (await b.newContext({ viewport: { width: 800, height: 450 } })).newPage();
  await p.goto("about:blank");
  const raf = await p.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res({ frames: n, ms: Math.round(performance.now() - t0) }); };
    requestAnimationFrame(tick);
  }));
  console.log("RAW RAF:", JSON.stringify(raf));
  await b.close();
})().catch((e) => { console.error("FAIL:", e.message.slice(0, 150)); process.exit(1); });
