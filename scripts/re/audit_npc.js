const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({args:["--use-gl=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
  const p = await b.newPage({viewport:{width:1280,height:720}});
  await p.goto("http://127.0.0.1:3161/",{waitUntil:"domcontentloaded"});
  for (let i=0;i<45;i++){ await p.waitForTimeout(2000);
    if (await p.evaluate(()=>{const g=window.__SERTZ__&&window.__SERTZ__.game; return g?g.scene.isActive("title"):false;})) break; }
  await p.evaluate(()=>{
    const s={stage:"village",lv:40,exp:0,maxHp:900,maxMp:300,atk:120,cleared:false,
      playerName:"T",gold:5000,potions:{hp:5,mp:5},weapon:"weapon_1",armor:"armor_1",
      owned:["weapon_1","armor_1"],upWea:0,upArm:0,starMap:{},inv:[],seen:[],sx:1200,sy:900,
      cls:"warrior",startCls:"warrior",gender:"m",skinIdx:0};
    localStorage.setItem("sertz_char_a1",JSON.stringify(s));
  });
  await p.reload({waitUntil:"domcontentloaded"});
  for (let i=0;i<45;i++){ await p.waitForTimeout(2000);
    if (await p.evaluate(()=>{const g=window.__SERTZ__&&window.__SERTZ__.game; return g?g.scene.isActive("title"):false;})) break; }
  await p.evaluate(()=>{const eb=window.__SERTZ__&&window.__SERTZ__.EventBus; if(eb) eb.emit("lobby:open");});
  await p.waitForTimeout(2500);
  const st = await p.evaluate(()=>{
    const el=[...document.querySelectorAll("button")].find(e=>/^이 캐릭터로 시작$/.test((e.textContent||"").trim()));
    if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};
  });
  if(st) await p.mouse.click(st.x,st.y);
  for (let i=0;i<40;i++){ await p.waitForTimeout(2000);
    if (await p.evaluate(()=>{const g=window.__SERTZ__&&window.__SERTZ__.game; const sc=g&&g.scene.getScene("world"); return !!(sc&&sc.player&&sc.player.active);})) break; }
  await p.waitForTimeout(3500);

  const r = await p.evaluate(()=>{
    const g=window.__SERTZ__&&window.__SERTZ__.game; const sc=g&&g.scene.getScene("world");
    const all = sc.children.list;
    const imgs = all.filter(o=>o.type==="Image");
    const texCount = {};
    imgs.forEach(o=>{ const k=o.texture?.key||"?"; texCount[k]=(texCount[k]||0)+1; });
    const spum = Object.keys(texCount).filter(k=>k.startsWith("spum"));
    const body = Object.keys(texCount).filter(k=>k.startsWith("npcbody"));
    const ell = all.filter(o=>o.type==="Ellipse");
    return {
      totalImages: imgs.length,
      spumTex: spum, screenTex: body,
      npcSpumCount: spum.reduce((a,k)=>a+texCount[k],0),
      npcBodyCount: body.reduce((a,k)=>a+texCount[k],0),
      ellipseCount: ell.length,
      ellipseInfo: ell.slice(0,4).map(o=>({w:o.width,h:o.height,fa:o.fillAlpha,vis:o.visible})),
    };
  });
  console.log(JSON.stringify(r,null,1));

  /* 마을 전체 + NPC 3명 클로즈업을 실제 화면에서 캡처한다.
     (종전엔 수치만 찍어서 /tmp/world_npc.png 같은 옛 이미지로 검증하는 실수가 있었다) */
  await p.screenshot({ path: "/tmp/world_now.png" });
  const spots = await p.evaluate(()=>{
    const g=window.__SERTZ__&&window.__SERTZ__.game; const sc=g&&g.scene.getScene("world");
    const cam=sc.cameras.main;
    /* 화면좌표는 scrollX 가 아니라 worldView 기준이어야 zoom 이 맞는다.
       종전 scrollX 사용으로 클립이 하늘만 잘려 나왔다. */
    const vx = cam.worldView ? cam.worldView.x : cam.scrollX;
    const vy = cam.worldView ? cam.worldView.y : cam.scrollY;
    return sc.children.list
      .filter(o=>o.type==="Image" && (o.texture?.key||"").startsWith("npcbody"))
      .map(o=>({key:o.texture.key,
        x:Math.round((o.x-vx)*cam.zoom),
        y:Math.round((o.y-vy)*cam.zoom),
        z:cam.zoom, vx:Math.round(vx), vy:Math.round(vy)}));
  });
  for (const s of spots) {
    if (s.x<50||s.y<50||s.x>1230||s.y>670) continue;
    await p.screenshot({ path:`/tmp/npc_${s.key}.png`,
      clip:{x:Math.max(0,s.x-50), y:Math.max(0,s.y-60), width:100, height:120} });
    console.log(`클립: /tmp/npc_${s.key}.png @ ${s.x},${s.y}`);
  }
  await b.close();
})();
