/* SERTZ 런처 아이콘 생성 — public/logo.svg → mipmap PNG (sharp) */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const RES = "/home/z/my-project/android/app/src/main/res";
const SVG = "/home/z/my-project/public/logo.svg";

// adaptive icon foreground: canvas 108dp, 로고는 safe zone(중앙 66dp ≈ 61%) 안에
const fgSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
// legacy launcher: 48dp
const legacySizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

async function renderFg(density, canvas) {
  const logo = Math.round(canvas * 0.62);
  const pad = Math.round((canvas - logo) / 2);
  const logoPng = await sharp(SVG, { density: 300 }).resize(logo, logo).png().toBuffer();
  await sharp({
    create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: logoPng, left: pad, top: pad }])
    .png()
    .toFile(path.join(RES, `mipmap-${density}`, "ic_launcher_foreground.png"));
}

async function renderLegacy(density, size) {
  const bg = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 5, g: 7, b: 13, alpha: 255 } },
  })
    .png()
    .toBuffer();
  const logo = Math.round(size * 0.72);
  const pad = Math.round((size - logo) / 2);
  const logoPng = await sharp(SVG, { density: 300 }).resize(logo, logo).png().toBuffer();
  // 사각 + 원형(legacy round)
  await sharp(bg).composite([{ input: logoPng, left: pad, top: pad }]).png()
    .toFile(path.join(RES, `mipmap-${density}`, "ic_launcher.png"));
  const round = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#05070d"/></svg>`
  );
  const roundPng = await sharp(round).png().toBuffer();
  await sharp(roundPng).composite([{ input: logoPng, left: pad, top: pad }]).png()
    .toFile(path.join(RES, `mipmap-${density}`, "ic_launcher_round.png"));
}

(async () => {
  for (const [d, s] of Object.entries(fgSizes)) await renderFg(d, s);
  for (const [d, s] of Object.entries(legacySizes)) await renderLegacy(d, s);
  // adaptive 배경색 (다크 네이비)
  fs.writeFileSync(
    path.join(RES, "values", "ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#05070D</color>\n</resources>\n`
  );
  console.log("icons done");
})();
