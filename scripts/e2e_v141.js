/**
 * v1.4.1 E2E — 유저 리포트 2건 검증
 *  ① 스프라이트 미로딩: 로드 실패 경고 0건 + 핵심 텍스처 전수 존재 + 재시도 체계 존재
 *  ② 요새 유적 타일맵: crop 교정(균일 흙/잔디)·실제 목책 난간·나무계단 소품·depth 정렬
 *  + 월드 진입 + pageerror 0
 */
const { chromium } = require("playwright");

(async () => {
  const results = [];
  const ok = (name, pass, detail = "") => {
    results.push({ name, pass });
    console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
  };
  const b = await chromium.launch({ args: ["--use-gl=swiftshader"], executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  const loadFails = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));
  p.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error") errs.push("CONSOLE: " + t.slice(0, 160));
    if (t.includes("[SERTZ] 에셋 로드 실패") || t.includes("[SERTZ] 지연 에셋 로드 실패") || t.includes("재시도 후에도") || t.includes("한도 초과")) loadFails.push(t.slice(0, 120));
  });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });

  /* 부팅 + 배지 */
  const badge = await p.getByText("v1.4.3", { exact: false }).first().isVisible().catch(() => false);
  ok("[부팅] 타이틀 도달 (v1.4.1 배지)", badge);

  /* ① 스프라이트 미로딩 — 부트/지연 로드 실패 경고 0건 */
  // 지연 로드 완료 대기 (TitleScene 백그라운드)
  for (let i = 0; i < 30 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++) await p.waitForTimeout(300);
  ok("[로딩] 지연 로드 완료 플래그", await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__));
  ok("[로딩] 로드 실패 경고 0건", loadFails.length === 0, loadFails.length ? loadFails.slice(0, 3).join(" | ") : "전 에셋 정상");

  /* 핵심 텍스처 존재 검증 — 카테고리별 표본 (월드 진입 전 타이틀 시점) */
  const texTitle = await p.evaluate(() => {
    const g = window.__SERTZ__?.game;
    const sc = g?.scene?.getScene("title");
    if (!sc) return null;
    const T = sc.textures;
    const keys = ["hero_idle0", "chm0_idle0", "chf5_atkup3", "gm_idle0", "costm_valkyrie_idle0", "cost_warlord_atk0", "jobf_archmage_idle0", "jobm_assassin_walk1", "map_ground", "map_props", "npc_gm", "sv_campfire", "chest_anim"];
    return keys.map((k) => ({ k, ok: T.exists(k) }));
  });
  const missingTitle = (texTitle ?? []).filter((x) => !x.ok);
  ok("[로딩] 타이틀 시점 핵심 텍스처 존재", !!texTitle && missingTitle.length === 0, missingTitle.map((x) => x.k).join(",") || `${texTitle.length}종 전부 존재`);

  /* 월드 진입 (로비 3단 흐름 준용) */
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("세라141");
  await p.waitForTimeout(300);
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click();
    }, label);
    await p.waitForTimeout(400);
  }
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click();
  });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
  });
  await p.waitForTimeout(2600);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(400); }
  await p.waitForTimeout(900);
  const inWorld = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    return !!(sc && sc.player);
  });
  ok("[게임] 월드 진입", inWorld);

  /* ② 요새 유적 — v1.4.3: 구조물 완전 철거 → 보물상자만 잔존. kg_* 프레임 0 + keepRect null 검증 */
  const keep = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc) return null;
    let kgTiles = 0, fence = 0, stair = 0;
    for (const ch of sc.children.list) {
      const tex = ch?.texture?.key;
      const fn = ch?.frame?.name;
      if (tex === "map_ground" && (fn === "kg_grass" || fn === "kg_dirt")) kgTiles++;
      else if (tex === "map_props" && fn === "kg_fence") fence++;
      else if (tex === "map_props" && fn === "kg_stairs") stair++;
    }
    const chest = (sc.interactables ?? []).filter((it: { kind: string }) => it.kind === "keepchest").length;
    return { kgTiles, fence, stair, chest, keepRectNull: !sc.keepRect, keepStairNull: !sc.keepStair };
  });
  ok("[유적] 구조물 철거 — kg 타일/목책/계단 0", !!keep && keep.kgTiles === 0 && keep.fence === 0 && keep.stair === 0, keep ? `kg=${keep.kgTiles} f=${keep.fence} s=${keep.stair}` : "-");
  ok("[유적] 은닉 히트박스 소멸 (keepRect/keepStair null)", !!keep && keep.keepRectNull && keep.keepStairNull, "-");
  ok("[유적] 보물상자 잔존 (1개)", !!keep && keep.chest === 1, keep ? `chest=${keep.chest}` : "-");

  /* 계단 소품은 v1.4.3 철거로 제거됐다 — 유적 스크린샷만 촬영 */
  await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc) return;
    const it = (sc.interactables ?? []).find((x: { kind: string }) => x.kind === "keepchest");
    const cam = sc.cameras.main;
    cam.stopFollow();
    cam.setZoom(1.4);
    if (it) cam.centerOn(it.x, it.y - 20);
  });

  /* 재시도 체계 번들 존재 (로드된 스크립트 청크 전수 스캔) */
  const retryBundled = await p.evaluate(async () => {
    const srcs = [...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")).filter(Boolean);
    for (const src of srcs) {
      try {
        const res = await fetch(src, { cache: "no-store" });
        if (!res.ok) continue;
        const t = await res.text();
        if (t.includes("retryFailedLoads") && t.includes("자동 재시도")) return true;
      } catch { /* 무시 */ }
    }
    return false;
  });
  ok("[로딩] 재시도 체계 번들 포함", retryBundled);

  /* 안정성 */
  const realErrors = errs.filter((e) => !e.includes("favicon") && !e.includes("404"));
  ok("[안정성] pageerror 0", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));

  await p.screenshot({ path: "/tmp/e2e_141_final.png" });
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== v1.4.1 E2E: ${pass}/${results.length} PASS, pageerror=${realErrors.length} ===`);
  await b.close();
  process.exit(pass === results.length ? 0 : 1);
})();
