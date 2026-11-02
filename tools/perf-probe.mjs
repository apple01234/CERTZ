/**
 * vc235 — 성능 실측 하네스.
 *
 * [왜 이 파일이 있나]
 *  성능 작업의 첫 규칙은 "측정 먼저, 추측 금지"다. 그런데 지금까지 이 저장소에는
 *  실제 게임 루프를 돌려 프레임 시간을 재는 수단이 없었다. 감으로 고치면
 *  엉뚱한 곳을 손대고 오히려 복잡해진다. 이 스크립트는 헤드리스 Chromium 으로
 *  게임을 띄워 WorldScene 이 노출하는 `__SERTZ_PERF__` 를 표본 수집한다.
 *
 * [무엇을 재나]
 *  WorldScene.tickFxQuality 가 500ms 마다 갱신하는
 *   fps / avgMs / worstMs / fxLevel / enemies / remotes
 *  를 500ms 간격으로 30초간 읽어 분포(중앙값·p95·최악)를 낸다.
 *  평균만 보면 순간 끊김(스터터)을 놓치므로 p95 와 worst 를 함께 본다.
 *
 * [사용]
 *  PORT=3311 node tools/perf-probe.mjs            # 기본 30초
 *  PORT=3311 DURATION=60 node tools/perf-probe.mjs
 *  PORT=3311 SCENARIO=combat node tools/perf-probe.mjs
 *
 *  결과는 stdout(사람용) + /tmp/perf-<scenario>.json(기계용)으로 남는다.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const PORT = process.env.PORT || "3311";
const DURATION = Number(process.env.DURATION || 30);
const SCENARIO = process.env.SCENARIO || "idle";
/* ?renderer=webgl — 이 앱은 GPU 가 소프트웨어 구현이면 스스로 Canvas 로 강등한다
 * (PhaserGame.ts:138 `WorldScene.isSoftwareGL()`). 헤드리스 SwiftShader 가 정확히
 * 그 판정에 걸려 Canvas 로 떨어지고, Canvas 로는 대용량 텍스처 로드가 실패해
 * BootScene 이 교착된다. 이 쿼리는 그 강등을 푸는 공식 탈출구다(PhaserGame.ts:121). */
const BASE = `http://127.0.0.1:${PORT}/?renderer=webgl`;

/* 게임 부팅 대기 한도. 첫 로드는 에셋이 많아 오래 걸린다(실측 12~20초). */
const BOOT_TIMEOUT = 90_000;

const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))];
};
const med = (arr) => pct(arr, 0.5);

