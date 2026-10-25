const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox","--disable-gpu","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport:{width:1000,height:720} });
  await p.goto("http://127.0.0.1:3000/", { waitUntil:"domcontentloaded", timeout:120000 });
  const wait = async (w,ms)=>{const t0=Date.now();let c=[];while(Date.now()-t0<ms){try{c=await p.evaluate(()=>window.__SERTZ_DEBUG__?.game?.scene.getScenes(true).map(s=>s.scene.key)??[]);if(w.every(x=>c.includes(x)))return c;}catch{}await p.waitForTimeout(700);}return c;};
  const click = async(re)=>p.evaluate((s)=>{const rx=new RegExp(s);const bt=Array.from(document.querySelectorAll("button")).find(x=>rx.test(x.textContent||"")&&x.offsetParent!==null);if(bt){bt.click();return true;}return false;},re.source);
  await wait(["title"],60000); await click(/게임 시작/); await p.waitForTimeout(2300);
  let ok=await click(/이 캐릭터로 시작/);
  if(!ok){await click(/캐릭터 생성/);await p.waitForTimeout(1500);
    const i=await p.$("input[placeholder*='캐릭터 이름']");if(i)await i.fill("스킬각");
    await p.waitForTimeout(900);await click(/^다음/);await p.waitForTimeout(1200);
    await click(/모험가로 생성/);await p.waitForTimeout(4000);ok=await click(/이 캐릭터로 시작/);}
  await wait(["world"],60000); await p.waitForTimeout(4000);

  const r = await p.evaluate(async () => {
    const sc=window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(s=>s&&s.player);
    sc.tut=null;sc.dialoguing=false;sc.tutorialDone=true;
    const norm=(d)=>((d+540)%360)-180;
    const out=[];

    // 클래스별 Z스킬 대각선(1,1) 검증
    for (const [cls, label] of [["raider","포격"],["stormcaptain","현측 전열포"],["seaking","심해 포격진"]]) {
      sc.player.cls=cls; sc.player.lv=250; sc.player.mp=9999;
      for (const q of sc.pProjPool) { if(q&&q.active){q.setActive(false);q.setVisible(false);if(q.body)q.body.stop();} }
      sc.player.facing.set(1,1).normalize();
      sc.player.state="idle"; sc.player["skill1Cd"]=0;
      sc.player.useSkill1();
      await new Promise(r=>setTimeout(r,420));
      const angles=[];
      for (const q of sc.pProjPool) if(q&&q.active&&q.body) angles.push(Math.round(Math.atan2(q.body.velocity.y,q.body.velocity.x)*180/Math.PI));
      const got=angles[0]??null;
      const diff=got===null?null:Math.abs(norm(got-45));
      out.push({cls,label,got,expect:45,diff,pass:diff!==null&&diff<=12});
    }
    return out;
  });
  console.log(JSON.stringify(r.map(x=>`${x.cls}(${x.label}): ${x.got}° (기대 45°) ${x.pass?"✓":"✗"}`),null,1));
  console.log(`\n해적 스킬 대각선: ${r.filter(x=>x.pass).length}/${r.length} 통과`);
  await b.close();
})();
