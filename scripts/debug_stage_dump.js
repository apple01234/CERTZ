/* 스테이지 키 실측 — A가 받는 players 페이로드 덤프 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3103;
const URL = `http://localhost:${PORT}`;

async function enterWorld(page, tag) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
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
  console.log(`${tag} 진입 완료`);
}

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: "/home/z/my-project", env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {}
  }
  const browser = await chromium.launch();
  const A = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const B = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();

  await enterWorld(A, "A");
  await enterWorld(B, "B");
  await A.waitForTimeout(3000);

  const dump = await A.evaluate(async () => {
    const s = window.__SERTZ_NET__;
    const w = window.__SERTZ__?.game?.scene.getScene("world");
    return await new Promise((resolve) => {
      s.once("players", (list) => {
        resolve({
          myId: s.id,
          myStage: w.stageDef?.key,
          list: (list || []).map((p) => ({ id: p.id, name: p.name, stage: p.stage, code: p.code, x: p.x, y: p.y })),
        });
      });
    });
  });
  const bStage = await B.evaluate(() => {
    const s = window.__SERTZ_NET__;
    const w = window.__SERTZ__?.game?.scene.getScene("world");
    return { myId: s.id, stage: w.stageDef?.key, player: { x: Math.round(w.player?.x), y: Math.round(w.player?.y) } };
  });
  console.log("A dump:", JSON.stringify(dump));
  console.log("B:", JSON.stringify(bStage));
  await browser.close();
  srv.kill();
  process.exit(0);
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
