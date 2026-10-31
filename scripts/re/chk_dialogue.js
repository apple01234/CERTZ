const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({args:["--use-gl=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
  const p = await b.newPage({viewport:{width:1280,height:720}});
  await p.goto("http://127.0.0.1:3107/",{waitUntil:"domcontentloaded"});
  for (let i=0;i<45;i++){ await p.waitForTimeout(2000);
    if (await p.evaluate(()=>{const g=window.__SERTZ__&&window.__SERTZ__.game; return g?g.scene.isActive("title"):false;})) break; }
  // 대사창 강제 표시
  const shapes=[
    {speaker:"상인 라고스", lines:["어서 오게, 모험가여!","좋은 물건이 많다네."]},
    {speaker:"직업 교관 카이엔", lines:["자네의 길을 선택하게."]},
    {speaker:"마법사 흐레스", lines:["마법의 흐름이 느껴지는가?"]},
    {speaker:"알프헤임의 여왕 요정", lines:["인피니트보석이 흔들리고 있다."]},
    {speaker:"대장장이 브라키", lines:["쇠를 두드려 보겠나?"]},
  ];
  const r = await p.evaluate((shapes)=>{
    const eb = window.__SERTZ__ && window.__SERTZ__.EventBus;
    if (!eb) return {err:"no bus"};
    eb.emit("dialogue:show", shapes[0]);
    // DOM 이 뜨길 기다릴 수 없으므로 순차 emit 은 밖에서
    return {ok:true};
  }, shapes);
  await p.waitForTimeout(1200);
  const dom = await p.evaluate(()=>{
    const imgs=[...document.querySelectorAll("img")].filter(i=>i.src.includes("npcface")||i.src.includes("spum")||i.src.includes("npc_"));
    return imgs.map(i=>({src:i.src.split("/").slice(-2).join("/"), w:Math.round(i.getBoundingClientRect().width), h:Math.round(i.getBoundingClientRect().height), ok:i.complete&&i.naturalWidth>0}));
  });
  console.log("대사창 초상화:", JSON.stringify(dom,null,1));
  await p.screenshot({path:"/tmp/dialogue_check.png"});
  await b.close();
})();
