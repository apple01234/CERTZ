// vc178 — 발열/멈춤 실측: 프레임 타임 분포 + 스파이크(멈춤) 검출 + 오브젝트/이미터 수
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch(["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader"].length ? { args: ["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader"] } : {});
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("http://127.0.0.1:3000/?renderer=canvas", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(15000);

  const btn = async (src) => page.evaluate((s) => {
    const rx = new RegExp(s);
    const b = Array.from(document.querySelectorAll("button")).find((x) => rx.test(x.textContent || ""));
    if (b) { b.click(); return true; }
    return false;
  }, src.source);

  await btn(/게임 시작/);
  await page.waitForTimeout(2200);
  let started = await btn(/이 캐릭터로 시작/);
  if (!started) {
    await btn(/캐릭터 생성/);
    await page.waitForTimeout(1300);
    const inp = await page.$("input[placeholder*='캐릭터 이름']");
    if (inp) await inp.fill("성능검증");
    await page.waitForTimeout(800);
    await btn(/^다음/);
    await page.waitForTimeout(1100);
    await btn(/모험가로 생성/);
    await page.waitForTimeout(3000);
    started = await btn(/이 캐릭터로 시작/);
  }
  await page.waitForTimeout(16000);

  // 프레임 타임 12초 수집 (월드에서)
  const perf = await page.evaluate(async () => {
    const D = window.__SERTZ_DEBUG__;
    const scene = D?.game?.scene.getScenes(true).find((s) => s && s.player);
    if (!scene) return { ok: false };

    const game = D.game;
    const deltas = [];
    let last = performance.now();
    const t0 = performance.now();
    await new Promise((res) => {
      const tick = () => {
        const now = performance.now();
        deltas.push(now - last);
        last = now;
        if (now - t0 > 12000) return res();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    deltas.sort((a, b) => a - b);
    const p = (q) => deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * q))];
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    // 100ms 초과 = 체감 멈춤
    const spikes = deltas.filter((d) => d > 100);

    // 씬 오브젝트 통계
    let total = 0, sprites = 0, images = 0, texts = 0, particles = 0, graphics = 0;
    const list = scene.children?.list ?? [];
    for (const o of list) {
      total++;
      const t = o.type;
      if (t === "Sprite") sprites++;
      else if (t === "Image") images++;
      else if (t === "Text") texts++;
      else if (t === "ParticleEmitter" || o.particleEmitter) particles++;
      else if (t === "Graphics") graphics++;
    }
    // 활성 트윈 수
    const tweens = scene.tweens?.getTweens?.().length ?? null;
    // fxLevel / fps
    const fps = game.loop?.actualFps ?? null;

    return {
      ok: true,
      frames: deltas.length,
      fps_measured: +(1000 / mean).toFixed(1),
      mean_ms: +mean.toFixed(2),
      p50: +p(0.5).toFixed(2), p95: +p(0.95).toFixed(2), p99: +p(0.99).toFixed(2),
      max_ms: +deltas[deltas.length - 1].toFixed(2),
      spikes_over_100ms: spikes.length,
      spike_ms_list: spikes.slice(0, 10).map((d) => +d.toFixed(0)),
      scene_objects: { total, sprites, images, texts, particles, graphics },
      tweens_active: tweens,
      fps_engine: fps ? +fps.toFixed(1) : null,
      fxLevel: scene.fxLevel,
      stage: scene.stageDef?.key,
    };
  });

  console.log(JSON.stringify(perf, null, 2));
  console.log("ERRORS", errors.length, errors.slice(0, 3));
  await browser.close();
})();
