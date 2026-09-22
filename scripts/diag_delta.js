/* Clock.update 호출 횟수/델타 측정 */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(3000);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  for (let i = 0; i < 30 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++) await p.waitForTimeout(300);
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click());
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("세라DLT");
  await p.waitForTimeout(300);
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click(), label);
    await p.waitForTimeout(400);
  }
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click());
  await p.waitForTimeout(1400);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
  await p.waitForTimeout(2600);
  const a = await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    const clock = sc.time;
    const proto = Object.getPrototypeOf(clock);
    window.__DBG_CALLS__ = 0; window.__DBG_SUM__ = 0; window.__DBG_TIMES__ = [];
    const orig = proto.update;
    proto.update = function (time, delta) {
      window.__DBG_CALLS__++;
      window.__DBG_SUM__ += delta;
      if (window.__DBG_TIMES__.length < 5) window.__DBG_TIMES__.push(Math.round(delta));
      return orig.call(this, time, delta);
    };
    return { wrapped: true };
  });
  await p.waitForTimeout(1500);
  const c = await p.evaluate(() => ({ calls: window.__DBG_CALLS__, sum: Math.round(window.__DBG_SUM__), sample: window.__DBG_TIMES__ }));
  console.log("DELTA:", JSON.stringify(c));
  await b.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
