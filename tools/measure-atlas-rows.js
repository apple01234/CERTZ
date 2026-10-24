// 아틀라스 행별 유효 프레임 수 측정 — 각 행에서 내용이 있는 마지막 열까지 센다
const { execFileSync } = require("child_process");
const fs = require("fs");

const SPECS = {
  nidhog:[140,147], surt:[256,171], fenrir:[204,184], skoll:[111,184],
  jorm:[256,147], nagr:[140,147], abudditos:[140,147], vord:[140,147], gram:[204,184],
  hati:[191,146], boss2:[330,212],
};

const D = "/root/workspace/CERTZ/public/assets";
function probe(p) {
  const o = execFileSync("ffprobe",["-v","error","-select_streams","v:0","-show_entries","stream=width,height","-of","csv=p=0",p],{encoding:"utf8"}).trim();
  return o.split(",").map(Number);
}

const out = {};
for (const [name,[fw,fh]] of Object.entries(SPECS)) {
  const p = `${D}/atl_boss_${name}.webp`;
  const alt = `${D}/atl_${name}.webp`;
  const file = fs.existsSync(p) ? p : (fs.existsSync(alt) ? alt : null);
  if (!file) { console.log(`${name}: 파일 없음`); continue; }
  const [W,H] = probe(file);
  const raw = execFileSync("ffmpeg",["-v","error","-i",file,"-f","rawvideo","-pix_fmt","rgba","-"],{maxBuffer:1<<28});
  const cols = Math.floor(W/fw), rows = Math.floor(H/fh);
  const counts = [];
  for (let r = 0; r < rows; r++) {
    let last = 0;
    for (let c = 0; c < cols; c++) {
      const x0=c*fw, y0=r*fh;
      let has = false;
      for (let y=0;y<fh && !has;y++) for (let x=0;x<fw;x++) {
        if (raw[((y0+y)*W+(x0+x))*4+3] > 16) { has = true; break; }
      }
      if (has) last = c + 1;
    }
    counts.push(last);
  }
  out[name] = counts;
  console.log(`${name.padEnd(11)} ${cols}x${rows}  행별 유효: [${counts.join(", ")}]`);
}
console.log("\nJSON:", JSON.stringify(out));
