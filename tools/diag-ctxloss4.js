/**
 * tools/diag-ctxloss4.js — WebGL 이 왜 NULL 인가: 실제 statusMessage 확인
 *
 * 지금까지:
 *   · 빈 페이지: webgl2 24개까지 OK (상한 문제 아님)
 *   · SERTZ 페이지: 152ms 부터 getContext(webgl/webgl2) 전부 NULL
 *   · 그래도 Phaser 는 "WebGL | Web Audio" 로 부팅 → 1.4s 에 즉시 lost
 *   · getContext 호출 628회 (대부분 2d)
 *
 * 남은 가설:
 *   A. 부팅 초기에 우리 코드가 캔버스/컨텍스트를 대량 생성해 GPU 프로세스를 압박
 *   B. chromium GPU 프로세스가 시작 직후 죽는다 (software GL 초기화 실패)
 *   C. webglcontextcreationerror 의 statusMessage 에 진짜 이유가 있다
 *
 * 이 도구는 A/B/C 를 가른다. 특히 ③ creationerror 메시지가 결정적이다.
 *
 * 사용: node tools/diag-ctxloss4.js
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

    await page.addInitScript(() => {
      window.__GL__ = { creationErrors: [], ctxLog: [], calls: { webgl: 0, webgl2: 0, d2: 0 } };
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        const t = String(type);
        if (t === "2d") window.__GL__.calls.d2++;
        else if (t === "webgl2") window.__GL__.calls.webgl2++;
        else if (/webgl/.test(t)) window.__GL__.calls.webgl++;

        /* creationerror 는 getContext 호출 전에 걸어야 잡힌다 */
        const onErr = (e) => {
          window.__GL__.creationErrors.push({
            t: Math.round(performance.now()),
            type: t,
            msg: (e && e.statusMessage) || "(no statusMessage)",
          });
        };
        this.addEventListener("webglcontextcreationerror", onErr, { once: true });
        const ctx = orig.call(this, type, ...rest);
        if (!ctx && /webgl/.test(t)) {
          window.__GL__.ctxLog.push({ t: Math.round(performance.now()), type: t, ok: false });
        } else if (ctx && /webgl/.test(t)) {
          window.__GL__.ctxLog.push({ t: Math.round(performance.now()), type: t, ok: true });
          this.addEventListener("webglcontextlost", () => {
            window.__GL__.ctxLog.push({ t: Math.round(performance.now()), type: t, lost: true });
          }, true);
        }
        return ctx;
      };
    });

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(6000);

    const g1 = await page.evaluate(() => ({
      creationErrors: window.__GL__.creationErrors.slice(0, 6),
      ctxLog: window.__GL__.ctxLog.slice(0, 10),
      calls: window.__GL__.calls,
      rendererType: window.__SERTZ_DEBUG__?.game?.renderer?.type ?? null,
    }));

    console.log("══════ WebGL NULL 원인 진단 ══════\n");
    console.log("[① webglcontextcreationerror — 진짜 이유]");
    if (g1.creationErrors.length === 0) console.log("  (없음 — creationerror 이벤트가 발생하지 않았다)");
    for (const e of g1.creationErrors) console.log(`  ${e.t}ms  ${e.type}: ${e.msg}`);

    console.log("\n[② 컨텍스트 요청/유실 순서]");
    for (const e of g1.ctxLog) {
      console.log(`  ${String(e.t).padStart(6)}ms  ${e.type}  ${e.ok === true ? "OK" : e.ok === false ? "NULL" : ""}${e.lost ? " ← LOST" : ""}`);
    }

    console.log("\n[③ getContext 호출 횟수]");
    console.log(`  webgl: ${g1.calls.webgl}  webgl2: ${g1.calls.webgl2}  2d: ${g1.calls.d2}`);
    console.log(`  Phaser 렌더러: ${g1.rendererType === 2 ? "WEBGL" : g1.rendererType === 1 ? "CANVAS" : String(g1.rendererType)}`);

    /* ④ 지금 이 순간 새 컨텍스트가 되는가 (부팅 후 안정화 시점) */
    const now = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 64;
      let msg = "";
      c.addEventListener("webglcontextcreationerror", (e) => (msg = e.statusMessage || ""));
      const gl = c.getContext("webgl2");
      return { ok: !!gl, msg };
    });
    console.log("\n[④ 부팅 안정화 후 새 webgl2 요청]");
    console.log(`  결과: ${now.ok ? "OK" : "NULL"}  ${now.msg ? "msg=" + now.msg : ""}`);
    console.log(
      `  해석: ${now.ok ? "컨텍스트는 정상 생성된다 → 게임 부팅 초기의 대량 요청이 원인" : "지금도 실패 → GPU 프로세스 자체가 비활성"}
`
    );

    console.log("\n[전체 6초간 creationErrors 총 " + g1.creationErrors.length + "건]");
  } finally {
    await browser.close();
  }
})();
