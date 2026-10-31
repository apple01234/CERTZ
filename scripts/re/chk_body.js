const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({args:["--use-gl=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
  const p = await b.newPage({viewport:{width:1280,height:720}});
  const net=[];
  p.on("response", r=>{ if(r.url().includes("npcbody")) net.push({u:r.url().split("/").pop(), s:r.status()}); });
  await p.goto("http://127.0.0.1:3129/",{waitUntil:"domcontentloaded"});
  for (let i=0;i<45;i++){ await p.waitForTimeout(2000);
    if (await p.evaluate(()=>{const g=window.__SERTZ__&&window.__SERTZ__.game; return g?g.scene.isActive("title"):false;})) break; }
  // 마을로 입장
  await p.evaluate(()=>{
    const s={stage:"village",lv:40,exp:0,maxHp:900,maxMp:300,atk:120,cleared:false,
      playerName:"테스터",gold:5000,potions:{hp:5,mp:5},weapon:"weapon_1",armor:"armor_1",
      owned:["weapon_1","armor_1"],upWea:0,upArm:0,starMap:{},inv:[],seen:[],sx:1200,sy:900,
      cls:"warrior",startCls:"warrior",gender:"m",skinIdx:0};
    localStorage.setItem("sertz_char_body1",JSON.stringify(s));
  });
  await p.reload({waitUntil:"domcontentloaded"});
  for (let i=0;i<45;i++){ await p.waitForTimeout(2000);
    if (await p.evaluate(()=>{const g=window.__SERTZ__&&window.__SERTZ__.game; return g?g.scene.isActive("title"):false;})) break; }
  await p.evaluate(()=>{const eb=window.__SERTZ__&&window.__SERTZ__.EventBus; if(eb) eb.emit("lobby:open");});
  await p.waitForTimeout(2500);
  const st = await p.evaluate(()=>{
    const el=[...document.querySelectorAll("button")].find(e=>/^이 캐릭터로 시작$/.test((e.textContent||"").trim()));
    if(!el) return null; const r=el.getBoundingClientRect();
    return {x:r.x+r.width/2,y:r.y+r.height/2};
  });
  if(st) await p.mouse.click(st.x, st.y);
  // 월드 진입 대기
  for (let i=0;i<40;i++){ await p.waitForTimeout(2000);
    if (await p.evaluate(()=>{const g=window.__SERTZ__&&window.__SERTZ__.game; const sc=g&&g.scene.getScene("world");
      return !!(sc&&sc.player&&sc.player.active);})) break; }
  await p.waitForTimeout(3000);
  const tex = await p.evaluate(()=>{
    const g=window.__SERTZ__&&window.__SERTZ__.game; const sc=g&&g.scene.getScene("world");
    if(!sc) return {err:"no world"};
    // 월드 씬의 이미지 게임오브젝트 중 npcbody 텍스처를 쓰는 것
    const imgs = sc.children.list.filter(o=>o.type==="Image" && typeof o.texture?.key==="string" && o.texture.key.startsWith("npcbody"));
    return {npcbodyCount:imgs.length, keys:imgs.map(o=>o.texture.key).slice(0,6),
      loaded:["npcbody_villager_m","npcbody_villager_f"].map(k=>({k, has:sc.textures.exists(k)}))};
  });
  console.log("네트워크(npcbody):", JSON.stringify(net.slice(0,6)));
  console.log("월드 텍스처:", JSON.stringify(tex,null,1));
  await p.screenshot({path:"/tmp/world_npc.png"});
  await b.close();
})();
