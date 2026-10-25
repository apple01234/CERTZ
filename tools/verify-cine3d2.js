const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({
    args: ["--no-sandbox", "--enable-unsafe-swiftshader",
           "--use-gl=angle", "--use-angle=swiftshader",
           "--disable-gpu-sandbox", "--ignore-gpu-blocklist"],
  });
  const p = await b.newPage({ viewport: { width: 1000, height: 720 } });
  const errs = [];
  const glb = [];
  p.on("pageerror", e => errs.push(String(e).slice(0,200)));
  p.on("response", r => { if (r.url().includes("assets3d")) glb.push(`${r.status()} ${r.url().split("/").pop()}`); });

  await p.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.waitForTimeout(15000);

  // WebGL 지원 확인
  const gl = await p.evaluate(() => {
    const c = document.createElement("canvas");
    const g2 = c.getContext("webgl2"), g1 = c.getContext("webgl");
    return { webgl2: !!g2, webgl1: !!g1,
      renderer: g2 ? g2.getParameter(g2.RENDERER) : g1 ? g1.getParameter(g1.RENDERER) : null };
  });
  console.log("GL", JSON.stringify(gl));

  const wait = async (w, ms) => { const t0=Date.now(); let c=[];
    while(Date.now()-t0<ms){ try{ c=await p.evaluate(()=>window.__SERTZ_DEBUG__?.game?.scene.getScenes(true).map(s=>s.scene.key)??[]);
      if(w.every(x=>c.includes(x)))return c;}catch{} await p.waitForTimeout(700);} return c; };
  const click = async (re) => p.evaluate((s)=>{const rx=new RegExp(s);
    const bt=Array.from(document.querySelectorAll("button")).find(x=>rx.test(x.textContent||"")&&x.offsetParent!==null);
    if(bt){bt.click();return true;}return false;}, re.source);

  await wait(["title"], 60000); await click(/게임 시작/); await p.waitForTimeout(2300);
  let ok = await click(/이 캐릭터로 시작/);
  if(!ok){ await click(/캐릭터 생성/); await p.waitForTimeout(1500);
    const i=await p.$("input[placeholder*='캐릭터 이름']"); if(i) await i.fill("시네3D");
    await p.waitForTimeout(900); await click(/^다음/); await p.waitForTimeout(1200);
    await click(/모험가로 생성/); await p.waitForTimeout(4000); ok=await click(/이 캐릭터로 시작/); }
  await wait(["world"], 60000); await p.waitForTimeout(4000);

  // 궁극기 → 3D
  await p.evaluate(() => {
    const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(s=>s&&s.player);
    sc.tut=null; sc.dialoguing=false; sc.tutorialDone=true;
    sc.player.cls="warrior"; sc.player.lv=250; sc.player.mp=9999;
    sc.player.skill5Unlocked=true; sc.player.skill5Cd=0;
    sc.player.useSkill5();
  });
  await p.waitForTimeout(5000);

  const state = await p.evaluate(() => {
    const c = document.getElementById("sertz-cine3d");
    let ctxOk = false, size = [0,0];
    if (c) { const g = c.getContext("webgl2") || c.getContext("webgl"); ctxOk = !!g; size = [c.width, c.height]; }
    return { exists: !!c, display: c?getComputedStyle(c).display:null, ctxOk, size };
  });
  console.log("3D", JSON.stringify(state));
  console.log("GLB요청", JSON.stringify(glb.slice(0,6)));
  console.log("ERRORS", errs.length, JSON.stringify(errs.slice(0,3)));
  await b.close();
})();
