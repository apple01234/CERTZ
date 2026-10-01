const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, userAgent: "Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile" });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 240) + " @ " + (e.stack?.split("\n")[1] || "").trim().slice(0, 150)));
  await p.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("게임 시작")))); i++) await p.waitForTimeout(500);
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("게임 시작"))?.click());
  await p.waitForTimeout(1600);
  /* 기존 캐릭터 있으면 선택 없으면 생성 */
  const hasStart = await p.evaluate(() => !!Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작")));
  if (!hasStart) {
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click());
    await p.waitForTimeout(900);
    await p.locator("input").first().fill("가로테스트2");
    for (const label of ["직업 선택", "외형 선택"]) { await p.evaluate((lb) => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click(), label); await p.waitForTimeout(350); }
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click());
    await p.waitForTimeout(1400);
  }
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
  /* 최대 30초 폴링: world 씬 존재 → dialoguing → player */
  let result = null;
  for (let i = 0; i < 60; i++) {
    result = await p.evaluate(() => {
      const sc = window.__SERTZ__?.game?.scene?.getScene("world");
      return { scene: !!sc, dialoguing: !!sc?.dialoguing, player: !!sc?.player, title: window.__SERTZ__?.game?.scene?.getScene("title") ? document.querySelector("canvas") ? "canvas 있음" : "-" : "-" };
    });
    if (result.player) break;
    await p.waitForTimeout(500);
  }
  console.log("폴링 결과:", JSON.stringify(result));
  /* 대사 스킵 */
  for (let i = 0; i < 30; i++) {
    const d = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
    if (!d) break;
    await p.touchscreen.tap(422, 240).catch(() => {});
    await p.waitForTimeout(320);
  }
  await p.waitForTimeout(1200);
  const final = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    return { player: !!sc?.player, dialoguing: !!sc?.dialoguing, stage: sc?.stageKey ?? sc?.stageDef?.key ?? "?" };
  });
  console.log("최종:", JSON.stringify(final), "| errs:", errs.length ? "\n" + errs.slice(0, 5).join("\n") : 0);
  await p.screenshot({ path: "/home/z/my-project/scripts/shot_v144_world.png" });
  await b.close();
})();
