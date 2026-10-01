/* 게임 인스턴스 중복 부트 확인 */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(3000);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  const res = await p.evaluate(() => {
    const canvases = document.querySelectorAll("canvas").length;
    const games = (window.__SERTZ_GAMES__ ?? null);
    const g = window.__SERTZ__?.game;
    return {
      canvases,
      hasGamesArray: !!games,
      gameCount: games?.length ?? null,
      loopRunning: g?.loop?.running ?? null,
      gameDestroyed: g?.isDestroyed ?? null,
      canvasParent: g?.canvas?.parentElement?.className?.slice(0, 60) ?? null,
      gameIsConnected: g?.canvas?.isConnected ?? null,
    };
  });
  console.log("INST:", JSON.stringify(res));
  await b.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
