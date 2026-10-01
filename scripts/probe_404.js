/* 404 자원 탐지 프로브 — v121 흐름 재현, 404 응답 URL 수집 */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const notFound = [];
  p.on("response", (r) => { if (r.status() === 404) notFound.push(r.url()); });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1000);
  await p.evaluate(() => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click(); });
  await p.waitForTimeout(600);
  await p.locator("input").first().fill("프로브");
  await p.waitForTimeout(300);
  for (const label of ["직업 선택", "외형 선택"]) await p.evaluate((lb) => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click(); }, label);
  await p.waitForTimeout(350);
  await p.evaluate(() => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click(); });
  await p.waitForTimeout(1300);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(350);
  await p.evaluate(() => { Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click(); });
  await p.waitForTimeout(3000);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  await p.waitForTimeout(1500);
  console.log("404 목록:", JSON.stringify(notFound, null, 1));
  await b.close();
})();
