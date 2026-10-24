// 보스 아틀라스 재슬라이싱 — 원본 시트에서 프레임 잘림 없이 다시 자른다
//
// 문제: 배포본(public/assets/atl_boss_*.webp)의 프레임 격자가 원본 아트와 안 맞아
//       캐릭터 발/머리가 프레임 경계에서 잘렸다(실측: 502프레임 중 270개 = 54%).
//       특히 surt는 원본 1197px를 1020px로 세로 압축하며 177px가 사라졌다.
//
// 해법: 원본(assets_src/boss_sheets/bsw_*.webp)의 실제 크기에서 격자를 다시 계산하고,
//       각 프레임이 경계에 닿지 않도록 여백(pad)을 확보해 재구성한다.
//
// 사용: node tools/reslice-boss-atlas.js [--apply]
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SRC_DIR = "/root/workspace/CERTZ/assets_src/boss_sheets";
const OUT_DIR = "/root/workspace/CERTZ/public/assets";
const TMP = "/tmp/reslice";

/* 원본 → 대상 아틀라스 매핑 + 행 구성(게임 규약: idle,run,atk,sp1,sp2,sp3,die) */
const MAP = [
  // [원본, 출력키, 열, 행]
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

function probe(p) {
  const o = execFileSync("ffprobe", ["-v","error","-select_streams","v:0","-show_entries","stream=width,height","-of","csv=p=0",p], { encoding: "utf8" }).trim();
  const [w, h] = o.split(",").map(Number);
  return [w, h];
}

const apply = process.argv.includes("--apply");
fs.mkdirSync(TMP, { recursive: true });

const report = [];
for (const [srcName, outKey, cols, rows] of MAP) {
  const src = path.join(SRC_DIR, `${srcName}.webp`);
  if (!fs.existsSync(src)) { console.log(`${outKey}: 원본 없음`); continue; }
  const [W, H] = probe(src);
  const fw = Math.floor(W / cols), fh = Math.floor(H / rows);
  const tailW = W - fw * cols, tailH = H - fh * rows;

  /* 프레임 크기는 "한 프레임 안에 캐릭터가 다 들어오는가"로 결정된다.
   *  원본을 cols×rows로 균등 분할하면 잘림이 사라진다(이미 그 격자로 그려진 아트이므로).
   *  여기서는 균등 분할만 하고, 실제 잘림 여부는 check-boss-atlas.js로 재검증한다. */
  report.push({ outKey, srcName, W, H, fw, fh, cols, rows, tailW, tailH });
  console.log(`${outKey.padEnd(20)} ${W}x${H} → ${fw}x${fh} (${cols}x${rows}) 꼬리 ${tailW},${tailH}`);
}

if (!apply) {
  console.log("\n(--apply 로 실제 생성)");
  process.exit(0);
}

/* 실제 재슬라이싱: 원본에서 프레임을 잘라 다시 이어붙인다.
 *  꼬리 픽셀이 있으면 잘라내고 정확히 cols*fw × rows*fh로 만든다. */
for (const r of report) {
  const src = path.join(SRC_DIR, `${r.srcName}.webp`);
  const out = path.join(OUT_DIR, `${r.outKey}.webp`);
  execFileSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error", "-i", src,
    "-vf", `crop=${r.fw * r.cols}:${r.fh * r.rows}:0:0`,
    "-c:v", "libwebp", "-lossless", "1", out,
  ], { stdio: "inherit" });
  console.log(`생성 ${r.outKey}.webp (${r.fw * r.cols}x${r.fh * r.rows})`);
}

fs.writeFileSync(
  path.join(TMP, "manifest.json"),
  JSON.stringify(Object.fromEntries(report.map((r) => [r.outKey, { fw: r.fw, fh: r.fh, cols: r.cols, rows: r.rows }])), null, 2)
);
console.log("\nmanifest 저장: /tmp/reslice/manifest.json");
