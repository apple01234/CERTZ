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
    const i=await p.$("input[placeholder*='캐릭터 이름']"); if(i) await i.fill("vfx검증");
    await p.waitForTimeout(800); await click(/^다음/); await p.waitForTimeout(1100);
    await click(/모험가로 생성/); await p.waitForTimeout(3500); ok=await click(/이 캐릭터로 시작/); }
  await wait(["world"],60000); await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(s=>s&&s.player);
    const all = ["fx_shockwave","fx_impact","fx_glow","fx_burst","fx_flare","fx_smoke",
                 "fx_electro","fx_flarew","fx_hex","fx_glowblue","fx_noise","fx_caustic",
                 "fx_electrichit","fx_lightning","fx_glowyellow","fx_aura","fx_purple","fx_flarebig"];
    const res = {}; for (const k of all) res[k]=sc.textures.exists(k);
    const missing = all.filter(k=>!res[k]);
    return { total: all.length, loaded: all.length-missing.length, missing };
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
