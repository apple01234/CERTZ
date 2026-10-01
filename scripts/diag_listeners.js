const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 300)));
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1500);
  for (let i = 0; i < 10; i++) {
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
    await p.waitForTimeout(800);
    if (await p.evaluate(() => !!window.__SERTZ__?.game?.scene?.getScene("world")?.player)) break;
  }
  await p.waitForTimeout(2000);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  for (let i = 0; i < 30; i++) {
    if (!(await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing))) break;
    await p.mouse.click(640, 500);
    await p.waitForTimeout(360);
  }
  const res = await p.evaluate(() => {
    const eb = window.__SERTZ_EB__;
    const names = eb.eventNames().filter((n) => typeof n === "string" && (n.includes("bossReplay") || n.includes("partyRaid") || n.includes("isekai") || n.includes("boss")));
    const counts = {};
    for (const n of names) counts[n] = eb.listenerCount(n);
    const sc = window.__SERTZ__.game.scene.getScene("world");
    return { counts, stage: sc.stageDef?.key, hasStartTransition: typeof sc.startTransition, transitioning: sc.transitioning };
  });
  console.log("LISTENERS:", JSON.stringify(res, null, 1));
  await b.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
