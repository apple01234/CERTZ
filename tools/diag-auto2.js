const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
  const wait = async (w, ms) => { const t0=Date.now(); let c=[];
    while(Date.now()-t0<ms){ try{ c=await p.evaluate(()=>window.__SERTZ_DEBUG__?.game?.scene.getScenes(true).map(s=>s.scene.key)??[]);
    if(w.every(x=>c.includes(x)))return c;}catch{} await p.waitForTimeout(700);} return c; };
  const click = async (re) => p.evaluate((s)=>{const rx=new RegExp(s);
    const bt=Array.from(document.querySelectorAll("button")).find(x=>rx.test(x.textContent||"")&&x.offsetParent!==null);
    if(bt){bt.click();return true;}return false;}, re.source);
  await wait(["title"],60000); await click(/게임 시작/); await p.waitForTimeout(2200);
  let ok=await click(/이 캐릭터로 시작/);
  if(!ok){ await click(/캐릭터 생성/); await p.waitForTimeout(1400);
    const i=await p.$("input[placeholder*='캐릭터 이름']"); if(i) await i.fill("자동2");
    await p.waitForTimeout(800); await click(/^다음/); await p.waitForTimeout(1100);
    await click(/모험가로 생성/); await p.waitForTimeout(3500); ok=await click(/이 캐릭터로 시작/); }
  await wait(["world"],60000); await p.waitForTimeout(3000);
  await p.evaluate(() => { const sc=window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(s=>s&&s.player);
    sc.gotoStage("forest", undefined, true); });
  await wait(["world"],45000); await p.waitForTimeout(5000);

  const r = await p.evaluate(async () => {
    const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(s => s && s.player);
    sc.player.cls = "pirate"; sc.player.lv = 60;
    sc.tut = null; sc.dialoguing = false; sc.tutorialDone = true;
    const samples = [];
    // autoHunt 메서드 이름 찾기
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(sc)).filter(m => /auto/i.test(m));
    sc.autoHunt = true;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 200));
      samples.push({
        auto: sc.auto,
        hasTarget: !!sc.autoTarget,
        enemies: sc.enemies.filter(e=>e.alive&&e.active).length,
        px: Math.round(sc.player.x), py: Math.round(sc.player.y),
      });
    }
    return { methods, stage: sc.stageDef?.key, samples: samples.slice(0, 8), last: samples[samples.length-1] };
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
