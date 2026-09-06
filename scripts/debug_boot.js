const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const logs = [];
  page.on("console", (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message.slice(0, 400)}`));
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(9000);
  const has = await page.evaluate(() => ({
    sertzScene: !!window.__SERTZ_SCENE__,
    buttons: [...document.querySelectorAll("button")].map((b) => b.textContent?.trim()).slice(0, 8),
  }));
  console.log(JSON.stringify(has, null, 1));
  console.log(logs.slice(0, 20).join("\n"));
  await browser.close();
})();
