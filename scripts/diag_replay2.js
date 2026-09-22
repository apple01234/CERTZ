/* 디버그 2 — 메서드 패치로 전환 경로 추적 */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  p.on("console", (m) => { const t = m.text(); if (t.startsWith("DBG")) console.log(t.slice(0, 220)); });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1500);
  for (let i = 0; i < 10; i++) {
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
    await p.waitForTimeout(800);
    const inW = await p.evaluate(() => !!window.__SERTZ__?.game?.scene?.getScene("world")?.player);
    if (inW) break;
  }
  await p.waitForTimeout(2000);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  for (let i = 0; i < 30; i++) {
    const d = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
    if (!d) break;
    await p.mouse.click(640, 500);
    await p.waitForTimeout(360);
  }
  await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    const proto = Object.getPrototypeOf(sc);
    const origST = proto.startTransition;
    proto.startTransition = function (t, o) { console.log("DBG startTransition→", t, JSON.stringify(o ?? {})); return origST.call(this, t, o); };
    const origGS = proto.gotoStage;
    proto.gotoStage = function (n, e, f) { console.log("DBG gotoStage→", n, "force=", f); return origGS.call(this, n, e, f); };
    // monsterKills 주입 + emit
    sc.monsterKills["boss_vord"] = 1;
    console.log("DBG pre-emit transitioning=", sc.transitioning, "dialoguing=", sc.dialoguing, "playerState=", sc.player?.state);
    window.__SERTZ_EB__.emit("rpg:bossReplay", { ch: "r5", lv: "easy" });
    console.log("DBG post-emit transitioning=", sc.transitioning);
  });
  await p.waitForTimeout(3000);
  const post = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    return sc ? { stage: sc.stageDef?.key, boss: sc.bossDef?.name ?? null } : null;
  });
  console.log("POST:", JSON.stringify(post));
  await b.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
