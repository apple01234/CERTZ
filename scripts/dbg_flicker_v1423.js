/* dbg_flicker_v1423 — 이동/스킬 사용 시 검은 화면 반짝임 재현 측정 (유저 버그 #1)
 *
 * 변형 매트릭스 (VARIANT env):
 *   gl-high   : WebGL(SwiftShader) + sertz_fx_mode=high  → 카메라 블룸(external filter) ON
 *   gl-low    : WebGL(SwiftShader) + sertz_fx_mode=low   → 필터 OFF
 *   canvas-high: Phaser CANVAS 백엔드 (?renderer=canvas) + high
 *
 * 측정: POST_RENDER 훅에서 프레임마다 중앙 48×48 readPixels 평균 밝기 → 검은 프레임 비율.
 * 동작 시뮬레이션: 화살표 이동 교대 홀드 + X(공격)/Z·C·V(스킬) 연타.
 */
const { chromium } = require("playwright");
const BASE = process.env.SERTZ_URL || "http://localhost:3000";
const VARIANT = process.env.VARIANT || "gl-high";

(async () => {
  const useCanvas = VARIANT.startsWith("canvas");
  const fxMode = VARIANT.endsWith("high") ? "high" : "low";
  const args = ["--enable-unsafe-swiftshader", "--disable-web-security"];
  if (!useCanvas) args.push("--use-angle=swiftshader");
  const browser = await chromium.launch({
    executablePath: "/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
    args,
  });
  const page = await browser.newPage({ viewport: { width: 850, height: 400 } }); // 가로 모드 (실제 플레이 환경)
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 160)));
  const logs = [];
  page.on("console", (m) => {
    const t = m.text();
    if (/\[SERTZ|WebGL|context|컨텍스트|블룸|효과 모드|적응형/.test(t)) logs.push(t.slice(0, 140));
  });

  const url = useCanvas ? BASE + "/?renderer=canvas" : BASE + "/";
  console.log(`=== VARIANT=${VARIANT} (fx=${fxMode}, renderer=${useCanvas ? "canvas" : "webgl"}) ===`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);
  await page.evaluate((m) => {
    localStorage.clear();
    localStorage.setItem("sertz_fx_mode", m);
    /* 테스트 캐릭터 시딩 — 생성 UI 경유(React 상태 동기화 이슈) 없이 즉시 시작 */
    const id = "c_flick01";
    const now = Date.now();
    const meta = { id, name: "플리커", cls: "warrior", lv: 1, stage: "village", cleared: false, lastSeen: now, createdAt: now, rebirths: 0, lookTint: null, gender: "m", skinIdx: 2 };
    const save = { stage: "village", lv: 1, exp: 0, maxHp: 100, atk: 10, cleared: false, maxMp: 60, playerName: "플리커", cls: "warrior", startCls: "warrior", gold: 30, lookTint: null, gender: "m", skinIdx: 2, introSeen: true };
    localStorage.setItem("sertz_slots_v1", JSON.stringify({ v: 1, slots: 4, activeId: null, chars: { [id]: meta } }));
    localStorage.setItem("sertz_char_" + id, JSON.stringify(save));
  }, fxMode);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);

  // 부팅 상태머신: 타이틀(게임 시작) → 로비(이 캐릭터로 시작) → 월드
  const worldAt = Date.now() + 120000;
  while (Date.now() < worldAt) {
    const inWorld = await page.evaluate(() => !!window.__SERTZ_SCENE__);
    if (inWorld) break;
    const act = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const click = (el) => { el.click(); return (el.textContent ?? "").trim().slice(0, 20); };
      const find = (re) => btns.find((b) => re.test(b.textContent ?? ""));
      const st = find(/이 캐릭터로 시작/);
      if (st) return "start:" + click(st);
      const gs = find(/게임 시작/);
      if (gs) return "title:" + click(gs);
      return "idle:" + (btns.length ? btns.map((b) => (b.textContent ?? "").trim().slice(0, 12)).join("|").slice(0, 80) : "nobtns");
    });
    if (process.env.FLICK_TRACE) console.log("  boot:", act);
    await page.waitForTimeout(1400);
  }
  const inWorld = await page.evaluate(() => !!window.__SERTZ_SCENE__);
  if (!inWorld) {
    console.log("FAIL: 월드 진입 실패");
    await browser.close();
    process.exit(1);
  }
  await page.waitForTimeout(3000); // 초기 페이드/인트로 유예

  // 프레임 샘플러 설치
  await page.evaluate(() => {
    const game = window.__SERTZ__.game;
    const r = game.renderer;
    const F = (window.__FLICK__ = { frames: 0, black: 0, dark: 0, means: [], gl: r.type === 2 ? r.gl : null, px: null, ctx: null, skip: 0 });
    if (r.type === 2) {
      const gl = F.gl;
      F.px = new Uint8Array(48 * 48 * 4);
      r.on("postrender", () => {
        F.frames++;
        try {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          const cx = Math.floor(gl.drawingBufferWidth / 2) - 24;
          const cy = Math.floor(gl.drawingBufferHeight / 2) - 24;
          gl.readPixels(cx, cy, 48, 48, gl.RGBA, gl.UNSIGNED_BYTE, F.px);
          let s = 0;
          for (let i = 0; i < F.px.length; i += 4) s += (F.px[i] + F.px[i + 1] + F.px[i + 2]) / 3;
          const mean = s / (48 * 48);
          if (mean < 15) F.black++;
          if (mean < 45) F.dark++;
          if (F.means.length < 6000) F.means.push(Math.round(mean));
        } catch (e) { /* 샘플 실패 무시 */ }
      });
    } else {
      const cv = game.canvas;
      F.ctx = cv.getContext("2d");
      game.events.on("postrender", () => {
        F.frames++;
        F.skip = (F.skip + 1) % 2;
        if (F.skip !== 0) return;
        try {
          const d = F.ctx.getImageData(Math.floor(cv.width / 2) - 24, Math.floor(cv.height / 2) - 24, 48, 48).data;
          let s = 0;
          for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
          const mean = s / (48 * 48);
          if (mean < 15) F.black++;
          if (mean < 45) F.dark++;
          if (F.means.length < 6000) F.means.push(Math.round(mean));
        } catch (e) { /* 무시 */ }
      });
    }
  });

  // 이동 + 스킬 시뮬레이션 14초
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
  const t0 = Date.now();
  let ki = 0;
  let lastAtk = 0, lastSkill = 0, skillIdx = 0;
  const skillKeys = ["z", "c", "v"];
  while (Date.now() - t0 < 14000) {
    const hold = keys[ki % keys.length];
    ki++;
    await page.keyboard.down(hold);
    const segEnd = Date.now() + 380;
    while (Date.now() < segEnd) {
      const now = Date.now();
      if (now - lastAtk > 480) { await page.keyboard.press("x"); lastAtk = now; }
      if (now - lastSkill > 900) { await page.keyboard.press(skillKeys[skillIdx++ % 3]); lastSkill = now; }
      await page.waitForTimeout(90);
    }
    await page.keyboard.up(hold);
  }

  const stats = await page.evaluate(() => {
    const F = window.__FLICK__;
    const sc = window.__SERTZ_SCENE__;
    const cam = sc.cameras.main;
    return {
      frames: F.frames,
      black: F.black,
      dark: F.dark,
      blackPct: +(100 * F.black / Math.max(1, F.frames)).toFixed(2),
      darkPct: +(100 * F.dark / Math.max(1, F.frames)).toFixed(2),
      renderer: sc.game.renderer.type,
      fps: Math.round(sc.game.loop.actualFps),
      fxLevel: sc.fxLevel,
      fxMode: sc.fxMode,
      ambientFilters: (sc.ambientFilters ?? []).length,
      bossFilters: (sc.bossFilters ?? []).length,
      playerToon: !!sc.playerToon,
      stage: sc.stageDef?.key,
      camBg: cam.backgroundColor?.color,
      camAlpha: cam.alpha,
      fadeRunning: cam.fadeEffect?.isRunning,
      meansHead: F.means.slice(0, 60).join(","),
      meansTail: F.means.slice(-60).join(","),
    };
  });
  console.log(JSON.stringify(stats, null, 1));
  console.log("--- 관련 콘솔 로그 ---");
  logs.slice(-20).forEach((l) => console.log("  ", l));
  await browser.close();
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
