const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox","--disable-dev-shm-usage","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 900, height: 640 } });
  const logs=[]; p.on("pageerror",e=>logs.push("ERR "+(e.message||"").slice(0,160)));
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(9000);
  const click = async (t) => {
    const ok = await p.evaluate((txt) => {
      const el = [...document.querySelectorAll("button")].find(b => (b.textContent||"").includes(txt));
      if (el) { el.click(); return true; } return false;
    }, t);
    await p.waitForTimeout(1600);
    return ok;
  };
  console.log("start:", await click("게임 시작"));
  const step1 = await p.evaluate(() => ({
    inputs:[...document.querySelectorAll("input")].map(i=>({t:i.type,ph:i.placeholder||"",v:i.value||""})),
    buttons:[...document.querySelectorAll("button")].map(b=>(b.textContent||"").trim().slice(0,20)).slice(0,20),
    text:(document.body.innerText||"").slice(0,400),
  }));
  console.log(JSON.stringify(step1,null,1));
  await b.close();
})();
