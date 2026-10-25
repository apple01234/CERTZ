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
    const i=await p.$("input[placeholder*='캐릭터 이름']"); if(i) await i.fill("진단");
    await p.waitForTimeout(800); await click(/^다음/); await p.waitForTimeout(1100);
    await click(/모험가로 생성/); await p.waitForTimeout(3500); ok=await click(/이 캐릭터로 시작/); }
  await wait(["world"],60000); await p.waitForTimeout(3000);

  const d = await p.evaluate(async () => {
    const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(s => s && s.player);
    const before = { stage: sc.stageDef?.key, enemies: sc.enemies?.length ?? -1, auto: sc.auto, autoTarget: !!sc.autoTarget };
    sc.gotoStage("forest", undefined, true);
    return before;
  });
  console.log("BEFORE", JSON.stringify(d));
  await wait(["world"], 45000);
  await p.waitForTimeout(6000);
  const after = await p.evaluate(async () => {
    const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(s => s && s.player);
    const s0 = { stage: sc.stageDef?.key, enemies: sc.enemies?.length ?? -1, auto: sc.auto };
    sc.auto = true;
    await new Promise(r => setTimeout(r, 3000));
    const s1 = {
      auto: sc.auto,
      autoTarget: sc.autoTarget ? { x: Math.round(sc.autoTarget.x), y: Math.round(sc.autoTarget.y), alive: sc.autoTarget.alive } : null,
      enemies: sc.enemies.map(e => ({ alive: e.alive, active: e.active, d: Math.round(Math.hypot(e.x-sc.player.x, e.y-sc.player.y)) })).slice(0,5),
      player: { x: Math.round(sc.player.x), y: Math.round(sc.player.y) },
      autoStuckMs: sc.autoStuckMs,
    };
    return { s0, s1 };
  });
  console.log("AFTER", JSON.stringify(after, null, 1));
  await b.close();
})();
