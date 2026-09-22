/* 디버그 — bossReplay/partyRaid 이벤트가 왜 막히는지 상태 덤프 */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 200)));
  p.on("console", (m) => { const t = m.text(); if (t.includes("SERTZ") && (t.includes("재림") || t.includes("토벌") || t.includes("오류") || t.includes("error"))) console.log("LOG:", t.slice(0, 200)); });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1500);
  for (let i = 0; i < 10; i++) {
    const ready = await p.evaluate(() => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
      return true;
    });
    if (ready) break;
    await p.waitForTimeout(600);
  }
  await p.waitForTimeout(2600);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  for (let i = 0; i < 30; i++) {
    const d = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
    if (!d) break;
    await p.mouse.click(640, 500);
    await p.waitForTimeout(360);
  }
  const pre = await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    return { transitioning: sc.transitioning, dialoguing: sc.dialoguing, state: sc.player?.state, stage: sc.stageDef?.key };
  });
  console.log("PRE:", JSON.stringify(pre));
  const res = await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    sc.monsterKills["boss_vord"] = 1;
    window.__SERTZ_EB__.emit("rpg:bossReplay", { ch: "r5", lv: "easy" });
    return { transitioning: sc.transitioning, dialoguing: sc.dialoguing };
  });
  console.log("AFTER EMIT:", JSON.stringify(res));
  await p.waitForTimeout(3000);
  const post = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    return sc ? { stage: sc.stageDef?.key, boss: sc.bossDef?.name ?? null, transitioning: sc.transitioning } : null;
  });
  console.log("POST 3s:", JSON.stringify(post));
  await b.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
