// 보스 아틀라스 프레임 잘림 검사 — 모든 프레임의 경계 1px에 불투명 픽셀이 있는지
// 사용: node tools/check-boss-atlas.js
const { execFileSync } = require("child_process");
const fs = require("fs");

const SPECS = {
  nidhog:[156,163], surt:[272,187], fenrir:[220,200], skoll:[127,200],
  jorm:[272,163], nagr:[156,163], abudditos:[156,163], vord:[156,163], gram:[220,200],
};

function probe(p) {
  const o = execFileSync("ffprobe", ["-v","error","-select_streams","v:0","-show_entries","stream=width,height","-of","csv=p=0",p], { encoding: "utf8" }).trim();
  const [w, h] = o.split(",").map(Number);
  return [w, h];
}

const DIR = "/root/workspace/CERTZ/public/assets";
let grand = { total: 0, touch: 0 };

for (const [name, [fw, fh]] of Object.entries(SPECS)) {
  const p = `${DIR}/atl_boss_${name}.webp`;
  if (!fs.existsSync(p)) { console.log(`${name}: 파일 없음`); continue; }
  const [W, H] = probe(p);
  const raw = execFileSync("ffmpeg", ["-v","error","-i",p,"-f","rawvideo","-pix_fmt","rgba","-"], { maxBuffer: 1 << 28 });
  if (raw.length < W * H * 4) { console.log(`${name}: raw 부족 ${raw.length} < ${W*H*4}`); continue; }

  const cols = Math.floor(W / fw), rows = Math.floor(H / fh);
  let total = 0, touch = 0;
  const worst = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * fw, y0 = r * fh;
      // 빈 프레임 판정 + 경계 접촉 판정
      let anyOpaque = false;
      const edgeHits = new Set();
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          const a = raw[((y0 + y) * W + (x0 + x)) * 4 + 3];
          if (a <= 16) continue;
          anyOpaque = true;
          if (y === 0) edgeHits.add("top");
          if (y === fh - 1) edgeHits.add("bottom");
          if (x === 0) edgeHits.add("left");
          if (x === fw - 1) edgeHits.add("right");
        }
      }
      if (!anyOpaque) continue;
      total++;
      if (edgeHits.size > 0) {
        touch++;
        if (worst.length < 4) worst.push(`r${r}c${c}[${[...edgeHits].join(",")}]`);
      }
    }
  }
  grand.total += total; grand.touch += touch;
  const pct = total ? Math.round((touch / total) * 100) : 0;
  console.log(`${name.padEnd(11)} ${cols}x${rows}  내용 ${String(total).padStart(3)}  경계접촉 ${String(touch).padStart(3)} (${pct}%)  ${worst.join(" ")}`);
}
console.log(`\n합계: ${grand.total}프레임 중 ${grand.touch}개가 경계에 닿음 (${Math.round(grand.touch/grand.total*100)}%)`);
