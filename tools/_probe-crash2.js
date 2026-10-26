const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox","--disable-dev-shm-usage","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 900, height: 640 } });
  const logs=[]; p.on("pageerror",e=>logs.push("PAGEERROR: "+(e.stack||e.message).slice(0,400)));
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(14000);
  const info = await p.evaluate(() => ({
    body:(document.body.innerText||"").slice(0,260),
    buttons:[...document.querySelectorAll("button")].map(b=>(b.textContent||"").trim().slice(0,18)).slice(0,12),
    renderer: (()=>{ const g=window.__SERTZ_GAME__||(window.Phaser&&window.Phaser.GAMES&&window.Phaser.GAMES[0]); if(!g) return null; try { return g.renderer && g.renderer.type; } catch { return "err"; } })(),
  }));
  console.log(JSON.stringify(info,null,1));
  console.log("ERRORS:", logs.slice(0,4));
  await b.close();
})();
