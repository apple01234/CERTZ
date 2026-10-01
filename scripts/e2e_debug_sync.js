/* A 클라이언트 원격싱크 디버그 — players 수신/리스너/remotes 상태 추적 */
const { chromium } = require("playwright");

const URL = "http://localhost:3000";

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
  const browser = await chromium.launch();
  const A = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const B = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  A.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("A콘솔:", m.type(), m.text().slice(0, 140)); });
  B.on("console", (m) => { if (m.type() === "error") console.log("B콘솔:", m.text().slice(0, 140)); });

  await enterWorld(A);
  console.log("A 진입 완료");
  await enterWorld(B);
  console.log("B 진입 완료");

  // B가 5초간 이동 → 지속 브로드캐스트 유발
  B.keyboard.down("ArrowRight");
  for (let i = 1; i <= 5; i++) {
    await A.waitForTimeout(1000);
    const probe = await A.evaluate(() => {
      const w = window.__SERTZ__?.game?.scene.getScene("world");
      if (!w) return null;
      return {
        remotes: w.remotes?.size,
        netOffs: w.netOffs?.length,
        stage: w.stageDef?.key,
        px: Math.round(w.player?.x),
        sceneActive: w.scene?.isActive(),
      };
    });
    console.log(`A probe ${i}s:`, JSON.stringify(probe));
  }
  B.keyboard.up("ArrowRight");
  await A.waitForTimeout(800);
  await A.screenshot({ path: "/home/z/my-project/scripts/mp-debug-a.png" });
  await B.screenshot({ path: "/home/z/my-project/scripts/mp-debug-b.png" });
  await browser.close();
  console.log("DONE");
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
