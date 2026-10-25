const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader"] });
  const page = await b.newPage({ viewport: { width: 1100, height: 760 } });
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
  const wait = async (w, ms) => { const t0 = Date.now(); let c = [];
    while (Date.now() - t0 < ms) { try { c = await page.evaluate(() => window.__SERTZ_DEBUG__?.game?.scene.getScenes(true).map(s => s.scene.key) ?? []);
      if (w.every(x => c.includes(x))) return c; } catch {} await page.waitForTimeout(700); } return c; };
  const click = async (re) => page.evaluate((s) => { const rx = new RegExp(s);
    const bt = Array.from(document.querySelectorAll("button")).find(x => rx.test(x.textContent||"") && x.offsetParent !== null);
    if (bt) { bt.click(); return true; } return false; }, re.source);
  await wait(["title"], 60000);
  await click(/게임 시작/); await page.waitForTimeout(2500);
  let ok = await click(/이 캐릭터로 시작/);
  if (!ok) { await click(/캐릭터 생성/); await page.waitForTimeout(1500);
    const i = await page.$("input[placeholder*='캐릭터 이름']"); if (i) await i.fill("오버레이검증");
    await page.waitForTimeout(900); await click(/^다음/); await page.waitForTimeout(1200);
    await click(/모험가로 생성/); await page.waitForTimeout(4000); ok = await click(/이 캐릭터로 시작/); }
  await wait(["world"], 60000); await page.waitForTimeout(6000);

  // 게이트/인트로 정리 후 스킬 튜토리얼 강제 재생
  await page.evaluate(() => {
    const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(s => s && s.player);
    sc.tut = null; sc.tutorialDone = true; sc.dialoguing = false; sc.featureTutDelay = 0;
    sc.playFeatureTutorial("skill", false);
  });
  await page.waitForTimeout(1500);
  const dump = await page.evaluate(() => {
    const t = document.body.innerText || "";
    const lines = t.split("\n").map(x => x.trim()).filter(Boolean);
    const i = lines.findIndex(x => /다시보기|새 기능 안내/.test(x));
    return { i, around: i >= 0 ? lines.slice(Math.max(0, i - 2), i + 9) : lines.slice(-14) };
  });
  console.log("OVERLAY", JSON.stringify(dump, null, 1));

  // 다시보기 항목 클릭 경로 (설정 패널)
  await page.evaluate(() => window.__SERTZ_EB__.emit("ui:panel", { panel: "opt" }));
  await page.waitForTimeout(1200);
  const before = await page.evaluate(() => (document.body.innerText || "").includes("튜토리얼 다시보기"));
  const clicked = await page.evaluate(() => {
    const b2 = Array.from(document.querySelectorAll("button")).find(x => /^가방/.test((x.textContent||"").trim()));
    if (b2) { b2.click(); return true; } return false;
  });
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => {
    const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(s => s && s.player);
    const t = document.body.innerText || "";
    const lines = t.split("\n").map(x => x.trim()).filter(Boolean);
    const i = lines.findIndex(x => /다시보기 ·/.test(x));
    return { open: sc.featureTutOpen, feature: sc.featureTutFeature, shown: i >= 0, around: i >= 0 ? lines.slice(i - 1, i + 5) : lines.slice(-10) };
  });
  console.log("REPLAY", JSON.stringify({ section: before, clicked, ...after }, null, 1));
  await b.close();
})();
