const { chromium } = require("playwright");
async function run(ua, touch, label) {
  const b = await chromium.launch({ args:["--no-sandbox","--disable-gpu","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport:{width:1000,height:760}, userAgent:ua, hasTouch:touch });
  const errs=[]; p.on("pageerror",e=>errs.push(String(e).slice(0,120)));
  await p.goto("http://127.0.0.1:3000/", { waitUntil:"domcontentloaded", timeout:120000 });
  const click=async(re)=>p.evaluate((s)=>{const rx=new RegExp(s);const bt=Array.from(document.querySelectorAll("button")).find(x=>rx.test(x.textContent||"")&&x.offsetParent!==null);if(bt){bt.click();return true;}return false;},re.source);
  const wait=async(w,ms)=>{const t0=Date.now();while(Date.now()-t0<ms){try{const c=await p.evaluate(()=>window.__SERTZ_DEBUG__?.game?.scene?.getScenes(true).map(s=>s.scene.key)??[]);if(w.every(x=>c.includes(x)))return c;}catch{}await p.waitForTimeout(800);}return[];};
  await wait(["title"],150000); await p.waitForTimeout(2000);
  await click(/게임 시작/); await p.waitForTimeout(2500);
  let ok=await click(/이 캐릭터로 시작/);
  if(!ok){
    await click(/캐릭터 생성/); await p.waitForTimeout(2000);
    const i=await p.$("input[placeholder*='캐릭터 이름']"); if(i) await i.fill(label);
    await p.waitForTimeout(900); await click(/다음/); await p.waitForTimeout(1800);
    await click(/모험가로 생성|생성/); await p.waitForTimeout(4500);
    ok=await click(/이 캐릭터로 시작|입장|시작/);
  }
  const sc=await wait(["world"],120000);
  if(!sc.length){ console.log(label,"world 실패"); await b.close(); return; }
  await p.waitForTimeout(4000);
  const r = await p.evaluate(()=>{
    try{
      const s=window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(x=>x&&x.player);
      if(!s) return {noPlayer:true};
      return { lowPerf:/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||navigator.maxTouchPoints>=2,
               playerToon: !!s.playerToon, ambientFilters: s.ambientFilters?.length ?? -1, fxLevel: s.fxLevel };
    }catch(e){ return {err:e.message}; }
  });
  console.log(label, JSON.stringify(r), "errs:", errs.length);
  await b.close();
}
(async()=>{
  await run(undefined, false, "PC");
  await run("Mozilla/5.0 (Linux; Android 13; SM-G985F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36", true, "모바일");
})();
