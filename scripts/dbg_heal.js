/** 자가치유 미발동 원인 진단 — protectedDark 요소 + fadeDarkMs 추적 */
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
  await page.evaluate(() => window.__SERTZ_SCENE__.cameras.main.fadeOut(400, 0, 0, 0));
  await page.waitForTimeout(4000);
  const st = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const f = s.cameras?.main?.fadeEffect;
    return { dialoguing: s.dialoguing, sleeping: s.sleeping, dead: s.player?.state, trans: s.transitioning,
      fadeDarkMs: s.fadeDarkMs, run: f?.isRunning, prog: f ? Math.round(f.progress * 100) / 100 : null,
      dir: f?.direction };
  });
  console.log("fadeOut 4초 후:", JSON.stringify(st));
  await page.waitForTimeout(5000);
  const st2 = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    const f = s.cameras?.main?.fadeEffect;
    return { dialoguing: s.dialoguing, fadeDarkMs: s.fadeDarkMs, run: f?.isRunning,
      prog: f ? Math.round(f.progress * 100) / 100 : null, dir: f?.direction };
  });
  console.log("9초 후:", JSON.stringify(st2));
  await browser.close();
})();
