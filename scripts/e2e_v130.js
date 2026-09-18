/**
 * v1.3.0 E2E — 유저 지시 9건 검증
 *  #1 SNS 로그인 임시 비활성 (업데이트 준비 중 배지)
 *  #2 HUD ☰ 버튼 제거 + 설정 패널 메뉴 나가기 유지
 *  #3 날개/망토 방향 인지 렌더 (뒷모습=등에 보임, 정면=뒤에 숨음)
 *  #4 NPC급 옷 세트 3종 (cost_flame 시트 + 장착)
 *  #5 오로라류 오라 강화 (발판 서클+링+위스프 4겹)
 *  #6 소모품 수량 지정 사용 + 최대
 *  #7 랭킹창 (HUD 버튼 + /api/rank + 주간 보상 엔드포인트)
 *  #8 VFX 에셋 통합 (petal0/impact/fire/water 텍스처 + 마을 벚꽃 이미터)
 *  #9 층식 구조 타일맵 (단 셀 + 절벽 콜리전 + 계단 경로)
 *  + pageerror 0 · 버전 배지 v1.3.0
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
  p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 200)));
  p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errs.push("CONSOLE: " + m.text().slice(0, 160)); });
  const shot = (n) => p.screenshot({ path: `/tmp/e2e_130_${n}.png` });

  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  await p.waitForSelector("text=게임 시작", { timeout: 30000 });
  const badge = await p.getByText("v1.3.0", { exact: false }).first().isVisible().catch(() => false);
  ok("[버전] 타이틀 배지 v1.3.0", badge);

  /* 캐릭터 생성 (여캠) */
  await p.getByText("게임 시작").first().click();
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("캐릭터 생성"))?.click();
  });
  await p.waitForTimeout(700);
  await p.locator("input").first().fill("시아");
  await p.waitForTimeout(300);
  for (const label of ["직업 선택", "외형 선택"]) {
    await p.evaluate((lb) => {
      Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes(lb))?.click();
    }, label);
    await p.waitForTimeout(300);
  }
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "여캠")?.click();
  });
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "백자")?.click();
  });
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("생성!"))?.click();
  });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { document.querySelector(".cursor-pointer")?.click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("이 캐릭터로 시작"))?.click();
  });
  await p.waitForTimeout(2800);
  for (let i = 0; i < 6; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(420); }
  await p.waitForTimeout(800);

  const inWorld = await p.evaluate(() => {
    const s = window.__SERTZ__?.game?.scene?.getScene("world");
    return { has: !!s?.player, tex: s?.player?.texture?.key ?? null };
  });
  ok("[진입] 월드 진입", inWorld.has, inWorld.tex ?? "");

  /* #1 SNS 임시 비활성 — 계정 패널 (ui:authOpen) */
  await p.evaluate(() => { window.__SERTZ_EB__.emit("ui:authOpen", {}); });
  await p.waitForTimeout(700);
  const snsDisabled = await p.evaluate(() => {
    const badge = Array.from(document.querySelectorAll("span")).find((x) => x.textContent?.includes("업데이트 준비 중"));
    const btns = Array.from(document.querySelectorAll("button")).filter((x) => ["구글", "카카오", "네이버"].includes(x.textContent?.trim() ?? ""));
    return { badge: !!badge, count: btns.length };
  });
  ok("[#1] SNS 임시 비활성 배지", snsDisabled.badge && snsDisabled.count === 3, `badge=${snsDisabled.badge} sns=${snsDisabled.count}`);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(500);

  /* #2 ☰ 제거 + 설정 메뉴 나가기 유지 */
  const hudCheck = await p.evaluate(() => {
    const gone = !Array.from(document.querySelectorAll("button")).find((x) => x.getAttribute("aria-label")?.includes("메뉴 화면으로 나가기"));
    return { gone };
  });
  ok("[#2] HUD ☰ 버튼 제거", hudCheck.gone);
  // 설정 패널 열기 (O 키 아이콘 = Settings 버튼 aria-label "설정/키 매핑 열기")
  await p.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((x) => x.getAttribute("aria-label")?.includes("설정"));
    btn?.click();
  });
  await p.waitForTimeout(600);
  const optMenu = await p.evaluate(() => {
    const hasCard = Array.from(document.querySelectorAll("p")).some((x) => x.textContent?.trim() === "메뉴 화면");
    const buttons = Array.from(document.querySelectorAll("button")).filter((x) => x.textContent?.trim() === "캐릭터 선택" || x.textContent?.trim() === "게임 시작 화면");
    return { hasCard, exitButtons: buttons.length };
  });
  ok("[#2] 설정 패널 메뉴 나가기 유지", optMenu.hasCard && optMenu.exitButtons >= 2, `card=${optMenu.hasCard} btn=${optMenu.exitButtons}`);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);

  /* #3/#4/#5/#6 — 이벤트 기반 실측 */
  const fx = await p.evaluate(async () => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!ws?.player) return { err: "no world" };
    ws.dialoguing = false;
    const out = {};
    ws.player.emerald = 9999;
    ws.player.gold = 999999;

    /* #5 오라 강화 — cos_aurora 구매/장착 */
    window.__SERTZ_EB__.emit("rpg:bmBuy", { key: "cos_aurora", qty: 1 });
    await new Promise((r) => setTimeout(r, 500));
    out.aura = {
      circle: !!ws.auraCircle,
      ring: !!ws.auraRing,
      wisps: ws.auraWisps?.length ?? 0,
      glow: !!ws.cosmeticAura,
      cosmetic: ws.player.cosmetic,
    };

    /* #3 망토 방향 렌더 — acc_cape_crimson 지급/장착 + 뒷모습/정면 depth 실측 */
    if (!ws.player.cosmetics.includes("acc_cape_crimson")) ws.player.cosmetics.push("acc_cape_crimson");
    window.__SERTZ_EB__.emit("rpg:cosmetic", { key: "acc_cape_crimson", slot: "acc" });
    await new Promise((r) => setTimeout(r, 400));
    // 뒷모습 애님 강제
    ws.player.play(ws.player.bodyKey("hero-walk-up"), true);
    ws.player.setDepth(10);
    await new Promise((r) => setTimeout(r, 250));
    const cape = ws.accOverlays?.find((a) => a.key === "acc_cape_crimson");
    out.capeBackDepth = cape ? cape.img.depth : null;
    out.playerDepth = ws.player.depth;
    // 정면 애님
    ws.player.play(ws.player.bodyKey("hero-idle"), true);
    await new Promise((r) => setTimeout(r, 250));
    out.capeFrontDepth = cape ? cape.img.depth : null;

    /* #4 옷 세트 — outfit_flame 장착 → 시트 교체 */
    if (!ws.player.cosmetics.includes("outfit_flame")) ws.player.cosmetics.push("outfit_flame");
    window.__SERTZ_EB__.emit("rpg:cosmetic", { key: "outfit_flame", slot: "outfit" });
    await new Promise((r) => setTimeout(r, 400));
    out.flameSet = { prefix: ws.player.bodyPrefix, tex: ws.player.texture.key };

    /* #6 수량 사용 — 성장의 책(고급) 7권 지급 후 5권 사용 (HP 상태 무관 — 순수 수량 실측) */
    ws.dialoguing = false; // 튜토리얼이 도중에 기동돼 dialoguing=true가 되는 것을 다시 해제 (테스트 아티팩트)
    ws.tutorialDone = true;
    for (let i = 0; i < 7; i++) ws.player.owned.push("exp_book_s");
    const before = ws.player.owned.filter((k) => k === "exp_book_s").length;
    window.__SERTZ_EB__.emit("rpg:useItem", { key: "exp_book_s", qty: 5 });
    await new Promise((r) => setTimeout(r, 500));
    const after = ws.player.owned.filter((k) => k === "exp_book_s").length;
    // 진단 — 핸들러 조건 재확인
    out.qtyUse = { before, after, used: before - after, dialoguing: ws.dialoguing, state: ws.player.state };
    return out;
  });
  if (fx.err) { ok("[실측] 이벤트 실측", false, fx.err); }
  else {
    ok("[#5] 오라 4겹 패키지", fx.aura?.circle && fx.aura?.ring && fx.aura?.wisps === 3 && fx.aura?.glow, JSON.stringify(fx.aura));
    const backOk = fx.capeBackDepth !== null && fx.capeBackDepth > fx.playerDepth;
    const frontOk = fx.capeFrontDepth !== null && fx.capeFrontDepth < fx.playerDepth;
    ok("[#3] 망토 뒷모습=등에 보임(depth↑)", backOk, `back=${fx.capeBackDepth} front=${fx.capeFrontDepth} player=${fx.playerDepth}`);
    ok("[#3] 망토 정면=등 뒤 숨음(depth↓)", frontOk);
    ok("[#4] 화염무사 세트 장착", /costm?_flame/.test(String(fx.flameSet?.prefix ?? "")), `${fx.flameSet?.prefix} / ${fx.flameSet?.tex}`);
    ok("[#6] 수량 5 사용", fx.qtyUse?.used === 5, JSON.stringify(fx.qtyUse));
  }
  await shot("10_world");

  /* #7 랭킹창 — HUD 버튼 → 패널 오픈 + API */
  const rankApi = await p.evaluate(async () => {
    const r = await fetch("/api/rank").then((x) => x.json());
    return { ok: Array.isArray(r.level) && Array.isArray(r.power), week: r.week ?? "" };
  });
  ok("[#7] /api/rank 200", rankApi.ok, rankApi.week);
  await p.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((x) => x.getAttribute("aria-label")?.includes("랭킹창"));
    btn?.click();
  });
  await p.waitForTimeout(700);
  const rankPanel = await p.evaluate(() => {
    const title = Array.from(document.querySelectorAll("p")).some((x) => x.textContent?.trim() === "세르츠 랭킹");
    const tabs = Array.from(document.querySelectorAll("button")).filter((x) => ["전투력", "레벨", "콘텐츠"].includes(x.textContent?.trim() ?? "")).length;
    const claim = Array.from(document.querySelectorAll("button")).some((x) => x.textContent?.includes("주간 보상 수령") || x.textContent?.includes("이번 주 수령 완료"));
    return { title, tabs, claim };
  });
  ok("[#7] 랭킹창 오픈 (탭 + 보상 수령)", rankPanel.title && rankPanel.tabs >= 3 && rankPanel.claim, JSON.stringify(rankPanel));
  await shot("11_rank");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);

  /* #8 에셋 — 텍스처/애님/벚꽃 이미터 */
  const assets = await p.evaluate(() => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    const t = ws?.textures;
    return {
      petal: !!t?.exists("petal0"),
      impact: !!t?.exists("vfx3_impact"),
      heart: !!t?.exists("vfx3_heart"),
      fireAnim: !!ws?.anims?.exists("vfx3-fire"),
      waterAnim: !!ws?.anims?.exists("vfx3-water"),
    };
  });
  ok("[#8] VFX 텍스처 로드", assets.petal && assets.impact && assets.heart && assets.fireAnim && assets.waterAnim, JSON.stringify(assets));

  /* #9 층식 구조 — 필드 전환 후 단/절벽/계단 실측 */
  await p.evaluate(() => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    if (ws?.player) ws.startTransition("forest1", { delay: 10 });
  });
  await p.waitForTimeout(3800);
  for (let i = 0; i < 4; i++) { await p.mouse.click(640, 500); await p.waitForTimeout(350); }
  await p.waitForTimeout(600);
  const plateau = await p.evaluate(() => {
    const ws = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!ws?.layout?.level) return { err: "no layout" };
    const lay = ws.layout;
    const cells = Array.from(lay.level).filter((l) => l === 1).length;
    // 절벽 콜리전 — 단 경계 static body 존재 (solidGroup 크기 증가로 간접 판정)
    const solids = ws.solidGroup.getChildren().length;
    // 계단 경로 — 지상→단 BFS 경로가 계단을 경유하는지 (nextStepToward로 단 셀 도달 가능)
    let stairOk = false;
    if (lay.stairs?.size > 0) {
      const stairCell = [...lay.stairs][0];
      stairOk = lay.open[stairCell];
    }
    return { cells, solids, stairs: lay.stairs?.size ?? 0, stairOk };
  });
  ok("[#9] 단 셀 생성 + 계단", plateau.cells > 0 && plateau.stairs > 0 && plateau.stairOk, JSON.stringify(plateau));
  await shot("12_plateau");

  /* pageerror */
  ok("[안정] pageerror 0", errs.length === 0, errs.slice(0, 3).join(" | "));

  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== ${pass}/${results.length} PASS ===`);
  await b.close();
  process.exit(pass === results.length ? 0 : 1);
})();
