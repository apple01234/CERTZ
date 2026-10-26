/**
 * tools/diag-ctxloss2.js — 컨텍스트 유실의 정체 규명 (2차)
 *
 * 1차(diag-ctxloss) 결과: 4개 시나리오 전부 **정확히 4건**, 전부 CANVAS 폴백.
 *   원인이 셰이더/블룸/조명이 아니다 → 공통 경로에 있다.
 *   로그 문구가 `loseContext: context lost` 인데 우리 코드엔 loseContext 호출이 없다.
 *
 * 이 도구가 밝힐 것:
 *   ① 몇 초에 유실되는가 (타이밍 → 특정 단계 지목)
 *   ② 우리 코드인가 chromium 인가 (스택/이벤트 순서)
 *   ③ Canvas 폴백 시점이 유실 시점과 같은가 (폴백이 유실의 원인인가 결과인가)
 *   ④ 유실 전 마지막 동작이 무엇인가
 *
 * 사용: node tools/diag-ctxloss2.js
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
  const browser = await chromium.launch({ args: ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
    const t0 = Date.now();
    const mark = () => ((Date.now() - t0) / 1000).toFixed(1) + "s";
    const timeline = [];

    /* 브라우저 콘솔 전부 수집 (레벨 무관) */
    page.on("console", (m) => timeline.push(`[${mark()}] console.${m.type()}: ${m.text().slice(0, 150)}`));
    page.on("pageerror", (e) => timeline.push(`[${mark()}] pageerror: ${String(e).slice(0, 150)}`));

    /* 캔버스에 직접 리스너를 걸어 이벤트 순서를 포착한다.
     *  addInitScript 로 페이지 스크립트보다 먼저 심어야 놓치지 않는다. */
    await page.addInitScript(() => {
      window.__CTXLOG__ = [];
      const t0 = performance.now();
      const push = (s) => window.__CTXLOG__.push({ t: Math.round(performance.now() - t0), s });
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        const ctx = origGetContext.call(this, type, ...rest);
        if (ctx && /webgl/i.test(type) && !this.__hooked) {
          this.__hooked = true;
          push(`getContext(${type}) OK`);
          this.addEventListener("webglcontextlost", () => push("EVENT webglcontextlost"), true);
          this.addEventListener("webglcontextrestored", () => push("EVENT webglcontextrestored"), true);
          this.addEventListener("webglcontextcreationerror", (e) => push("EVENT creationerror: " + (e.statusMessage || "")), true);
        } else if (!ctx && /webgl/i.test(type)) {
          push(`getContext(${type}) NULL`);
        }
        return ctx;
      };
      /* loseContext 를 누가 부르는지 추적 */
      const origGetExt = WebGLRenderingContext.prototype.getExtension;
      WebGLRenderingContext.prototype.getExtension = function (name) {
        const ext = origGetExt.call(this, name);
        if (name === "WEBGL_lose_context" && ext && !ext.__wrapped) {
          ext.__wrapped = true;
          for (const fn of ["loseContext", "restoreContext"]) {
            const o = ext[fn];
            if (typeof o === "function") {
              ext[fn] = function (...a) {
                push(`CALL WEBGL_lose_context.${fn} from: ${new Error().stack?.split("\n")[2]?.trim() || "?"}`);
                return o.apply(ext, a);
              };
            }
          }
        }
        return ext;
      };
      const origGetExt2 = self.WebGL2RenderingContext?.prototype?.getExtension;
      if (origGetExt2) {
        self.WebGL2RenderingContext.prototype.getExtension = function (name) {
          const ext = origGetExt2.call(this, name);
          if (name === "WEBGL_lose_context" && ext && !ext.__wrapped) {
            ext.__wrapped = true;
            for (const fn of ["loseContext", "restoreContext"]) {
              const o = ext[fn];
              if (typeof o === "function") {
                ext[fn] = function (...a) {
                  push(`CALL WEBGL2 lose_context.${fn} from: ${new Error().stack?.split("\n")[2]?.trim() || "?"}`);
                  return o.apply(ext, a);
                };
              }
            }
          }
          return ext;
        };
      }
    });

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll("button")).some((b) => /게임 시작/.test(b.textContent || "")),
      { timeout: 120000 }
    );
    const { enterWorld } = require("../tests/smoke/lib");
    await enterWorld(page, "CTXLOSS2");

    /* 20초 관찰하며 렌더러 타입 변화를 1초 간격으로 샘플 */
    const samples = [];
    for (let i = 0; i < 20; i++) {
      const s = await page.evaluate(() => {
        const g = window.__SERTZ_DEBUG__?.game;
        const sc = g?.scene?.getScenes(true)?.find((x) => x && x.player);
        return {
          type: g?.renderer?.type ?? null,
          frame: g?.loop?.frame ?? null,
          fxMode: sc?.fxMode ?? null,
          fxLevel: sc?.fxLevel ?? null,
          stage: sc?.stageDef?.key ?? null,
          ctxLog: (window.__CTXLOG__ || []).slice(-6),
        };
      });
      samples.push({ sec: i, type: s.type, frame: s.frame, fx: `${s.fxMode}/${s.fxLevel}`, stage: s.stage, n: s.ctxLog.length });
      await page.waitForTimeout(1000);
    }

    const ctxLog = await page.evaluate(() => window.__CTXLOG__ || []);

    console.log("══════ 컨텍스트 유실 정밀 진단 ══════\n");

    console.log("[캔버스 컨텍스트 이벤트 타임라인]");
    if (ctxLog.length === 0) console.log("  (이벤트 없음 — 유실이 캔버스 이벤트로 잡히지 않음)");
    for (const e of ctxLog) console.log(`  ${String(e.t).padStart(6)}ms  ${e.s}`);

    console.log("\n[렌더러 타입 변화 (1초 샘플)]");
    let prev = null;
    for (const s of samples) {
      const name = s.type === 2 ? "WEBGL" : s.type === 1 ? "CANVAS" : String(s.type);
      if (name !== prev) console.log(`  ${s.sec}s → renderer=${name}  (frame=${s.frame}, fx=${s.fx}, stage=${s.stage})`);
      prev = name;
    }

    console.log("\n[콘솔 타임라인 — 유실 관련]");
    for (const l of timeline.filter((x) => /context|webgl|shader|gpu|renderer|폴백|손실/i.test(x))) {
      console.log("  " + l);
    }
    console.log(`\n[전체 콘솔 ${timeline.length}줄 중 유실 관련만 표시]`);
  } finally {
    await browser.close();
  }
})();
