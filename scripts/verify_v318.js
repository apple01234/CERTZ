/* v3.0.18 검증 — "조이스틱 걸림 + 이속 느림" 근원 6종 수술
 * ① 조이스틱 연속 커브(계단 점프 제거) 수학 검증
 * ② 드래그 중 리렌더 0 (TouchControls 소스에 setState 잔존 없음)
 * ③ BASE_SPEED 300 + 수동 이동 실측 ≥ 270px/s
 * ④ 공격 중 이동 감삭 0.92 실측
 * ⑤ 카메라 추적 lerp 0.18
 * ⑥ 나무 16x14 / 바위 36x20 히트박스 축소 실측
 * 실행 중인 3000 서버 접속 */
const { chromium } = require("playwright");
const fs = require("fs");

const URL = "http://127.0.0.1:3000";
const results = [];
const ok = (name, cond, detail = "") => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
};

/* ── 소스 정적 검증 (빌드 전 원본 기준) ── */
const tcSrc = fs.readFileSync("src/components/game/TouchControls.tsx", "utf8");
const plSrc = fs.readFileSync("src/game/entities/Player.ts", "utf8");

/* ① 조이스틱 연속 커브 — TouchControls와 동일 식 (JOY_RADIUS=64) */
function joyCurve(raw) {
  const t = Math.max(0, Math.min(1, (raw - 0.08) / 0.34));
  return t <= 0 ? 0 : Math.pow(t, 0.58);
}
const c07 = joyCurve(0.07), c08 = joyCurve(0.08), c09 = joyCurve(0.09);
const c15 = joyCurve(0.15), c25 = joyCurve(0.25), c35 = joyCurve(0.35), c42 = joyCurve(0.42), c80 = joyCurve(0.80);
ok("① 데드존 경계 연속(7%→0, 8%→0, 9%→소폭>0) — 계단 점프 제거",
  c07 === 0 && c08 === 0 && c09 > 0 && c09 < 0.2, `c07=${c07} c08=${c08} c09=${c09.toFixed(4)}`);
ok("① 15%→40% / 25%→67% / 35%→88% (연속 가속)", Math.abs(c15 - 0.400) < 0.02 && Math.abs(c25 - 0.669) < 0.02 && Math.abs(c35 - 0.875) < 0.02,
  `${c15.toFixed(3)}/${c25.toFixed(3)}/${c35.toFixed(3)}`);
ok("① 42% 포화 — 80%·100% 모두 100%", Math.abs(c42 - 1) < 1e-9 && c80 === 1, `c42=${c42.toFixed(4)}`);
ok("① 소스 반영: JOY_RADIUS 64 + 연속 커브 식",
  tcSrc.includes("const JOY_RADIUS = 64") && tcSrc.includes("Math.pow(t, 0.58)") && tcSrc.includes("(raw - 0.08) / 0.34"));

/* ② 드래그 중 리렌더 0 — onJoyMove 내 setState 호출 제거 (주석 언급 제외 실체 검사) */
ok("② setJoyKnob({/setJoyOrigin({ 호출 잔존 없음 (리렌더 근원 제거)",
  !tcSrc.includes("setJoyKnob({") && !tcSrc.includes("setJoyOrigin({") && !tcSrc.includes("useState<{ x: number; y: number }"));
ok("② 노브/베이스 ref 직접 DOM 조작 + dragging은 down/up만",
  tcSrc.includes("joyKnobRef.current") && tcSrc.includes("joyBaseRef.current") && tcSrc.includes("setDragging(true)") && tcSrc.includes("setDragging(false)"));

