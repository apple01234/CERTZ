/* A 소켓 상태 정밀 프로브 — players/friends 수신 여부 실측 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3102;
const URL = `http://localhost:${PORT}`;

async function enterWorld(page) {
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

  await enterWorld(A);
  await enterWorld(B);

  // A에 이벤트 카운터 부착
  await A.evaluate(() => {
    const s = window.__SERTZ_NET__;
    window.__CNT = { players: 0, friends: 0, lastPlayersLen: -1, connectEvents: 0 };
    if (!s) return;
    s.on("players", (l) => { window.__CNT.players++; window.__CNT.lastPlayersLen = (l || []).length; });
    s.on("friends", () => { window.__CNT.friends++; });
    s.on("connect", () => { window.__CNT.connectEvents++; });
  });
  await A.waitForTimeout(5000);
  const st = await A.evaluate(() => {
    const s = window.__SERTZ_NET__;
    return {
      cnt: window.__CNT,
      connected: s?.connected,
      id: s?.id,
      transport: s?.io?.engine?.transport?.name,
      remotes: window.__SERTZ__?.game?.scene.getScene("world")?.remotes?.size,
    };
  });
  const stB = await B.evaluate(() => {
    const s = window.__SERTZ_NET__;
    return { connected: s?.connected, id: s?.id, transport: s?.io?.engine?.transport?.name };
  });
  console.log("A:", JSON.stringify(st));
  console.log("B:", JSON.stringify(stB));
  await browser.close();
  srv.kill();
  process.exit(0);
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
