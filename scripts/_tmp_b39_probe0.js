
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader","--no-sandbox"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const logs = [];
  p.on("console", m => logs.push(m.type()+": "+m.text().slice(0,180)));
  p.on("pageerror", e => logs.push("PAGEERROR: "+e.message.slice(0,300)));
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(12000);
  const info = await p.evaluate(() => {
    const g = window.__SERTZ_DEBUG__?.game;
    return {
      scenes: g?.scene?.scenes?.map(s=>({key:s.scene.key, active:s.scene.isActive(), vis:s.scene.isVisible()})),
      hasEB: !!window.__SERTZ_EB__,
      ebMode: typeof window.__SERTZ_EB__,
      gameRootChildren: document.querySelector(".game-root")?.children?.length ?? null,
      snapshot: [...document.querySelectorAll(".game-root *")].slice(0,25).map(e=>`${e.tagName}.${(e.className||"").toString().slice(0,40)}`),
      innerTextLen: document.body.innerText.length,
      textContentLen: document.body.textContent.length,
      overlay: [...document.querySelectorAll("[role=dialog],[role=alertdialog]")].length,
      crash: !!document.querySelector("[class*=crash]"),
      saveRaw: (localStorage.getItem("sertz_save_v2")||"").slice(0,80),
    };
  });
  console.log(JSON.stringify(info,null,1));
  console.log("--- logs ---");
  console.log(logs.slice(0,25).join("\n"));
  await b.close();
})();
