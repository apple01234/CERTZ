/**
 * tools/probe-webgl.js — 이 컨테이너에서 WebGL 이 실제로 켜지는지 판정
 *
 * 배경: 그동안 "컨테이너는 WebGL 불가"라고 보고했는데, 실은 테스트 런치 플래그가
 *       --disable-gpu 였다. 그 플래그는 GPU 프로세스 자체를 죽여 WebGL 을 봉인한다.
 *       Mesa 22.3.6 + SwiftShader(libvk_swiftshader.so) 가 이미 설치돼 있으므로
 *       플래그만 바꾸면 소프트웨어 렌더링으로 돌아갈 가능성이 높다.
 *
 * 각 조합을 실제로 브라우저에 물어보고 판정한다(추측 없음).
 *
 * 사용: node tools/probe-webgl.js
 */
const { chromium } = require("playwright");

const CASES = [
  { name: "A. 현재 플래그(--disable-gpu)", args: ["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader"] },
  { name: "B. --disable-gpu 제거", args: ["--no-sandbox", "--use-gl=swiftshader"] },
  {
    name: "C. angle+swiftshader (권장 조합)",
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
    ],
  },
  {
    name: "D. egl(네이티브 Mesa llvmpipe)",
    args: ["--no-sandbox", "--use-gl=egl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
  },
  { name: "E. 플래그 없음", args: ["--no-sandbox"] },
];

(async () => {
  for (const c of CASES) {
    let browser;
    const out = { case: c.name, ok: false };
    try {
      browser = await chromium.launch({ args: c.args });
      const page = await browser.newPage();
      const r = await page.evaluate(() => {
        const c = document.createElement("canvas");
        const gl2 = c.getContext("webgl2");
        const gl1 = c.getContext("webgl") || c.getContext("experimental-webgl");
        const gl = gl2 || gl1;
        let renderer = "", vendor = "";
        if (gl) {
          const ext = gl.getExtension("WEBGL_debug_renderer_info");
          if (ext) {
            renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "";
            vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || "";
          }
          renderer = renderer || gl.getParameter(gl.RENDERER) || "";
          vendor = vendor || gl.getParameter(gl.VENDOR) || "";
        }
        return { webgl1: !!gl1, webgl2: !!gl2, renderer, vendor };
      });
      out.ok = r.webgl1 || r.webgl2;
      out.webgl1 = r.webgl1;
      out.webgl2 = r.webgl2;
      out.renderer = r.renderer;
      out.vendor = r.vendor;
    } catch (e) {
      out.error = String(e).slice(0, 120);
    } finally {
      if (browser) await browser.close();
    }
    const mark = out.ok ? "✅" : "❌";
    console.log(`${mark} ${out.case}`);
    console.log(`   webgl1=${out.webgl1} webgl2=${out.webgl2}`);
    if (out.renderer) console.log(`   renderer=${out.renderer}`);
    if (out.vendor) console.log(`   vendor=${out.vendor}`);
    if (out.error) console.log(`   error=${out.error}`);
  }
})();
