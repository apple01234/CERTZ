const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, userAgent: "Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile" });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("게임 시작")))); i++) await p.waitForTimeout(500);
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("게임 시작"))?.click());
  await p.waitForTimeout(1600);
  const hasStart = await p.evaluate(() => !!Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작")));
  if (!hasStart) {
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click());
    await p.waitForTimeout(900);
    await p.locator("input").first().fill("대사테스트");
    for (const label of ["직업 선택", "외형 선택"]) { await p.evaluate((lb) => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click(), label); await p.waitForTimeout(350); }
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click());
    await p.waitForTimeout(1400);
  }
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!window.__SERTZ__?.game?.scene?.getScene("world")?.player)); i++) await p.waitForTimeout(500);
  /* 대화창 DOM 요소에 pointerdown 직접 발화 */
  const dlgInfo = await p.evaluate(() => {
    const panels = Array.from(document.querySelectorAll(".game-panel"));
    const dlg = panels.find((x) => x.className.includes("cursor-pointer"));
    if (!dlg) return { found: false };
    const r = dlg.getBoundingClientRect();
    dlg.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
    return { found: true, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
  });
  console.log("대화창:", JSON.stringify(dlgInfo));
  await p.waitForTimeout(700);
  const d1 = await p.evaluate(() => ({ dialoguing: !!window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing }));
  console.log("pointerdown 후:", JSON.stringify(d1));
  /* 반복 발화로 전부 스킵 */
  for (let i = 0; i < 25; i++) {
    const d = await p.evaluate(() => !!window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
    if (!d) break;
    await p.evaluate(() => {
      const dlg = Array.from(document.querySelectorAll(".game-panel")).find((x) => x.className.includes("cursor-pointer"));
      const r = dlg.getBoundingClientRect();
      dlg.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
      dlg.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    });
    await p.waitForTimeout(420);
  }
  const fin = await p.evaluate(() => ({ dialoguing: !!window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing, player: !!window.__SERTZ__?.game?.scene?.getScene("world")?.player }));
  console.log("최종:", JSON.stringify(fin));
  await b.close();
})();
