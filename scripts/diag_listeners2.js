const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const logs = [];
  p.on("console", (m) => logs.push(m.type() + ": " + m.text().slice(0, 180)));
  p.on("pageerror", (e) => logs.push("PAGEERROR: " + e.message.slice(0, 300)));
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
    const sc = window.__SERTZ__.game.scene.getScene("world");
    return { isekai: eb.listenerCount("rpg:isekai"), partyRaid: eb.listenerCount("rpg:partyRaid"), bossReplay: eb.listenerCount("rpg:bossReplay"), stage: sc.stageDef?.key };
  });
  console.log("RES:", JSON.stringify(res));
  const interesting = logs.filter((l) => l.includes("SERTZ") || l.toLowerCase().includes("error") || l.includes("오류") || l.includes("create"));
  console.log("LOGS:", interesting.slice(0, 10).join("\n") || "none");
  await b.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
