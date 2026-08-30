/* 여관 입장 디버그 — nearInteract 상태 실측 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3107;
const URL = `http://localhost:${PORT}`;

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: "/home/z/my-project", env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {}
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=새로운 모험", { timeout: 30000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 30; i++) {
    const inWorld = await page.evaluate(() => {
      const g = window.__SERTZ__?.game;
      return !!(g && g.scene.getScene("world") && g.scene.getScene("world").player);
    });
    if (inWorld) break;
    await page.mouse.click(640, 400);
    await page.keyboard.press("e");
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1000);
  const probe = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const inn = w.interactables.find((i) => i.kind === "inn");
    w.player.setPosition(inn.x, inn.y + 30);
    w.player.setVelocity(0, 0);
    return {
      stageDims: [w.stageW, w.stageH],
      inn,
      allKinds: w.interactables.map((i) => i.kind),
      dialoguing: w.dialoguing,
      introStep: w.introStep,
    };
  });
  console.log("probed:", JSON.stringify(probe));
  await page.waitForTimeout(900);
  const probe2 = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return {
      near: w.nearInteract,
      dialoguing: w.dialoguing,
      px: Math.round(w.player.x),
      py: Math.round(w.player.y),
      promptDom: !![...document.querySelectorAll("button")].find((b) => b.innerText?.includes("여관")),
    };
  });
  console.log("after 900ms:", JSON.stringify(probe2));
  await page.keyboard.press("e");
  await page.waitForTimeout(1300);
  const stage = await page.evaluate(() => window.__SERTZ__.game.scene.getScene("world")?.stageDef?.key);
  console.log("stage after E:", stage);
  await browser.close();
  srv.kill();
  process.exit(0);
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
