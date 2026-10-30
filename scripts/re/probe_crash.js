const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ executablePath: "/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome",
    args: ["--no-sandbox","--disable-dev-shm-usage","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const logs = [], errs = [];
  p.on("console", m => { const t=m.text(); if (/error|실패|undefined|Cannot|TypeError/i.test(t)) logs.push(t.slice(0,220)); });
  p.on("pageerror", e => errs.push(String(e.stack||e).slice(0,600)));
  await p.goto("http://127.0.0.1:3047", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(10000);
  await p.evaluate(() => { window.__SERTZ__.EventBus.emit("game:new", {}); });
  await p.waitForTimeout(6000);
  console.log("=== pageerror ===");
  errs.slice(0,4).forEach((e,i)=>console.log(`[${i}]`, e));
  console.log("=== 콘솔(에러류) ===");
  logs.slice(-8).forEach((l,i)=>console.log(`(${i})`, l));
  await b.close();
})();
