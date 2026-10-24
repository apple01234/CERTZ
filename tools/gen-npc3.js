// 씹덕 NPC 생성기 v3 — 64×96 실제 해상도로 새로 그린다
//
// v2까지의 문제: 32x48 좌표계로 그린 뒤 2배 확대만 해서 "픽셀 뻥튀기"로 보였다.
// v3: 64x96 좌표계에서 직접 그린다. 아래 디테일을 실제로 추가한다.
//   - 눈: 흰자·홍채·동공·캐치라이트 2개 + 속눈썹 + 눈썹
//   - 머리: 하이라이트를 여러 가닥으로, 삐져나온 머리카락, 리본에 명암
//   - 옷: 목선 그림자, 소매 주름, 스커트 주름, 단추/장식
//   - 신체: 목·어깨 곡선, 손가락 암시, 발(신발)까지
//   - 외곽선: 소재별로 색을 다르게(머리=어두운 금발, 옷=어두운 분홍 …)
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const W = 64, H = 96;
const OUTDIR = process.argv[2] || "/tmp/npc3";

/* 소재별 외곽선 색 — 단일 검정 대신 재질에 맞춰 부드럽게 */
const OUT = {
  hairA: "#2a1f14", hairB: "#1e1620", skin: "#a8755a", cloth: "#3a2028",
  metal: "#2a2a3a", white: "#8a8a9a",
};

function cv() { return new Array(W * H).fill(null); }
const I = (x, y) => y * W + x;
function px(c, x, y, col) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H || !col) return;
  c[I(x, y)] = col;
}
function rect(c, x, y, w, h, col) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(c, x + i, y + j, col);
}
function ell(c, cx, cy, rx, ry, col) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1.02) px(c, x, y, col);
    }
}
function line(c, x0, y0, x1, y1, col, w = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    if (w <= 1) px(c, x, y, col);
    else ell(c, x, y, w / 2, w / 2, col);
  }
}
/* 외곽선 — 소재 색을 모르므로 인접 픽셀의 평균 어두운 색을 쓴다 */
function outline(c) {
  const add = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (c[I(x, y)]) continue;
    let n = null;
    for (let dy = -1; dy <= 1 && !n; dy++) for (let dx = -1; dx <= 1 && !n; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const v = c[I(nx, ny)];
      if (v) n = v;
    }
    if (n) add.push([x, y, darken(n)]);
  }
  for (const [x, y, col] of add) if (!c[I(x, y)]) c[I(x, y)] = col;
}
function darken(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const k = 0.42;
  const f = (v) => Math.max(0, Math.round(v * k)).toString(16).padStart(2, "0");
  return `#${f(r)}${f(g)}${f(b)}`;
}

/* PNG */
function crc32(buf) {
  const t = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([l, t, data, cr]);
}
function writePng(file, rgba) {
  const sig = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W,0); ih.writeUInt32BE(H,4); ih[8]=8; ih[9]=6;
  const raw = Buffer.alloc(H*(W*4+1));
  for (let y=0;y<H;y++){ raw[y*(W*4+1)]=0; rgba.copy(raw, y*(W*4+1)+1, y*W*4, (y+1)*W*4); }
  const idat = zlib.deflateSync(raw,{level:9});
  fs.writeFileSync(file, Buffer.concat([sig, chunk("IHDR",ih), chunk("IDAT",idat), chunk("IEND",Buffer.alloc(0))]));
}
const hx = (h) => { const s=h.replace("#",""); return [parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)]; };

/* ════════ 캐릭터 (64×96 기준) ════════
 * 머리 y6~46 (머리 지름 40), 몸통 y46~84, 발 y84~92 */
