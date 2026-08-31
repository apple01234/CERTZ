/* v3.0.5 디버그 프로브2 — GM 칩 팬텀 정체 파악 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3123;
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

  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const gm = w.interactables.find((it) => it.kind === "gm");
    const p = w.player;
    if (p.body && p.body.reset) p.body.reset(gm.x + 55, gm.y);
  });
  await page.waitForTimeout(700);

  const dump = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const matches = btns.filter((b) => (b.textContent ?? "").includes("GM — 자유전직"));
    return matches.map((b) => {
      const r = b.getBoundingClientRect();
      let par = b.parentElement;
      const chain = [];
      for (let i = 0; i < 3 && par; i++) {
        chain.push(`${par.tagName}.${String(par.className).slice(0, 40)}`);
        par = par.parentElement;
      }
      return {
        rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
        style: { left: b.style.left, top: b.style.top },
        cls: String(b.className).slice(0, 80),
        chain,
        html: b.outerHTML.slice(0, 200),
      };
    });
  });
  console.log("=== GM 텍스트 매칭 버튼 전체 ===");
  console.log(JSON.stringify(dump, null, 1));

  await browser.close();
  srv.kill();
  process.exit(0);
})();
