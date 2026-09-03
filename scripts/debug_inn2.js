const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3108;
const URL = `http://localhost:${PORT}`;
(async () => {
  const srv = spawn("node", ["server.js"], { cwd: "/home/z/my-project", env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") console.log("ERR:", m.text().slice(0, 120)); });
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=새로운 모험", { timeout: 30000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 30; i++) {
    const inWorld = await page.evaluate(() => { const g = window.__SERTZ__?.game; return !!(g && g.scene.getScene("world") && g.scene.getScene("world").player); });
    if (inWorld) break;
    await page.mouse.click(640, 400); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1000);
  const st = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const inn = w.interactables.find((i) => i.kind === "inn");
    w.player.setPosition(inn.x, inn.y + 14);
    w.player.setVelocity(0, 0);
    return { inn, keyE: !!w.keys?.E, keyForInteract: w.keymap?.interact };
  });
  console.log("state:", JSON.stringify(st));
  await page.waitForTimeout(800);
  const near = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { near: w.nearInteract, d: w.dialoguing };
  });
  console.log("near:", JSON.stringify(near));
  // tryInteract 직접 호출 — E 키 경로와 무관하게 로직 자체 검증
  const direct = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    try { w.tryInteract(); return "tryInteract OK"; } catch (e) { return "ERR " + e.message; }
  });
  console.log("direct:", direct);
  await page.waitForTimeout(1400);
  const stage = await page.evaluate(() => window.__SERTZ__.game.scene.getScene("world")?.stageDef?.key);
  console.log("stage after direct tryInteract:", stage);
  await browser.close();
  srv.kill();
  process.exit(0);
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
