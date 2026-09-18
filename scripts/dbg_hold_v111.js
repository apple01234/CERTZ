/** 홀드 진행 디버그 — 홀드 중 대사 텍스트가 실제로 넘어가는지 실측 */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 150)));
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2000);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1000);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(600);
  await p.locator("input").first().fill("테스터");
  await p.waitForTimeout(200);
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
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
  });
  await p.waitForTimeout(2500);
  for (let i = 0; i < 6; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(420); }
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    s?.finishIntro?.("테스터");
  });
  await p.waitForTimeout(1300);

  const dlgText = () => p.evaluate(() => {
    const dlgEl = document.querySelector(".absolute.inset-x-0.bottom-0.z-30");
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    return {
      t: dlgEl ? (dlgEl.textContent || "").replace(/\s+/g, " ").slice(0, 60) : null,
      queued: s?.queuedDialogue ?? null,
      d: !!s?.dialoguing,
    };
  });

  console.log("[홀드 시작]", JSON.stringify(await dlgText()));
  await p.mouse.move(640, 600);
  await p.mouse.down();
  for (const ms of [1500, 3000, 5000, 8000, 12000]) {
    await p.waitForTimeout(ms === 1500 ? 1500 : ms - (ms === 3000 ? 1500 : ms === 5000 ? 3000 : ms === 8000 ? 5000 : 8000));
    console.log(`[${ms}ms]`, JSON.stringify(await dlgText()));
  }
  await p.mouse.up();
  await p.waitForTimeout(4000);
  const s = window;
  const fin = await p.evaluate(() => {
    const sw = window.__SERTZ__?.game?.scene?.getScene("world");
    return { tut: !!sw?.tut, queued: sw?.queuedDialogue ?? null, d: !!sw?.dialoguing };
  });
  console.log("[홀드 종료 후]", JSON.stringify(fin));
  await b.close();
})().catch((e) => { console.error("CRASH:", e.message); process.exit(2); });
