// 씹덕 스타일 NPC 생성기 — 32×48 픽셀 버퍼 (기존 npc_merchant 32×32보다 세로 여유)
//
// 기존 화풍 규칙(기존 NPC 분석 결과를 그대로 따른다):
//  - 1px 어두운 외곽선 (순수 검정 금지 — 어두운 보라/갈색)
//  - SD 비율: 머리 60~70%, 몸통 짧음
//  - 제한 팔레트(10~15색), 셀 셰이딩 2~3단계
//  - 눈은 2~3px, 큰 눈망울(씹덕 요소), 볼터치
//
// 씹덕 요소를 넣는 방식: 큰 눈(하이라이트 포함) + 볼터치 + 리본/장식 + 청록·분홍 계열.
// 다만 전체 팔레트는 기존 톤(저채도)을 유지해 이질감이 없게 한다.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const W = 64, H = 96; // v1.2.4 — 2배 해상도(픽셀 부족 지적 반영)
const OUTDIR = process.argv[2] || "/tmp/npc";

/* 공통 팔레트 — 기존 NPC에서 추출한 톤 + 씹덕용 색 2~3개만 추가 */
const C = {
  out:    "#2a1f2e",  // 외곽선 (어두운 자주)
  out2:   "#3d2b33",
  skin:   "#f5cfa8",
  skinSh: "#d9a77e",
  skinHi: "#ffe6c8",
  hairA:  "#3a2b4a",  // 흑발 남보라
  hairB:  "#57406b",
  hairHi: "#7d6a94",
  blondA: "#e8c07a",
  blondB: "#c49a52",
  silverA:"#c8d4e0",
  silverB:"#9aa8ba",
  pinkA:  "#e88ba8",
  pinkB:  "#c4667f",
  cloth:  "#4a5a7a",
  cloth2: "#36426090",
  white:  "#f0f4f8",
  eye:    "#2e4a6b",
  eyeHi:  "#ffffff",
  blush:  "#f09aa8",
  gold:   "#e8c064",
  teal:   "#5fc4b8",
};

function canvas() {
  return new Array(W * H).fill(null);
}
const idx = (x, y) => y * W + x;
/* v1.2.4 — 32x48 좌표계로 그린 아트를 2배 해상도(64x96)에 찍는다.
 *  각 도형 함수가 2x2 픽셀 블록을 채우므로 디테일(눈 하이라이트 등)이
 *  뭉개지지 않으면서 해상도는 4배가 된다. */
const SC = 2;
function px(c, x, y, col) {
  if (!col) return;
  const X = x * SC, Y = y * SC;
  for (let dy = 0; dy < SC; dy++) for (let dx = 0; dx < SC; dx++) {
    const nx = X + dx, ny = Y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    c[idx(nx, ny)] = col;
  }
}
function rect(c, x0, y0, w, h, col) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) px(c, x, y, col);
}
function circle(c, cx, cy, r, col) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3) px(c, x, y, col);
}
function ellipse(c, cx, cy, rx, ry, col) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.05) px(c, x, y, col);
}

/* 외곽선 자동 — 전경 인접 빈 픽셀 채우기 */
function outline(c, col) {
  const add = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (c[idx(x, y)]) continue;
      let t = false;
      for (let dy = -1; dy <= 1 && !t; dy++)
        for (let dx = -1; dx <= 1 && !t; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (c[idx(nx, ny)]) t = true;
        }
      if (t) add.push([x, y]);
    }
  for (const [x, y] of add) if (!c[idx(x, y)]) c[idx(x, y)] = col;
}

/* PNG 인코딩 */
function crc32(buf) {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function writePng(file, rgba) {
  const sig = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  fs.writeFileSync(file, Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]));
}
const hex = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];

/* ════════ NPC 정의 ════════
 * 모두 같은 뼈대(머리 y4~22, 몸 y23~44)를 쓴다. 헤어/의상만 바꿔 통일감 유지. */
