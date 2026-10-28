const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader']});
  const p = await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await p.goto('http://127.0.0.1:3200/', {waitUntil:'domcontentloaded', timeout:120000});
  await p.waitForTimeout(15000);
  await p.locator('text=게임 시작').first().click({force:true}).catch(()=>{});
  await p.waitForTimeout(2200);
  await p.locator('text=캐릭터 생성').last().click({force:true});
  await p.waitForTimeout(1500);
  await p.locator('input').first().fill('테스터').catch(()=>{});
  await p.waitForTimeout(500);
  await p.locator('button:has-text("다음 — 외형 선택")').first().click({force:true}).catch(()=>{});
  await p.waitForTimeout(1200);
  await p.locator('button:has-text("모험가로 생성")').last().click({force:true}).catch(()=>{});
  await p.waitForTimeout(2500);
  // 생성 직후 — 세이브에 introSeen=true 강제
  await p.evaluate(() => { for (const k of Object.keys(localStorage)) { if(!k.includes('sertz'))continue;
    try{const v=JSON.parse(localStorage.getItem(k)); const f=o=>{if(!o||typeof o!=='object')return;
      if('introSeen' in o) o.introSeen=true;
      for(const c of Object.values(o))f(c);}; f(v); localStorage.setItem(k,JSON.stringify(v));}catch{} } });
  await p.locator('text=테스터').first().dblclick({force:true}).catch(()=>{});
  await p.waitForTimeout(10000);
  const r = await p.evaluate(() => {
    const g = window.__SERTZ__.game; const sc = g.scene.getScenes(true)[0];
    const pl = sc && sc.player;
    if (!pl) return { err:'no player', scene: sc?.scene?.key };
    pl.lv=200; pl.cls='warbringer'; pl.tier=4; pl.sTier=5; pl.isFifth=true;
    pl.skill3Unlocked=true; pl.skill4Unlocked=true; pl.skill5Unlocked=true; pl.skill5bUnlocked=true;
    pl.mp=9999; pl.maxMp=9999; pl.hp=99999; pl.maxHp=99999;
    pl.state='idle'; pl.skill5Cd=0; pl.skill5bCd=0;
    try { pl.useSkill5(); } catch(e){ return { err:String(e).slice(0,120) }; }
    return { cast:true, overlay: !!document.querySelector('[class*=prologue]') };
  });
  console.log('발동:', JSON.stringify(r));
  for (let i=0;i<8;i++){ await p.waitForTimeout(105); await p.screenshot({path:'/tmp/bf_'+i+'.png'}); }
  console.log('errors:', errs.slice(0,2).join(' || ') || '없음');
  await b.close();
})();
