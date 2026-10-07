/**
 * 모바일 맵 우측 치우침 재현 진단 — 유저 스크린샷(2400x1080) 동일 조건
 *  1200x540 CSS @ DPR2 = 2400x1080 physical (APK WebView와 동일)
 *  측정: 캔버스 rect / 카메라 scroll·zoom / player / stage 크기 / HUD DOM 위치
 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({
    executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
    args: ["--use-gl=swiftshader", "--no-sandbox"],
  });
  const ctx = await b.newContext({
    viewport: { width: 1200, height: 540 },
    deviceScaleFactor: 2,
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 150)));

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByRole("button", { name: /게임 시작/ }).first().click();
  await p.waitForTimeout(900);
  await p.getByText("캐릭터 생성", { exact: false }).first().click();
  await p.waitForTimeout(400);
  await p.locator('input[placeholder*="캐릭터 이름"]').fill("오프셋진단");
  await p.getByRole("button", { name: /다음 — 직업 선택/ }).click();
  await p.waitForTimeout(300);
  await p.getByText("전사", { exact: false }).first().click();
  await p.waitForTimeout(200);
  await p.getByRole("button", { name: /다음 — 외형 선택|다음/ }).last().click().catch(() => {});
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: /생성!/ }).first().click();
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const t = btns.find((x) => /이 캐릭터로 시작/.test(x.textContent || "")) || btns.find((x) => /시작/.test(x.textContent || ""));
    if (t) t.click();
  });
  await p.waitForTimeout(4000);

  let sceneReady = false;
  for (let i = 0; i < 20; i++) {
    sceneReady = await p.evaluate(() => !!window.__SERTZ_SCENE__ && !!window.__SERTZ_SCENE__.gotoStage).catch(() => false);
    if (sceneReady) break;
    await p.keyboard.press("Enter");
    await p.waitForTimeout(700);
  }
  for (let i = 0; i < 40; i++) {
    const done = await p.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      return !!s && !!s.stageDef?.key && s.dialoguing !== true;
    }).catch(() => false);
    if (done) break;
    await p.keyboard.press("Enter");
    await p.waitForTimeout(400);
  }
  await p.waitForTimeout(1500);

  const m = await p.evaluate(() => {
    const g = window.__SERTZ__?.game;
    const s = window.__SERTZ_SCENE__;
    const canvas = g?.canvas;
    const r = canvas?.getBoundingClientRect();
    const cam = g?.scene?.getScene("world")?.cameras?.main;
    const scale = g?.scale;
    const hud = document.querySelector('[class*="left-[max"]') || document.querySelector("body > div > div");
    const hudRect = hud?.getBoundingClientRect();
    const w = window;
    return {
      inner: { w: w.innerWidth, h: w.innerHeight },
      dpr: w.devicePixelRatio,
      visualViewport: { w: w.visualViewport?.width, h: w.visualViewport?.height, offsetLeft: w.visualViewport?.offsetLeft, offsetTop: w.visualViewport?.offsetTop },
      canvasRect: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null,
      canvasAttr: canvas ? { w: canvas.width, h: canvas.height, styleW: canvas.style.width, styleH: canvas.style.height } : null,
      gameSize: scale ? { w: scale.gameSize.width, h: scale.gameSize.height, displayedW: scale.displaySize.width, displayedH: scale.displaySize.height, canvasStyle: scale.canvasStyle } : null,
      cam: cam ? { scrollX: cam.scrollX, scrollY: cam.scrollY, zoom: cam.zoom, width: cam.width, height: cam.height, worldView: { x: cam.worldView.x, y: cam.worldView.y, w: cam.worldView.width } } : null,
      player: s?.player ? { x: s.player.x, y: s.player.y } : null,
      stage: s ? { w: s.stageW, h: s.stageH, key: s.stageDef?.key } : null,
      hudRect: hudRect ? { x: hudRect.x, y: hudRect.y, w: hudRect.width } : null,
      sceneHookKeys: s ? Object.keys(s).slice(0, 40) : null,
    };
  });
  console.log(JSON.stringify(m, null, 2));

  await p.screenshot({ path: "/tmp/repro_1200x540.png" });
  console.log("errors:", errs.slice(0, 5));
  await b.close();
})();
