/** 오라 착용 전/후 스크린샷 비교 — 시각 인지성 검증 (신규 캐릭터 풀플로우) */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1400);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("비주얼");
  await p.waitForTimeout(300);
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click();
    }, label);
    await p.waitForTimeout(300);
  }
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click();
  });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
  });
  await p.waitForTimeout(2800);
  for (let i = 0; i < 8; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  await p.waitForTimeout(800);

  const ready = await p.evaluate(() => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!ws?.player) return { err: "no world" };
    ws.dialoguing = false;
    ws.player.emerald = 9999;
    ws.cameras.main.stopFollow();
    ws.cameras.main.centerOn(ws.player.x, ws.player.y);
    return { ok: true, x: ws.player.x, y: ws.player.y };
  });
  console.log("ready:", JSON.stringify(ready));
  await p.waitForTimeout(600);
  await p.screenshot({ path: "/tmp/aura_before.png" });

  await p.evaluate(() => {
    window.__SERTZ_EB__.emit("rpg:bmBuy", { key: "cos_aurora", qty: 1 });
  });
  await p.waitForTimeout(900);
  await p.screenshot({ path: "/tmp/aura_after_aurora.png" });

  // 극단 비교 — 무지개 오라 직접 주입 후 장착
  await p.evaluate(() => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!ws?.player) return;
    if (!ws.player.cosmetics.includes("cos_rainbow")) ws.player.cosmetics.push("cos_rainbow");
    window.__SERTZ_EB__.emit("rpg:cosmetic", { key: "cos_rainbow" });
  });
  await p.waitForTimeout(900);
  await p.screenshot({ path: "/tmp/aura_after_rainbow.png" });

  console.log("screens saved");
  await b.close();
})();
