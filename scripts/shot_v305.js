/* v3.0.5 스크린샷 — 스타포스 UI + 모바일 조이스틱 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3126;
const URL = `http://localhost:${PORT}`;

async function enterWorld(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(400, 300); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.__SERTZ__.game.scene.getScene("world").finishIntro("테스터"); });
  await page.waitForTimeout(400);
  for (let i = 0; i < 5; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(260); }
  let streak = 0;
  for (let i = 0; i < 20 && streak < 3; i++) {
    const dlg = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      if (w.dialoguing) { w.resumeFromDialogue(); return true; }
      return false;
    });
    if (dlg) streak = 0; else streak++;
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    w.physics.world.resume();
  });
  await page.waitForTimeout(250);
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();

  // 1) PC — 스타포스 상점 UI (성 9★ 방어구 / 4★ 무기 예시)
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await enterWorld(page);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    p.upgrades.weapon = 4;
    p.upgrades.armor = 9;
    p.addGold(50000);
    w.syncUpgradeGlow();
    w.emitRpgState();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__SERTZ_EB__.emit("ui:panel", { panel: "shop" }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "download/proof-v305/shop_starforce_pc.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // 2) PC — 무기 ★9 강화 오라 (월드 뷰)
  await page.evaluate(() => window.__SERTZ_EB__.emit("ui:panel", { panel: null }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: "download/proof-v305/aura_star9_world.png" });

  // 3) 모바일 — 조이스틱 좌하단 + 축소된 인식 범위 (GM 근처 + 칩)
  const page2 = await browser.newPage({ viewport: { width: 760, height: 720 } });
  await enterWorld(page2);
  await page2.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const gm = w.interactables.find((it) => it.kind === "gm");
    const p = w.player;
    if (p.body && p.body.reset) p.body.reset(gm.x + 55, gm.y);
  });
  await page2.waitForTimeout(900);
  await page2.screenshot({ path: "download/proof-v305/mobile_joystick_chip.png" });

  await browser.close();
  srv.kill();
  console.log("screenshots done");
  process.exit(0);
})();
