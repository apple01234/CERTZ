/* 상단/우측 수상 오브젝트 덤프 — forest1에서 화면 좌표의 오브젝트 나열 */
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
  await enterWorld(page);
  // forest1로 재시작
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.scene.restart({ stage: "forest1", fresh: true });
  });
  await page.waitForTimeout(1800);
  await cleanDialogues(page);
  await page.waitForTimeout(500);

  const dump = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const cam = w.cameras.main;
    const out = [];
    for (const go of w.children.list ?? []) {
      const key = go.texture ? go.texture.key : (go.type ?? "?");
      out.push({
        key,
        type: go.type,
        x: Math.round(go.x), y: Math.round(go.y),
        w: Math.round(go.displayWidth ?? 0), h: Math.round(go.displayHeight ?? 0),
        alpha: go.alpha !== undefined ? +go.alpha.toFixed(2) : undefined,
        tint: go.tintTopLeft !== undefined ? go.tintTopLeft : undefined,
        isTile: go.type === "TileSprite",
      });
    }
    // 카메라가 보는 월드 범위
    return {
      objects: out,
      camView: { x: Math.round(cam.worldView.x), y: Math.round(cam.worldView.y), w: Math.round(cam.worldView.width), h: Math.round(cam.worldView.height) },
      stage: { w: w.stageW, h: w.stageH },
    };
  });

  // 화면 위쪽(y < camTop+250)과 우측 사각형 후보를 분석
  const top = dump.objects.filter((o) => o.y < dump.camView.y + 230 && o.type !== "Rectangle");
  const green = dump.objects.filter((o) => String(o.key).includes("gvar"));
  console.log("=== 카메라 뷰:", JSON.stringify(dump.camView), "스테이지:", JSON.stringify(dump.stage));
  console.log("=== 상단 영역 오브젝트 (y<camTop+230):", top.length, "개");
  for (const o of top.slice(0, 40)) console.log(" ", JSON.stringify(o));
  console.log("=== gvar 오브젝트:", green.length, "개");
  for (const o of green.slice(0, 15)) console.log(" ", JSON.stringify(o));
  await browser.close();
})();
