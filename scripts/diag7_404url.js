const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const bad = [];
  p.on("response", (r) => { if (r.status() === 404) bad.push(r.url()); });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForSelector("text=게임 시작", { timeout: 40000 });
  const boot = await p.evaluate(() => JSON.stringify(window.__SERTZ_BOOT__ || null));
  console.log("부팅 fxMode:", boot);
  // 타이틀에서 20초 대기 (지연 로드 완료까지)
  for (let i = 0; i < 20 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__).catch(() => false)); i++) await p.waitForTimeout(1000);
  await p.waitForTimeout(2000);
  console.log("404 URL:", bad.length ? bad : "없음");
  await b.close();
})().catch((e) => { console.error("실패:", e.message); process.exit(1); });
