/**
 * scripts/apply_webp.js — scripts/_webp/*.png.webp → public/assets/**.webp 복구 적용
 *  (1차 적용 스크립트의 경로 버그로 인한 복구 — webp 소스는 _webp에 온전 보존됨)
 */
const fs = require("node:fs");
const path = require("node:path");

const SRC = "/home/z/my-project/scripts/_webp";
const DST = "/home/z/my-project/public/assets";

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith(".png.webp")) yield p;
  }
}

let n = 0;
for (const src of walk(SRC)) {
  const rel = path.relative(SRC, src); // 예: ui2/panel.png.webp
  const target = path.join(DST, rel.replace(/\.png\.webp$/, ".webp"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(src, target);
  if (fs.statSync(target).size === 0) throw new Error("zero-byte: " + target);
  n++;
}
console.log(`${n}개 webp 적용 완료`);
