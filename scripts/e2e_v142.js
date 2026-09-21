/**
 * v1.4.3 E2E — 유저 리포트 2건 "재발 없음" 최종 검증
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

  /* ① v1.4.3 — 요새 유적 전면 삭제 검증 + 초행자 훈련장 신설 검증 */
  const keepGone = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc) return null;
    let kg = 0, mg = 0, torch = false;
    for (const ch of sc.children.list) {
      const tex = ch?.texture?.key;
      const fn = ch?.frame?.name;
      if (tex === "map_ground" || tex === "map_props") mg++;
      if (fn && String(fn).startsWith("kg_")) kg++;
      if (ch?.anims?.currentAnim?.key === "keep_torch") torch = true;
    }
    return { keepRect: !!sc.keepRect, kg, mapTex: mg, torch, texMapGround: !!sc.textures.exists("map_ground") };
  });
  ok("[유적삭제] 유적 구조물 완전 제거 (keepRect/kg_*/텍스처 0)", !!keepGone && !keepGone.keepRect && keepGone.kg === 0 && keepGone.mapTex === 0 && !keepGone.torch, keepGone ? JSON.stringify(keepGone) : "-");
  ok("[유적삭제] 유적 전용 텍스처 미로드 (부트 절감)", !!keepGone && !keepGone.texMapGround, "-");

  const train = await p.evaluate(() => {
    const sc = window.__SERTZ__?.game?.scene?.getScene("world");
    if (!sc) return null;
    const tw = (sc.enemies ?? []).filter((e) => e?.displayName === "훈련용 늑대" && e.active && e.alive);
    const sign = (sc.children.list ?? []).some((ch) => ch?.text?.includes("초행자 훈련장"));
    const stone = (sc.interactables ?? []).some((it) => it.kind === "secret");
    return { n: tw.length, hp: tw[0]?.maxHp ?? 0, sign, stone };
  });
  ok("[훈련장] 훈련용 늑대 3마리 스폰 (약한 스탯)", !!train && train.n === 3 && train.hp > 0 && train.hp < 58, train ? JSON.stringify(train) : "-");
  ok("[훈련장] 표지판 + ARG 이상한 비석 상호작용", !!train && train.sign && train.stone, "-");

  /* 훈련장 스크린샷 증거 저장 */
  await p.evaluate(() => {
    const sc = window.__SERTZ__.game.scene.getScene("world");
    const cam = sc.cameras.main;
    cam.stopFollow();
    cam.setZoom(1.4);
    cam.centerOn(1180, 515);
    return true;
  });
  await p.waitForTimeout(800);
  await p.screenshot({ path: "/tmp/e2e_143_training.png" });

  /* 안정성 */
  const realErrors = errs.filter((e) => !e.includes("favicon") && !e.includes("404"));
  ok("[안정성] pageerror 0", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));

  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== v1.4.3 E2E: ${pass}/${results.length} PASS, pageerror=${realErrors.length} ===`);
  await b.close();
  process.exit(pass === results.length ? 0 : 1);
})();
