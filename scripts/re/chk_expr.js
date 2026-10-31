const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({args:["--use-gl=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
  const p = await b.newPage({viewport:{width:1280,height:720}});
  await p.goto("http://127.0.0.1:3111/",{waitUntil:"domcontentloaded"});
  for (let i=0;i<45;i++){ await p.waitForTimeout(2000);
    if (await p.evaluate(()=>{const g=window.__SERTZ__&&window.__SERTZ__.game; return g?g.scene.isActive("title"):false;})) break; }

  const tests=[
    ["어서 오게, 모험가여!","상인 라고스","happy"],
    ["젠장, 또 실패했어","상인 라고스","angry"],
    ["숲의 신전으로 가야 한다.","상인 라고스","neutral"],
  ];
  const out=[];
  for (const [line, sp, want] of tests){
    await p.evaluate(([l,s])=>{const eb=window.__SERTZ__&&window.__SERTZ__.EventBus;
      if(eb) eb.emit("dialogue:show",{speaker:s,lines:[l]});}, [line,sp]);
    await p.waitForTimeout(1000);
    const got = await p.evaluate(()=>{
      const im=[...document.querySelectorAll("img")].find(i=>i.src.includes("npcface"));
      return im? im.src.split("/").pop() : null;
    });
    out.push({line:line.slice(0,20), want, got, ok: got===`merchant_${want}.png`});
    await p.screenshot({path:`/tmp/expr_${want}.png`});
  }
  console.log(JSON.stringify(out,null,1));
  const pass=out.every(o=>o.ok);
  console.log(">>> 판정:", pass?"PASS 3/3":"FAIL");
  await b.close();
})();
