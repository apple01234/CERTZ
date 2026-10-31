const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({args:["--use-gl=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
  const p = await b.newPage({viewport:{width:1440,height:900}});
  await p.goto("http://127.0.0.1:3099/",{waitUntil:"domcontentloaded"});
  for (let i=0;i<45;i++){ await p.waitForTimeout(2000);
    if (await p.evaluate(()=>{const g=window.__SERTZ__&&window.__SERTZ__.game; return g?g.scene.isActive("title"):false;})) break; }
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
  const r = await p.evaluate(()=>{
    const c=document.querySelector(".otaku-card");
    if(!c) return {found:false};
    const cs=getComputedStyle(c), rc=c.getBoundingClientRect();
    const art=c.querySelector(".otaku-art");
    const artRc=art?art.getBoundingClientRect():null;
    const img=c.querySelector(".otaku-art img");
    const imgRc=img?img.getBoundingClientRect():null;
    return {
      found:true,
      cardW:Math.round(rc.width), cardH:Math.round(rc.height),
      ratio:(rc.height/rc.width).toFixed(2),
      flexDir:cs.flexDirection,
      hasArt:!!art, artH:artRc?Math.round(artRc.height):0,
      imgW:imgRc?Math.round(imgRc.width):0, imgH:imgRc?Math.round(imgRc.height):0,
      artPct: artRc? Math.round(artRc.height/rc.height*100):0,
    };
  });
  console.log(JSON.stringify(r,null,1));
  await p.screenshot({path:"/tmp/otaku2.png"});
  await b.close();
})();