/* ③ BASE_SPEED 300 소스 */
ok("③ 소스: BASE_SPEED 300", plSrc.includes("static readonly BASE_SPEED = 300"));

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

  /* ── ③ BASE_SPEED 300 + 수동 이동 실측 (EventBus 실제 입력 경로) ── */
  const speedInfo = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    return { base: w.player.constructor.BASE_SPEED, speed: w.player.speed };
  });
  ok("③ BASE_SPEED 300 적용", speedInfo.base === 300 && speedInfo.speed === 300, `base=${speedInfo.base} speed=${speedInfo.speed}`);

  const moveDist = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
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
      if (best >= 270) break;
    }
    return Math.round(best);
  });
  ok("③ 수동 이동 실측 ≥ 270px/s (300의 90%)", moveDist >= 270, `${moveDist}px/s — v3.0.17 실측 256~287 대비 상향`);

  /* ── ④ 공격 중 이동 0.92 실측: 공격 상태 강제 후 4방향 시도(벽 충돌 변수 제거) ── */
  const atkMove = await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const p = w.player;
    const dirs = [[1, 0], [-1, 0], [0, -1], [0, 1]];
    let best = 0;
    for (const [dx, dy] of dirs) {
      p.state = "attack"; p.lungeTime = 0; p.swingDone = true; p.atkCooldown = 99999;
      w.touchMove.set(dx, dy);
      const sx = p.x, sy = p.y;
      await new Promise((r) => setTimeout(r, 800));
      w.touchMove.set(0, 0);
      p.state = "idle"; p.atkCooldown = 0;
      await new Promise((r) => setTimeout(r, 120));
      const d = Math.hypot(p.x - sx, p.y - sy);
      best = Math.max(best, d);
      if (best >= 240) break;
    }
    return Math.round(best);
  });
  ok("④ 공격 중 이동 실측 ≥ 248px/s (300×0.92의 90%)", atkMove >= 248, `${atkMove}px/s — 기존 0.8 감삭 시 212px/s`);

  /* ── ⑤ 카메라 추적 lerp 실측 ── */
  const lerp = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const c = w.cameras.main;
    return c.followLerpX ?? c._followLerpX ?? (c.lerp && c.lerp.x) ?? 0;
  });
  ok("⑤ 카메라 추적 lerp 0.18 (기존 0.12)", Math.abs(lerp - 0.18) < 0.001, `lerp=${lerp}`);

  /* ── ⑥ 장애물 히트박스 실측 (나무 16x14 / 바위 36x20) ── */
  const bodies = await page.evaluate(() => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const trees = new Set(), rocks = new Set();
    let obstacleN = 0;
    for (const go of w.solidGroup.children.entries) {
      if (!go.active || !go.getData("obstacle")) continue;
      obstacleN++;
      const b = go.body;
      const isRock = /rock/.test(go.texture.key);
      const size = `${b.width}x${b.height}`;
      if (isRock) rocks.add(size); else trees.add(size);
    }
    return { obstacleN, trees: [...trees], rocks: [...rocks] };
  });
  ok("⑥ 나무 히트박스 16x14 (기존 24x20)", bodies.trees.every((s) => s === "16x14"), JSON.stringify(bodies.trees));
  ok("⑥ 바위 히트박스 36x20 (기존 44x28)", bodies.rocks.every((s) => s === "36x20"), JSON.stringify(bodies.rocks));
  ok("⑥ 충돌 오브젝트 존재 (실측 표본)", bodies.obstacleN > 0, `${bodies.obstacleN}개`);

  /* ── ⑦ 안정성: 6초 자유 이동 + pageerror ── */
  await page.evaluate(async () => {
    const w = window.__SERTZ__.game.scene.getScene("world");
    const dirs = [[1, 0], [0, -1], [-1, 0], [0, 1]];
    let i = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 6000) {
      const [dx, dy] = dirs[Math.floor(i / 30) % 4];
      w.touchMove.set(dx, dy);
      i++;
      await new Promise((r) => setTimeout(r, 33));
    }
    w.touchMove.set(0, 0);
  });
  ok("pageerror 0", errors.length === 0, errors.join(" | ").slice(0, 200));

  await browser.close();
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n===== ${passed}/${results.length} PASS =====`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
