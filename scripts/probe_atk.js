/* 기본공격 히트 실측 디버그 프로브 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3123;
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
  await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.finishIntro("테스터"); });
  await page.waitForTimeout(500);
  for (let i = 0; i < 6; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(250); }
  let cs = 0;
  for (let i = 0; i < 20 && cs < 3; i++) {
    const d = await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); if (w?.dialoguing) { w.resumeFromDialogue(); return true; } return false; });
    cs = d ? 0 : cs + 1; await page.waitForTimeout(250);
  }
  await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.dialoguing = false; w.introStep = -1; });

  const probe = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    window.__SERTZ_EB__.emit("rpg:gm", { type: "job", value: "mage" });
    await new Promise((r) => setTimeout(r, 400));
    p.gmSetLevel(10);
    // [10] 재현: facing 위, 이동 오른쪽, 공격
    p.hp = p.maxHp; p.mp = p.maxMp;
    p.facing.set(0, -1);
    p.setVelocity(0, 0); p.state = "idle"; p.atkCooldown = 0;
    const V2b = p.facing.constructor;
    p.update(16, new V2b(1, 0), true);
    await new Promise((r) => setTimeout(r, 200));
    const act = w.pProjPool.filter((x) => x.active);
    const projs = act.map((x) => ({ vx: Math.round(x.body.velocity.x), vy: Math.round(x.body.velocity.y), tex: x.texture.key }));
    return { projs, facing: { x: Math.round(p.facing.x * 100) / 100, y: Math.round(p.facing.y * 100) / 100 }, state: p.state, cls: p.cls };
    w.requestSummon("wolf", 1, p.x + 70, p.y);
    await new Promise((r) => setTimeout(r, 400));
    const e = w.enemies.find((x) => x.alive && x.active);
    if (!e) return { err: "no-enemy", count: w.enemies.length };
    e.body.reset(p.x + 70, p.y);
    e.x = p.x + 70; e.y = p.y;
    p.facing.set(1, 0);
    p.setVelocity(0, 0); p.state = "idle";
    let hits = 0;
    const orig = e.takeDamage.bind(e);
    e.takeDamage = (...a) => { hits++; return orig(...a); };
    const states = [];
    // state 변경 감시 — setter 트레이스
    let _st = p.state;
    Object.defineProperty(p, "state", {
      configurable: true,
      get() { return _st; },
      set(v) {
        const t = Math.round(performance.now() % 100000);
        states.push(`${_st}->${v}@${t}`);
        _st = v;
      },
    });
    const V2 = p.facing.constructor; p.update(16, new V2(0, 0), true);
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 30));
    }
    const dist = Math.hypot(e.x - p.x, e.y - p.y);
    return { hits, finalState: _st, dist, transitions: states };
  });
  console.log(JSON.stringify(probe, null, 2));
  await browser.close();
  srv.kill();
})();
