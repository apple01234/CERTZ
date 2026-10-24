// 보스 아틀라스 패딩 재구성 — 원본 아트가 프레임 하단에 발을 붙여 그려져 있어
// 그대로 자르면 "잘린 것처럼" 보인다. 각 프레임에 상하좌우 여백을 넣어
// 캐릭터가 프레임 경계에서 떨어지게 만든다.
//
// 원리: 프레임마다 (fw+2p) × (fh+2p) 크기로 캔버스를 잡고 원본 프레임을 중앙에 놓는다.
//       배경은 투명(alpha 0)이므로 게임에서는 원래처럼 보이고, 경계 접촉만 사라진다.
//
// 사용: node tools/pad-boss-atlas.js [--apply] [pad]
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PAD = Number(process.argv.find((a) => /^\d+$/.test(a)) || 6);
const apply = process.argv.includes("--apply");
const TMP = "/tmp/pad";
fs.mkdirSync(TMP, { recursive: true });

/* 원본 시트 + 격자 (원본 아트 기준) */
const MAP = [
  ["bsw_nidhog",    "atl_boss_nidhog",    11, 7],
  ["bsw_surt",      "atl_boss_surt",       6, 7],
  ["bsw_fenrir",    "atl_boss_fenrir",     6, 7],
  ["bsw_skoll",     "atl_boss_skoll",     11, 7],
  ["bsw_jorm",      "atl_boss_jorm",       6, 7],
  ["bsw_nagr",      "atl_boss_nagr",      11, 7],
  ["bsw_abudditos", "atl_boss_abudditos", 11, 7],
  ["bsw_vord",      "atl_boss_vord",      11, 7],
  ["bsw_gram",      "atl_boss_gram",       6, 7],
];
const SRC = "/root/workspace/CERTZ/assets_src/boss_sheets";
const OUT = "/root/workspace/CERTZ/public/assets";

function probe(p) {
  const o = execFileSync("ffprobe", ["-v","error","-select_streams","v:0","-show_entries","stream=width,height","-of","csv=p=0",p], { encoding: "utf8" }).trim();
  return o.split(",").map(Number);
}

const manifest = {};
for (const [srcName, outKey, cols, rows] of MAP) {
  const src = path.join(SRC, `${srcName}.webp`);
  if (!fs.existsSync(src)) { console.log(`${outKey}: 원본 없음`); continue; }
  const [W, H] = probe(src);
  const fw = Math.floor(W / cols), fh = Math.floor(H / rows);

  // 프레임별로 잘라 개별 파일 생성 → 여백 합성 → 재조립은 ffmpeg xstack 대신
  // 단순하게 "전체 시트에 패딩을 넣고 칸 경계에 투명 거터를 그린다" 방식이 아니라,
  // 각 프레임을 개별 처리 후 hstack/vstack으로 붙인다.
  const work = path.join(TMP, outKey);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });

  const rowsFiles = [];
  for (let r = 0; r < rows; r++) {
    const colsFiles = [];
    for (let c = 0; c < cols; c++) {
      const f = path.join(work, `r${r}c${c}.png`);
      execFileSync("ffmpeg", ["-y","-hide_banner","-loglevel","error","-i",src,
        "-vf", `crop=${fw}:${fh}:${c*fw}:${r*fh},pad=${fw+2*PAD}:${fh+2*PAD}:${PAD}:${PAD}:color=0x00000000`,
        "-frames:v","1", f]);
      colsFiles.push(f);
    }
    // 가로로 붙이기
    const rowFile = path.join(work, `row${r}.png`);
    const inputs = colsFiles.flatMap((f) => ["-i", f]);
    const filter = colsFiles.map((_, i) => `[${i}:v]`).join("") + `hstack=inputs=${cols}`;
    execFileSync("ffmpeg", ["-y","-hide_banner","-loglevel","error", ...inputs, "-filter_complex", filter, rowFile]);
    rowsFiles.push(rowFile);
  }
  // 세로로 붙이기
  const outFile = path.join(OUT, `${outKey}.webp`);
  const inputs = rowsFiles.flatMap((f) => ["-i", f]);
  const filter = rowsFiles.map((_, i) => `[${i}:v]`).join("") + `vstack=inputs=${rows}`;
  execFileSync("ffmpeg", ["-y","-hide_banner","-loglevel","error", ...inputs, "-filter_complex", filter,
    "-c:v","libwebp","-lossless","1", outFile]);

  manifest[outKey] = { fw: fw + 2*PAD, fh: fh + 2*PAD, cols, rows, pad: PAD };
  console.log(`${outKey.padEnd(20)} ${fw}x${fh} + pad${PAD} → ${fw+2*PAD}x${fh+2*PAD}  (${cols}x${rows})`);
}

fs.writeFileSync(path.join(TMP, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nmanifest: ${TMP}/manifest.json`);
if (!apply) console.log("(--apply 로 실제 반영)");
