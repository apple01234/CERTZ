/* v3.0.16 시각 확인 — 데드아이 초록 화살 + 트레일 스크린샷 */
const { chromium } = require("playwright");
const URL = "http://127.0.0.1:3000";

async function cleanDialogues(page) {
  for (let i = 0; i < 20; i++) {
    const dlg = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      if (w?.dialoguing) { w.resumeFromDialogue(); return true; }
      return false;
    });
    if (!dlg) break;
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    if (w.physics.world) w.physics.world.resume();
  });
  await page.waitForTimeout(250);
}

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(400, 300); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(800);
  for (let i = 0; i < 6; i++) {
    const done = await page.evaluate(() => {
      try {
        const w = window.__SERTZ__.game.scene.getScene("world");
        if (!w?.player) return false;
        w.finishIntro("테스터");
        return true;
      } catch { return false; }
    });
    if (done) break;
    await page.waitForTimeout(500);
  }
  await cleanDialogues(page);

  // forest1 이동 → 데드아이 → 우측 연발 사격
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.scene.restart({ stage: "forest1", fresh: true });
  });
  await page.waitForTimeout(1800);
  await cleanDialogues(page);
  await page.evaluate(() => { const w = window.__SERTZ__.game.scene.getScene("world"); w.player.cls = "deadeye"; });
  await page.waitForTimeout(300);

  for (let k = 0; k < 3; k++) {
    await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      p.state = "idle"; p.atkCooldown = 0;
      p.update(16, { x: 1, y: 0, lengthSq: () => 1, copy() {}, normalize() { return this; } }, true);
    });
    if (k === 1) await page.waitForTimeout(130); // 연사 중간 잔상 포착
    await page.screenshot({ path: `scripts/shot_v316_deadeye_${k}.png` });
    await page.waitForTimeout(420);
  }
  console.log("shots saved");
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
