// vc178 검증 — ① 패널 잠금(저레벨) ② 레벨업 개방 배너+튜토리얼 ③ 설정 다시보기 ④ emit 스로틀
const { chromium } = require("playwright");

const OUT = [];
const log = (...a) => { const s = a.map((x) => typeof x === "string" ? x : JSON.stringify(x)).join(" "); OUT.push(s); console.log(s); };

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));

  await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 120000 });
  const waitScene = async (want, maxMs) => {
    const t0 = Date.now();
    let cur = [];
    while (Date.now() - t0 < maxMs) {
      cur = await page.evaluate(() => window.__SERTZ_DEBUG__?.game?.scene.getScenes(true).map((s) => s.scene.key) ?? []);
      if (want.every((w) => cur.includes(w))) return cur;
      await page.waitForTimeout(700);
    }
    return cur;
  };
  const click = async (re) => page.evaluate((src) => {
    const rx = new RegExp(src);
    const b = Array.from(document.querySelectorAll("button")).find((x) => rx.test(x.textContent || "") && x.offsetParent !== null);
    if (b) { b.click(); return true; }
    return false;
  }, re.source);

  await waitScene(["title"], 60000);
  await click(/게임 시작/);
  await page.waitForTimeout(2500);
  let ok = await click(/이 캐릭터로 시작/);
  if (!ok) {
    await click(/캐릭터 생성/);
    await page.waitForTimeout(1500);
    const inp = await page.$("input[placeholder*='캐릭터 이름']");
    if (inp) await inp.fill("개방검증");
    await page.waitForTimeout(900);
    await click(/^다음/);
    await page.waitForTimeout(1200);
    await click(/모험가로 생성/);
    await page.waitForTimeout(4000);
    ok = await click(/이 캐릭터로 시작/);
  }
  log("WORLD", JSON.stringify(await waitScene(["world"], 60000)));
  await page.waitForTimeout(5000);

  // ── ① 저레벨 잠금 확인: Lv1에서 보스 패널(Lv18) 열기 시도
  const lockTest = await page.evaluate(() => {
    const EB = window.__SERTZ_EB__;
    const D = window.__SERTZ_DEBUG__;
    const scene = D.game.scene.getScenes(true).find((s) => s && s.player);
    const before = { lv: scene.player.lv, tutSeen: [...(scene.player.tutSeen || [])] };
    EB.emit("ui:panel", { panel: "boss" }); // 잠긴 패널
    return before;
  });
  await page.waitForTimeout(1200);
  const lockUi = await page.evaluate(() => {
    const t = document.body.innerText || "";
    const m = t.match(/보스 재도전 잠김|보스 잠김|잠김[\s\S]{0,40}Lv(\d+)/);
    return { hasLockNotice: /잠김/.test(t) && /Lv18/.test(t), snippet: m ? m[0].slice(0, 60) : null };
  });
  log("① 잠금", JSON.stringify({ lv: lockTest.lv, ...lockUi }));
  await page.evaluate(() => window.__SERTZ_EB__.emit("ui:panel", { panel: null }));
  await page.waitForTimeout(600);

  // ── ② 레벨업 개방: 2,5,7 강제 → 배너 + 튜토리얼 자동
  const levelUps = await page.evaluate(async () => {
    const D = window.__SERTZ_DEBUG__;
    const scene = D.game.scene.getScenes(true).find((s) => s && s.player);
    const seenBanners = [];
    const EB = window.__SERTZ_EB__;
    const onBanner = (v) => seenBanners.push(typeof v === "string" ? v : JSON.stringify(v).slice(0, 80));
    EB.on("banner:show", onBanner);
    const results = [];
    for (const target of [2, 5, 7]) {
      scene.player.lv = target;
      scene.onLevelUp();
      await new Promise((r) => setTimeout(r, 900));
      results.push({
        lv: scene.player.lv,
        tutSeen: [...(scene.player.tutSeen || [])],
        pending: (scene.pendingFeatureTuts || []).length,
        featOpen: scene.featureTutOpen,
      });
    }
    EB.off("banner:show", onBanner);
    return { results, banners: seenBanners };
  });
  log("② 레벨업", JSON.stringify(levelUps));
  await page.waitForTimeout(2500);

  const tutUi = await page.evaluate(() => {
    const t = document.body.innerText || "";
    return {
      overlayShown: /새 기능 안내|다시보기 ·/.test(t),
      firstPage: /스킬이란|가방 열기|상점|퀘스트 로그/.test(t),
      hasWhere: /위치:/.test(t),
      snippet: t.split("\n").filter((x) => x.trim()).slice(0, 30).join(" | ").slice(0, 400),
    };
  });
  log("② 오버레이", JSON.stringify(tutUi));

  // 다음 버튼으로 페이지 진행
  const adv = [];
  for (let i = 0; i < 4; i++) {
    const clicked = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find((x) => /^(다음|확인)$/.test((x.textContent || "").trim()) && x.offsetParent !== null);
      if (b) { b.click(); return true; }
      return false;
    });
    adv.push(clicked);
    await page.waitForTimeout(700);
  }
  log("② 다음 진행", JSON.stringify(adv));

  // ── ③ 설정 → 튜토리얼 다시보기
  await page.evaluate(() => window.__SERTZ_EB__.emit("ui:panel", { panel: "opt" }));
  await page.waitForTimeout(1200);
  const replayUi = await page.evaluate(() => {
    const t = document.body.innerText || "";
    const btns = Array.from(document.querySelectorAll("button")).filter((b) => /가방|스킬|상점|퀘스트|스탯|유니온|시즌 패스/.test(b.textContent || "")).length;
    return { hasSection: /튜토리얼 다시보기/.test(t), featureButtons: btns, hasSeenBadge: /본 적 있음/.test(t) };
  });
  log("③ 다시보기", JSON.stringify(replayUi));

  // 다시보기 클릭 → 오버레이 재생
  const replayClick = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) => /^가방/.test((x.textContent || "").trim()));
    if (b) { b.click(); return true; }
    return false;
  });
  await page.waitForTimeout(1600);
  const replayShown = await page.evaluate(() => {
    const t = document.body.innerText || "";
    return { shown: /다시보기 ·/.test(t), title: /가방 열기/.test(t) };
  });
  log("③ 재생", JSON.stringify({ replayClick, ...replayShown }));

  // ── ④ emit 스로틀: 100회 연속 호출 시 실제 직렬화 횟수
  const throttle = await page.evaluate(async () => {
    const D = window.__SERTZ_DEBUG__;
    const scene = D.game.scene.getScenes(true).find((s) => s && s.player);
    const EB = window.__SERTZ_EB__;
    let rpgEmits = 0;
    const onRpg = () => { rpgEmits++; };
    EB.on("rpg:state", onRpg);
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) scene.emitRpgState();
    const syncMs = performance.now() - t0;
    await new Promise((r) => setTimeout(r, 400));
    const after400 = rpgEmits;
    EB.off("rpg:state", onRpg);
    return { calls: 200, syncMs: +syncMs.toFixed(1), rpgEmits: after400 };
  });
  log("④ 스로틀", JSON.stringify(throttle));

  log("ERRORS", errs.length, JSON.stringify(errs.slice(0, 3)));
  await browser.close();
})();
