// 해적 총기 스프라이트 생성기 — x3_gun (손에 드는 무기 비주얼)
// 규격: x3_bow(28x52) / x3_staff(16x60) / x3_dagger(12x26) 와 같은 계열.
// 32x32 캔버스에 오른쪽을 향하는 화승총(머스킷) 실루엣 — 회전·플립은 게임이 처리한다.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const W = 40, H = 24;
const OUTDIR = process.argv[2] || "/tmp/gun";

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function writePng(file, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  const raw = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  fs.writeFileSync(file, Buffer.concat([sig, chunk("IHDR", ih), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]));
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const C = {
  out: "#241a14",       // 외곽선 (어두운 갈색)
  wood: "#8a5a30",      // 개머리판 나무
  woodD: "#5e3a1c",
  woodL: "#a8763f",
  metal: "#5a6270",     // 총열 금속
  metalD: "#363c46",
  metalL: "#8a94a4",
  brass: "#c8963c",     // 장식 금속
  brassL: "#e8bd6a",
};

function canvas() { return new Array(W * H).fill(null); }
const ix = (x, y) => y * W + x;
function px(c, x, y, col) {
  if (x < 0 || y < 0 || x >= W || y >= H || !col) return;
  c[ix(x, y)] = col;
}
function rect(c, x0, y0, w, h, col) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) px(c, x, y, col);
}
function outline(c) {
  const add = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (c[ix(x, y)]) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (c[ix(nx, ny)]) { add.push([x, y]); dy = 2; break; }
    }
  }
  for (const [x, y] of add) c[ix(x, y)] = C.out;
}

const c = canvas();

/* ── 개머리판: 뒤쪽 아래로 완만한 대각선으로 흘러내리는 머스킷형 ──
 *  (직각 손잡이는 권총처럼 보인다 — 비스듬한 어깨 견착판이 머스킷의 상징) */
for (let i = 0; i < 9; i++) {
  // 왼쪽으로 갈수록 아래로 내려가는 계단
  const y = 11 + Math.floor(i * 0.7);
  rect(c, 3 + i, y, 1, 7 - Math.floor(i * 0.35), C.wood);
}
rect(c, 3, 17, 5, 3, C.woodD);        // 개머리판 하단 그늘
rect(c, 3, 11, 6, 1, C.woodL);        // 상단 하이라이트

/* ── 총몸(스트럭처): 개머리판에서 총열까지 이어지는 목재 ── */
rect(c, 11, 12, 8, 5, C.wood);
rect(c, 11, 12, 8, 1, C.woodL);
rect(c, 11, 16, 8, 1, C.woodD);

/* ── 꼬질대(ramrod): 전장식 머스킷의 상징 — 총열 아래 얇은 막대 ── */
rect(c, 14, 17, 22, 1, C.woodD);
rect(c, 14, 17, 22, 1, "#7a5228");

/* ── 방아쇠울 + 방아쇠: 빈 공간을 남겨 방아쇠로 읽히게 ── */
rect(c, 11, 17, 1, 3, C.brass);       // 방아쇠울 앞 기둥
rect(c, 12, 19, 3, 1, C.brass);       // 방아쇠울 바닥
px(c, 12, 18, C.metalD);              // 방아쇠

/* ── 총열: 길고 가는 머스킷 총열 (사람 키만 한 길이가 상징) ── */
rect(c, 19, 12, 18, 3, C.metal);      // 총열 본체
rect(c, 19, 12, 18, 1, C.metalL);     // 상단 하이라이트
rect(c, 19, 14, 18, 1, C.metalD);     // 하단 그늘
/* 총구 — 밋밋한 원통형 파이프 (소염기·나팔 모양 금지) */
rect(c, 36, 11, 1, 5, C.metalD);
px(c, 36, 12, C.metalL);

/* ── 총열 고정 밴드 2개 ── */
rect(c, 21, 11, 2, 5, C.brass);
rect(c, 21, 11, 2, 1, C.brassL);
rect(c, 29, 11, 1, 5, C.brass);

/* ── 조준기(가늠쇠) + 화승 장치(락) ── */
px(c, 34, 11, C.metalD);              // 가늠쇠
rect(c, 17, 9, 2, 3, C.metalD);       // 화승 락(공이)
px(c, 17, 8, C.metalL);

outline(c);

const rgba = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const col = c[i];
  if (!col) { rgba[i * 4 + 3] = 0; continue; }
  const [r, g, b] = hex(col);
  rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = 255;
}

fs.mkdirSync(OUTDIR, { recursive: true });
writePng(path.join(OUTDIR, "x3_gun.png"), rgba);
console.log(`PNG x3_gun (${W}x${H})`);
