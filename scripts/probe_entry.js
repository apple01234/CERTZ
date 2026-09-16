/** 클린 재현: 생성→입장만 하고 1.5/3/5초 스크린샷 (클릭 없음) */
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 200)));
  p.on("console", (m) => { const t = m.text(); if (t.includes("[PROBE]")) console.log(t.slice(0, 400)); });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2200);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    const b2 = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"));
    b2?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("클린");
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
  await p.waitForTimeout(1400);
  // 마우스를 구석으로 치우친 뒤 입장 (잔여 호버 제거)
  await p.mouse.move(5, 700);
  await p.evaluate(() => {
    const card = document.querySelector(".cursor-pointer");
    card?.click();
  });
  await p.waitForTimeout(500);
  await p.mouse.move(5, 700);
  await p.evaluate(() => {
    const b2 = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"));
    b2?.click();
  });
  await p.mouse.move(5, 700);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: "/tmp/clean_1500.png" });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "/tmp/clean_2700.png" });
  // 열려있는 패널 정체를 DOM으로 판독
  const info = await p.evaluate(() => {
    const scrolls = Array.from(document.querySelectorAll("div")).filter((d) => typeof d.className === "string" && d.className.includes("overflow-y-auto") && d.className.includes("max-h"));
    const txt = scrolls.map((d) => (d.textContent || "").replace(/\s+/g, " ").slice(0, 120));
    return { n: scrolls.length, txt: txt.slice(0, 3) };
  });
  console.log("PANEL:", JSON.stringify(info));
  console.log("done");
  await b.close();
})();
