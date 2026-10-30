const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ executablePath: "/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome",
    args: ["--no-sandbox","--disable-dev-shm-usage","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto("http://127.0.0.1:3047", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(8000);
  const info = await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")].map(x => (x.textContent||"").trim().slice(0,40));
    const divs = [...document.querySelectorAll("[role=button]")].map(x => (x.textContent||"").trim().slice(0,40));
    return { btns, divs, hasCanvas: !!document.querySelector("canvas") };
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})();
