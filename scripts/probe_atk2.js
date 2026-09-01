/* 기본공격 다연타 실측 프로브 v2 — warrior/berserker + 위치 샘플링 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3124;
const URL = `http://localhost:${PORT}`;

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 150)));
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(400, 300); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);
  for (let i = 0; i < 6; i++) {
    const done = await page.evaluate(() => {
      try {
        const w = window.__SERTZ__.game.scene.getScene("world");
        if (!w?.player) return false;
        w.finishIntro("테스터"); return true;
      } catch { return false; }
    });
    if (done) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(400);
  for (let i = 0; i < 6; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(250); }
  let cs = 0;
  for (let i = 0; i < 20 && cs < 3; i++) {
    const d = await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); if (w?.dialoguing) { w.resumeFromDialogue(); return true; } return false; });
    cs = d ? 0 : cs + 1; await page.waitForTimeout(250);
  }
  await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.dialoguing = false; w.introStep = -1; });

  const result = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    // buy 가드 소스 확인
    const buySrc = String(p.buy).slice(0, 300);
    const it = window.__SERTZ_DEBUG__.items["bd_guardian"];
    let buyRes = null;
    try { buyRes = p.buy("bd_guardian"); } catch (e) { buyRes = "ERR:" + e; }
    return { buySrc, tradeLock: it?.tradeLock, buyRes, owned: p.owned.includes("bd_guardian"), gold: p.gold };
    window.__SERTZ_EB__.emit("rpg:gm", { type: "job", value: "warrior" });
    await new Promise((r) => setTimeout(r, 500));
    p.gmSetLevel(1);
    w.requestSummon("wolf", 1, p.x + 70, p.y);
    await new Promise((r) => setTimeout(r, 400));
    const e = w.enemies[w.enemies.length - 1];
    if (!e || !e.alive) return { err: "no-enemy" };
    p.facing.set(1, 0);
    p.setVelocity(0, 0); p.state = "idle";
    let hits = 0;
    const dmgLog = [];
    const orig = e.takeDamage.bind(e);
    e.takeDamage = (...a) => { hits++; dmgLog.push([Math.round(p.x), Math.round(e.x), p.state]); return orig(...a); };
    const pin = setInterval(() => { if (e.active && e.alive) e.body.reset(p.x + 70, p.y); }, 40);
    const V2 = p.facing.constructor; p.update(16, new V2(0, 0), true);
    const samples = [];
    for (let i = 0; i < 13; i++) {
      await new Promise((r) => setTimeout(r, 60));
      samples.push({ t: i * 60, st: p.state, ex: Math.round(e.x - p.x), alive: e.alive });
    }
    clearInterval(pin);
    e.takeDamage = orig;
    return { hits, dmgLog, cls: p.cls, tier: p.tier, atkTotal: p.atkTotal, eHp: e.hp, samples: samples.slice(0, 8) };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  srv.kill();
})();
