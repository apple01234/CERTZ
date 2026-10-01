const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text().slice(0, 200)); });
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
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
  await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:gm", { type: "dojang" }));
  await page.waitForTimeout(3000);
  const st = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    return {
      key: s.stageDef.key, returnActive: s.returnActive,
      hasReturnPortal: !!s.returnPortal, portalXY: s.returnPortal ? [Math.round(s.returnPortal.x), Math.round(s.returnPortal.y)] : null,
      playerXY: [Math.round(s.player.x), Math.round(s.player.y)],
      dojangActive: s.dojangActive, trans: s.transitioning,
    };
  });
  console.log("도장 상태:", JSON.stringify(st));
  await page.evaluate(() => window.__SERTZ_SCENE__.enterPrevStage());
  await page.waitForTimeout(600);
  const mid = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    return { key: s.stageDef.key, trans: s.transitioning, dojangActive: s.dojangActive, camAlpha: s.cameras.main.alpha };
  });
  console.log("enterPrevStage 직후:", JSON.stringify(mid));
  await page.waitForTimeout(1800);
  const fin = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    return { key: s.stageDef.key, trans: s.transitioning, camAlpha: s.cameras.main.alpha };
  });
  console.log("1.8초 후:", JSON.stringify(fin));
  await browser.close();
})().catch((e) => { console.error("CRASH", e.message); process.exit(2); });
