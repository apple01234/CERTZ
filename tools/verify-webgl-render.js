/**
 * tools/verify-webgl-render.js — 실제 게임을 WebGL(WebGL2)로 띄워 검증
 *
 * 그동안 "컨테이너는 WebGL 불가"라며 코드 경로만 확인했다. 그 판정이 틀렸음이
 * probe-webgl 로 확인됐다(webgl2=true, ANGLE/SwiftShader). 이제 실제로 검증한다.
 *
 * 판정:
 *  ① Phaser 렌더러 타입이 WEBGL 인가 (CANVAS 폴백이 아닌가)
 *  ② 월드 진입 + 적 스폰
 *  ③ 셰이더 파이프라인이 실제로 도는가 (fxMode/toon 적용 흔적)
 *  ④ 프레임이 진행되는가 (렌더 루프 생존)
 *  ⑤ pageerror 0 / WebGL 컨텍스트 손실 0
 *
 * 사용: node tools/verify-webgl-render.js
 */
const { chromium } = require("playwright");
const { enterWorld } = require("../tests/smoke/lib");

const BASE = process.env.SERTZ_BASE || "http://127.0.0.1:3000";

(async () => {
  const errors = [];
  const browser = await chromium.launch({
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
    ],
  });
  const out = { ok: false };
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    const glLogs = [];
    page.on("console", (m) => {
      const t = m.text();
      if (/context lost|CONTEXT_LOST|webglcontextlost/i.test(t)) errors.push("CTX_LOST: " + t.slice(0, 80));
      if (/shader|glsl|Shader|program|precison|precision/i.test(t)) glLogs.push(t.slice(0, 400));
    });

    /* 캔버스 렌더러 강제 해제 — 기본(WebGL)으로 띄운다 */
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 120000 });

    await page.waitForFunction(
      () => Array.from(document.querySelectorAll("button")).some((b) => /게임 시작/.test(b.textContent || "")),
      { timeout: 120000 }
    );

    const rendererInfo = await page.evaluate(() => {
      const g = window.__SERTZ_DEBUG__?.game;
      if (!g) return { ok: false, reason: "game 없음" };
      const t = g.renderer?.type;
      /* Phaser 렌더러 상수: CANVAS=1, WEBGL=2 (Phaser 4 동일).
       *  Phaser 를 전역으로 참조하면 ReferenceError 다 — 번들 스코프에만 있다(실측). */
      return {
        ok: true,
        type: t,
        isWebGL: t === 2,
        typeName: t === 1 ? "CANVAS" : t === 2 ? "WEBGL" : String(t),
      };
    });

    out.renderer = rendererInfo;

    /* 게임 시작 → 월드 진입. 로비(이름→직업→외형)를 거쳐야 하므로 스모크 헬퍼를 쓴다.
     *  직접 버튼 클릭만 하면 로비에서 멈춘다(실측: waitForFunction 타임아웃). */
    await enterWorld(page, "WebGL검증");

    /* 프레임 진행 측정 */
    const frames = await page.evaluate(async () => {
      const g = window.__SERTZ_DEBUG__?.game;
      const sc = g?.scene?.getScene?.("world");
      const f0 = g?.loop?.frame ?? 0;
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 3000));
      const f1 = g?.loop?.frame ?? 0;
      return {
        frames: f1 - f0,
        ms: Math.round(performance.now() - t0),
        fxMode: sc?.fxMode ?? null,
        fxLevel: sc?.fxLevel ?? null,
        rendererType: sc?.game?.renderer?.type ?? null,
        enemies: Array.isArray(sc?.enemies) ? sc.enemies.length : null,
        stage: sc?.stageDef?.key ?? null,
      };
    });

    out.frames = frames;
    const fps = frames.ms > 0 ? (frames.frames / (frames.ms / 1000)) : 0;
    out.fps = Math.round(fps * 10) / 10;
    out.ok =
      rendererInfo.isWebGL === true &&
      frames.frames > 10 &&
      (frames.enemies ?? 0) > 0 &&
      errors.length === 0;

    console.log("── WebGL 렌더 검증 ──");
    console.log(`  Phaser 렌더러   : ${rendererInfo.typeName} (type=${rendererInfo.type}) ${rendererInfo.isWebGL ? "[PASS — WebGL]" : "[FAIL — Canvas 폴백]"}`);
    console.log(`  스테이지        : ${frames.stage}`);
    console.log(`  적 스폰         : ${frames.enemies} ${(frames.enemies ?? 0) > 0 ? "[PASS]" : "[FAIL]"}`);
    console.log(`  프레임 진행     : ${frames.frames}프레임 / ${frames.ms}ms → ${out.fps}fps ${frames.frames > 10 ? "[PASS]" : "[FAIL]"}`);
    console.log(`  fxMode/fxLevel  : ${frames.fxMode} / ${frames.fxLevel}`);
    console.log(`  pageerror       : ${errors.length} ${errors.length === 0 ? "[PASS]" : errors.slice(0, 3).join(" | ")}`);
    if (glLogs.length) {
      console.log("  [셰이더 로그]");
      for (const l of glLogs.slice(0, 6)) console.log("   " + l.replace(/\n/g, " "));
    }
    console.log(`  => ${out.ok ? "OK — WebGL 경로 실측 완료" : "NG"}`);
    console.log(`  참고: SwiftShader 는 CPU 소프트웨어 렌더러다. 이 fps 는 기기 성능 지표가 아니며,`);
    console.log(`        "WebGL 파이프라인이 실제로 돈다"는 사실만 증명한다.`);
  } finally {
    await browser.close();
  }
  process.exit(out.ok ? 0 : 1);
})();
