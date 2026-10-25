const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox","--disable-gpu","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1000, height: 720 } });
  await p.goto("http://127.0.0.1:3000/", { waitUntil:"domcontentloaded", timeout:120000 });
  const wait = async (w,ms)=>{const t0=Date.now();let c=[];while(Date.now()-t0<ms){try{c=await p.evaluate(()=>window.__SERTZ_DEBUG__?.game?.scene.getScenes(true).map(s=>s.scene.key)??[]);if(w.every(x=>c.includes(x)))return c;}catch{}await p.waitForTimeout(700);}return c;};
  const click = async(re)=>p.evaluate((s)=>{const rx=new RegExp(s);const bt=Array.from(document.querySelectorAll("button")).find(x=>rx.test(x.textContent||"")&&x.offsetParent!==null);if(bt){bt.click();return true;}return false;},re.source);
  await wait(["title"],60000); await click(/게임 시작/); await p.waitForTimeout(2300);
  let ok=await click(/이 캐릭터로 시작/);
  if(!ok){await click(/캐릭터 생성/);await p.waitForTimeout(1500);
    const i=await p.$("input[placeholder*='캐릭터 이름']");if(i)await i.fill("각도");
    await p.waitForTimeout(900);await click(/^다음/);await p.waitForTimeout(1200);
    await click(/모험가로 생성/);await p.waitForTimeout(4000);ok=await click(/이 캐릭터로 시작/);}
  await wait(["world"],60000); await p.waitForTimeout(4000);

  const r = await p.evaluate(async () => {
    const sc=window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(s=>s&&s.player);
    sc.tut=null;sc.dialoguing=false;sc.tutorialDone=true;
    sc.player.cls="pirate";sc.player.lv=60;sc.player.mp=9999;

    // 풀에서 "지금 활성"인 투사체의 velocity 각도를 읽는다.
    const measure = () => {
      const out=[];
      for (const q of sc.pProjPool) {
        if (q && q.active && q.body) {
          const a = Math.atan2(q.body.velocity.y, q.body.velocity.x) * 180/Math.PI;
          out.push(Math.round(a));
        }
      }
      return out;
    };

    const dirs=[["우",1,0],["우하",1,1],["하",0,1],["좌하",-1,1],["좌",-1,0],["좌상",-1,-1],["상",0,-1],["우상",1,-1]];
    const res=[];
    for (const [name,x,y] of dirs) {
      // 이전 투사체 정리
      for (const q of sc.pProjPool) { if (q && q.active) { q.setActive(false); q.setVisible(false); if(q.body) q.body.stop(); } }
      sc.player.facing.set(x,y).normalize();
      sc.player.state="idle"; sc.player["atkCooldown"]=0;
      sc.attackQueued=true;
      await new Promise(r=>setTimeout(r,260));
      let angles = measure();
      if (angles.length === 0) {
        // 쿨다운/프레임 타이밍으로 한 번 놓칠 수 있음 — 1회 재시도
        sc.player.state="idle"; sc.player["atkCooldown"]=0;
        sc.attackQueued=true;
        await new Promise(r=>setTimeout(r,260));
        angles = measure();
      }
      const expect=Math.round(Math.atan2(y,x)*180/Math.PI);
      const got = angles[0] ?? null;
      const norm=(d)=>((d+540)%360)-180;
      const diff = got===null?null:Math.abs(norm(got-expect));
      res.push({name,expect,got,diff,pass:diff!==null&&diff<=3});
    }
    return res;
  });
  console.log(JSON.stringify(r.map(x=>`${x.name}: ${x.got}° (기대 ${x.expect}°) ${x.pass?"✓":"✗"}`), null, 1));
  console.log(`\n8방향: ${r.filter(x=>x.pass).length}/${r.length} 통과`);
  await b.close();
})();