function draw(c, o) {
  const {
    hair, hairD, hairL, skin = "#f7d3b0", skinD = "#d9a884",
    cloth, clothD, eye = "#3a5a8a", eyeL = "#6a9ad0",
    style = {},
  } = o;
  const { longHair=false, twinTail=false, sideTail=false, catEar=false,
          ribbon=null, hat=null, glasses=false, wing=false } = style;

  /* ── 뒤머리 ── */
  ell(c, 32, 26, 21, 20, hairD);
  if (longHair) { rect(c, 12, 30, 12, 34, hairD); rect(c, 40, 30, 12, 34, hairD); }
  if (twinTail) { ell(c, 10, 42, 6, 14, hairD); ell(c, 54, 42, 6, 14, hairD); }
  if (sideTail) { ell(c, 56, 50, 6, 18, hairD); }

  /* ── 얼굴 ── */
  ell(c, 32, 30, 17, 16, skin);
  ell(c, 32, 38, 13, 11, skin);           // 턱
  rect(c, 20, 18, 24, 3, skinD);          // 이마 그림자
  /* v1.2.4 — 광원을 좌상단으로 고정하고 얼굴에 명암 3단계를 넣는다 */
  ell(c, 22, 26, 5, 7, skinD);            // 좌측 광대 음영
  rect(c, 44, 22, 4, 12, skinD);          // 우측 얼굴 음영
  ell(c, 28, 24, 6, 3, "#fff0e0");        // 좌상단 하이라이트
  px(c, 18, 34, skinD); px(c, 46, 34, skinD);
  ell(c, 20, 38, 5, 3, "#f0a0a8");        // 볼터치 L
  ell(c, 44, 38, 5, 3, "#f0a0a8");        // 볼터치 R

  /* ── 눈 (흰자·홍채·동공·캐치라이트2·속눈썹) ── */
  const eyeAt = (ex) => {
    ell(c, ex, 30, 5.5, 6.5, "#ffffff");
    ell(c, ex, 31, 4.2, 5.4, eye);
    ell(c, ex, 32, 3.0, 3.6, eyeL);
    ell(c, ex, 32.5, 1.8, 2.4, "#101828");       // 동공
    px(c, ex-2, 28, "#ffffff"); px(c, ex-1, 28, "#ffffff"); // 캐치라이트 1
    px(c, ex+2, 35, "#e8f4ff");                   // 캐치라이트 2 (아래 반사)
    /* 속눈썹 */
    rect(c, ex-6, 24, 12, 2, "#241a20");
    px(c, ex-7, 25, "#241a20"); px(c, ex+6, 25, "#241a20");
  };
  eyeAt(23); eyeAt(41);
  /* 눈썹 */
  line(c, 17, 21, 27, 20, hairD, 2);
  line(c, 37, 20, 47, 21, hairD, 2);
  /* 코·입 */
  px(c, 32, 36, skinD);
  line(c, 29, 40, 35, 40, "#c07a72", 1);
  px(c, 28, 39, "#c07a72"); px(c, 36, 39, "#c07a72");

  /* ── 앞머리 (얼굴 위로) ── */
  ell(c, 32, 18, 20, 11, hair);
  /* 가닥 — 여러 줄로 나눠 하이라이트 */
  for (let i = 0; i < 7; i++) {
    const x = 15 + i * 5;
    line(c, x, 9, x + (i % 2 ? 2 : -1), 22, i % 3 === 0 ? hairL : hair, 2);
  }
  /* 삐져나온 머리카락 */
  px(c, 12, 14, hair); px(c, 11, 16, hair); px(c, 52, 13, hair); px(c, 53, 16, hair);
  /* v1.2.4 — 머리카락 결: 아래로 흐르는 가닥을 얇게 여러 줄 넣는다 */
  for (let i = 0; i < 9; i++) {
    const x = 14 + i * 4;
    line(c, x, 16, x + (i % 2 ? 1 : -1), 26, hairD, 1);
  }
  /* 하이라이트 띠 (광원 좌상단) */
  line(c, 18, 11, 28, 8, hairL, 2);
  line(c, 20, 13, 26, 11, hairL, 1);

  /* 옆머리 */
  rect(c, 10, 22, 5, longHair ? 34 : 18, hair);
  rect(c, 49, 22, 5, longHair ? 34 : 18, hair);
  line(c, 12, 24, 12, longHair ? 50 : 36, hairL, 1);

  if (catEar) { ell(c, 18, 9, 5, 7, hair); ell(c, 46, 9, 5, 7, hair); ell(c, 18, 11, 2.5, 3.5, "#f0a0a8"); ell(c, 46, 11, 2.5, 3.5, "#f0a0a8"); }
  if (ribbon) {
    ell(c, 47, 12, 5, 4, ribbon); ell(c, 54, 12, 5, 4, ribbon);
    rect(c, 49, 10, 2, 5, "#e8c064");
    line(c, 48, 13, 53, 15, darken(ribbon), 1);
  }
  if (hat === "witch") {
    /* 뾰족 원뿔 (64 스케일) */
    const cone = [[32,-2],[31,0],[33,0],[30,2],[31,2],[32,2],[33,2],[34,2],
                  [29,4],[30,4],[31,4],[32,4],[33,4],[34,4],[35,4],
                  [28,6],[29,6],[30,6],[31,6],[32,6],[33,6],[34,6],[35,6],[36,6],
                  [27,8],[28,8],[29,8],[30,8],[31,8],[32,8],[33,8],[34,8],[35,8],[36,8],[37,8]];
    for (const [x,y] of cone) px(c,x,y,"#3a2a5a");
    for (let x=27;x<=37;x++){ px(c,x,8,"#6a5a8a"); }
    for (let x=16;x<=48;x++){ px(c,x,10,"#2a1f3a"); px(c,x,11,"#241a30"); }
    px(c,31,3,"#e8c064"); px(c,33,3,"#e8c064"); px(c,32,2,"#e8c064"); px(c,32,4,"#e8c064");
  }
  if (glasses) {
    for (const gx of [23,41]) { rect(c,gx-7,26,14,1,"#c8a850"); rect(c,gx-7,35,14,1,"#c8a850"); rect(c,gx-7,26,1,9,"#c8a850"); rect(c,gx+6,26,1,9,"#c8a850"); }
    rect(c,30,29,4,1,"#c8a850");
    px(c,19,27,"#ffffff"); px(c,37,27,"#ffffff"); // 렌즈 반사
  }
  if (wing) {
    ell(c, 8, 56, 6, 13, "#d8f8ff"); ell(c, 56, 56, 6, 13, "#d8f8ff");
    line(c, 6, 46, 4, 68, "#9ad8f0", 1); line(c, 58, 46, 60, 68, "#9ad8f0", 1);
  }

  /* ── 목 (턱 아래 그림자로 머리가 떠 보이지 않게) ── */
  rect(c, 28, 43, 9, 7, skin);
  rect(c, 28, 43, 9, 2, "#b8886e");   // 턱 그림자
  rect(c, 28, 49, 9, 1, "#c89a7e");   // 목 밑단
  rect(c, 27, 43, 2, 7, skinD);       // 목 좌측 음영
  rect(c, 37, 43, 1, 7, skinD);

  /* ── 몸통 ── */
  const by = 50, bh = 22;
  ell(c, 32, by + 2, 13, 4, cloth);            // 어깨 곡선
  rect(c, 19, by, 27, bh, cloth);
  rect(c, 19, by, 3, bh, clothD);              // 좌측 음영
  /* 목선 + 칼라 */
  rect(c, 24, by + 1, 17, 4, "#f2f4f8");
  line(c, 24, by + 5, 40, by + 5, "#b8bcc8", 1);
  /* 리본/넥타이 */
  rect(c, 29, by + 6, 7, 6, clothD);
  px(c, 31, by + 7, "#e8c064"); px(c, 33, by + 7, "#e8c064");
  /* v1.2.4 — 몸통 명암: 좌상단 광원 기준 좌하단을 어둡게 */
  rect(c, 19, by + bh - 6, 27, 6, clothD);
  ell(c, 24, by + 6, 4, 5, "#ffffff33");
  line(c, 20, by + 14, 20, by + 20, darken(clothD), 1);
  /* 소매 주름 */
  line(c, 22, by + 8, 22, by + 17, clothD, 1);
  line(c, 42, by + 8, 42, by + 17, clothD, 1);
  /* 스커트 */
  rect(c, 17, by + bh, 31, 10, clothD);
  for (let i = 0; i < 5; i++) line(c, 20 + i * 6, by + bh + 1, 19 + i * 6, by + bh + 9, "rgba0", 1);
  line(c, 17, by + bh, 47, by + bh, darken(clothD), 1);
  rect(c, 18, by + bh + 2, 29, 1, cloth);
  /* 다리 */
  rect(c, 25, by + bh + 10, 6, 9, skin);
  rect(c, 34, by + bh + 10, 6, 9, skin);
  rect(c, 25, by + bh + 10, 6, 2, skinD);
  rect(c, 34, by + bh + 10, 6, 2, skinD);
  /* 신발 */
  ell(c, 28, by + bh + 20, 5, 3, "#3a2a30");
  ell(c, 37, by + bh + 20, 5, 3, "#3a2a30");
  rect(c, 24, by + bh + 22, 10, 1, "#1e1418");  // 밑창
  rect(c, 33, by + bh + 22, 10, 1, "#1e1418");
  px(c, 26, by + bh + 19, "#5a4a52"); px(c, 35, by + bh + 19, "#5a4a52"); // 하이라이트
  /* 팔 */
  line(c, 16, by + 6, 15, by + 20, cloth, 6);
  line(c, 49, by + 6, 50, by + 20, cloth, 6);
  line(c, 14, by + 8, 13, by + 19, clothD, 1);
  line(c, 50, by + 8, 51, by + 19, clothD, 1);
  ell(c, 15, by + 22, 3.2, 3.2, skin);
  ell(c, 50, by + 22, 3.2, 3.2, skin);
  px(c, 14, by + 23, skinD); px(c, 49, by + 23, skinD);
}

