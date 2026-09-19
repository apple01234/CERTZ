/**
 * v1.3.0 probe — 오로라류(오라 치장) 구매/장착 실측 리포터
 *  캐릭터 생성 → GM 에메랄드 지급 → rpg:bmBuy cos_aurora/cos_frost →
 *  cosmeticAura 시각 오브젝트 존재 + 텍스처/티트/depth 검사
 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 300)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 160)); });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("프로브");
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
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(420); }
  await p.waitForTimeout(900);

  // 월드 씬 획득
  const probe = await p.evaluate(async () => {
    const w = window.__SERTZ__?.game;
    const ws = w?.scene?.getScene("world");
    if (!ws || !ws.player) return { err: "no world/player" };
    const out = {};
    // GM 지갑
    ws.player.emerald = 9999;
    // cos_aurora 구매 (BM 경로)
    window.__SERTZ_EB__.emit("rpg:bmBuy", { key: "cos_aurora", qty: 1 });
    await new Promise((r) => setTimeout(r, 600));
    const a1 = ws.player.cosmetic;
    const owned1 = ws.player.cosmetics.includes("cos_aurora");
    out.buy_aurora = { cosmetic: a1, owned: owned1, auraObj: !!ws.cosmeticAura, overlay: !!ws.cosmeticOverlay };
    if (ws.cosmeticAura) {
      out.buy_aurora.auraTex = ws.cosmeticAura.texture.key;
      out.buy_aurora.auraDepth = ws.cosmeticAura.depth;
      out.buy_aurora.auraAlpha = ws.cosmeticAura.alpha;
      out.buy_aurora.auraVisible = ws.cosmeticAura.visible;
      out.buy_aurora.auraTint = ws.cosmeticAura.tintTop;
    }
    // 다른 오라류: cos_frost 인벤 경로 장착
    window.__SERTZ_EB__.emit("rpg:bmBuy", { key: "cos_frost", qty: 1 });
    await new Promise((r) => setTimeout(r, 400));
    // cos_aurora 다시 장착 (인벤 경로 재현)
    window.__SERTZ_EB__.emit("rpg:cosmetic", { key: "cos_aurora" });
    await new Promise((r) => setTimeout(r, 400));
    out.equip_frost_then_aurora = {
      cosmetic: ws.player.cosmetic,
      auraObj: !!ws.cosmeticAura,
      overlay: !!ws.cosmeticOverlay,
    };
    // cos_wings 구매/장착
    window.__SERTZ_EB__.emit("rpg:bmBuy", { key: "cos_wings", qty: 1 });
    await new Promise((r) => setTimeout(r, 400));
    out.buy_wings = { cosmetic: ws.player.cosmetic, emitter: !!ws.cosmeticEmitter };
    return out;
  });
  console.log(JSON.stringify(probe, null, 2));
  console.log("ERRORS:", errs.length ? errs.slice(0, 6) : "none");
  await b.close();
})();
