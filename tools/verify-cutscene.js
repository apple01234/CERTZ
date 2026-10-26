/** 이벤트 컷씬 검증 — 마을 진입 시 cutsceneBusy 가 실제로 켜지고 카드가 뜨는지 */
const { chromium } = require("playwright");
const { enterWorld } = require("../tests/smoke/lib");
(async () => {
  const b = await chromium.launch({ args:["--no-sandbox","--disable-gpu","--use-gl=swiftshader"] });
  const p = await b.newPage({ viewport:{width:900,height:700} });
  const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
  // 첫 진입 시점을 잡기 위해 localStorage 를 비운다
  await p.goto("http://127.0.0.1:3000/?renderer=canvas",{waitUntil:"domcontentloaded",timeout:120000});
  await p.evaluate(()=>{ try{ localStorage.clear(); }catch{} });
  await enterWorld(p, "컷씬검증");
  const r = await p.evaluate(async ()=>{
    const D=window.__SERTZ_DEBUG__;
    const sc=D.game.scene.getScenes(true).find(s=>s&&s.player&&s.stageDef);
    const seen = sc?.seenCutscenes ? Array.from(sc.seenCutscenes) : null;
    const busy = sc?.cutsceneBusy;
    const hasFn = typeof window.__SERTZ_DEBUG__ !== "undefined";
    return { seen, busy, hasFn, stage: sc?.stageDef?.key };
  });
  console.log("컷씬 상태:", JSON.stringify(r));
  console.log("pageerror:", errs.slice(0,3));
  await b.close();
})();
