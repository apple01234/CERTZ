const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox","--disable-gpu","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport:{width:900,height:700} });
  const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
  await p.goto("http://127.0.0.1:3000/?renderer=canvas",{waitUntil:"domcontentloaded",timeout:120000});
  await p.waitForTimeout(12000);
  const btns = async()=> p.evaluate(()=>Array.from(document.querySelectorAll("button")).map(b=>b.textContent.trim()).slice(0,20));
  console.log("① 버튼:", JSON.stringify(await btns()));
  const click = async(re)=>p.evaluate(s=>{const rx=new RegExp(s);const b=Array.from(document.querySelectorAll("button")).find(x=>rx.test(x.textContent||""));if(b){b.click();return true}return false},re);
  console.log("게임시작:", await click(/게임 시작/)); await p.waitForTimeout(2500);
  console.log("② 버튼:", JSON.stringify(await btns()));
  console.log("이캐릭터로시작:", await click(/이 캐릭터로 시작/)); await p.waitForTimeout(3000);
  console.log("캐릭터생성:", await click(/캐릭터 생성/)); await p.waitForTimeout(1500);
  const inp = await p.$("input[placeholder*='캐릭터 이름']");
  if(inp){ await inp.fill("디버그"); await p.waitForTimeout(600); }
  console.log("③ 버튼:", JSON.stringify(await btns()));
  console.log("다음:", await click(/^다음/)); await p.waitForTimeout(1200);
  console.log("④ 버튼:", JSON.stringify(await btns()));
  console.log("생성:", await click(/모험가로 생성/)); await p.waitForTimeout(3000);
  console.log("⑤ 버튼:", JSON.stringify(await btns()));
  console.log("시작:", await click(/이 캐릭터로 시작/)); await p.waitForTimeout(12000);
  const info = await p.evaluate(()=>{
    const D=window.__SERTZ_DEBUG__; if(!D) return {noDebug:true};
    const g=D.game; if(!g) return {noGame:true};
    const all=g.scene.getScenes(false)||[];
    return { scenes: all.map(s=>({key:s.scene?.key, active:s.scene?.isActive?.(), hasPlayer:!!s.player, hasStage:!!s.stageDef})), errs:[] };
  });
  console.log("⑥ 씬:", JSON.stringify(info,null,1));
  console.log("pageerror:", errs.slice(0,5));
  await b.close();
})();
