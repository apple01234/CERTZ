/* v3.0.5 디버그 — skill4 미발동 원인 추적 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3125;
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

async function gmSet(page, job, lv) {
  await page.evaluate(([j, l]) => {
    const eb = window.__SERTZ_EB__;
    eb.emit("rpg:gm", { type: "job", value: j });
    eb.emit("rpg:gm", { type: "lv", value: l });
    eb.emit("rpg:gm", { type: "heal" });
  }, [job, lv]);
  await page.waitForTimeout(400);
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 200)); });

  await enterWorld(page);
  await gmSet(page, "warbringer", 120);

  const trace = await page.evaluate(() => {
    return new Promise((res) => {
      const eb = window.__SERTZ_EB__;
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      const log = [];
      log.push({ t: 0, state: p.state, mp: p.mp, cd3: p.skill3Cd, cd4: p.skill4Cd, u4: p.skill4Unlocked, cls: p.cls });
      eb.emit("input:skill3");
      log.push({ t: 10, state: p.state, mp: p.mp, cd3: p.skill3Cd, cd4: p.skill4Cd });
      const iv = setInterval(() => {
        log.push({ t: Date.now() % 100000, state: p.state, cd3: p.skill3Cd, cd4: p.skill4Cd });
      }, 60);
      setTimeout(() => {
        eb.emit("input:skill4");
        clearInterval(iv);
        setTimeout(() => {
          log.push({ t: "after+150", state: p.state, mp: p.mp, cd4: p.skill4Cd });
          res(log);
        }, 150);
      }, 240);
    });
  });
  for (const l of trace) console.log(JSON.stringify(l));

  await browser.close();
  srv.kill();
  process.exit(0);
})();
