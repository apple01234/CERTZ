const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args:["--no-sandbox","--disable-gpu","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport:{width:900,height:700} });
  await p.goto("http://127.0.0.1:3000/?renderer=canvas",{waitUntil:"domcontentloaded",timeout:120000});
  await p.waitForTimeout(15000);
  const r = await p.evaluate(()=>{
    const D=window.__SERTZ_DEBUG__;
    const S=D?.stages?.STAGES;
    if(!S) return {noStages:true, keys:Object.keys(D?.stages||{})};
    const all=Object.keys(S);
    return { total:all.length, sample:all.slice(0,25),
      detailed: all.slice(0,12).map(k=>({k, name:S[k]?.name, village:!!S[k]?.isVillage, boss:!!S[k]?.isBoss, ch:S[k]?.ch})) };
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
