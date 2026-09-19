/**
 * v1.3.0 probe2 — 오라 치장 세이브/복원 실측
 *  구매 → 세이브 → 페이지 리로드 → 이어하기 → 오라 복원 검사
 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 300)));

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("세이브프로브");
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
  for (let i = 0; i < 3; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(420); }

  // 구매 → 세이브 → 리로드
  const before = await p.evaluate(async () => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!ws?.player) return { err: "no world" };
    ws.player.emerald = 9999;
    window.__SERTZ_EB__.emit("rpg:bmBuy", { key: "cos_aurora", qty: 1 });
    await new Promise((r) => setTimeout(r, 600));
    window.__SERTZ_EB__.emit("rpg:bmBuy", { key: "cos_frost", qty: 1 });
    await new Promise((r) => setTimeout(r, 600));
    ws.save();
    return { cosmetic: ws.player.cosmetic, owned: ws.player.cosmetics.length, aura: !!ws.cosmeticAura };
  });
  console.log("BEFORE RELOAD:", JSON.stringify(before));

  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  // 이어하기
  await p.getByText("이어하기").first().click().catch(async () => {
    await p.getByText("게임 시작").first().click();
    await p.waitForTimeout(1000);
  });
  await p.waitForTimeout(1000);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
  });
  await p.waitForTimeout(2800);
  for (let i = 0; i < 3; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(420); }
  await p.waitForTimeout(600);

  const after = await p.evaluate(() => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!ws?.player) return { err: "no world after reload" };
    return {
      cosmetic: ws.player.cosmetic,
      cosmetics: [...ws.player.cosmetics],
      auraObj: !!ws.cosmeticAura,
      auraTex: ws.cosmeticAura?.texture?.key ?? null,
      auraVisible: ws.cosmeticAura?.visible ?? null,
      overlay: !!ws.cosmeticOverlay,
    };
  });
  console.log("AFTER RELOAD:", JSON.stringify(after, null, 2));
  console.log("PAGEERRORS:", errs.length ? errs.slice(0, 4) : "none");
  await b.close();
})();
