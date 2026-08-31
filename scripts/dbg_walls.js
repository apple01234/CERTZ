const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3117;
const URL = `http://localhost:${PORT}`;
(async () => {
  const srv = spawn("node", ["server.js"], { cwd: "/home/z/my-project", env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {} }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(640, 400); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(800);
  await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.finishIntro("t"); w.dialoguing = false; w.introStep = -1; });
  await page.waitForTimeout(400);
  await page.evaluate(([st]) => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const carry = w.buildSave(st);
    w.scene.restart({ stage: st, save: carry });
  }, ["cave1"]);
  await page.waitForTimeout(2500);
  const dump = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const g = w.game;
    const ts = w.add.tileSprite(0, 0, 100, 100, "x2_bricks");
    const probe = { key: ts.texture.key, version: Phaser.VERSION };
    ts.destroy();
    // 기존 벽 하나의 setTexture 직후 키 확인
    const wallKid = w.solidGroup.getChildren().find((c) => c.constructor.name === "TileSprite");
    const before = wallKid?.texture.key;
    if (wallKid) wallKid.setTexture("x2_bricks");
    const after = wallKid?.texture.key;
    return { probe, before, after, src0: String(g.textures.get("x2_bricks")?.source?.[0]?.src ?? "?").slice(0, 60) };
  });
  console.log(JSON.stringify(dump, null, 1));
  await browser.close(); srv.kill(); process.exit(0);
})();
