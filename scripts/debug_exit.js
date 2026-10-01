/** #6 디버그 — exitMenu 클릭 플로우 프로브 */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on("console", (m) => console.log("[CONSOLE]", m.type(), m.text().slice(0, 120)));
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2400);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  // 기존 세이브로 빠르게: 로비에서 생성 대신 계속 (세이브가 있으면)
  await p.waitForTimeout(600);
  const hasCont = await p.evaluate(() => !!Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작")));
  if (hasCont) {
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
  } else {
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click());
    await p.waitForTimeout(700);
    await p.locator("input").first().fill("디버그");
    await p.waitForTimeout(200);
    for (const label of ["직업 선택", "외형 선택"]) {
      await p.evaluate((lb) => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click(), label);
      await p.waitForTimeout(300);
    }
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click());
    await p.waitForTimeout(1200);
    await p.evaluate(() => document.querySelector(".cursor-pointer")?.click());
    await p.waitForTimeout(300);
    await p.evaluate(() => Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click());
  }
  await p.waitForTimeout(2600);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }

  const pre = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    return { transitioning: s.transitioning, has: !!s.player };
  });
  console.log("PRE:", JSON.stringify(pre));

  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.getAttribute("aria-label") === "메뉴 화면으로 나가기")?.click();
  });
  await p.waitForTimeout(400);
  const overlay = await p.evaluate(() => !!Array.from(document.querySelectorAll("p")).find((x) => x.textContent?.includes("메뉴 화면으로 나갈까요")));
  console.log("OVERLAY:", overlay);

  // EventBus 직접 발화 (강한 실측)
  await p.evaluate(() => {
    window.__SERTZ_EB__.emit("rpg:exitMenu", { lobby: true });
  });
  await p.waitForTimeout(500);
  const mid = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    return { transitioning: s?.transitioning, camAlpha: s?.cameras?.main?.alpha };
  });
  console.log("MID:", JSON.stringify(mid));
  await p.waitForTimeout(3000);
  const post = await p.evaluate(() => {
    const w = window.__SERTZ__?.game;
    const active = w?.scene?.scenes?.filter((sc) => sc?.scene?.isActive())?.map((sc) => sc.scene.key) ?? [];
    return { active };
  });
  console.log("POST:", JSON.stringify(post));
  await b.close();
})();
