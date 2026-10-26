/**
 * tools/diag-ctxloss5.js — 남은 webgl 컨텍스트 2개가 누구 것인지 특정
 *
 * 진행 상황:
 *   · 최초: 유실 4건, webgl2 1개 + webgl 다수
 *   · isSoftwareGL 재사용화 + Vfx3D 게이트 후치 + add.shader 지연 → 유실 2건, webgl2 0개
 *   · 그래도 webgl 2개가 생성되고 둘 다 2383ms 에 LOST
 *
 * 남은 후보: Phaser 내부가 만드는 것(MultiTexture/CanvasPool/Watcher?),
 *           또는 아직 못 찾은 우리 코드.
 *
 * 이 도구는 getContext 호출 시 **스택 트레이스와 캔버스 속성**을 남겨
 * 2개가 각각 어디서 만들어지는지 확정한다.
 *
 * 사용: node tools/diag-ctxloss5.js
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
      window.__GL5__ = [];
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        const t = String(type);
        const isGL = /webgl/.test(t);
        let rec = null;
        if (isGL) {
          const st = new Error().stack || "";
          const frames = st.split("\n").slice(1, 6).map((l) => l.trim().slice(0, 110));
          rec = {
            t: Math.round(performance.now()),
            type: t,
            w: this.width,
            h: this.height,
            id: this.id || "(no-id)",
            cls: this.className || "(no-class)",
            inDom: document.body.contains(this),
            parent: this.parentElement?.tagName || "(none)",
            css: (this.style.cssText || "").slice(0, 80),
            stack: frames,
            ok: null,
          };
          window.__GL5__.push(rec);
        }
        const ctx = orig.call(this, type, ...rest);
        if (rec) {
          rec.ok = !!ctx;
          this.addEventListener("webglcontextlost", () => {
            window.__GL5__.push({ t: Math.round(performance.now()), type: t, LOST: true, id: rec.id, w: this.width, h: this.height });
          }, true);
        }
        return ctx;
      };
    });

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(8000);

    const log = await page.evaluate(() => window.__GL5__ || []);
    const domCanvases = await page.evaluate(() =>
      Array.from(document.querySelectorAll("canvas")).map((c) => ({
        id: c.id || "(no-id)",
        w: c.width,
        h: c.height,
        cls: c.className || "",
        hasGL: !!(c.getContext("webgl2") || c.getContext("webgl")),
        css: (c.style.cssText || "").slice(0, 70),
      }))
    );

    console.log("══════ webgl 컨텍스트 출처 추적 ══════\n");
    console.log(`[getContext(webgl*) 호출 ${log.filter((r) => !r.LOST).length}건]`);
    for (const r of log) {
      if (r.LOST) {
        console.log(`  ${String(r.t).padStart(6)}ms  *** LOST *** id=${r.id} ${r.w}x${r.h}`);
        continue;
      }
      console.log(`  ${String(r.t).padStart(6)}ms  ${r.type}  ${r.w}x${r.h}  id=${r.id}  ok=${r.ok}`);
      console.log(`           inDom=${r.inDom} parent=${r.parent} cls="${r.cls}"`);
      if (r.css) console.log(`           css="${r.css}"`);
      for (const f of r.stack) console.log(`           @ ${f}`);
    }

    console.log(`\n[DOM 캔버스 ${domCanvases.length}개]`);
    for (const c of domCanvases) {
      console.log(`  id=${c.id} ${c.w}x${c.h} hasGL=${c.hasGL} cls="${c.cls}"`);
      if (c.css) console.log(`     css="${c.css}"`);
    }
  } finally {
    await browser.close();
  }
})();
