const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  for (let i = 0; i < 30 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++) await p.waitForTimeout(300);
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(2000);
  const dom1 = await p.evaluate(() => ({
    buttons: Array.from(document.querySelectorAll("button")).map((x) => x.textContent?.trim()).filter(Boolean).slice(0, 20),
    body: document.body.innerText.slice(0, 400),
  }));
  console.log("DOM1:", JSON.stringify(dom1, null, 1).slice(0, 1200));
  await b.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
