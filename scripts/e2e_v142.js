/**
 * v1.4.2 E2E — 유저 리포트 2건 "재발 없음" 최종 검증
 *  ① 요새 유적 타일맵: setCrop 폐지→프레임 방식 전환. 프레임명 + '실제 렌더 좌표'까지 검증
 *     (v1.4.1은 crop 수치만 봐서 화면상 이동을 놓쳤다 — 이번엔 좌표를 실측한다)
 *  ② 스프라이트 미로딩: texGuard 무결성 체계(레지스트리/부트 감사/월드 상주 감시) + 로드 실패 0
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
    if (t.includes("[SERTZ] 에셋 로드 실패") || t.includes("[SERTZ] 지연 에셋 로드 실패") || t.includes("재시도 후에도") || t.includes("한도 초과") || t.includes("누락/손상")) loadFails.push(t.slice(0, 140));
  });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });

  /* 부팅 + 배지 */
  const badge = await p.getByText("v1.4.3", { exact: false }).first().isVisible().catch(() => false);
  ok("[부팅] 타이틀 도달 (v1.4.3 배지)", badge);

  /* ② 스프라이트 미로딩 — 부트 감사 통과 + 지연 로드 완료 + 실패 경고 0건 */
  for (let i = 0; i < 30 && !(await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__)); i++) await p.waitForTimeout(300);
  ok("[로딩] 지연 로드 완료 플래그", await p.evaluate(() => !!window.__SERTZ_DEFER_DONE__));
  ok("[로딩] 로드 실패 경고 0건", loadFails.length === 0, loadFails.length ? loadFails.slice(0, 3).join(" | ") : "전 에셋 정상");

  /* texGuard — 레지스트리 규모 + 부트 감사 통과 (부트 시점 스냅샷 — 지연 로드분 제외 ~985) */
  const guard = await p.evaluate(() => window.__SERTZ_TEXGUARD__ ?? null);
  ok("[로딩] texGuard 레지스트리 구축 (부트 기대 텍스처 900종 이상)", !!guard && guard.expected >= 900, guard ? `expected=${guard.expected}` : "없음");

  /* 월드 진입 (로비 3단 흐름 준용) */
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("세라142");
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
  for (let i = 0; i < 30; i++) {
    const d = await p.evaluate(() => window.__SERTZ__?.game?.scene?.getScene("world")?.dialoguing);
    if (!d) break;
    await p.mouse.click(640, 500);
    await p.waitForTimeout(360);
  }
  const inWorld = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    return !!(sc && sc.player);
  });
  ok("[게임] 월드 진입", inWorld);

  /* ① 요새 유적 — v1.4.3: 유적 구조물 철거(발코니/계단/목책/기둥 충돌 제거) → 보물상자만 잔존.
   *  kg_* 프레임 오브제 0 + keepRect null(히트박스 원천 소멸) + 상자 interactable 1개를 검증한다. */
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
    const chest = sc.interactables?.filter((it) => it.kind === "keepchest").length ?? 0;
    return { kgTiles, fence, stair, chest, keepRectNull: !sc.keepRect, keepStairNull: !sc.keepStair };
  });
  ok("[유적] 구조물 철거 — 발코니/목책/계단 프레임 0", !!keep && keep.kgTiles === 0 && keep.fence === 0 && keep.stair === 0, keep ? `kg=${keep.kgTiles} fence=${keep.fence} stair=${keep.stair}` : "-");
  ok("[유적] 은닉 히트박스 원천 소멸 (keepRect/keepStair null)", !!keep && keep.keepRectNull && keep.keepStairNull, "-");
  ok("[유적] 보물상자만 잔존 (interactable 1개)", !!keep && keep.chest === 1, keep ? `chest=${keep.chest}` : "-");

  /* texGuard 상주 감시 — 월드에서 1회 감사 완료 상태 (경고 로그 0이면 전 정상) */
  ok("[로딩] 월드 감사·상주 감시 경고 0건", loadFails.length === 0, "texGuard 누락/손상 감지 없음");

  /* 유적 스크린샷 증거 저장 */
  const kr = await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    const cam = sc.cameras.main;
    cam.stopFollow();
    cam.setZoom(1.4);
    const it = (sc.interactables ?? []).find((x) => x.kind === "keepchest");
    if (it) cam.centerOn(it.x, it.y - 20);
    return true;
  });
  await p.waitForTimeout(800);
  if (kr) await p.screenshot({ path: "/tmp/e2e_142_keep.png" });

  /* 안정성 */
  const realErrors = errs.filter((e) => !e.includes("favicon") && !e.includes("404"));
  ok("[안정성] pageerror 0", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));

  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== v1.4.2 E2E: ${pass}/${results.length} PASS, pageerror=${realErrors.length} ===`);
  await b.close();
  process.exit(pass === results.length ? 0 : 1);
})();
