/** 대사 진행 디버그 — 각 단계에서 DOM 대사 텍스트 + 씬 상태 덤프 */
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

  const dump = () => p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    /* 대사창 DOM: 하단 z-30 게임패널 — 화자명+본문 추출 */
    const dlgEl = document.querySelector(".absolute.inset-x-0.bottom-0.z-30");
    return {
      dlg: dlgEl ? (dlgEl.textContent || "").replace(/\s+/g, " ").slice(0, 90) : null,
      dialoguing: !!s?.dialoguing,
      introStep: s?.introStep ?? null,
      queued: s?.queuedDialogue ?? null,
      pending: !!s?.tutPendingStart,
      retry: Math.round(s?.tutRetryMs ?? -1),
      tut: !!s?.tut,
    };
  });

  console.log("[prologue 후]", JSON.stringify(await dump()));
  await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    s?.finishIntro?.("테스터");
  });
  await p.waitForTimeout(1300);
  console.log("[finishIntro 후]", JSON.stringify(await dump()));
  /* 단발 클릭 3회 — 매번 상태 확인 */
  for (let i = 0; i < 3; i++) {
    await p.mouse.click(640, 600);
    await p.waitForTimeout(700);
    console.log(`[클릭 ${i + 1}]`, JSON.stringify(await dump()));
  }
  await b.close();
})().catch((e) => { console.error("CRASH:", e.message); process.exit(2); });
