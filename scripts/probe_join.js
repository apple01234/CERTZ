const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 3104;
const URL = `http://localhost:${PORT}`;
async function enterWorld(page, tag, logs) {
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
  const browser = await chromium.launch({
    args: ["--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"],
  });
  const mk = async (tag) => {
    const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    p.on("console", (m) => { const t = m.text(); if (t.includes("[net]")) console.log(`${tag}: ${t}`); });
    return p;
  };
  const A = await mk("A");
  const B = await mk("B");
  await enterWorld(A, "A");
  await enterWorld(B, "B");
  // headless 다중 페이지: 포그라운드만 rAF 구동 → 실기기는 항상 포그라운드이므로 무관.
  // B의 타이머를 돌리기 위해 B를 포그라운드로.
  await B.bringToFront();
  await B.waitForTimeout(4000);
  console.log("--- 4초 경과 ---");
  await browser.close();
  srv.kill();
  process.exit(0);
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