const PAL = {
  npc_guide_lily:    { hair:"#f0c860", hairD:"#c99a3a", hairL:"#ffeaa0", cloth:"#f0a0b8", clothD:"#b8607a", eye:"#3a6aa8", style:{ sideTail:true, ribbon:"#f07090" } },
  npc_scholar_mio:   { hair:"#d8e0ec", hairD:"#a8b4c4", hairL:"#ffffff", cloth:"#eef2f8", clothD:"#8a94a8", eye:"#4a6a8a", style:{ longHair:true, glasses:true } },
  npc_mage_rin:      { hair:"#4a3a62", hairD:"#2e2440", hairL:"#8a78a8", cloth:"#7a5ab0", clothD:"#442a6a", eye:"#6a4a8a", style:{ twinTail:true, ribbon:"#b88ae8" } },
  npc_merchant_nyan: { hair:"#f0a050", hairD:"#c07030", hairL:"#ffd090", cloth:"#6a8a58", clothD:"#3e5238", eye:"#3a7a5a", style:{ catEar:true } },
  npc_witch_nyx:     { hair:"#3a2a52", hairD:"#221636", hairL:"#6a5a88", cloth:"#3e2e60", clothD:"#1e1434", eye:"#8a6ac0", style:{ longHair:true, hat:"witch" } },
  npc_fairy_aria:    { hair:"#b8f0d0", hairD:"#78c098", hairL:"#e8fff4", cloth:"#98e8c8", clothD:"#4a9e84", eye:"#2e8878", style:{ wing:true, sideTail:true } },
};

fs.mkdirSync(OUTDIR, { recursive: true });
for (const [name, cfg] of Object.entries(PAL)) {
  const c = cv();
  draw(c, cfg);
  outline(c);
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const col = c[i];
    if (!col || col === "rgba0") { rgba[i*4+3] = 0; continue; }
    const [r,g,b] = hx(col);
    rgba[i*4]=r; rgba[i*4+1]=g; rgba[i*4+2]=b; rgba[i*4+3]=255;
  }
  writePng(path.join(OUTDIR, `${name}.png`), rgba);
  console.log(`PNG ${name} (${W}x${H})`);
}
