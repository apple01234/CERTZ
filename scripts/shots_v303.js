/* v3.0.3 스크린샷 — 마을 GM NPC / 궁수 활 / 마법사 지팡이 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3120;
const URL = `http://localhost:${PORT}`;

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(640, 400); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__SERTZ__.game.scene.getScene("world").finishIntro("세르츠"));
  await page.waitForTimeout(500);
  for (let i = 0; i < 5; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(260); }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (w.dialoguing) w.resumeFromDialogue();
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    w.physics.world.resume();
  });
  await page.waitForTimeout(300);

  // ① 마을 GM NPC 앞으로 이동 + 스크린샷
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const gm = w.interactables.find((it) => it.kind === "gm");
    if (gm) {
      w.player.body.reset(gm.x - 70, gm.y + 40);
      w.player.setPosition(gm.x - 70, gm.y + 40);
    }
    w.cameras.main.setZoom(1.6);
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: "/home/z/my-project/download/v303_gm_npc.png" });

  // ② 궁수 활 — 필드에서
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave("forest1");
    Object.assign(carry, { cls: "ranger", lv: 12 });
    w.scene.restart({ stage: "forest1", save: carry });
  });
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (w.dialoguing) w.resumeFromDialogue();
    w.dialoguing = false; w.introStep = -1;
    w.physics.world.resume();
    const p = w.player;
    p.facing.set(1, 0);
    w.cameras.main.setZoom(2.2);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "/home/z/my-project/download/v303_bow.png" });

  // ③ 마법사 지팡이
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave("forest1");
    Object.assign(carry, { cls: "mage", lv: 12 });
    w.scene.restart({ stage: "forest1", save: carry });
  });
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (w.dialoguing) w.resumeFromDialogue();
    w.dialoguing = false; w.introStep = -1;
    w.physics.world.resume();
    const p = w.player;
    p.facing.set(1, 0);
    w.cameras.main.setZoom(2.2);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "/home/z/my-project/download/v303_staff.png" });

  // ④ GM 패널 UI
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    window.__SERTZ_EB__.emit("ui:panel", { panel: "gm" });
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "/home/z/my-project/download/v303_gm_panel.png" });

  console.log("screenshots saved");
  await browser.close();
  srv.kill();
  process.exit(0);
})();