const browser = await chromium.launch({
  args: [
    /* vc235 — 헤드리스에서 WebGL 을 **실제로** 켠다.
     *  종전 조합(`--use-gl=angle --use-angle=swiftshader`)만으로는 이 컨테이너에서
     *  `canvas.getContext('webgl')` 이 null 이었고, Phaser 가 Canvas 렌더러로
     *  폴백(type=1)해 대용량 텍스처 로드가 실패 → BootScene preload 교착 → 측정 불가.
     *  `--no-sandbox` + `--ignore-gpu-blocklist` 를 더해야 WebGL 2.0 이 살아난다. */
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--disable-gpu-sandbox",
    "--no-sandbox",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

console.log(`[probe] ${BASE} 열기 (시나리오=${SCENARIO}, ${DURATION}초)`);
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });

/* 랜딩 → 게임 진입.
 *
 * [시행착오 기록 — 같은 함정을 다시 밟지 않게]
 *  이 앱의 랜딩 화면은 **DOM 이 아니라 WebGL 캔버스에 그려진다**. 그래서
 *  · `document.querySelectorAll("button")` → 0개
 *  · `innerText` 로 "게임 시작" 이 보임 → 캔버스 텍스트가 아니라 실제 DOM 텍스트
 *  즉 DOM 버튼이 없어 클릭 자동화가 불가능하다. Phaser 씬 API 를 직접 호출한다.
 *
 *  씬 키는 소문자(`boot`/`title`/`world`)이고 초기에는 셋 다 비활성이다
 *  (TitleScene 이 DOM 랜딩 버튼에서 시작되기 때문). GameRoot 의 "게임 시작"
 *  버튼이 scene.start("boot") 를 걸고, 부팅이 끝나면 title 로 넘어간다.
 */
async function enterGame() {
  const clickByText = async (re) => {
    for (const h of await page.locator("button, a, [role=button]").all()) {
      const t = ((await h.innerText().catch(() => "")) || "").trim();
      if (re.test(t)) {
        await h.click({ timeout: 3000 }).catch(() => {});
        return t;
      }
    }
    return null;
  };

  /* 1) DOM 버튼이 있으면 그걸로 */
  const btn = await clickByText(/게임 시작|게임시작|시작하기|이어하기/);
  if (btn) console.log(`[probe] DOM 버튼 클릭: "${btn}"`);

  /* 2) 씬 API 로 부팅 보장 — DOM 버튼이 없거나 못 눌렀을 때 */
  await page
    .evaluate(() => {
      const g = window.__SERTZ__?.game;
      if (!g) return;
      const active = g.scene.getScenes(true).map((x) => x.scene.key);
      if (active.length) return;
      /* boot 부터 정상 순서로 시작한다 (world 직행은 텍스처가 없어 실패) */
      g.scene.start("boot");
    })
    .catch(() => {});

  /* 3) title → world. TitleScene 이 뜨면 beginWorld 를 직접 부른다 */
  for (let i = 0; i < 40; i++) {
    const key = await page
      .evaluate(() => window.__SERTZ__?.game?.scene.getScenes(true).map((x) => x.scene.key)[0] || null)
      .catch(() => null);
    if (key === "world") break;
    if (key === "title") {
      const launched = await page
        .evaluate(() => {
          const t = window.__SERTZ__?.game.scene.getScene("title");
          if (!t) return false;
          /* TitleScene 의 진입 경로를 순서대로 시도 */
          /* 앱의 실제 신규 시작 경로와 동일하게 넘긴다("village" + fresh) */
          if (typeof t.beginWorld === "function") {
            t.beginWorld({ stage: "village", fresh: true });
            return true;
          }
          if (typeof t.startWorld === "function") { t.startWorld(); return true; }
          return false;
        })
        .catch(() => false);
      if (launched) console.log("[probe] TitleScene.beginWorld() 호출");
    }
    await page.waitForTimeout(500);
  }
}

await page.waitForTimeout(1500);
await enterGame();

/* 게임 캔버스 + WorldScene 준비 대기 */
const boot = await page
  .waitForFunction(
    () => {
      const w = window;
      /* PhaserGame 이 노출하는 실제 핸들. 종전엔 window.game 을 찾았는데
       * 이 앱은 __SERTZ__ 로 노출한다(PhaserGame.ts:347). */
      const g = w.__SERTZ__?.game || w.__SERTZ_GAME__ || w.game;
      if (!g) return false;
      const s = g.scene?.getScene?.("world");
      return !!(s && s.scene?.isActive?.() && s.enemies);
    },
    null,
    { timeout: BOOT_TIMEOUT },
  )
  .then(() => true)
  .catch((e) => {
    console.error("[probe] 부팅 실패:", String(e).slice(0, 300));
    return false;
  });

if (!boot) {
  /* 폴백 — __SERTZ_PERF__ 만이라도 뜨면 측정은 가능하다 */
  const hasPerf = await page.evaluate(() => !!window.__SERTZ_PERF__).catch(() => false);
  if (!hasPerf) {
    console.error("[probe] 게임이 뜨지 않았습니다. 화면 텍스트:");
    console.error((await page.evaluate(() => document.body.innerText.slice(0, 500))).slice(0, 600));
    await browser.close();
    process.exit(2);
  }
}

/* 전투 시나리오 — 스폰을 유도해 적 수를 올린다(있다면) */
if (SCENARIO === "combat") {
  await page.evaluate(() => {
    try {
      const g = window.__SERTZ__?.game || window.__SERTZ_GAME__ || window.game;
      const s = g.scene.getScene("World");
      /* 게임 내부 API 가 있으면 사용, 없으면 무시(측정은 계속) */
      s.spawnWave?.();
    } catch { /* 무시 */ }
  }).catch(() => {});
}

/* 표본 수집 — 500ms 마다 1개, 30초면 60개 */
const samples = [];
const t0 = Date.now();
while (Date.now() - t0 < DURATION * 1000) {
  const p = await page
    .evaluate(() => {
      const x = window.__SERTZ_PERF__;
      if (!x) return null;
      return { ...x, t: performance.now() };
    })
    .catch(() => null);
  if (p) samples.push(p);
  await page.waitForTimeout(500);
}

await browser.close();

if (!samples.length) {
  console.error("[probe] 표본 0개 — __SERTZ_PERF__ 가 갱신되지 않았습니다.");
  process.exit(3);
}

const fps = samples.map((s) => s.fps);
const avg = samples.map((s) => s.avgMs).filter((v) => Number.isFinite(v));
const worst = samples.map((s) => s.worstMs).filter((v) => Number.isFinite(v));

const out = {
  scenario: SCENARIO,
  durationS: DURATION,
  samples: samples.length,
  fps: { median: med(fps), p5: pct(fps, 0.05), min: Math.min(...fps), max: Math.max(...fps) },
  avgMs: { median: med(avg), p95: pct(avg, 0.95), max: Math.max(...avg) },
  worstMs: { median: med(worst), p95: pct(worst, 0.95), max: Math.max(...worst) },
  fxLevel: samples.at(-1)?.fxLevel,
  mode: samples.at(-1)?.mode,
  enemies: { median: med(samples.map((s) => s.enemies)) },
  remotes: { median: med(samples.map((s) => s.remotes)) },
  pageErrors: errors.slice(0, 5),
};

console.log("\n=== 측정 결과 ===");
console.log(`시나리오   : ${out.scenario} (${out.durationS}초, 표본 ${out.samples})`);
console.log(`FPS        : 중앙 ${out.fps.median} / p5 ${out.fps.p5} / 최저 ${out.fps.min} / 최고 ${out.fps.max}`);
console.log(`avgMs      : 중앙 ${out.avgMs.median} / p95 ${out.avgMs.p95} / 최악 ${out.avgMs.max}`);
console.log(`worstMs    : 중앙 ${out.worstMs.median} / p95 ${out.worstMs.p95} / 최악 ${out.worstMs.max}`);
console.log(`fxLevel    : ${out.fxLevel} (mode=${out.mode})`);
console.log(`적 수      : 중앙 ${out.enemies.median}`);
console.log(`원격 유저  : 중앙 ${out.remotes.median}`);
if (errors.length) console.log(`페이지 오류: ${errors.length}건 — ${errors[0]}`);

const path = `/tmp/perf-${SCENARIO}.json`;
writeFileSync(path, JSON.stringify({ ...out, raw: samples }, null, 2));
console.log(`\n저장: ${path}`);
