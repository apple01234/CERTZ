/**
 * scripts/optimize_webp.js — v4.1.6 성능 최적화 Phase 2 (보고서 3.2 개선안 ③)
 *  - public/assets 하위 PNG → WebP 일괄 변환 (루트 + skillicon/ + ui2/)
 *  - 무손실 우선, 무손실이 PNG보다 크면 lossy q95, 그래도 크면 PNG 유지(경고)
 *  - 변환 성공분은 원본 PNG 삭제 (APK/웹 모두 절감)
 *  - 결과 매니페스트: scripts/_webp/manifest.json (kept/converted 목록)
 */
const sharp = require("sharp");
const fs = require("node:fs");
const path = require("node:path");

const ASSETS = "/home/z/my-project/public/assets";
const OUTDIR = "/home/z/my-project/scripts/_webp";
fs.mkdirSync(OUTDIR, { recursive: true });

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "audio") yield* walk(p); }
    else if (e.name.toLowerCase().endsWith(".png")) yield p;
  }
}

(async () => {
  const manifest = { converted: [], kept: [] };
  let ob = 0, oa = 0;
  const files = [...walk(ASSETS)];
  for (const p of files) {
    const rel = path.relative(ASSETS, p);
    const out = path.join(OUTDIR, rel + ".webp");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const pngSize = fs.statSync(p).size;
    try {
      // 1) 무손실
      await sharp(p, { limitInputPixels: false }).webp({ lossless: true, effort: 4 }).toFile(out);
      if (fs.statSync(out).size >= pngSize) {
        // 2) lossy q95 (픽셀아트 육안 동등)
        await sharp(p, { limitInputPixels: false }).webp({ quality: 95, effort: 4 }).toFile(out);
      }
      const webpSize = fs.statSync(out).size;
      if (webpSize < pngSize) {
        manifest.converted.push({ rel, pngSize, webpSize });
        ob += pngSize; oa += webpSize;
      } else {
        manifest.kept.push({ rel, pngSize, webpSize });
        fs.removeSync ? fs.removeSync(out) : fs.rmSync(out);
      }
    } catch (e) {
      manifest.kept.push({ rel, pngSize, webpSize: -1, err: String(e).slice(0, 120) });
      if (fs.existsSync(out)) fs.rmSync(out);
    }
  }
  fs.writeFileSync(path.join(OUTDIR, "manifest.json"), JSON.stringify(manifest, null, 1));
  console.log(`변환 ${manifest.converted.length}개 / 유지 ${manifest.kept.length}개`);
  console.log(`PNG ${(ob / 1048576).toFixed(2)}MB -> WebP ${(oa / 1048576).toFixed(2)}MB (-${100 - Math.round((oa / ob) * 100)}%)`);
  if (manifest.kept.length) console.log("유지(변환실패/이득없음):", manifest.kept.map(k => k.rel).join(", "));
})();
