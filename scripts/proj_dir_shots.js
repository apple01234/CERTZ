/* 투사체 방향 시각 검증 — 각 방향 공격 후 투사체 비행 중 스크린샷 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3125;
const URL = `http://localhost:${PORT}`;

async function cleanDialogues(page) {
  for (let i = 0; i < 20; i++) {
    const dlg = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      if (w?.dialoguing) { w.resumeFromDialogue(); return true; }
      return false;
    });
    if (!dlg) break;
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    if (w.physics.world) w.physics.world.resume();
  });
  await page.waitForTimeout(250);
}

async function enterWorld(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(400, 300); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(800);
  for (let i = 0; i < 6; i++) {
    const done = await page.evaluate(() => {
      try {
        const w = window.__SERTZ__.game.scene.getScene("world");
        if (!w?.player) return false;
        w.finishIntro("테스터");
        return true;
      } catch { return false; }
    });
    if (done) break;
    await page.waitForTimeout(500);
  }
  await cleanDialogues(page);
}

const KEY = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await enterWorld(page);

  for (const cls of ["mage", "ranger"]) {
    await page.evaluate((c) => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      w.player.gmSetClass(c);
      w.player.gmSetLevel(30);
      w.player.mp = 999;
      w.player.healFull();
    }, cls);
    await page.waitForTimeout(250);
    for (const dname of ["up", "left", "down", "right"]) {
      await page.keyboard.down(KEY[dname]);
      await page.waitForTimeout(300);
      await page.keyboard.up(KEY[dname]);
      await page.waitForTimeout(130);
      await page.keyboard.press("Space");
      await page.waitForTimeout(120); // 투사체가 플레이어 근처에 있는 시점
      await page.screenshot({ path: `scripts/shot_${cls}_${dname}.png` });
      await page.waitForTimeout(1900);
    }
  }
  console.log("스크린샷 저장 완료: scripts/shot_*.png");
  if (errors.length) console.log("pageerror:", errors.slice(0, 3));
  await browser.close();
  srv.kill();
})();
