/** 픽셀 휘도 실측 — resetFX 후 실제 화면이 밝아지는지 (canvas 픽셀 직접 샘플) */
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--disable-web-security"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(process.env.SERTZ_URL || "http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(6000);
  await page.evaluate(() => localStorage.removeItem("sertz_save_v2"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  for (let i = 0; i < 3; i++) {
    const c = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("새로운 모험"));
      if (b) { b.click(); return true; } return false;
    });
    if (c) break; await page.waitForTimeout(2500);
  }
  await page.waitForTimeout(4000);

  const lum = () => page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return -1;
    const ctx = c.getContext("2d");
    if (!ctx) return -2;
    const d = ctx.getImageData(Math.floor(c.width / 2) - 40, Math.floor(c.height / 2) - 40, 80, 80).data;
    let s = 0, n = 0;
    for (let i = 0; i < d.length; i += 40) { s += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; }
    return Math.round(s / n);
  });

  const before = await lum();
  await page.evaluate(() => window.__SERTZ_SCENE__.cameras.main.fadeOut(300, 0, 0, 0));
  await page.waitForTimeout(3500);
  const dark = await lum();
  const fxState = await page.evaluate(() => {
    const f = window.__SERTZ_SCENE__?.cameras?.main?.fadeEffect;
    const s = window.__SERTZ_SCENE__;
    return { run: f?.isRunning, prog: f ? Math.round(f.progress * 100) / 100 : null, dir: f?.direction, fadeDarkMs: Math.round(s?.fadeDarkMs ?? -1) };
  });
  await page.waitForTimeout(26000); // 자가치유 윈도우
  const after = await lum();
  const fxState2 = await page.evaluate(() => {
    const f = window.__SERTZ_SCENE__?.cameras?.main?.fadeEffect;
    const s = window.__SERTZ_SCENE__;
    return { run: f?.isRunning, prog: f ? Math.round(f.progress * 100) / 100 : null, dir: f?.direction, fadeDarkMs: Math.round(s?.fadeDarkMs ?? -1) };
  });
  console.log(`휘도: 밝기전=${before} 어두움=${dark} 26s후=${after}`);
  console.log("완료시 fx:", JSON.stringify(fxState));
  console.log("26s후 fx:", JSON.stringify(fxState2));
  await browser.close();
})();
