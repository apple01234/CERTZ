/** Fade 이펙트 API 실측 — 리셋 수단 탐색 */
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
  await page.waitForTimeout(3500);
  const info = await page.evaluate(async () => {
    const s = window.__SERTZ_SCENE__;
    const cam = s.cameras.main;
    cam.fadeOut(400, 0, 0, 0);
    await new Promise((r) => setTimeout(r, 1600)); // 완료 대기 (완료 후 검은 상태)
    const fx = cam.fadeEffect;
    const props = {};
    if (fx) for (const k of ["isRunning", "isTransition", "progress", "direction", "alpha"]) {
      try { props[k] = fx[k]; } catch { props[k] = "ERR"; }
    }
    const hasResetFX = typeof cam.resetFX === "function";
    const hasFopp = typeof cam.postFX === "object" && cam.postFX !== null;
    /* resetFX 시도 후 상태 */
    let after = null;
    if (hasResetFX) { try { cam.resetFX(); after = { a: cam.alpha, run: fx?.isRunning }; } catch (e) { after = "ERR:" + e.message; } }
    return { props, hasResetFX, hasFopp, after, phaser: s.game.version };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();
