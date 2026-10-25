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
    const i = await page.$("input[placeholder*='캐릭터 이름']"); if (i) await i.fill("리플레이검증");
    await page.waitForTimeout(900); await click(/^다음/); await page.waitForTimeout(1200);
    await click(/모험가로 생성/); await page.waitForTimeout(4000); ok = await click(/이 캐릭터로 시작/); }
  await wait(["world"], 60000); await page.waitForTimeout(6000);

  await page.evaluate(() => {
    const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(s => s && s.player);
    sc.tut = null; sc.tutorialDone = true; sc.dialoguing = false; sc.closeFeatureTutorial?.();
  });

  // 설정 패널 열고, "튜토리얼 다시보기" 섹션 내부 버튼만 클릭
  await page.evaluate(() => window.__SERTZ_EB__.emit("ui:panel", { panel: "opt" }));
  await page.waitForTimeout(1400);
  const res = await page.evaluate(() => {
    // 섹션 텍스트를 가진 부모를 찾아 그 안의 버튼만
    const all = Array.from(document.querySelectorAll("p"));
    const head = all.find(p => p.textContent?.trim() === "튜토리얼 다시보기");
    if (!head) return { err: "section not found" };
    const box = head.parentElement;
    const btns = Array.from(box.querySelectorAll("button"));
    const names = btns.map(b => (b.textContent || "").trim().slice(0, 20));
    const bag = btns.find(b => /^가방/.test((b.textContent || "").trim()));
    if (!bag) return { err: "bag btn not found", names };
    bag.click();
    return { names: names.slice(0, 6), total: btns.length, clicked: true };
  });
  await page.waitForTimeout(1800);
  const out = await page.evaluate(() => {
    const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find(s => s && s.player);
    const t = document.body.innerText || "";
    const lines = t.split("\n").map(x => x.trim()).filter(Boolean);
    const i = lines.findIndex(x => /다시보기 ·/.test(x));
    return { open: sc.featureTutOpen, feature: sc.featureTutFeature, page: sc.featureTutPage,
      shown: i >= 0, around: i >= 0 ? lines.slice(i, i + 5) : lines.slice(-8),
      panelClosed: !(t.includes("튜토리얼 다시보기")) };
  });
  console.log("REPLAY", JSON.stringify(res), JSON.stringify(out, null, 1));
  await b.close();
})();
