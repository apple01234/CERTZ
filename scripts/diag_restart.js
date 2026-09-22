/* scene.restart 감시 — r5 재시작이 실제로 호출되는지/예외가 나는지 */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  p.on("console", (m) => { const t = m.text(); if (t.startsWith("DBG")) console.log(t.slice(0, 300)); });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  for (let i = 0; i < 30 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++) await p.waitForTimeout(300);
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click());
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("세라RE");
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
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  for (let i = 0; i < 30; i++) {
    if (!(await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing))) break;
    await p.mouse.click(640, 500);
    await p.waitForTimeout(360);
  }
  await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    const origRestart = sc.scene.restart.bind(sc.scene);
    sc.scene.restart = (data) => { console.log("DBG scene.restart called:", JSON.stringify(data)); try { const r = origRestart(data); console.log("DBG restart ok"); return r; } catch (e) { console.log("DBG restart THREW:", String(e)); throw e; } };
    const proto = Object.getPrototypeOf(sc);
    const origGS = proto.gotoStage;
    proto.gotoStage = function (n, e, f) { console.log("DBG gotoStage→", n, "force=", f, "trans=", this.transitioning); return origGS.call(this, n, e, f); };
    sc.monsterKills["boss_vord"] = 1;
    console.log("DBG emit 시작");
    window.__SERTZ_EB__.emit("rpg:bossReplay", { ch: "r5", lv: "easy" });
    console.log("DBG emit 완료");
  });
  await p.waitForTimeout(5500);
  const post = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    return { stage: sc?.stageDef?.key, boss: sc?.bossDef?.name ?? null };
  });
  console.log("POST:", JSON.stringify(post));
  await b.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
