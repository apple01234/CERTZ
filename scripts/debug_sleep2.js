const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3110;
const URL = `http://localhost:${PORT}`;
(async () => {
  const srv = spawn("node", ["server.js"], { cwd: "/home/z/my-project", env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 250)));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERR:", m.text().slice(0, 200)); });
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=새로운 모험", { timeout: 30000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 30; i++) {
    const inWorld = await page.evaluate(() => { const g = window.__SERTZ__?.game; return !!(g && g.scene.getScene("world") && g.scene.getScene("world").player); });
    if (inWorld) break;
    await page.mouse.click(640, 400); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(600);
  for (let i = 0; i < 6; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(300); }
  await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.dialoguing = false; w.introStep = -1; });
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const inn = w.interactables.find((i) => i.kind === "inn");
    w.player.setPosition(inn.x, inn.y + 14); w.player.setVelocity(0, 0); w.player.gold = 100;
  });
  await page.waitForTimeout(700);
  await page.keyboard.press("e");
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.player.setPosition(w.stageW / 2 + 115, 170); w.player.setVelocity(0, 0);
  });
  await page.waitForTimeout(700);
  await page.keyboard.press("e"); // 대사 열기
  await page.waitForTimeout(800);
  for (let i = 0; i < 9; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(500); }
  for (let s = 1; s <= 7; s++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      return { sleeping: w.sleeping, gold: w.player.gold, buffs: w.player.buffs.length, dlg: document.body.innerText.includes("로안") };
    });
    console.log(`+${s}s:`, JSON.stringify(st));
  }
  await browser.close();
  srv.kill();
  process.exit(0);
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
