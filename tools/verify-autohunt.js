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
    const i=await p.$("input[placeholder*='캐릭터 이름']"); if(i) await i.fill("자동사냥검증");
    await p.waitForTimeout(800); await click(/^다음/); await p.waitForTimeout(1100);
    await click(/모험가로 생성/); await p.waitForTimeout(3500); ok=await click(/이 캐릭터로 시작/); }
  await wait(["world"],60000); await p.waitForTimeout(4000);

  // 마을 → 사냥터 이동 (씬 재시작)
  await p.evaluate(() => {
    const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(s => s && s.player);
    if (sc && sc.stageDef?.key === "village") sc.gotoStage("forest", undefined, true);
  });
  await wait(["world"], 40000);
  await p.waitForTimeout(4000);

  const res = await p.evaluate(async () => {
    const D = window.__SERTZ_DEBUG__;
    const sc = D.game.scene.getScenes(true).find(s => s && s.player);
    sc.tut = null; sc.dialoguing = false; sc.tutorialDone = true;

    const out = {};
    // 해적 vs 전사 둘 다 측정: 자동사냥이 유지하는 거리
    for (const cls of ["pirate", "warrior"]) {
      sc.player.cls = cls; sc.player.lv = 60;
      // 마을이면 사냥터로 (이 함수 밖에서 처리) — 여기선 이미 사냥터라고 가정
      if (sc.enemies.length === 0) {
        try { sc.spawnEnemies && sc.spawnEnemies(sc.stageDef); } catch {}
      }
      sc.autoHunt = true;
      const dists = [];
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 150));
        const t = sc.autoTarget;
        if (t && t.active && t.alive) {
          dists.push(Math.hypot(t.x - sc.player.x, t.y - sc.player.y));
        }
      }
      sc.autoHunt = false;
      dists.sort((a,b)=>a-b);
      out[cls] = {
        samples: dists.length,
        min: dists.length ? Math.round(dists[0]) : null,
        median: dists.length ? Math.round(dists[Math.floor(dists.length/2)]) : null,
        max: dists.length ? Math.round(dists[dists.length-1]) : null,
      };
    }
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})();
