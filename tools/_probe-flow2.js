const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox","--disable-dev-shm-usage","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 900, height: 640 } });
  const logs=[]; p.on("pageerror",e=>logs.push("ERR "+(e.message||"").slice(0,200)));
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(9000);
  // 실제 마우스 클릭 (Phaser 입력은 합성 click 이벤트를 무시할 수 있음)
  const box = await p.evaluate(() => {
    const el = [...document.querySelectorAll("button")].find(b => (b.textContent||"").includes("게임 시작"));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, h: r.height };
  });
  console.log("box", box);
  if (box) { await p.mouse.click(box.x, box.y); }
  await p.waitForTimeout(3000);
  const after = await p.evaluate(() => ({
    text:(document.body.innerText||"").slice(0,500),
    inputs:[...document.querySelectorAll("input")].map(i=>({t:i.type,ph:i.placeholder||""})),
  }));
  console.log(JSON.stringify(after,null,1));
  console.log("ERR", logs.slice(0,3));
  await b.close();
})();
