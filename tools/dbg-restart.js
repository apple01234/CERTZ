const { chromium } = require("playwright");
const { enterWorld } = require("../tests/smoke/lib");
(async () => {
  const b = await chromium.launch({ args:["--no-sandbox","--disable-gpu","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport:{width:900,height:700} });
  const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
  const ok = await enterWorld(p, "재시작검증");
  const r1 = await p.evaluate(()=>{
    const D=window.__SERTZ_DEBUG__;
    const sc=D.game.scene.getScenes(true).find(s=>s&&s.player&&s.stageDef);
    return { stage: sc?.stageDef?.key, enemies: (sc?.enemies?.getChildren?.()??[]).length,
             hasEnemies: !!sc?.enemies, fnRestart: typeof sc?.scene?.restart,
             keys: Object.keys(D.stages?.STAGES||{}).filter(k=>/^forest\d$/.test(k)).slice(0,4) };
  });
  console.log("진입:", ok, JSON.stringify(r1));
  const r2 = await p.evaluate(async ()=>{
    const D=window.__SERTZ_DEBUG__;
    const sc=D.game.scene.getScenes(true).find(s=>s&&s.player&&s.stageDef);
    try { sc.scene.restart({ stage: "forest1" }); } catch(e){ return {err:String(e)}; }
    await new Promise(r=>setTimeout(r,12000));
    const sc2=D.game.scene.getScenes(true).find(s=>s&&s.player&&s.stageDef);
    return { stage: sc2?.stageDef?.key, enemies: (sc2?.enemies?.getChildren?.()??[]).length, hasEnemies: !!sc2?.enemies };
  });
  console.log("재시작 후:", JSON.stringify(r2));
  console.log("errs:", errs.slice(0,3));
  await b.close();
})();
