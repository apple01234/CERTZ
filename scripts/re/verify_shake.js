const { chromium } = require("playwright");
const ID = "verify209";
(async () => {
  const b = await chromium.launch({args:["--use-gl=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
  const p = await b.newPage({viewport:{width:1280,height:720}});
  const errs=[]; p.on("pageerror", e=>errs.push(String(e.message).slice(0,120)));
  await p.goto("http://127.0.0.1:3090/",{waitUntil:"domcontentloaded"});
  await p.waitForTimeout(1500);

  // 올바른 SaveData 주입 (stage 필수)
  await p.evaluate((id)=>{
    const save = {
      stage:"village", lv:40, exp:0, maxHp:900, maxMp:300, atk:120, cleared:false,
      playerName:"셰이크검증", gold:5000, potions:{hp:5,mp:5},
      weapon:"weapon_1", armor:"armor_1", owned:["weapon_1","armor_1"],
      upWea:0, upArm:0, starMap:{}, inv:[], seen:[], sx:1200, sy:900,
    };
    localStorage.setItem("sertz_char_"+id, JSON.stringify(save));
  }, ID);

  await p.reload({waitUntil:"domcontentloaded"});
  for (let i=0;i<40;i++){ await p.waitForTimeout(2000);
    if (await p.evaluate(()=>{const g=window.__SERTZ__&&window.__SERTZ__.game; return g?g.scene.isActive("title"):false;})) break; }

  const slots = await p.evaluate(()=>localStorage.getItem("sertz_slots_v1"));
  console.log("slots:", (slots||"").slice(0,220));

  await p.evaluate(()=>{const eb=window.__SERTZ__&&window.__SERTZ__.EventBus; if(eb) eb.emit("lobby:open");});
  await p.waitForTimeout(2500);
  const btns = await p.evaluate(()=>{const o=[];document.querySelectorAll("button").forEach(e=>{const t=(e.textContent||"").trim();if(t)o.push(t.slice(0,44));});return o;});
  console.log("버튼:", JSON.stringify(btns));

  // 시작 버튼 좌표 클릭
  const start = await p.evaluate(()=>{
    const el=[...document.querySelectorAll("button")].find(e=>/^이 캐릭터로 시작$/.test((e.textContent||"").trim()));
    if(!el) return null; const r=el.getBoundingClientRect();
    return {x:r.x+r.width/2,y:r.y+r.height/2,txt:(el.textContent||"").trim().slice(0,30)};
  });
  console.log("시작버튼:", JSON.stringify(start));
  if (start) await p.mouse.click(start.x, start.y);

  let ready=false;
  for (let i=0;i<35;i++){
    await p.waitForTimeout(2000);
    const st=await p.evaluate(()=>{const g=window.__SERTZ__&&window.__SERTZ__.game;const sc=g&&g.scene.getScene("world");
      return {w:g?g.scene.isActive("world"):false,impact:sc?!!sc.impactFX:false,player:sc?!!sc.player:false};});
    if(i%5===0) console.log(`t+${(i+1)*2}s`,JSON.stringify(st));
    if(st.impact&&st.player){ready=true;console.log("READY",JSON.stringify(st));break;}
  }
  console.log("READY:",ready,"ERRS:",errs.slice(0,2));

  if (ready) {
    const res = await p.evaluate(()=>{
      const g=window.__SERTZ__.game; const sc=g.scene.getScene("world");
      const cam=sc.cameras.main, fx=sc.impactFX, eff=cam.shakeEffect;
      const snap=()=>({run:!!eff.isRunning,dur:eff.duration,int:eff.intensity?eff.intensity.x:null});
      const out={};
      /* 헤드리스는 SwiftShader 라 isLowPerfEnv() → fxLevel 0 으로 강등된다.
       *  그러면 모든 셰이크가 게이트에 막혀 우선순위 자체를 검증할 수 없다.
       *  검증 목적상 정상 기기(fxLevel 1)를 강제한다. 게이트 자체는 c3 에서 따로 본다. */
      out.fxLevelBefore = sc.fxLevel;
      sc.fxLevel = 1;

      // 1) 약한 명중이 강한 시전 연출을 깎지 않는가
      cam.shakeEffect.reset(); fx.shake(700,0.03); const a1=snap();
      fx.shake(90,0.0027); const a2=snap();
      out.c1={before:a1,after:a2,
        PASS:a1.run && a1.dur===700 && a2.dur===700 && Math.abs((a2.int??0)-0.03)<1e-9};

      // 2) 강한 명중이 약한 연출을 덮어쓰는가
      cam.shakeEffect.reset(); fx.shake(90,0.0027); const b1=snap();
      fx.shake(700,0.03); const b2=snap();
      out.c2={before:b1,after:b2,
        PASS:b1.dur===90 && b2.dur===700 && Math.abs((b2.int??0)-0.03)<1e-9};

      // 3) fxLevel=0 이면 꺼지는가 (정상에서 켜지고, 0 에서 꺼짐)
      cam.shakeEffect.reset();
      fx.shake(500,0.02); const c2on=snap();
      sc.fxLevel=0; cam.shakeEffect.reset();
      fx.shake(500,0.02); const c1off=snap();
      out.c3={fxLevel1_run:c2on.run, fxLevel0_run:c1off.run, PASS:c2on.run && !c1off.run};

      sc.fxLevel=out.fxLevelBefore;
      cam.shakeEffect.reset();
      return out;
    });
    console.log(JSON.stringify(res,null,2));
    const pass = res.c1.PASS && res.c2.PASS && res.c3.PASS;
    console.log(">>> 판정:", pass?"PASS 3/3":"FAIL");
  }

  await p.screenshot({path:"/tmp/world3.png"});
  await b.close();
})();
