/* Phaser 4 Clock 내부 구조 진단 */
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
  await p.locator("input").first().fill("세라CLK4");
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
    const keys = Object.keys(clock);
    const pendingKeys = keys.filter((k) => /pending|events|add/i.test(k));
    window.__DBG_FIRED__ = false;
    const ev = clock.delayedCall(200, () => { (window).__DBG_FIRED__ = true; });
    const evInfo = { hasElapsed: "elapsed" in ev, elapsed: ev.elapsed, dur: ev.duration, state: ev.state, pendingRemove: ev.pendingRemove, argsLen: (ev.args ?? []).length };
    const proto = Object.getPrototypeOf(clock);
    const hasUpdate = typeof proto.update;
    return { keys: keys.slice(0, 20), pendingKeys, evInfo, hasUpdate, clockNow: clock.now };
  });
  await p.waitForTimeout(1500);
  const c = await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    return { fired: window.__DBG_FIRED__, now: sc.time.now };
  });
  console.log("A:", JSON.stringify(a, null, 1));
  console.log("C:", JSON.stringify(c));
  await b.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
