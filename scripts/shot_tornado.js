/* 토네이도 비주얼 스크린샷 — 스카이로드 하늘의 희망 시전 장면 촬영 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3123;
const URL = `http://localhost:${PORT}`;

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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
      try { const w = window.__SERTZ__.game.scene.getScene("world"); if (!w?.player) return false; w.finishIntro("테스터"); return true; } catch { return false; }
    });
    if (done) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(600);
  // 몬스터 있는 스테이지로 이동 + 스카이로드
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const base = w.buildSave("forest2") || {};
    base.stage = "forest2"; base.cls = "skylord"; base.lv = 100;
    w.scene.restart({ stage: "forest2", save: base });
  });
  await page.waitForTimeout(1800);
  for (let i = 0; i < 10; i++) {
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
    w.dialoguing = false; w.introStep = -1;
    w.player.healFull();
    w.player.mp = 999;
    w.player.useSkill3(); // 하늘의 희망
  });
  await page.waitForTimeout(650);
  await page.screenshot({ path: "/tmp/shot_cyclone.png" });
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.skill3Cd = 0; w.player.state = "idle"; w.player.mp = 999;
    w.player.useSkill4(); // 천공의 폭풍
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: "/tmp/shot_skystorm.png" });
  await browser.close();
  srv.kill();
  console.log("screenshots saved");
})();
