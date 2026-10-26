const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox","--disable-dev-shm-usage","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 900, height: 640 } });
  const logs=[];
  p.on("console",m=>logs.push(m.type().toUpperCase()+": "+m.text().slice(0,400)));
  p.on("pageerror",e=>logs.push("PAGEERROR: "+(e.stack||e.message).slice(0,1200)));
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(15000);
  console.log(JSON.stringify({ body:(await p.evaluate(()=>document.body.innerText.slice(0,200))) },null,1));
  console.log("=== ERRORS ===");
  for (const l of logs.filter(x=>/PAGEERROR|^ERROR/i.test(x))) console.log(l, "\n---");
  await b.close();
})();
