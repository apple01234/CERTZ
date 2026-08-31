/* v3.0.5 디버그 프로브3 — 칩 렌더 타임라인 추적 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3124;
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
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    if (w.dialoguing) w.resumeFromDialogue();
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    w.physics.world.resume();
  });
  await page.waitForTimeout(250);
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 760, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 150)));

  await enterWorld(page);

  // ui:interact 페이로드 감시 + GM 텔레포트
  await page.evaluate(() => {
    window.__uii = [];
    window.__SERTZ_EB__.on("ui:interact", (v) => window.__uii.push({ t: Date.now() % 100000, active: v.active, label: (v.label || "").slice(0, 14), x: v.x, y: v.y }));
    const w = window.__SERTZ__.game.scene.getScene("world");
    const gm = w.interactables.find((it) => it.kind === "gm");
    const p = w.player;
    if (p.body && p.body.reset) p.body.reset(gm.x + 55, gm.y);
    window.__gm = { x: gm.x, y: gm.y };
  });

  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(350);
    const snap = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const matches = btns.filter((b) => (b.textContent ?? "").includes("GM — 자유전직"));
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      return {
        n: matches.length,
        rects: matches.map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }),
        styles: matches.map((b) => [b.style.left, b.style.top]),
        ui: window.__uii.slice(-3),
        dist: Math.round(Math.hypot(p.x - window.__gm.x, p.y - window.__gm.y)),
        near: w.nearInteract?.kind ?? null,
        totalBtns: btns.length,
      };
    });
    console.log(`[${i}] n=${snap.n} rects=${JSON.stringify(snap.rects)} styles=${JSON.stringify(snap.styles)} dist=${snap.dist} near=${snap.near} btns=${snap.totalBtns} ui=${JSON.stringify(snap.ui)}`);
  }

  await browser.close();
  srv.kill();
  process.exit(0);
})();
