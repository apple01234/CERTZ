const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox","--disable-dev-shm-usage","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 900, height: 640 } });
  const logs=[]; p.on("console",m=>logs.push(m.type()+": "+m.text().slice(0,200))); p.on("pageerror",e=>logs.push("PAGEERROR: "+e.message.slice(0,200)));
  const resp = await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle", timeout: 120000 }).catch(e=>null);
  console.log("status", resp && resp.status());
  await p.waitForTimeout(12000);
  const info = await p.evaluate(() => ({
    html: document.documentElement.outerHTML.length,
    rootChildren: document.getElementById("__next") ? document.getElementById("__next").childElementCount : -1,
    canvases: document.querySelectorAll("canvas").length,
    bodyLen: (document.body.innerText||"").length,
    bodyHead: (document.body.innerText||"").slice(0,300),
  }));
  console.log(JSON.stringify(info,null,1));
  console.log("LOGS:", logs.slice(0,25));
  await b.close();
})();
