/* 디버그2 — v301 궁수 군집 플로우 그대로 재현 + useSkill1 호출 추적 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3119;
const URL = `http://localhost:${PORT}`;

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(640, 400); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__SERTZ__.game.scene.getScene("world").finishIntro("디버그"));
  await page.waitForTimeout(500);

  // setupJob("ranger") — v301과 동일
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave("forest3");
    Object.assign(carry, { cls: "ranger", lv: 15 });
    w.scene.restart({ stage: "forest3", save: carry });
  });
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    if (!p.pets.includes("pet_slime")) p.pets.push("pet_slime");
    p.setPet("pet_slime");
    p.potions.mp = 0; p.potions.hp = 8;
    p.hp = p.maxHp; p.mp = p.maxMp;
    p.skill1Cd = 0; p.skill2Cd = 0;
    w.autoHunt = false;
  });
  await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:autohunt", {}));
  await page.waitForTimeout(300);

  // isolate(3) — v301과 동일
  await page.evaluate((i) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const ts = w.getAllTargets().filter((e) => e.active);
    const tgt = ts[i % ts.length];
    const wb = w.physics.world.bounds;
    const p = w.player;
    const away = (e) => {
      const jx = (Math.random() - 0.5) * 300, jy = (Math.random() - 0.5) * 300;
      const nx = Math.min(Math.max(2 * wb.width / 2 - p.x + jx, 80), wb.width - 80);
      const ny = Math.min(Math.max(2 * wb.height / 2 - p.y + jy, 80), wb.height - 80);
      if (e.body && e.body.reset) e.body.reset(nx, ny); else { e.x = nx; e.y = ny; }
    };
    for (const e of ts) { if (e !== tgt) { away(e); e.setVelocity(0, 0); } }
    for (const e of ts) { e.hp = 999999; e.maxHp = 999999; }
  }, 3);
  await page.waitForTimeout(200);

  // robust cluster 배치 — v301 패치본과 동일
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    const ts = w.getAllTargets().filter((e) => e.active);
    const wb = w.physics.world.bounds;
    const push = (e) => {
      const jx = (Math.random() - 0.5) * 300, jy = (Math.random() - 0.5) * 300;
      const nx = Math.min(Math.max(wb.width - p.x + jx, 80), wb.width - 80);
      const ny = Math.min(Math.max(wb.height - p.y + jy, 80), wb.height - 80);
      if (e.body && e.body.reset) e.body.reset(nx, ny); else { e.x = nx; e.y = ny; }
      e.setVelocity(0, 0);
    };
    const t = ts[0];
    for (const e of ts) { if (e !== t) push(e); }
    const a1 = Math.random() * Math.PI * 2;
    const tx = Math.min(Math.max(p.x + Math.cos(a1) * 210, 80), wb.width - 80);
    const ty = Math.min(Math.max(p.y + Math.sin(a1) * 210, 80), wb.height - 80);
    if (t.body && t.body.reset) t.body.reset(tx, ty); else { t.x = tx; t.y = ty; }
    t.setVelocity(0, 0);
    const o = ts[1];
    if (o.body && o.body.reset) o.body.reset(tx + 240, ty); else { o.x = tx + 240; o.y = ty; }
    o.setVelocity(0, 0);
    p.mp = p.maxMp; p.skill1Cd = 0; p.skill2Cd = 6000; p.state = "idle";
  });

  // useSkill1 모니터 + 분기 추적
  const trace = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    let s1Calls = 0;
    const orig = p.useSkill1.bind(p);
    p.useSkill1 = (...a) => { s1Calls++; return orig(...a); };
    const rec = [];
    for (let i = 0; i < 25; i++) {
      const ds = w.getAllTargets().filter((e) => e.active).map((e) => Math.round(Math.hypot(p.x - e.x, p.y - e.y))).sort((a, b) => a - b);
      rec.push({
        s1Calls,
        st: p.state,
        d0: ds[0], d1: ds[1], d2: ds[2], n: ds.length,
        s1cd: Math.round(p.skill1Cd), mp: Math.round(p.mp),
        ah: w.autoHunt, paused: w.physics.world.isPaused,
      });
      await new Promise((r) => setTimeout(r, 100));
    }
    return rec;
  });
  for (const r of trace) console.log(JSON.stringify(r));
  await browser.close();
  srv.kill();
  process.exit(0);
})();
