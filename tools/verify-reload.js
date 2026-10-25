const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader"] });
  const page = await b.newPage({ viewport: { width: 1100, height: 760 } });
  const wait = async (w, ms) => { const t0 = Date.now(); let c = [];
    while (Date.now() - t0 < ms) { try { c = await page.evaluate(() => window.__SERTZ_DEBUG__?.game?.scene.getScenes(true).map(s => s.scene.key) ?? []);
      if (w.every(x => c.includes(x))) return c; } catch {} await page.waitForTimeout(700); } return c; };
  const click = async (re) => page.evaluate((s) => { const rx = new RegExp(s);
    const bt = Array.from(document.querySelectorAll("button")).find(x => rx.test(x.textContent||"") && x.offsetParent !== null);
    if (bt) { bt.click(); return true; } return false; }, re.source);
  const enter = async () => {
    await wait(["title"], 70000);
    await click(/게임 시작/); await page.waitForTimeout(2500);
    let ok = await click(/이 캐릭터로 시작/);
    if (!ok) { await click(/캐릭터 생성/); await page.waitForTimeout(1500);
      const i = await page.$("input[placeholder*='캐릭터 이름']"); if (i) await i.fill("지속검증");
      await page.waitForTimeout(900); await click(/^다음/); await page.waitForTimeout(1200);
      await click(/모험가로 생성/); await page.waitForTimeout(4000); ok = await click(/이 캐릭터로 시작/); }
    return wait(["world"], 70000);
  };
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await enter();
  await page.waitForTimeout(5000);

  // 튜토리얼 2개 auto 재생 + 저장
  const before = await page.evaluate(async () => {
    const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(s => s && s.player);
    sc.tut = null; sc.dialoguing = false; sc.tutorialDone = true;
    sc.player.tutSeen = [];
    sc.playFeatureTutorial("shop", true);
    await new Promise(r => setTimeout(r, 600));
    sc.closeFeatureTutorial();
    sc.playFeatureTutorial("stat", true);
    await new Promise(r => setTimeout(r, 600));
    sc.closeFeatureTutorial();
    return { tutSeen: [...sc.player.tutSeen] };
  });
  console.log("재생 전", JSON.stringify(before));

  // 재접속 (같은 컨텍스트 = localStorage 유지)
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await enter();
  await page.waitForTimeout(4000);
  const after = await page.evaluate(() => {
    const sc = window.__SERTZ_DEBUG__?.game?.scene.getScenes(true).find(s => s && s.player);
    if (!sc) return { noScene: true };
    return { lv: sc.player.lv, tutSeen: [...(sc.player.tutSeen || [])], pending: (sc.pendingFeatureTuts || []).length,
      featOpen: sc.featureTutOpen };
  });
  console.log("재접속 후", JSON.stringify(after));
  await b.close();
})();
