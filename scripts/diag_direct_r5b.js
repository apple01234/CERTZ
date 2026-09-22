const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 300)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 200)); });
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
  await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    sc.startTransition("r5", { delay: 100, replayBoss: "r5", replayDiff: "easy" });
  });
  await p.waitForTimeout(4500);
  const post = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc) return "no-scene";
    return {
      key: sc.stageDef?.key ?? null,
      name: sc.stageDef?.name ?? null,
      hasPlayer: !!sc.player,
      boss: sc.bossDef?.name ?? null,
      stageKey: sc.stageKey ?? null,
      w: sc.stageW, h: sc.stageH,
    };
  });
  console.log("POST:", JSON.stringify(post));
  console.log("ERRS:", errs.slice(0, 6).join(" || ") || "none");
  await b.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
