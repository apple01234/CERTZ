const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
  const wait = async (w, ms) => { const t0=Date.now(); let c=[];
    while(Date.now()-t0<ms){ try{ c=await p.evaluate(()=>window.__SERTZ_DEBUG__?.game?.scene.getScenes(true).map(s=>s.scene.key)??[]);
    if(w.every(x=>c.includes(x)))return c;}catch{} await p.waitForTimeout(700);} return c; };
  const click = async (re) => p.evaluate((s)=>{const rx=new RegExp(s);
    const bt=Array.from(document.querySelectorAll("button")).find(x=>rx.test(x.textContent||"")&&x.offsetParent!==null);
    if(bt){bt.click();return true;}return false;}, re.source);
  await wait(["title"],60000); await click(/게임 시작/); await p.waitForTimeout(2200);
  let ok=await click(/이 캐릭터로 시작/);
  if(!ok){ await click(/캐릭터 생성/); await p.waitForTimeout(1400);
    const i=await p.$("input[placeholder*='캐릭터 이름']"); if(i) await i.fill("사거리");
    await p.waitForTimeout(800); await click(/^다음/); await p.waitForTimeout(1100);
    await click(/모험가로 생성/); await p.waitForTimeout(3500); ok=await click(/이 캐릭터로 시작/); }
  await wait(["world"],60000); await p.waitForTimeout(3000);
  await p.evaluate(() => { const sc=window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(s=>s&&s.player);
    sc.gotoStage("forest", undefined, true); });
  await wait(["world"],45000); await p.waitForTimeout(5000);

  const r = await p.evaluate(async () => {
    const D = window.__SERTZ_DEBUG__;
    const sc = D.game.scene.getScenes(true).find(s => s && s.player);
    sc.tut = null; sc.dialoguing = false; sc.tutorialDone = true;

    const out = {};
    for (const [cls, expect] of [["pirate", 300], ["warrior", 56], ["ranger", 250]]) {
      sc.player.cls = cls; sc.player.lv = 70;
      await new Promise(r => setTimeout(r, 200));
      sc.autoHunt = true;
      await new Promise(r => setTimeout(r, 4000));
      // 정지 순간 포착: 플레이어 속도가 0에 가까운 표본의 거리
      const stopped = [];
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 90));
        const t = sc.autoTarget;
        if (!t || !t.active || !t.alive) continue;
        const body = sc.player.body;
        const moving = body ? Math.hypot(body.velocity.x, body.velocity.y) > 20 : true;
        if (!moving) stopped.push(Math.round(Math.hypot(t.x - sc.player.x, t.y - sc.player.y)));
      }
      sc.autoHunt = false;
      await new Promise(r => setTimeout(r, 300));
      stopped.sort((a,b)=>a-b);
      out[cls] = {
        expectRange: expect,
        stops: stopped.length,
        medianStop: stopped.length ? stopped[Math.floor(stopped.length/2)] : null,
        withinBand: stopped.length ? Math.round((stopped.filter(d => d <= expect * 1.15).length / stopped.length) * 100) : null,
      };
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
