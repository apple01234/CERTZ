const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox","--disable-dev-shm-usage"] });
  const p = await b.newPage({ viewport: { width: 900, height: 640 } });
  const bad = [];
  p.on("response", r => { if (r.status() >= 400) bad.push(r.status()+" "+r.url().replace("http://127.0.0.1:3000","")); });
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(25000);
  console.log(JSON.stringify([...new Set(bad)], null, 2));
  await b.close();
})();
