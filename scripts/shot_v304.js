/* v3.0.4 시각 검증 — 활 방향(우/좌 조준) + 신규 몬스터 렌더 스크린샷 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3123;
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
  await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.dialoguing = false; w.introStep = -1; w.sleepPending = false; if (w.dialoguing) w.resumeFromDialogue(); w.physics.world.resume(); });
  await page.waitForTimeout(300);

  // 궁수로 전직 — 오른쪽 조준 스크린샷
  await page.evaluate(() => {
    const eb = window.__SERTZ_EB__;
    eb.emit("rpg:gm", { type: "job", value: "ranger" });
    eb.emit("rpg:gm", { type: "lv", value: 15 });
    eb.emit("rpg:gm", { type: "heal" });
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    p.facing.set(1, 0); p.setFlipX(false); p.flipX = false;
    w.syncWeaponSprite();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "scripts/shot_v304_bow_right.png" });

  // 왼쪽 조준
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    p.facing.set(-1, 0); p.setFlipX(true); p.flipX = true;
    w.syncWeaponSprite();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "scripts/shot_v304_bow_left.png" });

  // 신규 몬스터 — forest1 고블린 근처로
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave("forest1");
    w.scene.restart({ stage: "forest1", save: carry });
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (w.dialoguing) w.resumeFromDialogue();
    w.dialoguing = false; w.introStep = -1; w.physics.world.resume();
    const wb = w.physics.world.bounds, p = w.player;
    const gob = w.enemies.find((e) => e.active && e.def.key === "x3_goblin");
    if (gob) {
      const nx = Math.min(Math.max(p.x + 130, 80), wb.width - 80);
      const ny = Math.min(Math.max(p.y - 20, 80), wb.height - 80);
      if (gob.body?.reset) gob.body.reset(nx, ny); else { gob.x = nx; gob.y = ny; }
      gob.applyStun?.(4000);
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "scripts/shot_v304_goblin.png" });

  // abyss1 거대 시체
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave("abyss1");
    w.scene.restart({ stage: "abyss1", save: carry });
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (w.dialoguing) w.resumeFromDialogue();
    w.dialoguing = false; w.introStep = -1; w.physics.world.resume();
    const wb = w.physics.world.bounds, p = w.player;
    const bz = w.enemies.find((e) => e.active && e.def.key === "x3_bigzombie");
    if (bz) {
      const nx = Math.min(Math.max(p.x + 150, 80), wb.width - 80);
      const ny = Math.min(Math.max(p.y - 10, 80), wb.height - 80);
      if (bz.body?.reset) bz.body.reset(nx, ny); else { bz.x = nx; bz.y = ny; }
      bz.applyStun?.(4000);
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "scripts/shot_v304_bigzombie.png" });

  console.log("screenshots saved");
  await browser.close();
  srv.kill();
  process.exit(0);
})();
