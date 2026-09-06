/** 수비전 퇴장 완료 시점 실측 (가상시간 늘어짐 감안) */
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
  await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:gm", { type: "gate" }));
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__SERTZ_SCENE__.finishGate("exit"));
  const t0 = Date.now();
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      const f = s?.cameras?.main?.fadeEffect;
      return { key: s?.stageDef?.key, trans: s?.transitioning, run: !!f?.isRunning,
        dark: !!(f && f.direction === true && f.progress >= 0.99 && !f.isRunning),
        fps: Math.round(s?.game?.loop?.actualFps ?? -1) };
    });
    console.log(`+${Math.round((Date.now() - t0) / 100) / 10}s:`, JSON.stringify(st));
    if (st.key === "village" && !st.trans) { console.log("GATE EXIT COMPLETED"); break; }
  }
  await browser.close();
})();
