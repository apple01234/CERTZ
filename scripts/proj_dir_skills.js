/* 전 클래스(3차/4차) Z·V·B 스킬 투사체 방향 일괄 실측 — facing=up 고정 후 시전 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3126;
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
  await page.waitForTimeout(200);
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

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  await enterWorld(page);

  const CLASSES = ["warrior", "ranger", "mage", "thief",
    "berserker", "guardian", "sniper", "windrunner", "archmage", "sage", "assassin", "swashbuckler",
    "warlord", "paladin", "eagleeye", "tempest", "stormbringer", "chronicle", "nightblade", "duelist",
    "warbringer", "crusader", "deadeye", "skylord", "arclord", "eternal", "shadowlord", "blademaster"];

  const report = [];
  for (const cls of CLASSES) {
    await page.evaluate((c) => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      w.player.gmSetClass(c);
      w.player.gmSetLevel(80);
      w.player.mp = 9999;
      w.player.healFull();
    }, cls);
    await page.waitForTimeout(180);
    for (const [slot, fn] of [["Z", "useSkill1"], ["V", "useSkill3"], ["B", "useSkill4"]]) {
      // facing을 위로: 위 방향키 살짝 눌렀다 뗌
      await page.keyboard.down("ArrowUp");
      await page.waitForTimeout(240);
      await page.keyboard.up("ArrowUp");
      await page.waitForTimeout(120);
      const facing = await page.evaluate(() => {
        const w = window.__SERTZ__.game.scene.getScene("world");
        return { x: Math.round(w.player.facing.x * 100) / 100, y: Math.round(w.player.facing.y * 100) / 100 };
      });
      await page.evaluate((f) => {
        const w = window.__SERTZ__.game.scene.getScene("world");
        w.player.state = "idle";
        w.player.mp = 9999;
        // 쿨다운 전부 0으로
        w.player.skill1Cd = 0; w.player.skill2Cd = 0; w.player.skill3Cd = 0; w.player.skill4Cd = 0;
        w.player[f]();
      }, fn);
      await page.waitForTimeout(420);
      const projs = await page.evaluate(() => {
        const w = window.__SERTZ__.game.scene.getScene("world");
        const out = [];
        for (const p of w.pProjPool || []) {
          if (!p.active) continue;
          out.push({ tex: p.texture.key, vx: Math.round(p.body.velocity.x), vy: Math.round(p.body.velocity.y) });
        }
        return out;
      });
      // 위쪽(vy<0)이어야 함
      const bad = projs.filter((p) => Math.hypot(p.vx, p.vy) >= 40 && !(p.vy < -0.85 * Math.hypot(p.vx, p.vy)));
      report.push({ cls, slot, facing, n: projs.length, bad });
      // 정리 대기
      await page.waitForTimeout(2300);
      await page.evaluate(() => {
        const w = window.__SERTZ__.game.scene.getScene("world");
        for (const p of w.pProjPool || []) { p.setActive(false).setVisible(false); if (p.body) p.body.stop(); }
      }).catch(() => {});
    }
  }
  for (const r of report) {
    const st = r.n === 0 ? "NO-PROJ" : r.bad.length === 0 ? "OK" : "WRONG";
    console.log(`[${st}] ${r.cls} ${r.slot} facing=${r.facing.x},${r.facing.y} n=${r.n}` +
      (r.bad.length ? ` BAD=${JSON.stringify(r.bad.slice(0, 4))}` : ""));
  }
  await browser.close();
  srv.kill();
})();
