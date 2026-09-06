/** v4.1.2 전환 지연 진단 — fps·타이머 발화·키 전환 타임라인 실측 */
const { chromium } = require("playwright");
const BASE = process.env.SERTZ_URL || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--disable-web-security"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 120)));
  page.on("console", (m) => { if (m.text().includes("[SERTZ]")) console.log("  log:", m.text().slice(0, 140)); });

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(6000);
  await page.evaluate(() => localStorage.removeItem("sertz_save_v2"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  for (let i = 0; i < 3; i++) {
    const c = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("새로운 모험"));
      if (b) { b.click(); return true; }
      return false;
    });
    if (c) break;
    await page.waitForTimeout(2500);
  }
  await page.waitForTimeout(4500);

  const fps = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    return { fps: Math.round(s?.game?.loop?.actualFps ?? -1), key: s?.stageDef?.key };
  });
  console.log("부팅 후:", JSON.stringify(fps));

  /* forest1로 전진 후 복귀 — 300ms 간격 상세 타임라인 */
  await page.evaluate(() => window.__SERTZ_SCENE__.gotoStage("forest1", null, true));
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(300);
    const st = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      return { key: s?.stageDef?.key, trans: s?.transitioning, a: Math.round((s?.cameras?.main?.alpha ?? -1) * 100) / 100, fps: Math.round(s?.game?.loop?.actualFps ?? -1) };
    });
    console.log(`전진+${(i + 1) * 300}ms:`, JSON.stringify(st));
  }
  await page.evaluate(() => window.__SERTZ_SCENE__.enterPrevStage());
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(300);
    const st = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      return { key: s?.stageDef?.key, trans: s?.transitioning, a: Math.round((s?.cameras?.main?.alpha ?? -1) * 100) / 100, fps: Math.round(s?.game?.loop?.actualFps ?? -1) };
    });
    console.log(`복귀+${(i + 1) * 300}ms:`, JSON.stringify(st));
    if (st.key === "village" && !st.trans && i > 2) break;
  }
  await browser.close();
})();
