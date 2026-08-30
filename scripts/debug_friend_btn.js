/* 친구 버튼 렌더 디버그 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const PORT = 3101;
const URL = `http://localhost:${PORT}`;

(async () => {
  const srv = spawn("node", ["server.js"], {
    cwd: "/home/z/my-project",
    env: { ...process.env, PORT: String(PORT), NODE_ENV: "production" },
    stdio: "ignore",
  });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try { const r = await fetch(`${URL}/socket.io/?EIO=4&transport=polling`); if (r.ok) break; } catch {}
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("console", (m) => { if (m.type() === "error") console.log("콘솔:", m.text().slice(0, 200)); });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
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
  await page.waitForTimeout(1500);
  const probe = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")].map((b) => b.getAttribute("aria-label")).filter(Boolean);
    const party = document.querySelector('[aria-label="파티 열기 (Y)"]');
    const friend = document.querySelector('[aria-label="친구 열기 (F)"]');
    const fr = friend?.getBoundingClientRect();
    return { btns, partyRect: party?.getBoundingClientRect().toJSON(), friendRect: fr?.toJSON() ?? null };
  });
  console.log(JSON.stringify(probe, null, 1));
  await browser.close();
  srv.kill();
  process.exit(0);
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
