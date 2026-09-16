const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2000);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  // 캐릭터 없으면 로비 캐릭터 생성 생략 — 프레임 측정만 (타이틀 화면 + 로비)
  const fps1 = await p.evaluate(() => {
    const g = window.__SERTZ__?.game;
    return { fps: Math.round(g.loop.actualFps), target: g.loop.targetFps };
  });
  console.log("title/lobby fps:", JSON.stringify(fps1));
  await b.close();
})();
