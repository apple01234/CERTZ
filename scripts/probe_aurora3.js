/**
 * v1.3.0 probe3 — 오라 치장 세이브/복원 실측 (대화 상태 정리 후 정확 측정)
 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 300)));

  // 1차: 기존 세이브 무시하고 신규 캐릭터 생성 — localStorage 클리어로 깨끗한 상태
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("오라테스트");
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
  // 대화/프롤로그 스킵 — 충분히 클릭 + dialoguing 상태 확인
  for (let i = 0; i < 8; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  await p.waitForTimeout(500);

  const before = await p.evaluate(async () => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!ws?.player) return { err: "no world" };
    if (ws.dialoguing) return { err: "still dialoguing" };
    ws.player.emerald = 9999;
    window.__SERTZ_EB__.emit("rpg:bmBuy", { key: "cos_aurora", qty: 1 });
    await new Promise((r) => setTimeout(r, 600));
    const st1 = {
      buy1: ws.player.cosmetics.includes("cos_aurora"),
      cosmetic: ws.player.cosmetic,
      aura: !!ws.cosmeticAura,
      emerald: ws.player.emerald,
    };
    window.__SERTZ_EB__.emit("rpg:bmBuy", { key: "cos_frost", qty: 1 });
    await new Promise((r) => setTimeout(r, 600));
    st1.buy2 = ws.player.cosmetics.includes("cos_frost");
    // cos_aurora 재장착
    window.__SERTZ_EB__.emit("rpg:cosmetic", { key: "cos_aurora" });
    await new Promise((r) => setTimeout(r, 400));
    ws.save();
    return st1;
  });
  console.log("BEFORE RELOAD:", JSON.stringify(before));

  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  // 이어하기 버튼 — 타이틀에서 존재 확인
  const hasResume = await p.getByText("이어하기").first().isVisible().catch(() => false);
  console.log("hasResume:", hasResume);
  // 타이틀 → "게임 시작" 버튼 (이어하기 텍스트는 문구에 포함된 span이라 버튼이 아님)
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1400);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
  });
  await p.waitForTimeout(2800);
  for (let i = 0; i < 8; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  await p.waitForTimeout(600);

  await p.screenshot({ path: "/tmp/probe3_after_resume.png" });
  const dbg = await p.evaluate(() => {
    const g = window.__SERTZ__?.game;
    const scenes = g?.scene?.scenes?.map?.((s) => `${s.scene?.key ?? "?"}:${s.scene?.isActive() ? "act" : "in"}`) ?? [];
    return { scenes, lobbyOpen: !!document.querySelector("[data-lobby]"), bodyText: document.body.innerText.slice(0, 300) };
  });
  console.log("DBG:", JSON.stringify(dbg));
  const after = await p.evaluate(() => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!ws?.player) return { err: "no world after reload" };
    return {
      name: ws.player.name,
      cosmetic: ws.player.cosmetic,
      cosmetics: [...ws.player.cosmetics],
      auraObj: !!ws.cosmeticAura,
      auraTex: ws.cosmeticAura?.texture?.key ?? null,
      auraVisible: ws.cosmeticAura?.visible ?? null,
      overlay: !!ws.cosmeticOverlay,
      emerald: ws.player.emerald,
    };
  });
  console.log("AFTER RELOAD:", JSON.stringify(after, null, 2));
  console.log("PAGEERRORS:", errs.length ? errs.slice(0, 4) : "none");
  await b.close();
})();
