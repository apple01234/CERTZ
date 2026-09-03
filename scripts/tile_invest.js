/* v3.0.13 타일 조사 — 각 챕터 진입 스크린샷 (실행 중인 3000 서버에 접속) */
const { chromium } = require("playwright");

const URL = "http://localhost:3000";

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

async function enterWorld(page) {
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
}

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await enterWorld(page);

  const stages = ["village", "forest1", "alfheim1", "niflheim1", "cave1", "muspelheim1"];
  for (const st of stages) {
    await page.evaluate((s) => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      const p = w.player;
      w.scene.restart({ stage: s, save: w.saveData ?? undefined, fresh: true });
      return s;
    }, st);
    // 씬 재시작 + 인트로 건너뛰기
    await page.waitForTimeout(1500);
    for (let i = 0; i < 8; i++) {
      const ok = await page.evaluate(() => {
        try {
          const w = window.__SERTZ__.game.scene.getScene("world");
          if (!w?.player) return false;
          w.dialoguing = false; w.introStep = -1;
          if (w.physics.world) w.physics.world.resume();
          return true;
        } catch { return false; }
      });
      if (ok) break;
      await page.waitForTimeout(400);
    }
    await cleanDialogues(page);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `scripts/shot_tiles_${st}.png` });
    // 텍스처 존재 검사: 화면에 missing 텍스처 개수
    const missing = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      let miss = 0; const keys = [];
      const list = w.children.list ?? [];
      for (const go of list) {
        if (go.texture && go.texture.key === "__MISSING") miss++;
      }
      return { miss, gameObjects: list.length };
    });
    console.log(`${st}: MISSING=${missing.miss} / GameObjects=${missing.gameObjects}`);
  }
  console.log("pageerror:", errors.length ? errors.slice(0, 3) : "0건");
  await browser.close();
})();
