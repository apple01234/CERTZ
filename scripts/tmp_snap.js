const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.click("text=새로운 모험", { timeout: 10000 });
  await p.waitForTimeout(2500);
  // 필드(개미굴) 스크린샷
  await p.evaluate(async () => {
    const S = window.__SERTZ__;
    const s = S.game.scene.getScene("world");
    s.scene.restart({ stage: "cave4", save: s.buildSave("cave4") });
  });
  await p.waitForTimeout(3200);
  await p.screenshot({ path: "scripts/v30-cave-field.png" });
  // 챕터 마을 스크린샷 (niflheimv)
  await p.evaluate(async () => {
    const S = window.__SERTZ__;
    const s = S.game.scene.getScene("world");
    s.scene.restart({ stage: "niflheimv", save: s.buildSave("niflheimv") });
  });
  await p.waitForTimeout(3200);
  await p.screenshot({ path: "scripts/v30-village.png" });
  console.log("pageerrors:", errs.length ? errs : "none");
  await b.close();
})();