function base(c, o) {
  const {
    hair = C.hairA, hairB = C.hairB, hairHi = C.hairHi,
    cloth = C.cloth, clothB = C.out2,
    eyeColor = C.eye, longHair = false, twinTail = false, sideTail = false,
    ribbon = null, hat = null, glasses = false, catEar = false, wing = false,
    bodyScale = 1,
  } = o;

  /* ── 머리 (y 5~23) ── */
  ellipse(c, 16, 14, 10, 9, hair);          // 뒷머리
  ellipse(c, 16, 15, 8.5, 8, C.skin);       // 얼굴
  /* 턱 */
  ellipse(c, 16, 19, 6, 5, C.skin);
  /* 이마 그림자 */
  rect(c, 8, 9, 16, 2, C.skinSh);
  /* 볼터치 (씹덕) */
  ellipse(c, 10, 18, 2.2, 1.4, C.blush);
  ellipse(c, 22, 18, 2.2, 1.4, C.blush);
  /* 눈 — 큰 눈망울 + 하이라이트 (씹덕 핵심) */
  ellipse(c, 12, 16, 2.4, 3.0, C.eyeHi);
  ellipse(c, 20, 16, 2.4, 3.0, C.eyeHi);
  ellipse(c, 12, 16.5, 1.9, 2.5, eyeColor);
  ellipse(c, 20, 16.5, 1.9, 2.5, eyeColor);
  /* 하이라이트를 좌우 대칭으로 — 이전엔 한쪽만 2px라 시선이 어긋났다 */
  px(c, 11, 15, C.eyeHi); px(c, 12, 15, C.eyeHi);
  px(c, 19, 15, C.eyeHi); px(c, 20, 15, C.eyeHi);
  /* 눈썹 */
  rect(c, 10, 12, 4, 1, hairB); rect(c, 18, 12, 4, 1, hairB);
  /* 입 */
  px(c, 16, 21, C.skinSh); px(c, 15, 21, C.skinSh); px(c, 17, 21, C.skinSh);
  /* 코 */
  px(c, 16, 19, C.skinSh);

  /* 앞머리 — 얼굴 위로 덮는다 */
  ellipse(c, 16, 9, 9.5, 5, hair);
  ellipse(c, 11, 8, 4, 3.4, hairHi);
  /* 옆머리 */
  rect(c, 5, 12, 3, longHair ? 20 : 10, hair);
  rect(c, 24, 12, 3, longHair ? 20 : 10, hair);
  rect(c, 6, 12, 1, 8, hairHi);
  if (longHair) { rect(c, 4, 28, 4, 14, hair); rect(c, 24, 28, 4, 14, hair); }
  if (twinTail) {
    ellipse(c, 5, 22, 2.6, 5, hair); ellipse(c, 27, 22, 2.6, 5, hair);
    ellipse(c, 5, 27, 2.2, 4, hairB); ellipse(c, 27, 27, 2.2, 4, hairB);
  }
  if (sideTail) { ellipse(c, 27, 26, 2.4, 7, hair); ellipse(c, 27, 31, 2, 4, hairB); }
  if (catEar) {
    ellipse(c, 9, 5, 2.6, 3, hair); ellipse(c, 23, 5, 2.6, 3, hair);
    ellipse(c, 9, 6, 1.2, 1.6, C.blush); ellipse(c, 23, 6, 1.2, 1.6, C.blush);
  }
  if (ribbon) {
    ellipse(c, 24, 7, 2.2, 1.8, ribbon); ellipse(c, 27, 7, 2.2, 1.8, ribbon);
    px(c, 25, 7, C.gold); px(c, 26, 7, C.gold);
  }
  if (hat === "witch") {
    /* 뾰족한 원뿔 — 위로 갈수록 좁아지는 계단식 삼각형 + 챙 + 별 장식.
     *  이전 시도는 rect로 사각형을 쌓아 "머리 위 상자"로 보였다. */
    const cone = [
      [16, -1], [15, 0], [17, 0], [15, 1], [16, 1], [17, 1],
      [14, 2], [15, 2], [16, 2], [17, 2], [18, 2],
      [14, 3], [15, 3], [16, 3], [17, 3], [18, 3],
      [13, 4], [14, 4], [15, 4], [16, 4], [17, 4], [18, 4], [19, 4],
      [13, 5], [14, 5], [15, 5], [16, 5], [17, 5], [18, 5], [19, 5],
      [12, 6], [13, 6], [14, 6], [15, 6], [16, 6], [17, 6], [18, 6], [19, 6], [20, 6],
    ];
    for (const [x, y] of cone) px(c, x, y, "#3a2a5a");
    /* 모자 띠 */
    for (let x = 12; x <= 20; x++) px(c, x, 6, "#6a5a8a");
    /* 챙 — 넓게 */
    for (let x = 7; x <= 25; x++) { px(c, x, 7, "#2a1f3a"); px(c, x, 8, "#241a30"); }
    /* 별 장식 */
    px(c, 15, 3, C.gold); px(c, 17, 3, C.gold); px(c, 16, 2, C.gold); px(c, 16, 4, C.gold);
  }
  if (glasses) {
    rect(c, 9, 14, 6, 1, C.gold); rect(c, 17, 14, 6, 1, C.gold);
    rect(c, 9, 19, 6, 1, C.gold); rect(c, 17, 19, 6, 1, C.gold);
  }

  /* ── 몸통 ── */
  const by = 24, bh = Math.round(16 * bodyScale);
  /* 목 — 이전엔 칼라가 턱에 붙어 "머리가 얹힌" 느낌이었다 */
  rect(c, 14, 23, 4, 3, C.skinSh);
  /* 어깨를 둥글게 (각진 사각형 → 곡선) */
  rect(c, 9, by, 14, bh, cloth);
  ellipse(c, 9, by + 1, 2.2, 2.2, cloth);
  ellipse(c, 23, by + 1, 2.2, 2.2, cloth);
  rect(c, 10, by + 1, 12, 2, C.white);        // 칼라
  rect(c, 14, by + 3, 4, 3, clothB);          // 리본/넥타이
  /* 팔 — 어깨에서 이어지는 소매 + 피부 손 (이전엔 손이 허공에 떠 있었다) */
  const armLen = Math.round(bh * 0.72);
  rect(c, 6, by + 1, 3, armLen, cloth);        // 왼 소매
  rect(c, 23, by + 1, 3, armLen, cloth);       // 오른 소매
  rect(c, 7, by + 1, 1, armLen, clothB);       // 소매 그림자
  rect(c, 24, by + 1, 1, armLen, clothB);
  ellipse(c, 7, by + armLen + 1, 1.6, 1.6, C.skin);   // 손
  ellipse(c, 25, by + armLen + 1, 1.6, 1.6, C.skin);
  /* 옷 주름 — 단색이던 몸통에 명암 2단계만 넣어 입체감을 준다 */
  rect(c, 9, by + bh - 3, 14, 1, clothB);
  rect(c, 10, by + 4, 1, bh - 6, clothB);
  /* 스커트/하의 */
  rect(c, 8, by + bh, 16, 4, clothB);
  rect(c, 8, by + bh, 16, 1, cloth);
  /* 다리 */
  rect(c, 11, by + bh + 4, 3, 5, C.skinSh);
  rect(c, 18, by + bh + 4, 3, 5, C.skinSh);
  /* 신발 */
  rect(c, 10, by + bh + 9, 4, 3, C.out2);
  rect(c, 18, by + bh + 9, 4, 3, C.out2);

  if (wing) {
    ellipse(c, 4, 28, 3.5, 6, "#cff0ff");
    ellipse(c, 28, 28, 3.5, 6, "#cff0ff");
    rect(c, 3, 26, 1, 8, "#9ad8f0"); rect(c, 28, 26, 1, 8, "#9ad8f0");
  }
}

