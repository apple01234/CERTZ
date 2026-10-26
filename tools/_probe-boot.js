const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox","--disable-dev-shm-usage"] });
  const p = await b.newPage({ viewport: { width: 900, height: 640 } });
  const logs=[]; p.on("console",m=>logs.push(m.text().slice(0,160))); p.on("pageerror",e=>logs.push("ERR "+e.message.slice(0,160)));
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(9000);
  const info = await p.evaluate(() => ({
    inputs: [...document.querySelectorAll("input")].map(i=>({t:i.type,ph:i.placeholder,id:i.id})),
    buttons: [...document.querySelectorAll("button")].slice(0,20).map(b=>(b.textContent||"").trim().slice(0,24)),
    text: (document.body.innerText||"").slice(0,600),
  }));
  console.log(JSON.stringify(info,null,1));
  console.log("LOGS:", logs.filter(l=>/ERR|error/i.test(l)).slice(0,6));
  await b.close();
})();
