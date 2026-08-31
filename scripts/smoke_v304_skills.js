/* v3.0.4 스모크 — 16개 3차기 메커니즘 + 8개 4차기 메커니즘 전부 발동 → pageerror 0 검증
 *  (신규 8종: bloodrage/holynova/arrowrain/cyclone/chainlight/gravity/shadowmine/swordaura) */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3125;
const URL = `http://localhost:${PORT}`;

const T3 = ["warlord", "paladin", "eagleeye", "tempest", "stormbringer", "chronicle", "nightblade", "duelist"];
const T4 = ["warbringer", "crusader", "deadeye", "skylord", "arclord", "eternal", "shadowlord", "blademaster"];

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));

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
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (w.dialoguing) w.resumeFromDialogue();
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
  });
  await page.waitForTimeout(300);

  // 사냥 구역으로 이동 (적이 있는 곳에서 발동 — 타겟 있는 경로 커버)
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
  });
  await page.waitForTimeout(400);

  // 적 5마리를 플레이어 주변에 고정 (기절) — 다수 대상 스킬 판정 경로
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const wb = w.physics.world.bounds, p = w.player;
    w.enemies.filter((e) => e.active && e.alive).slice(0, 5).forEach((e, i) => {
      const ang = (i / 5) * Math.PI * 2;
      const nx = Math.min(Math.max(p.x + Math.cos(ang) * 150, 80), wb.width - 80);
      const ny = Math.min(Math.max(p.y + Math.sin(ang) * 150, 80), wb.height - 80);
      if (e.body?.reset) e.body.reset(nx, ny); else { e.x = nx; e.y = ny; }
      e.applyStun?.(30000);
    });
  });

  // 16개 3차기 + 8개 4차기 순차 발동 (짧은 evaluate + 노드 대기 — 컨텍스트 유지 안전)
  const all = [...T3.map((c) => [c, 3]), ...T4.map((c) => [c, 4])];
  for (const [cls, tier] of all) {
    await page.evaluate(([c, t]) => {
      const eb = window.__SERTZ_EB__;
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      eb.emit("rpg:gm", { type: "job", value: c });
      eb.emit("rpg:gm", { type: "lv", value: t === 3 ? 60 : 120 });
      eb.emit("rpg:gm", { type: "heal" });
    }, [cls, tier]);
    await page.waitForTimeout(500);
    const before = errors.length;
    await page.evaluate((t) => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      p.state = "idle"; p.skill3Cd = 0; p.skill4Cd = 0; p.skill1Cd = 0; p.skill2Cd = 0;
      p.hp = p.maxHp; p.mp = p.maxMp;
      if (w.dialoguing) { w.dialoguing = false; }
      try {
        p.useSkill3();
        p.state = "idle"; p.skill4Cd = 0;
        if (t === 4) p.useSkill4();
      } catch (e) {
        (window).__smokeThrow = String(e);
      }
    }, tier);
    await page.waitForTimeout(1700);
    const r = await page.evaluate(() => ({ threw: window.__smokeThrow ?? null }));
    const threw = r.threw;
    const errs = errors.length - before;
    console.log(`${threw ? "THROW" : errs > 0 ? "ERR " : "OK  "} — ${cls} (${tier === 3 ? "V" : "V+B"})${threw ? ": " + threw : ""}`);
  }

  console.log(`\npageerrors: ${errors.length}`);
  if (errors.length) console.log(errors.slice(0, 5).join("\n---\n"));
  await browser.close();
  srv.kill();
  process.exit(errors.length > 0 ? 1 : 0);
})();
