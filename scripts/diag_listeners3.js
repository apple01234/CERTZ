const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  p.on("console", (m) => { const t = m.text(); if (t.startsWith("DBG")) console.log(t.slice(0, 200)); });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1500);
  for (let i = 0; i < 10; i++) {
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
    await p.waitForTimeout(800);
    if (await p.evaluate(() => { const sc = window.__SERTZ__?.game?.scene?.getScene("world"); return !!(sc && sc.player && sc.stageDef); })) break;
  }
  await p.waitForTimeout(2500);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  for (let i = 0; i < 30; i++) {
    if (!(await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing))) break;
    await p.mouse.click(640, 500);
    await p.waitForTimeout(360);
  }
  const res = await p.evaluate(() => {
    const eb = window.__SERTZ_EB__;
    const sc = window.__SERTZ__.game.scene.getScene("world");
    eb.on("rpg:bossReplay", () => console.log("DBG test-listener fired"));
    return {
      isActive: sc.scene.isActive(),
      status: sc.scene.settings?.status,
      stage: sc.stageDef?.key,
      hasPlayer: !!sc.player,
      isekai: eb.listenerCount("rpg:isekai"),
      bossReplay: eb.listenerCount("rpg:bossReplay"),
      partyRaid: eb.listenerCount("rpg:partyRaid"),
      state: sc.player?.state,
      playerKeys: sc.player ? Object.keys(sc.player).slice(0, 8) : null,
    };
  });
  console.log("STATE:", JSON.stringify(res));
  await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    sc.monsterKills["boss_vord"] = 1;
    window.__SERTZ_EB__.emit("rpg:bossReplay", { ch: "r5", lv: "easy" });
    console.log("DBG after emit transitioning=", sc.transitioning);
  });
  await p.waitForTimeout(3500);
  const post = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    return { stage: sc?.stageDef?.key, boss: sc?.bossDef?.name ?? null };
  });
  console.log("POST:", JSON.stringify(post));
  await b.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
