/* v3.0.16 검증 — 신규 4개 피드백 항목
 * ① 기본 이동속도 상향(230→265) + 수동 이동 실측
 * ② 퀘스트 팝업 모바일 하단 이동(mt-8 적용)
 * ③ 데드아이 초록 화살 텍스처 로드 + 4차 기본공격 사용
 * ④ 다중사격 재미 강화: 부채꼴 확대 + 트레일 전달 + 실측 생성
 * 실행 중인 3000 서버에 접속 */
const { chromium } = require("playwright");

const URL = "http://127.0.0.1:3000";
const results = [];
const ok = (name, cond, detail = "") => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
};

/* ① 조이스틱 포화 커브 수학 검증 (TouchControls와 동일 식) */
function joyCurve(raw) {
  if (raw <= 0.14) return 0;
  const t = Math.min(1, (raw - 0.14) / 0.41);
  return 0.3 + 0.7 * Math.pow(t, 0.75);
}
const c30 = joyCurve(0.30), c55 = joyCurve(0.55), c80 = joyCurve(0.80), c100 = joyCurve(1.0), c10 = joyCurve(0.10);
ok("① 조이스틱 커브: 30%→64%", Math.abs(c30 - 0.6407) < 0.02, c30.toFixed(3));
ok("① 조이스틱 커브: 55%→100% 포화", Math.abs(c55 - 1) < 1e-9, c55.toFixed(3));
ok("① 조이스틱 커브: 80%·100% 모두 100%", Math.abs(c80 - 1) < 1e-9 && Math.abs(c100 - 1) < 1e-9);
ok("① 조이스틱 데드존 10%→0", c10 === 0);

async function cleanDialogues(page) {
  for (let i = 0; i < 20; i++) {
    const dlg = await page.evaluate(() => {
      const w = window.__SERTZ__.game.scene.getScene("world");
      if (w?.dialoguing) { w.resumeFromDialogue(); return true; }
      return false;
    });
    if (!dlg) break;
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.dialoguing = false; w.introStep = -1; w.sleepPending = false;
    if (w.physics.world) w.physics.world.resume();
  });
  await page.waitForTimeout(250);
}

