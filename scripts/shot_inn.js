const { chromium } = require("playwright");
const { spawn } = require("child_process");
(async () => {
  const srv = spawn("node", ["server.js"], { cwd: "/home/z/my-project", env: { ...process.env, PORT: "3109" }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch("http://localhost:3109/socket.io/?EIO=4&transport=polling"); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto("http://localhost:3109", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(640, 400); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave("interior_inn");
    w.scene.restart({ stage: "interior_inn", save: carry });
  });
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.player.setPosition(416, 240);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/home/z/my-project/scripts/v23-inn-top.png" });
  await browser.close();
  srv.kill();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
