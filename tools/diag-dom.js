const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox","--disable-dev-shm-usage"] });
  const p = await b.newPage({ viewport: { width: 900, height: 640 } });
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(8000);
  const info = await p.evaluate(() => ({
    title: document.title,
    canvas: !!document.querySelector("canvas"),
    inputs: [...document.querySelectorAll("input")].map(i => ({ type: i.type, ph: i.placeholder })),
    buttons: [...document.querySelectorAll("button")].map(t => (t.textContent||"").trim()).filter(Boolean).slice(0, 30),
    bodyText: (document.body.innerText||"").slice(0, 600),
    gameGlobal: !!(window.Phaser && window.Phaser.GAMES && window.Phaser.GAMES.length),
  }));
  console.log(JSON.stringify({ ...info, errs }, null, 2));
  await b.close();
})();
