/**
 * tools/diag-ctxloss3.js — 컨텍스트 개수 한도 가설 검증
 *
 * diag-ctxloss2 결정적 단서:
 *   152ms getContext(webgl)  NULL
 *   153ms getContext(experimental-webgl) NULL
 *   192ms getContext(webgl2) NULL          ← 게임 자체가 컨텍스트를 못 얻음
 *   1.2s  Phaser v4.2.1 (WebGL | Web Audio) ← 그런데 WebGL 로 시작
 *   1.4s  WebGL Context lost. Renderer disabled
 *   그리고 유실 횟수는 모든 시나리오에서 **정확히 4건**.
 *
 * 가설: SwiftShader 백엔드에서 동시 WebGL 컨텍스트 개수 상한이 낮고,
 *       그 상한에 도달하면 chromium 이 오래된 컨텍스트를 강제로 파괴한다
 *       (그래서 개수가 아니라 "상한"이 원인 → 횟수가 일정).
 *
 * 검증: 빈 페이지에서 webgl2 컨텍스트를 N개 만들어 몇 개째에서 NULL 이 되는지 센다.
 *       그리고 SERTZ 페이지 진행 중 컨텍스트를 하나 더 요청해 즉시 파괴되는지 본다.
 *
 * 사용: node tools/diag-ctxloss3.js
 */
const { chromium } = require("playwright");

const BASE = process.env.SERTZ_BASE || "http://127.0.0.1:3000";
const ARGS = [
  "--no-sandbox",
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
];

(async () => {
  /* ── 1부: 빈 페이지에서 컨텍스트 상한 측정 ── */
  {
    const browser = await chromium.launch({ args: ARGS });
    try {
      const page = await browser.newPage();
      const r = await page.evaluate(() => {
        const made = [];
        const canvases = [];
        for (let i = 0; i < 24; i++) {
          const c = document.createElement("canvas");
          c.width = 256;
          c.height = 256;
          document.body.appendChild(c);
          canvases.push(c);
          const gl = c.getContext("webgl2");
          made.push(gl ? "OK" : "NULL");
          if (!gl && made.filter((x) => x === "OK").length === 0) made[i] = "NULL(first)";
        }
        const okCount = made.filter((x) => x.startsWith("OK")).length;
        return { made, okCount, total: made.length };
      });
      console.log("── 1부: 빈 페이지 컨텍스트 상한 ──");
      console.log(`  생성 시도 24개 중 성공 ${r.okCount}개`);
      console.log(`  패턴: ${r.made.join(",")}`);
      console.log(`  → 상한 ${r.okCount}개 (이 이상은 NULL)`);
    } finally {
      await browser.close();
    }
  }

  /* ── 2부: SERTZ 진행 중 추가 컨텍스트 요청 → 게임 컨텍스트가 죽는가 ── */
  {
    const browser = await chromium.launch({ args: ARGS });
    try {
      const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
      await page.addInitScript(() => {
        window.__CTX2__ = [];
        const origGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
          const ctx = origGetContext.call(this, type, ...rest);
          window.__CTX2__.push({ t: Math.round(performance.now()), type, ok: !!ctx, marked: this.__probe || false });
          return ctx;
        };
      });
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll("button")).some((b) => /게임 시작/.test(b.textContent || "")),
        { timeout: 120000 }
      );
      const { enterWorld } = require("../tests/smoke/lib");
      await enterWorld(page, "CTXLOSS3");
      await page.waitForTimeout(3000);

      const before = await page.evaluate(() => {
        const g = window.__SERTZ_DEBUG__?.game;
        return { type: g?.renderer?.type, ctxReqs: (window.__CTX2__ || []).length };
      });

      /* 게임이 WebGL2 컨텍스트를 쓰고 있을 때 추가로 1개 요청 */
      const after = await page.evaluate(() => {
        const c = document.createElement("canvas");
        c.__probe = true;
        c.width = 128;
        c.height = 128;
        document.body.appendChild(c);
        const gl = c.getContext("webgl2");
        const g = window.__SERTZ_DEBUG__?.game;
        return { extraOk: !!gl, typeAfter: g?.renderer?.type };
      });
      await page.waitForTimeout(2500);
      const later = await page.evaluate(() => {
        const g = window.__SERTZ_DEBUG__?.game;
        return { typeLater: g?.renderer?.type, ctx2: (window.__CTX2__ || []).slice(-8) };
      });

      console.log("\n── 2부: 게임 중 추가 컨텍스트 요청 ──");
      console.log(`  요청 전 렌더러: type=${before.type} (getContext 호출 ${before.ctxReqs}회)`);
      console.log(`  추가 요청 성공: ${after.extraOk} / 직후 렌더러: type=${after.typeAfter}`);
      console.log(`  2.5초 후 렌더러: type=${later.typeLater}`);
      console.log(`  최근 getContext 기록: ${JSON.stringify(later.ctx2)}`);
      const verdict =
        after.typeAfter !== before.type || later.typeLater !== before.type
          ? "→ 추가 컨텍스트 요청이 게임 컨텍스트를 죽였다 (상한 초과 = 원인)"
          : "→ 추가 요청이 게임을 죽이지 않았다 (상한 초과 가설 기각)";
      console.log(`  ${verdict}`);
    } finally {
      await browser.close();
    }
  }
})();
