/** 탑 내부 탐색 — 패널 닫고 이동하며 NPC UI 정체 캡처 */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 200)));
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  // 캐릭터 없으면 생성
  let card = await p.$(".cursor-pointer");
  if (!card) {
    await p.evaluate(() => {
      const b2 = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"));
      b2?.click();
    });
    await p.waitForTimeout(700);
    await p.locator("input").first().fill("탐험가");
    await p.waitForTimeout(300);
    for (const label of ["직업 선택", "외형 선택"]) {
      await p.evaluate((lb) => {
        const b2 = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb));
        b2?.click();
      }, label);
      await p.waitForTimeout(400);
    }
    await p.evaluate(() => {
      const b2 = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"));
      b2?.click();
    });
    await p.waitForTimeout(1300);
    card = await p.$(".cursor-pointer");
  }
  if (card) { await card.click(); await p.waitForTimeout(400); }
  const startBtn = p.getByText("이 캐릭터로 시작", { exact: false }).first();
  if (await startBtn.isVisible().catch(() => false)) await startBtn.click();
  await p.waitForTimeout(4500);
  // 콘텐츠 → 탑 입장
  await p.evaluate(() => {
    const s = Array.from(document.querySelectorAll("span")).find((x) => x.textContent === "콘텐츠");
    s?.closest("button")?.click();
  });
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    const e = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("탑 입장"));
    e?.click();
  });
  await p.waitForTimeout(3500);
  // 패널 닫기
  await p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const x = btns.find((b2) => b2.getAttribute("aria-label")?.includes("닫기") || b2.textContent?.trim() === "✕");
    x?.click();
  });
  await p.waitForTimeout(800);
  await p.screenshot({ path: "/tmp/tw_0.png" });
  // 이동 (방향키) — 아래로 2초, 좌로 2초
  await p.keyboard.down("ArrowDown");
  await p.waitForTimeout(1600);
  await p.keyboard.up("ArrowDown");
  await p.keyboard.down("ArrowLeft");
  await p.waitForTimeout(1400);
  await p.keyboard.up("ArrowLeft");
  await p.waitForTimeout(500);
  await p.screenshot({ path: "/tmp/tw_1.png" });
  // E키 (상호작용) 눌러보기
  await p.keyboard.press("e");
  await p.waitForTimeout(1200);
  await p.screenshot({ path: "/tmp/tw_2.png" });
  console.log("done");
  await b.close();
})();