const NPCS = {
  // 1) 리본 소녀 — 마을 안내원. 밝은 성격.
  npc_guide_lily: (c) => base(c, {
    hair: C.blondA, hairB: C.blondB, hairHi: "#ffe6b0",
    cloth: "#e8a0b8", clothB: "#a85470",
    sideTail: true, ribbon: C.pinkA,
  }),
  // 2) 안경 도서관원 — 차분한 은발
  npc_scholar_mio: (c) => base(c, {
    hair: C.silverA, hairB: C.silverB, hairHi: "#e8f0f8",
    cloth: C.white, clothB: "#5a6a8a",
    longHair: true, glasses: true, eyeColor: "#4a6a8a",
  }),
  // 3) 쌍둥이 꼬리 마법사 — 보라
  npc_mage_rin: (c) => base(c, {
    hair: C.hairA, hairB: C.hairB, hairHi: C.hairHi,
    cloth: "#6a4a9a", clothB: "#3a2a5a",
    twinTail: true, ribbon: "#a87ae8",
  }),
  // 4) 고양이귀 상인 — 주황
  npc_merchant_nyan: (c) => base(c, {
    hair: "#e89050", hairB: "#b86830", hairHi: "#ffc080",
    cloth: "#5a7a4a", clothB: "#3a4a30",
    catEar: true,
  }),
  // 5) 마녀 — 검은 모자
  npc_witch_nyx: (c) => base(c, {
    hair: C.hairA, hairB: "#2a1f3a", hairHi: "#6a5a8a",
    cloth: "#3a2a5a", clothB: "#1e1430",
    hat: "witch", longHair: true,
  }),
  // 6) 요정 — 날개
  npc_fairy_aria: (c) => base(c, {
    hair: "#a8e8c0", hairB: "#6ab890", hairHi: "#d8ffe8",
    cloth: "#8ae0c0", clothB: "#4a9a80",
    wing: true, sideTail: true, eyeColor: "#2e7a6a",
  }),
};

fs.mkdirSync(OUTDIR, { recursive: true });
for (const [name, draw] of Object.entries(NPCS)) {
  const c = canvas();
  draw(c);
  outline(c, C.out);
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const col = c[i];
    if (!col) { rgba[i*4+3] = 0; continue; }  // 투명
    const [r, g, b] = hex(col.replace(/[^#0-9a-f]/gi, "").slice(0, 7) || "#000000");
    rgba[i*4] = r; rgba[i*4+1] = g; rgba[i*4+2] = b; rgba[i*4+3] = 255;
  }
  writePng(path.join(OUTDIR, `${name}.png`), rgba);
  console.log(`PNG ${name} (${W}x${H})`);
}
