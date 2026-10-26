const { chromium } = require("playwright");
const { enterWorld } = require("../tests/smoke/lib");
(async () => {
  const b = await chromium.launch({ args:["--no-sandbox","--disable-gpu","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport:{width:900,height:700} });
  const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
  await enterWorld(p, "공격검증");
  const r = await p.evaluate(async ()=>{
    const D=window.__SERTZ_DEBUG__, EB=window.__SERTZ_EB__;
    let sc=D.game.scene.getScenes(true).find(s=>s&&s.player&&s.stageDef);
    sc.scene.restart({ stage:"forest1" });
    await new Promise(r=>setTimeout(r,11000));
    sc=D.game.scene.getScenes(true).find(s=>s&&s.player&&s.stageDef);
    const list=(Array.isArray(sc.enemies)?sc.enemies:[]).filter(e=>e&&e.active&&e.hp>0);
    const t=list[0];
    const before={ state:sc.player.state, cd:sc.player.atkCooldown, hp:t?.hp, tx:t?.x, ty:t?.y, px:sc.player.x, py:sc.player.y, sleeping:sc.sleeping, dialoguing:sc.dialoguing };
    if(t) sc.player.setPosition(t.x-30, t.y);
    const log=[];
    for(let i=0;i<10;i++){
      EB.emit("input:attack");
      await new Promise(r=>setTimeout(r,450));
      log.push({ i, state:sc.player.state, cd:Math.round(sc.player.atkCooldown), hp:t?.hp, active:t?.active, dist: t?Math.round(Math.hypot(sc.player.x-t.x, sc.player.y-t.y)):-1 });
      if(t && sc.player) sc.player.setPosition(t.x-30, t.y);
    }
    return { before, log, errs:[] };
  });
  console.log("BEFORE:", JSON.stringify(r.before));
  console.log("LOG:"); r.log.forEach(l=>console.log("  ", JSON.stringify(l)));
  console.log("errs:", errs.slice(0,3));
  await b.close();
})();
