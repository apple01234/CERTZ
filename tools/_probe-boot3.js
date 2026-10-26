const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox","--disable-dev-shm-usage","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 900, height: 640 } });
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(8000);
  const before = await p.evaluate(() => ({
    buttons: [...document.querySelectorAll("button")].map(b=>({txt:(b.textContent||"").trim().slice(0,20), cls:(b.className||"").slice(0,40)})).slice(0,15),
    inputs: [...document.querySelectorAll("input")].map(i=>({t:i.type,ph:i.placeholder||"",name:i.name||""})),
  }));
  console.log("BEFORE", JSON.stringify(before,null,1));
  // 게임 시작 클릭
  const clicked = await p.evaluate(() => {
    const el = [...document.querySelectorAll("button")].find(b => (b.textContent||"").includes("게임 시작"));
    if (el) { el.click(); return true; } return false;
  });
  await p.waitForTimeout(3500);
  const after = await p.evaluate(() => ({
    buttons: [...document.querySelectorAll("button")].map(b=>(b.textContent||"").trim().slice(0,25)).slice(0,25),
    inputs: [...document.querySelectorAll("input")].map(i=>({t:i.type,ph:i.placeholder||"",name:i.name||""})),
    body: (document.body.innerText||"").slice(0,500),
  }));
  console.log("CLICKED", clicked);
  console.log("AFTER", JSON.stringify(after,null,1));
  await b.close();
})();
