/**
 * v4.1.2 스모크 — 화면 전환 검은 화면·멈춤 근본 수정 실측 (Playwright headless)
 *  [1] startTransition 단일 통로 — 즉시 게이트 + 경합 차단
 *  [2] 도장/수비전 복귀 단일 전환
 *  [3] 왕복 스트레스
 *  [4] 스타크 페이드 자가치유 — 완료된 fadeOut이 검게 남아도 resetFX로 복구 (v4.1.2 신규)
 *  ※ 헤드리스 가상시간 이슈로 알파 샘플 대신 fadeEffect 상태로 판정한다
 */
const { chromium } = require("playwright");

const BASE = process.env.SERTZ_URL || "http://localhost:3000";
const results = [];
function ok(name, cond, detail = "") {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? " — " : ""}${detail}`);
}

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--disable-web-security"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message} | ${String(e.stack || "").split("\n")[1]?.trim().slice(0, 160)}`));

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(6500);
  ok("타이틀 배지 v4.1.2", await page.evaluate(() => document.body.innerText.includes("v4.1.2")));

  /* 새 게임 */
  await page.evaluate(() => localStorage.removeItem("sertz_save_v2"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6500);
  let clicked = false;
  for (let i = 0; i < 3 && !clicked; i++) {
    clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("새로운 모험"));
      if (b) { b.click(); return true; }
      return false;
    });
    if (!clicked) await page.waitForTimeout(2500);
  }
  ok("부팅 — 새 게임 진입", clicked);
  await page.waitForTimeout(4500);

  const scene = () => page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    if (!s) return null;
    return {
      key: s.stageDef?.key, trans: s.transitioning, gold: s.player?.gold,
      gateActive: s.gateActive, portalActive: s.portalActive, returnActive: s.returnActive,
      fxRun: !!s.cameras?.main?.fadeEffect?.isRunning,
      fxDark: (() => { const f = s.cameras?.main?.fadeEffect; return !!(f && f.direction === true && f.progress >= 0.99 && !f.isRunning); })(),
    };
  });

  /* ============ [1] 블랙아웃 창 중 경합 전환 차단 (도장 복귀 경로) ============ */
  await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:gm", { type: "dojang" }));
  await page.waitForTimeout(3000);
  const dj = await scene();
  ok("도장 입장", dj?.key === "dojang", JSON.stringify(dj));

  await page.evaluate(() => window.__SERTZ_SCENE__.enterPrevStage());
  await page.waitForTimeout(150);
  const mid = await scene();
  ok("페이드 중 즉시 게이트 닫힘", mid?.trans === true && !mid?.portalActive && !mid?.returnActive,
    `trans=${mid?.trans} portal=${mid?.portalActive} ret=${mid?.returnActive}`);

  await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    s.enterPrevStage(); s.emergencyReturn(); s.enterPortal();
  });
  await page.waitForTimeout(1200);
  const race = await scene();
  await page.waitForTimeout(4200);
  const back = await scene();
  ok("경합 전환 전부 무시 — 도장→마을 단일 전환", back?.key === "village", `경합후=${race?.key ?? "?"} → ${back?.key}`);
  ok("복귀 후 게이트 해제 + 어둠 없음", back?.trans === false && !back?.fxDark && !back?.fxRun, JSON.stringify(back));

  /* ============ [2] 수비전 퇴장 1.9초 블랙아웃 창 경합 차단 ============ */
  const gold0 = (await scene())?.gold;
  await page.evaluate(() => window.__SERTZ_EB__.emit("rpg:gm", { type: "gate" }));
  await page.waitForTimeout(3000);
  const g = await scene();
  ok("수비전 입장", g?.key === "gate" && g?.gateActive === true, JSON.stringify(g));

  await page.evaluate(() => window.__SERTZ_SCENE__.finishGate("exit"));
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    s.enterPrevStage(); s.emergencyReturn(); s.enterPortal();
  });
  /* 헤드리스 가상시간 6배 늘어짐 — 실기기에선 1.9초+리스타트 ≈ 2.4초 */
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(600);
    const w = await scene();
    if (w?.key === "village" && !w?.trans) break;
  }
  await page.waitForTimeout(1500);
  const gback = await scene();
  ok("수비전 퇴장(1.9초 창) → 마을 단일 전환", gback?.key === "village" && gback?.gateActive === false, `key=${gback?.key} gateActive=${gback?.gateActive}`);
  ok("수비전 복귀 후 어둠 없음", !gback?.fxDark && !gback?.fxRun, JSON.stringify(gback));
  ok("수비전 철수 무보상 유지", gback?.gold === gold0, `gold ${gold0} → ${gback?.gold}`);

  /* ============ [3] 왕복 3사이클 스트레스 ============ */
  let cyclesOk = true, darkSeen = false;
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.__SERTZ_SCENE__.gotoStage("forest1", null, true));
    await page.waitForTimeout(3600);
    const f = await scene();
    await page.evaluate(() => window.__SERTZ_SCENE__.enterPrevStage());
    await page.waitForTimeout(4200);
    const v = await scene();
    if (f?.key !== "forest1" || v?.key !== "village" || v?.trans !== false) cyclesOk = false;
    if (v?.fxDark) darkSeen = true; // 완료된 fadeOut 잔상만 잔류로 간주 (fadeIn 진행중은 정상)
    console.log(`  cycle${i + 1}: ${f?.key} → ${v?.key} trans=${v?.trans} fxDark=${v?.fxDark}`);
  }
  ok("왕복 3사이클 전부 정상", cyclesOk);
  ok("3사이클 검은 화면 잔상 0", !darkSeen);

  /* ============ [4] 스타크 페이드 자가치유 (v4.1.2 신규 방어선) ============ */
  /* 전환 중이 아닌 상태에서 fadeOut을 완료시켜 dark 상태를 만든다 → update 자가치유가
   *  임계(1.2초 가상) 도달 시 resetFX를 발동하고 fadeDarkMs를 0으로 리셋한다.
   *  헤드리스는 가상시간이 ~100배 느려(프레임 delta ≈ 0.2ms) 실측 수 분 걸리므로
   *  "누적이 임계를 넘었다가 리셋되는" 발동 신호를 포착하는 방식으로 검증한다.
   *  실기기(60fps·실제 delta 16ms)에선 1.2초 만에 발동된다. */
  await page.evaluate(() => window.__SERTZ_SCENE__.cameras.main.fadeOut(300, 0, 0, 0));
  await page.waitForTimeout(3500); // 페이드 완료 대기
  let maxDark = 0, sawDrop = false, prev = -1;
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(1000);
    const v = await page.evaluate(() => Math.round(window.__SERTZ_SCENE__?.fadeDarkMs ?? -1));
    if (v > maxDark) maxDark = v;
    if (prev > 150 && v < prev - 60) sawDrop = true; // 누적 후 리셋 = 자가치유 발동 신호
    prev = v;
    if (sawDrop) break;
  }
  ok("스타크 페이드 자가치유 발동 (resetFX 신호 포착)", sawDrop && maxDark > 0, `max=${maxDark}ms 마지막=${prev}ms`);

  await page.waitForTimeout(4200);
  const fin = await scene();
  ok("4초 워치독 오작동 없음", fin?.trans === false && fin?.key === "village", JSON.stringify(fin));

  const realErrors = errors.filter((e) => !/swiftshader|texture/i.test(e));
  ok("페이지 에러 0", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));

  const pass = results.filter((r) => r.pass).length;
  console.log(`\n== v4.1.2 전환 스모크: ${pass}/${results.length} PASS ==`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
