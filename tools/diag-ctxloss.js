/**
 * tools/diag-ctxloss.js — WebGL 컨텍스트 유실 원인 격리
 *
 * 배경: verify-webgl-render 에서 WEBGL 렌더러로 60fps 까지 갔지만 CTX_LOST 가 4건 났다.
 *       1차 실행에서는 "Vertex Shader failed" 후 Canvas 폴백이었다 — 즉 간헐적이다.
 *       원인 후보를 하나씩 켜고 꺼서 특정한다.
 *
 * 후보:
 *  A. 커스텀 Shader GameObject 3종 (SlashArcFX / ShockwaveFX / PortalFX — scene.add.shader)
 *  B. 툰 파이프라인 (toonCamFilters / applyToonStyle)
 *  C. 앰비언트 블룸 (ambientFilters)
 *  D. 동적 조명 (bossLight / lighting)
 *  E. 그냥 지속 실행 중 발생 (특정 기능 무관)
 *
 * 방법: 각 후보를 비활성화한 상태로 부팅→월드 진입→15초 관찰, CTX_LOST 횟수 비교.
 *       그리고 각 Shader GameObject 를 하나씩 생성해 어느 것이 터지는지 본다.
 *
 * 사용: node tools/diag-ctxloss.js
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

/** 씬을 띄우고 월드까지 진입시킨 뒤, 지정 시간 동안 CTX_LOST 를 센다 */
async function run(label, setupFn, observeMs = 15000) {
  const browser = await chromium.launch({ args: ARGS });
  const ctxLost = [];
  const shaderErr = [];
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
    page.on("console", (m) => {
      const t = m.text();
      if (/context lost|CONTEXT_LOST/i.test(t)) ctxLost.push(t.slice(0, 100));
      if (/shader|glsl|program/i.test(t)) shaderErr.push(t.slice(0, 300));
    });
    page.on("pageerror", (e) => {
      const t = String(e);
      if (/shader|webgl|context/i.test(t)) shaderErr.push(t.slice(0, 300));
    });

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll("button")).some((b) => /게임 시작/.test(b.textContent || "")),
      { timeout: 120000 }
    );
    const { enterWorld } = require("../tests/smoke/lib");
    await enterWorld(page, label);

    if (setupFn) {
      const r = await page.evaluate(setupFn);
      if (r) console.log(`   setup: ${JSON.stringify(r)}`);
    }

    await page.waitForTimeout(observeMs);

    const state = await page.evaluate(() => {
      const g = window.__SERTZ_DEBUG__?.game;
      return {
        rendererType: g?.renderer?.type ?? null,
        frames: g?.loop?.frame ?? null,
      };
    });

    return {
      label,
      ctxLost: ctxLost.length,
      shaderErr: shaderErr.length,
      rendererType: state.rendererType,
      rendererName: state.rendererType === 2 ? "WEBGL" : state.rendererType === 1 ? "CANVAS" : String(state.rendererType),
      sampleCtx: ctxLost.slice(0, 2),
      sampleShader: shaderErr.slice(0, 2),
    };
  } finally {
    await browser.close();
  }
}

(async () => {
  const results = [];

  /* S0 — 기준선: 아무것도 안 건드림 */
  results.push(await run("S0 기준선(무개입)", null));

  /* S1 — 툰 필터 제거 */
  results.push(
    await run("S1 툰필터 제거", () => {
      const g = window.__SERTZ_DEBUG__?.game;
      const sc = g?.scene?.getScenes(true)?.find((s) => s && s.player);
      if (!sc) return { ok: false };
      try {
        sc.fxMode = "low";
        sc.applyFxMode?.();
        return { ok: true, fxMode: sc.fxMode, fxLevel: sc.fxLevel };
      } catch (e) {
        return { ok: false, err: String(e).slice(0, 80) };
      }
    })
  );

  /* S2 — 커스텀 셰이더를 하나씩 생성해 어느 것이 터지는지 */
  results.push(
    await run("S2 셰이더3종 순차생성", async () => {
      const g = window.__SERTZ_DEBUG__?.game;
      const sc = g?.scene?.getScenes(true)?.find((s) => s && s.player);
      if (!sc) return { ok: false };
      const FRAGS = {
        shock: ["precision mediump float;", "varying vec2 outTexCoord;", "uniform float uAlpha;", "void main(){ gl_FragColor = vec4(1.0,1.0,1.0,uAlpha); }"],
        slash: ["precision mediump float;", "varying vec2 outTexCoord;", "void main(){ gl_FragColor = vec4(1.0,0.5,0.2,1.0); }"],
        portal: ["precision mediump float;", "varying vec2 outTexCoord;", "void main(){ gl_FragColor = vec4(0.2,0.5,1.0,1.0); }"],
      };
      const out = {};
      for (const [k, frag] of Object.entries(FRAGS)) {
        try {
          const obj = sc.add.shader(frag, { shaderName: `diag_${k}` }, 400, 300);
          out[k] = obj ? "created" : "null";
          await new Promise((r) => setTimeout(r, 800));
          obj?.destroy();
        } catch (e) {
          out[k] = "ERR:" + String(e).slice(0, 90);
        }
      }
      return out;
    })
  );

  /* S3 — 블룸/조명 끄기 */
  results.push(
    await run("S3 블룸·조명 제거", () => {
      const g = window.__SERTZ_DEBUG__?.game;
      const sc = g?.scene?.getScenes(true)?.find((s) => s && s.player);
      if (!sc) return { ok: false };
      const r = { cam: false, ambient: false, bossLight: false };
      try {
        sc.cameras.main.clearRenderToTexture?.();
        sc.cameras.main.postPipelines?.length && sc.cameras.main.resetPostPipeline?.();
        r.cam = true;
      } catch { /* 무시 */ }
      try {
        (sc.ambientFilters ?? []).forEach((f) => { try { f?.destroy?.(); } catch { /* */ } });
        sc.ambientFilters = [];
        r.ambient = true;
      } catch { /* 무시 */ }
      try {
        sc.bossLight?.destroy?.();
        sc.bossLight = null;
        r.bossLight = true;
      } catch { /* 무시 */ }
      return r;
    })
  );

  console.log("\n══════ 컨텍스트 유실 격리 결과 ══════");
  for (const r of results) {
    console.log(`\n▸ ${r.label}`);
    console.log(`   renderer: ${r.rendererName}`);
    console.log(`   CTX_LOST: ${r.ctxLost}건 / 셰이더오류: ${r.shaderErr}건`);
    if (r.sampleCtx?.length) console.log(`   예시: ${r.sampleCtx[0]}`);
    if (r.sampleShader?.length) console.log(`   셰이더: ${r.sampleShader[0]}`);
  }
})();
