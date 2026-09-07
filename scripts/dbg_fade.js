/** 페이드 이펙트 실측 — isRunning·알파·델타 */
const { chromium } = require("playwright");
const BASE = process.env.SERTZ_URL || "http://localhost:3000";
(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--disable-web-security"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
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
  /* 씬 내부에서 페이드 시작→연속 샘플 (평가 지연 제거) */
  const samples = await page.evaluate(async () => {
    const s = window.__SERTZ_SCENE__;
    const cam = s.cameras.main;
    cam.fadeOut(500, 0, 0, 0);
    const out = [];
    for (let i = 0; i < 12; i++) {
      out.push({
        t: i * 250,
        a: Math.round(cam.alpha * 100) / 100,
        run: cam.fadeEffect ? cam.fadeEffect.isRunning : "no-fx",
        fps: Math.round(s.game.loop.actualFps),
      });
      await new Promise((r) => setTimeout(r, 250));
    }
    return out;
  });
  samples.forEach((s) => console.log(JSON.stringify(s)));
  await browser.close();
})();
