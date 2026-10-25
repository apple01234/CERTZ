const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args:["--no-sandbox","--disable-gpu","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport:{width:1000,height:760} });
  const errs=[]; p.on("pageerror",e=>errs.push(String(e).slice(0,200)));
  await p.goto("http://127.0.0.1:3000/", { waitUntil:"domcontentloaded", timeout:120000 });
  const wait=async(w,ms)=>{const t0=Date.now();while(Date.now()-t0<ms){try{const c=await p.evaluate(()=>window.__SERTZ_DEBUG__?.game?.scene?.getScenes(true).map(s=>s.scene.key)??[]);if(w.every(x=>c.includes(x)))return c;}catch{}await p.waitForTimeout(800);}return[];};
  const click=async(re)=>p.evaluate((s)=>{const rx=new RegExp(s);const bt=Array.from(document.querySelectorAll("button")).find(x=>rx.test(x.textContent||"")&&x.offsetParent!==null);if(bt){bt.click();return true;}return false;},re.source);
  await wait(["title"],120000);
  await p.waitForFunction(()=>Array.from(document.querySelectorAll("button")).some(x=>/게임 시작/.test(x.textContent||"")&&x.offsetParent!==null),{timeout:90000});
  await click(/게임 시작/); await p.waitForTimeout(2500);
  let ok=await click(/이 캐릭터로 시작/);
  if(!ok){await click(/캐릭터 생성/);await p.waitForTimeout(2000);
    const i=await p.$("input[placeholder*='캐릭터 이름']"); if(i) await i.fill("극딜검증");
    await p.waitForTimeout(900); await click(/다음/); await p.waitForTimeout(1800);
    await click(/모험가로 생성|생성/); await p.waitForTimeout(4500);
    await click(/이 캐릭터로 시작|입장|시작/);}
  await wait(["world"],120000);
  await p.waitForFunction(()=>{try{return !!window.__SERTZ_DEBUG__?.game?.scene?.getScenes(true)?.find(s=>s&&s.player)}catch{return false}},{timeout:90000});
  await p.waitForTimeout(3500);

  const r = await p.evaluate(async () => {
    const sc=window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(s=>s&&s.player);
    const pl=sc.player;
    sc.tut=null; sc.dialoguing=false;
    const out={};

    // 스킬명 테이블 교체 확인 (문서 10계열 반영)
    const cls=await import("/_next/static/chunks/src_game_classes_ts.js").catch(()=>null);
    out.classesModLoaded = !!cls;

    // 적 스폰 후 상태이상 검증
    const before = sc.enemies.length;
    try { sc.spawnEnemy?.("slime"); } catch {}
    await new Promise(r=>setTimeout(r,600));
    out.enemiesBefore = before; out.enemiesAfter = sc.enemies.length;

    const e = sc.enemies[0];
    if (e) {
      out.hasApplyDot = typeof e.applyDot === "function";
      out.hasApplyStun = typeof e.applyStun === "function";
      const hp0 = e.hp;
      e.applyDot(50, 3000);                    // 도트 부여
      await new Promise(r=>setTimeout(r,1300));
      out.dotDamaged = e.hp < hp0;
      out.dotHpDelta = Math.round(hp0 - e.hp);
    }

    // 보스에도 도트가 걸리는지
    sc.spawnBoss(false);
    await new Promise(r=>setTimeout(r,800));
    if (sc.boss) {
      out.bossHasApplyDot = typeof sc.boss.applyDot === "function";
      const bhp0 = sc.boss.hp;
      sc.boss.applyDot(1000, 3000);
      await new Promise(r=>setTimeout(r,1300));
      out.bossDotDamaged = sc.boss.hp < bhp0;
      out.bossDotDelta = Math.round(bhp0 - sc.boss.hp);
    }
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  console.log("ERRORS", errs.length, JSON.stringify(errs.slice(0,3)));
  await b.close();
})();