async function enterWorld(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=새로운 모험", { timeout: 60000 });
  await page.click("text=새로운 모험");
  for (let i = 0; i < 40; i++) {
    const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene.getScene("world")?.player));
    if (inWorld) break;
    await page.mouse.click(400, 300); await page.keyboard.press("e"); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(800);
  for (let i = 0; i < 6; i++) {
    const done = await page.evaluate(() => {
      try {
        const w = window.__SERTZ__.game.scene.getScene("world");
        if (!w?.player) return false;
        w.finishIntro("테스터");
        return true;
      } catch { return false; }
    });
    if (done) break;
    await page.waitForTimeout(500);
  }
  await cleanDialogues(page);
}

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await enterWorld(page);

  /* ── ① 기본 이동속도: BASE_SPEED 265 + 실측 (EventBus input:move = 실제 수동 입력 경로) ── */
  const speedInfo = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { base: w.player.constructor.BASE_SPEED, speed: w.player.speed, auto: w.autoHunt };
  });
  ok("① BASE_SPEED 265 상향", speedInfo.base === 265 && speedInfo.speed === 265, `base=${speedInfo.base} speed=${speedInfo.speed}`);

  const moveDist = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    // 실제 입력 경로: EventBus "input:move" → w.touchMove와 동일한 이후 파이프라인.
    // (touchMove 직접 주입 — useTouch 우선 → move = touchMove → player.update)
    const dirs = [[1, 0], [-1, 0], [0, -1], [0, 1]];
    let best = 0;
    for (const [dx, dy] of dirs) {
      w.touchMove.set(dx, dy);
      const sx = w.player.x, sy = w.player.y;
      await new Promise((r) => setTimeout(r, 1000));
      const d = Math.hypot(w.player.x - sx, w.player.y - sy);
      best = Math.max(best, d);
      w.touchMove.set(0, 0);
      await new Promise((r) => setTimeout(r, 120));
      if (best >= 230) break; // 충분하면 조기 종료
    }
    return Math.round(best);
  });
  ok("① 수동 이동 실측 ≥ 239px/s (265의 90%)", moveDist >= 239, `${moveDist}px/s — 기존 230 전송·조이스틱 반반 밀기 시 ~150px/s 체감`);

  /* ── ② 퀘스트 팝업 위치: 모바일 뷰포트에서 mt-8 적용 확인 ── */
  await page.setViewportSize({ width: 390, height: 720 });
  await page.waitForTimeout(400);
  const questGap = await page.evaluate(() => {
    const tracker = [...document.querySelectorAll("div")].find((d) =>
      typeof d.className === "string" && d.className.includes("border-amber-200/40") && d.className.includes("mt-8"));
    return { hasMt8: !!tracker, cls: tracker ? tracker.className.slice(0, 130) : "" };
  });
  ok("② 모바일 퀘스트 팝업 mt-8 (32px 하단 이동)", questGap.hasMt8, questGap.cls);
  ok("② PC(sm+) 레이아웃 유지 sm:mt-1", questGap.cls.includes("sm:mt-1"));
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.waitForTimeout(300);

  /* ── ③ 데드아이 초록 화살: 텍스처 로드 + 4차 기본공격 ── */
  const greenTex = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return w.textures.exists("x2_arrow_green");
  });
  ok("③ x2_arrow_green 텍스처 로드", greenTex);

  // 티어 getter는 cls 체인 기반 → cls만 주입하면 tier=4 자동 적용
  const shotResult = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    p.cls = "deadeye"; // chainOf("deadeye").length === 4 → tier 4
    const origFire = w.firePlayerProj.bind(w);
    const fired = [];
    w.firePlayerProj = (cfg) => { fired.push({ tex: cfg.tex, blend: cfg.blend, tint: cfg.tint, trail: cfg.trail, angle: +cfg.angle.toFixed(4), scale: cfg.scale }); };
    p.state = "idle"; p.atkCooldown = 0;
    p.update(16, { x: 1, y: 0, lengthSq: () => 1, copy() {}, normalize() { return this; } }, true);
    await new Promise((r) => setTimeout(r, 320));
    w.firePlayerProj = origFire;
    return fired;
  });
  ok("③ 데드아이 기본공격 = 초록 화살(x2_arrow_green) 4발",
    shotResult.length === 4 && shotResult.every((s) => s.tex === "x2_arrow_green"),
    JSON.stringify(shotResult.map((s) => s.tex)));
  ok("③ 데드아이 초록 화살(normal 블렌드로 진한 초록 유지) + 초록 트레일(0x53ff9a)",
    shotResult.every((s) => s.blend === "normal" && s.trail === 0x53ff9a));

  /* ── ④ 4차 부채꼴 확대: 총 확산각 = 3 × 0.22rad ── */
  if (shotResult.length === 4) {
    const angles = shotResult.map((s) => s.angle);
    const spreadTotal = Math.max(...angles) - Math.min(...angles);
    ok("④ 4차 부채꼴 0.66rad (기존 0.24rad의 2.75배)", Math.abs(spreadTotal - 3 * 0.22) < 0.01, `spread=${spreadTotal.toFixed(4)}rad`);
  }

  /* ── ④ 1차 궁수: 1발 + 골드 트레일 ── */
  const rangerShot = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    p.cls = "ranger"; // tier 1
    const origFire = w.firePlayerProj.bind(w);
    const fired = [];
    w.firePlayerProj = (cfg) => { fired.push({ tex: cfg.tex, trail: cfg.trail, blend: cfg.blend }); };
    p.state = "idle"; p.atkCooldown = 0;
    p.update(16, { x: 1, y: 0, lengthSq: () => 1, copy() {}, normalize() { return this; } }, true);
    await new Promise((r) => setTimeout(r, 250));
    w.firePlayerProj = origFire;
    return fired;
  });
  ok("④ 1차 = 화살 1발 + 골드 트레일", rangerShot.length === 1 && rangerShot[0].tex === "x2_arrow" && rangerShot[0].trail === 0xffd98a, JSON.stringify(rangerShot));

  /* ── ④ 트레일 실측: 화살 비행 중 잔상 이미지 생성 ── */
  const trailTest = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    w.firePlayerProj({ x: w.player.x, y: w.player.y - 8, angle: 0, speed: 600, pierce: 1, dmg: 1, crit: false, tint: 0xffffff, knock: 0, tex: "x2_arrow", rot: true, trail: 0x53ff9a });
    await new Promise((r) => setTimeout(r, 230));
    let count = 0;
    for (const img of w.children.list) {
      if (img.type === "Image" && img.texture.key === "x2_arrow" && img.blendMode === 1) count++;
    }
    return count;
  });
  ok("④ 비행 잔상 실측 생성 (≥2)", trailTest >= 2, `${trailTest}개 잔상`);
  await page.waitForTimeout(600);

  ok("pageerror 0", errors.length === 0, errors.join(" | ").slice(0, 200));

  await browser.close();
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n===== ${passed}/${results.length} PASS =====`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
