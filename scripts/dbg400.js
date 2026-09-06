const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"] });
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 300)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 300)); });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(6000);
  const txt = await p.evaluate(() => document.body.innerText.slice(0, 400));
  console.log("BODY:", txt.replace(/\n/g, " | "));
  console.log("SCENE:", await p.evaluate(() => !!window.__SERTZ_SCENE__));
  console.log(errs.slice(0, 8).join("\n") || "no errors");
  await b.close();
})();
