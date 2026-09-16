/* probe_aura_v111 — 오라 틴트가 왜 안 도는가: update 루프/위상/씬 상태 실측 */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 160)));
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2200);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  // 남캐 빠른 생성 (기본값 진행)
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(600);
  await p.locator("input").first().fill("테스터");
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("다음") || x.textContent?.includes("직업 선택"))?.click();
  });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("다음") || x.textContent?.includes("외형 선택"))?.click();
  });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click();
  });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
  });
  await p.waitForTimeout(2500);
  // 프롤로그 스킵 시도
  for (let i = 0; i < 6; i++) { await p.mouse.click(640, 400); await p.waitForTimeout(400); }
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    const sw = window.__SERTZ__?.game?.scene?.getScene("world");
    sw?.player?.cosmetics.push("cos_rainbow");
    sw?.player?.setCosmeticSlot("cos_rainbow", "aura");
  });
  for (let i = 0; i < 6; i++) {
    const st = await p.evaluate(() => {
      const g = window.__SERTZ__?.game;
      const sw = g?.scene?.getScene("world");
      return {
        gameLoop: g?.loop?.actualFps ?? null,
        worldStatus: sw?.sys?.settings?.status ?? null,
        worldActive: sw?.sys?.isSleeping ?? "n/a",
        scenePaused: sw?.scene?.isPaused("world") ?? null,
        dialoguing: sw?.dialoguing ?? null,
        playerState: sw?.player?.state ?? null,
        phase: sw?.auraPhase ?? null,
        tint: sw?.cosmeticAura ? sw.cosmeticAura.tintTopLeft : null,
        hasAura: !!sw?.cosmeticAura,
        cosKey: sw?.player?.cosmetic ?? null,
        sleeping: sw?.scene?.isActive("world") ?? null,
      };
    });
    console.log(i, JSON.stringify(st));
    await p.waitForTimeout(900);
  }
  await b.close();
})().catch((e) => { console.error("CRASH:", e.message); process.exit(2); });
