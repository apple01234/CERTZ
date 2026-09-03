const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3121;
const URL = `http://localhost:${PORT}`;
(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(640, 400); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);
  await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.finishIntro("테스터"); });
  await page.waitForTimeout(400);
  for (let i = 0; i < 5; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(260); }
  await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.dialoguing = false; w.introStep = -1; w.sleepPending = false; });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave("kingdom2");
    Object.assign(carry, { lv: 12, questIdx: { kingdom2: 99 }, seen: [] });
    w.scene.restart({ stage: "kingdom2", save: carry });
  });
  await page.waitForTimeout(2200);
  const s0 = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { portalActive: !!w.portalActive, repeatOn: !!w.repeatOn, questLen: w.stageDef.quests.length, idx: w.questIdx, boss: !!w.stageDef.boss, dead: w.player?.state };
  });
  console.log("E0 state:", JSON.stringify(s0));
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.portalActive = false; w.pendingPortal = true; w.dialoguing = false;
  });
  for (let t = 0; t < 10; t++) {
    await new Promise((r) => setTimeout(r, 1000));
    const s = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      return { active: !!w.portalActive, pending: !!w.pendingPortal, hold: w.portalHoldSince, now: Math.round(w.time.now), dialog: w.dialoguing, dead: w.player?.state, hp: Math.round(w.player?.hp ?? -1) };
    });
    console.log(`t=${t + 1}s`, JSON.stringify(s));
    if (s.active) break;
  }
  await browser.close();
  srv.kill();
  process.exit(0);
})();
