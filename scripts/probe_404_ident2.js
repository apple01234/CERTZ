/** 404 리소스 식별 프로브 2 — console location으로 출처 추적 */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  p.on("console", (m) => {
    if (m.type() === "error" && m.text().includes("404")) {
      const loc = m.location();
      console.log("404-MSG:", m.text().slice(0, 100), "| loc:", JSON.stringify(loc));
    }
  });
  p.on("requestfailed", (r) => console.log("REQFAIL:", r.url().slice(0, 120), r.failure()?.errorText));
  p.on("response", (r) => { if (r.status() >= 400) console.log("HTTP", r.status(), r.url().slice(0, 120)); });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(4000);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  await p.waitForTimeout(4000);
  console.log("done (title stage)");
  await b.close();
})();
