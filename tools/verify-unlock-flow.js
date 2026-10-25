// vc178 최종 검증 — 실제 플레이 흐름에서 개방 배너 + 튜토리얼 오버레이 자동 표시
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader"] });
  const page = await b.newPage({ viewport: { width: 1100, height: 760 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));

  await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
  const wait = async (w, ms) => {
    const t0 = Date.now(); let c = [];
    while (Date.now() - t0 < ms) {
      try {
        c = await page.evaluate(() => window.__SERTZ_DEBUG__?.game?.scene.getScenes(true).map((s) => s.scene.key) ?? []);
        if (w.every((x) => c.includes(x))) return c;
      } catch { /* 네비게이션 중 컨텍스트 파괴 → 재시도 */ }
      await page.waitForTimeout(700);
    }
    return c;
  };
  const click = async (re) => page.evaluate((s) => {
    const rx = new RegExp(s);
    const bt = Array.from(document.querySelectorAll("button")).find((x) => rx.test(x.textContent || "") && x.offsetParent !== null);
    if (bt) { bt.click(); return true; } return false;
  }, re.source);

  await wait(["title"], 60000);
  await click(/게임 시작/); await page.waitForTimeout(2500);
  let ok = await click(/이 캐릭터로 시작/);
  if (!ok) {
    await click(/캐릭터 생성/); await page.waitForTimeout(1500);
    const i = await page.$("input[placeholder*='캐릭터 이름']");
    if (i) await i.fill("최종검증");
    await page.waitForTimeout(900); await click(/^다음/); await page.waitForTimeout(1200);
    await click(/모험가로 생성/); await page.waitForTimeout(4000);
    ok = await click(/이 캐릭터로 시작/);
  }
  await wait(["world"], 60000);
  await page.waitForTimeout(6000);

  // 인트로 대사/튜토리얼을 걷어내고, 레벨을 올려 실제 자동 재생을 관찰
  const stage = await page.evaluate(() => {
    const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find((s) => s && s.player);
    sc.tut = null; sc.tutorialDone = true; sc.dialoguing = false;
    sc.featureTutDelay = 0;
    sc.pendingFeatureTuts = [];
    sc.player.tutSeen = [];       // 안 본 상태로
    sc.player.lv = 1;
    return { lv: sc.player.lv, seen: sc.player.tutSeen.length };
  });

  // Lv2로 — 스킬 개방 + 자동 튜토리얼
  await page.evaluate(() => {
    const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find((s) => s && s.player);
    sc.player.lv = 2;
    sc.checkUnlocksOnLevelUp();
  });
  await page.waitForTimeout(3500);

  const r1 = await page.evaluate(() => {
    const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find((s) => s && s.player);
    const t = document.body.innerText || "";
    return {
      featOpen: sc.featureTutOpen,
      feature: sc.featureTutFeature,
      seen: [...sc.player.tutSeen],
      pending: (sc.pendingFeatureTuts || []).length,
      overlay: /새 기능 안내 · 스킬/.test(t),
      body: /스킬은 기본공격보다 강하고/.test(t),
      where: /위치: 오른쪽 아래 스킬 버튼/.test(t),
      counter: /1\/3/.test(t),
    };
  });
  console.log("Lv2 결과", JSON.stringify({ ...stage, ...r1 }));

  // 다음 → 2장 → 3장 → 닫힘
  const adv = [];
  for (let i = 0; i < 3; i++) {
    const t = await page.evaluate(() => {
      const b2 = Array.from(document.querySelectorAll("button")).find((x) => /^(다음|확인)$/.test((x.textContent || "").trim()) && x.offsetParent !== null);
      if (b2) { b2.click(); return true; } return false;
    });
    await page.waitForTimeout(900);
    const st = await page.evaluate(() => {
      const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find((s) => s && s.player);
      const t = document.body.innerText || "";
      const m = t.match(/([123])\/3/);
      return { clicked: null, open: sc.featureTutOpen, page: m ? m[1] : null };
    });
    adv.push({ clicked: t, ...st });
  }
  console.log("페이지 진행", JSON.stringify(adv));

  // 세이브에 tutSeen 기록됐는지
  const saved = await page.evaluate(() => {
    try { const raw = localStorage.getItem("sertz_save_v1") || localStorage.getItem("sertz_save"); const o = JSON.parse(raw || "{}");
      return { keys: Object.keys(o).slice(0, 8), tutSeen: o.tutSeen ?? null }; } catch (e) { return { err: String(e) }; }
  });
  console.log("세이브", JSON.stringify(saved));

  // Lv5로 올려 상점 개방이 큐에 들어가는지 (연속 개방 처리)
  await page.evaluate(() => {
    const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find((s) => s && s.player);
    sc.player.lv = 5; sc.checkUnlocksOnLevelUp();
  });
  await page.waitForTimeout(3000);
  const r5 = await page.evaluate(() => {
    const sc = window.__SERTZ_DEBUG__.game.scene.getScenes(true).find((s) => s && s.player);
    const t = document.body.innerText || "";
    return { featOpen: sc.featureTutOpen, feature: sc.featureTutFeature, overlay: /새 기능 안내 · 상점/.test(t), seenLen: sc.player.tutSeen.length };
  });
  console.log("Lv5 결과", JSON.stringify(r5));

  console.log("ERRORS", errs.length, JSON.stringify(errs.slice(0, 3)));
  await b.close();
})();
