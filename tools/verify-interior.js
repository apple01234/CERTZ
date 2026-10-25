// vc178 — 집 실내 렌더 검증: 로비 진입 → 내 집 입장 → 가구 이미지/꾸미기 지점 확인
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/vercel-scripts|WebGL|worker-src|401/.test(m.text())) errors.push(m.text());
  });

  await page.goto("http://127.0.0.1:3000/?renderer=canvas", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(15000);

  const btn = async (src) => page.evaluate((s) => {
    const rx = new RegExp(s);
    const b = Array.from(document.querySelectorAll("button")).find((x) => rx.test(x.textContent || ""));
    if (b) { b.click(); return true; }
    return false;
  }, src.source);

  await btn(/게임 시작/);
  await page.waitForTimeout(2500);

  // 캐릭터가 이미 있으면 바로 시작, 없으면 생성 플로우
  let started = await btn(/이 캐릭터로 시작/);
  if (!started) {
    await btn(/캐릭터 생성/);
    await page.waitForTimeout(1400);
    const inp = await page.$("input[placeholder*='캐릭터 이름']");
    if (inp) await inp.fill("집검증");
    await page.waitForTimeout(900);
    await btn(/^다음/);
    await page.waitForTimeout(1200);
    await btn(/모험가로 생성/);
    await page.waitForTimeout(3500);
    started = await btn(/이 캐릭터로 시작/);
  }
  await page.waitForTimeout(16000);

  // 1) 월드 진입 + 가구 지급 후 내 집 입장
  const enter = await page.evaluate(() => {
    const D = window.__SERTZ_DEBUG__;
    const scene = D?.game?.scene.getScenes(true).find((s) => s && s.player);
    if (!scene) return { ok: false };
    const p = scene.player;
    for (const k of ["furn_table", "furn_bench", "furn_barrel"]) {
      if (!p.owned.includes(k)) p.owned.push(k);
    }
    p.homeDecor = [
      { key: "furn_table", x: 3, y: 3 },
      { key: "furn_bench", x: 5, y: 4 },
      { key: "furn_barrel", x: 7, y: 5 },
    ];
    scene.enterInterior("interior_home");
    return { ok: true, from: scene.stageDef?.key };
  });
  await page.waitForTimeout(3500);

  // 2) 실내에서 실제 렌더 확인
  const after = await page.evaluate(() => {
    const D = window.__SERTZ_DEBUG__;
    const scene = D?.game?.scene.getScenes(true).find((s) => s && s.player);
    if (!scene) return { ok: false };
    return {
      ok: true,
      stage: scene.stageDef?.key,
      isInterior: scene.isInterior,
      decorImgs: scene.homeDecorImgs?.length ?? null,
      imgsAlive: (scene.homeDecorImgs ?? []).filter((i) => i && i.active && i.visible).length,
      decorSpots: (scene.interactables ?? []).filter((i) => i.kind === "decor").length,
      imgs: (scene.homeDecorImgs ?? []).map((i) => ({ tex: i.texture?.key, x: Math.round(i.x), y: Math.round(i.y), depth: i.depth })),
    };
  });

  // 3) 꾸미기 지점 → HomePanel 개방 확인
  await page.evaluate(() => {
    const D = window.__SERTZ_DEBUG__;
    const scene = D?.game?.scene.getScenes(true).find((s) => s && s.player);
    if (!scene) return;
    const spot = (scene.interactables ?? []).find((i) => i.kind === "decor");
    if (!spot) return;
    scene.player.setPosition(spot.x, spot.y + 10);
    scene.nearInteract = spot;
    if (typeof scene.tryInteract === "function") scene.tryInteract();
  });
  await page.waitForTimeout(1500);
  const domHome = await page.evaluate(() => /집 꾸미기/.test(document.body.innerText || ""));

  await page.screenshot({ path: "/root/.hermes/cache/scratch/home_panel.png" });
  console.log("ENTER", JSON.stringify(enter));
  console.log("AFTER", JSON.stringify(after, null, 2));
  console.log("HOMEPANEL_IN_DOM", domHome);
  console.log("ERRORS", errors.length, errors.slice(0, 3));
  await browser.close();
})();
