const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({args:["--use-gl=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
  const p = await b.newPage({viewport:{width:1440,height:900}});
  await p.goto("http://127.0.0.1:3095/",{waitUntil:"domcontentloaded"});
  // 타이틀까지
  for (let i=0;i<45;i++){ await p.waitForTimeout(2000);
    if (await p.evaluate(()=>{const g=window.__SERTZ__&&window.__SERTZ__.game; return g?g.scene.isActive("title"):false;})) break; }
  // 캐릭터 세이브 주입 후 로비
  await p.evaluate(()=>{
    const s={stage:"village",lv:40,exp:0,maxHp:900,maxMp:300,atk:120,cleared:false,
      playerName:"테스터",gold:5000,potions:{hp:5,mp:5},weapon:"weapon_1",armor:"armor_1",
      owned:["weapon_1","armor_1"],upWea:0,upArm:0,starMap:{},inv:[],seen:[],sx:1200,sy:900};
    localStorage.setItem("sertz_char_otaku1",JSON.stringify(s));
  });
  await p.reload({waitUntil:"domcontentloaded"});
  for (let i=0;i<45;i++){ await p.waitForTimeout(2000);
    if (await p.evaluate(()=>{const g=window.__SERTZ__&&window.__SERTZ__.game; return g?g.scene.isActive("title"):false;})) break; }
  await p.evaluate(()=>{const eb=window.__SERTZ__&&window.__SERTZ__.EventBus; if(eb) eb.emit("lobby:open");});
  await p.waitForTimeout(2500);

  const res = await p.evaluate(()=>{
    const card=document.querySelector(".otaku-card");
    if(!card) return {found:false};
    const cs=getComputedStyle(card);
    const name=document.querySelector(".otaku-name");
    const badge=document.querySelector(".otaku-badge");
    return {
      found:true,
      radius:cs.borderRadius,
      shadow:cs.boxShadow.slice(0,70),
      transition:cs.transitionProperty.slice(0,60),
      hasBefore:getComputedStyle(card,"::before").height,
      nameShadow:name?getComputedStyle(name).textShadow.slice(0,70):null,
      badgeFound:!!badge,
      selected:card.getAttribute("data-selected"),
    };
  });
  console.log(JSON.stringify(res,null,1));

  // 호버 측정
  if(res.found){
    const card = p.locator(".otaku-card").first();
    await card.hover();
    await p.waitForTimeout(400);
    const hov = await p.evaluate(()=>{
      const c=document.querySelector(".otaku-card");
      const cs=getComputedStyle(c);
      return {transform:cs.transform.slice(0,50), shadow:cs.boxShadow.slice(0,90)};
    });
    console.log("HOVER:", JSON.stringify(hov,null,1));
  }
  await p.screenshot({path:"/tmp/otaku_lobby.png"});
  console.log("스크린샷: /tmp/otaku_lobby.png");
  await b.close();
})();
