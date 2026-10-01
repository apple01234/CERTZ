/* 셰이더 off + 작은 뷰포트로 프레임률 회복 테스트 */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 800, height: 450 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    try {
      localStorage.setItem("sertz_fx", JSON.stringify({ intensity: 0, noFlicker: true }));
    } catch {}
  });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(3000);
  await p.waitForSelector("text=게임 시작", { timeout: 40000 });
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++) await p.waitForTimeout(400);
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click());
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("세라FX0");
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
  await p.evaluate(() => { window.__DBG_F0__ = window.__SERTZ__.game.loop.frame; });
  await p.waitForTimeout(2000);
  const c = await p.evaluate(() => ({ frames: window.__SERTZ__.game.loop.frame - window.__DBG_F0__, fps: Math.round(window.__SERTZ__.game.loop.actualFps) }));
  console.log("FPS3:", JSON.stringify(c));
  await b.close();
})().catch((e) => { console.error("FAIL:", e.message.slice(0, 200)); process.exit(1); });
