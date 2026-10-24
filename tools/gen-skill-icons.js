// 해적 계열 스킬 아이콘 생성기 — 32×32 픽셀 버퍼 직접 조작
//
// 사용법: node tools/gen-skill-icons.js [출력디렉터리]
//   → 32x32 PNG를 만들고, WebP 변환은 ffmpeg로 한다:
//   for f in /tmp/px/*.png; do n=$(basename "$f" .png);
//     ffmpeg -y -i "$f" -vf "scale=32:32:flags=neighbor" -pix_fmt argb -c:v libwebp -lossless 1 \
//       public/assets/skillicon/$n.webp; done
//
// 왜 SVG가 아니라 픽셀 버퍼인가: SVG를 32px로 렌더하면 안티앨리어싱으로
// 반투명 픽셀이 생겨 형태가 뭉갠다. 픽셀 버퍼는 계단현상·반투명이 원천 불가능하다.
// 배경은 단색 + 1px 프레임. 그라데이션/디더는 "투명 체커보드"처럼 읽혀서 버렸다.
//
// v1(SVG 렌더)의 문제를 고친다:
//  1) 곡선이 안티앨리어싱돼 반투명 픽셀이 생기고 형태가 뭉갰다
//  2) 배경 디더가 "투명 체커보드"처럼 읽혔다
// → 안티앨리어싱이 원천적으로 불가능한 픽셀 버퍼를 직접 채우고,
//   배경은 비네트(모서리 어둡게)만 쓰고 디더는 1px 경계에만 넣는다.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const S = 32;
const OUTDIR = process.argv[2] || "/tmp/px";

/* ── 팔레트: [외곽, 어두움, 중간, 밝음, 하이라이트] ── */
const PAL = {
  gold:  ["#0d0803", "#4a3510", "#a8822a", "#ffd76a", "#fff6cf"],
  steel: ["#070d14", "#16283a", "#2e5068", "#7fc6e8", "#e2f6ff"],
  smoke: ["#0a0a0a", "#222222", "#4e4e4e", "#9a9a9a", "#dedede"],
  storm: ["#060c18", "#142a4e", "#2e60a8", "#6aa8ff", "#d6eaff"],
  sea:   ["#03101a", "#0a3346", "#12708a", "#38b4d0", "#b8f2ff"],
  fire:  ["#0f0602", "#4a1c04", "#a84410", "#ff8a3d", "#ffd9b0"],
  abyss: ["#05030c", "#1a1440", "#3c2f88", "#8a78e0", "#dcd4ff"],
};

/* ── 캔버스 ── */
function mkCanvas() {
  const fg = new Array(S * S).fill(null); // 전경색 (null = 비어 있음)
  const bgc = new Array(S * S).fill(null); // 배경색
  return { fg, bg: bgc };
}

const px = (c, x, y, col) => {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  c.fg[y * S + x] = col;
};

function fillRect(c, x0, y0, w, h, col) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) px(c, x, y, col);
}

function fillCircle(c, cx, cy, r, col) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r + r * 0.4) px(c, x, y, col);
    }
}

/** 두꺼운 선 — 원을 이어 그린다(픽셀아트에서 자연스러운 둥근 선) */
function thickLine(c, x0, y0, x1, y1, w, col) {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 2;
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    fillCircle(c, x0 + dx * t, y0 + dy * t, w / 2, col);
  }
}

/** 다각형 채우기 — 스캔라인. 정수 좌표만 써서 계단현상 없음 */
function fillPoly(c, pts, col) {
  const ys = pts.map((p) => p[1]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if (ay === by) continue;
      if ((y >= ay && y < by) || (y >= by && y < ay)) {
        xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.round(xs[k]); x <= Math.round(xs[k + 1]); x++) px(c, x, y, col);
  }
}

/* ── 배경: 대각 밴드 + 비네트 (체커보드 없음) ── */
function makeBg(pal) {
  /* 단색 배경 + 1px 내부 프레임.
   *  v1(대각 그라데이션+디더)과 v2(대각 밴드) 모두 "체커보드/줄무늬"로 읽혔다.
   *  아이콘은 이미 원형 버튼 안에 들어가므로 배경에 무늬를 넣을 이유가 없다.
   *  단색이 가장 깔끔하고, 프레임 1px가 타일 경계를 잡아준다. */
  const [, c1, , ,] = pal;
  const out = new Array(S * S).fill(c1);
  for (let x = 0; x < S; x++) {
    out[x] = pal[0];
    out[(S - 1) * S + x] = pal[0];
  }
  for (let y = 0; y < S; y++) {
    out[y * S] = pal[0];
    out[y * S + (S - 1)] = pal[0];
  }
  return out;
}

/* ── 외곽선 자동 생성: 전경에 인접한 빈 픽셀을 외곽색으로 ── */
function outline(c, outCol) {
  const add = [];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (c.fg[y * S + x]) continue;
      let touch = false;
      for (let dy = -1; dy <= 1 && !touch; dy++)
        for (let dx = -1; dx <= 1 && !touch; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
          if (c.fg[ny * S + nx]) touch = true;
        }
      if (touch) add.push([x, y]);
    }
  for (const [x, y] of add) if (!c.fg[y * S + x]) c.fg[y * S + x] = outCol;
}

/* ── PNG 인코딩 (zlib 내장) ── */
function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function writePng(file, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  const raw = Buffer.alloc(S * (S * 4 + 1));
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  fs.writeFileSync(file, Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]));
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/* ══════════════ 그림 정의 ══════════════ */
const ART = {
  // 포격 — 굵은 포신(대각) + 포탄 + 총구 화염 + 포대
  pirate_s1: (c, [o, d, m, l, hi]) => {
    fillRect(c, 5, 26, 12, 3, d);           // 포대
    fillRect(c, 7, 24, 8, 2, m);
    thickLine(c, 8, 25, 18, 14, 6, d);      // 포신(바깥)
    thickLine(c, 9, 25, 18, 15, 4, m);      // 포신(안)
    fillCircle(c, 19, 13, 2.4, d);          // 총구
    fillCircle(c, 19, 13, 1.5, o);
    fillPoly(c, [[22, 14], [27, 9], [30, 12], [26, 16], [24, 20]], l); // 화염
    fillPoly(c, [[24, 12], [28, 10], [27, 14]], hi);
    fillCircle(c, 23, 6, 2, m);             // 포탄
    fillCircle(c, 22, 5, 1, hi);
  },
  // 커틀러스 난무 — 교차한 두 칼날
  pirate_s2: (c, [o, d, m, l, hi]) => {
    thickLine(c, 6, 27, 25, 6, 4, d);       // 칼날1 외곽
    thickLine(c, 7, 26, 25, 7, 2, l);       // 칼날1 날
    thickLine(c, 26, 27, 6, 6, 4, d);       // 칼날2 외곽
    thickLine(c, 25, 26, 7, 7, 2, m);       // 칼날2 날
    fillRect(c, 4, 5, 3, 3, m);             // 손잡이
    fillRect(c, 25, 24, 3, 3, m);
    fillCircle(c, 16, 16, 2.6, hi);         // 교차 섬광
    fillCircle(c, 16, 16, 1.2, "#ffffff");
  },
  // 연막 측면 — 연기 덩어리 + 사라지는 잔상
  pirate_c1: (c, [o, d, m, l, hi]) => {
    fillCircle(c, 11, 20, 7, d);
    fillCircle(c, 18, 17, 6, m);
    fillCircle(c, 16, 24, 5, d);
    fillCircle(c, 8, 15, 4.5, m);
    fillCircle(c, 13, 19, 3, l);
    fillCircle(c, 19, 16, 2, hi);
    fillRect(c, 24, 8, 4, 2, l);            // 잔상 3개
    fillRect(c, 26, 13, 4, 2, m);
    fillRect(c, 27, 18, 3, 2, d);
  },
  // 갈고리 그네 — 밧줄 + 갈고리
  pirate_c2: (c, [o, d, m, l, hi]) => {
    const rope = [[5, 5], [10, 3], [15, 5], [19, 9]];
    for (let i = 0; i < rope.length - 1; i++)
      thickLine(c, rope[i][0], rope[i][1], rope[i + 1][0], rope[i + 1][1], 2, m);
    thickLine(c, 19, 9, 24, 14, 3, d);      // 갈고리 몸통
    thickLine(c, 24, 14, 25, 20, 3, d);
    fillPoly(c, [[25, 19], [29, 25], [21, 26], [22, 21]], l); // 갈고리 끝
    fillCircle(c, 6, 5, 2.4, l);            // 손
    fillCircle(c, 5, 4, 1, hi);
  },
  // 뇌우 소환 — 구름 + 번개
  stormcaptain_s3: (c, [o, d, m, l, hi]) => {
    fillCircle(c, 10, 10, 6, d);
    fillCircle(c, 19, 9, 5, d);
    fillCircle(c, 15, 13, 6, d);
    fillCircle(c, 10, 9, 4, m);
    fillCircle(c, 19, 8, 3, m);
    fillCircle(c, 14, 11, 3.5, l);
    fillPoly(c, [[17, 12], [11, 21], [15, 21], [12, 30], [21, 18], [16, 18], [20, 12]], hi); // 번개
    fillPoly(c, [[17, 13], [13, 20], [16, 20], [14, 27], [19, 19], [16, 19], [18, 13]], l);
  },
  // 지뢰 부설 — 지뢰 + 심지 + 불꽃
  powdermaster_s3: (c, [o, d, m, l, hi]) => {
    fillCircle(c, 16, 20, 9, d);            // 본체
    fillCircle(c, 16, 20, 7, m);
    fillCircle(c, 16, 20, 3.5, o);          // 중앙 구멍
    fillCircle(c, 16, 20, 2, l);
    fillRect(c, 15, 8, 2, 6, m);            // 심지
    fillCircle(c, 16, 6, 2.6, l);           // 불꽃
    fillCircle(c, 16, 6, 1.3, hi);
    fillRect(c, 5, 25, 4, 2, m);            // 다리
    fillRect(c, 23, 25, 4, 2, m);
  },
  // 만조 — 밀려오는 파도 3단
  seaking_s3: (c, [o, d, m, l, hi]) => {
    fillPoly(c, [[0, 24], [5, 18], [10, 24], [15, 18], [20, 24], [25, 18], [32, 24], [32, 32], [0, 32]], d);
    fillPoly(c, [[0, 19], [5, 13], [10, 19], [15, 13], [20, 19], [25, 13], [32, 19], [32, 26], [0, 26]], m);
    for (let x = 0; x < S; x += 5) fillRect(c, x, 12 + ((x / 5) % 2) * 2, 3, 2, l); // 파도 마루
    fillCircle(c, 25, 7, 3, l);             // 물방울
    fillCircle(c, 24, 6, 1.4, hi);
  },
  // 전탄 발사 — 포탑 + 양현 포신 + 3점 화염
  dreadnought_s3: (c, [o, d, m, l, hi]) => {
    fillCircle(c, 16, 24, 7, d);            // 포탑
    fillCircle(c, 16, 24, 5, m);
    thickLine(c, 15, 21, 7, 9, 4, d);       // 좌 포신
    thickLine(c, 17, 21, 25, 9, 4, d);      // 우 포신
    fillRect(c, 14, 4, 3, 4, l);            // 중앙 화염
    fillCircle(c, 7, 6, 2.6, l);
    fillCircle(c, 25, 6, 2.6, l);
    fillCircle(c, 15, 3, 1.4, hi);
    fillCircle(c, 7, 6, 1.2, hi);
    fillCircle(c, 25, 6, 1.2, hi);
  },
  // 침몰의 종 — 3중 나선 소용돌이
  seaking_s4: (c, [o, d, m, l, hi]) => {
    const spiral = (r0, r1, turns, col, w) => {
      let prev = null;
      const steps = 90;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ang = t * turns * Math.PI * 2 - Math.PI / 2;
        const r = r0 + (r1 - r0) * t;
        const x = 16 + Math.cos(ang) * r, y = 16 + Math.sin(ang) * r;
        if (prev) thickLine(c, prev[0], prev[1], x, y, w, col);
        prev = [x, y];
      }
    };
    spiral(2, 14, 1.35, d, 5);
    spiral(2, 13, 1.35, m, 3);
    spiral(3, 10, 1.1, l, 1.6);
    fillCircle(c, 16, 16, 2.2, hi);
  },
  // 무쌍 포격 — 중심 폭발 + 8방향
  dreadnought_s4: (c, [o, d, m, l, hi]) => {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      thickLine(c, 16 + Math.cos(a) * 5, 16 + Math.sin(a) * 5, 16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14, 2.6, d);
      thickLine(c, 16 + Math.cos(a) * 7, 16 + Math.sin(a) * 7, 16 + Math.cos(a) * 13, 16 + Math.sin(a) * 13, 1.2, l);
    }
    fillCircle(c, 16, 16, 6, d);
    fillCircle(c, 16, 16, 4.5, m);
    fillCircle(c, 16, 16, 2.6, hi);
  },
  // 2차 파생
  raider_s1: (c, p) => ART.pirate_s1(c, p),
  raider_s2: (c, p) => ART.pirate_c1(c, p),
  raider_s3: (c, p) => ART.powdermaster_s3(c, p),
  raider_s4: (c, p) => ART.dreadnought_s4(c, p),
  corsair_s1: (c, p) => ART.pirate_s2(c, p),
  corsair_s2: (c, p) => ART.pirate_c2(c, p),
  corsair_s3: (c, p) => ART.stormcaptain_s3(c, p),
  corsair_s4: (c, p) => ART.seaking_s4(c, p),
};

const KEYS = {
  pirate_s1: "gold", pirate_s2: "steel", pirate_c1: "smoke", pirate_c2: "steel",
  raider_s1: "fire", raider_s2: "smoke", raider_s3: "fire", raider_s4: "fire",
  corsair_s1: "steel", corsair_s2: "gold", corsair_s3: "storm", corsair_s4: "abyss",
  stormcaptain_s3: "storm", powdermaster_s3: "fire",
  seaking_s3: "sea", seaking_s4: "abyss",
  dreadnought_s3: "fire", dreadnought_s4: "gold",
};

fs.mkdirSync(OUTDIR, { recursive: true });
for (const [name, art] of Object.entries(ART)) {
  const pal = PAL[KEYS[name] || "gold"];
  const c = mkCanvas();
  art(c, pal);
  outline(c, pal[0]);                    // 1px 외곽선 (원본과 동일한 방식)
  const bgp = makeBg(pal);
  const rgba = Buffer.alloc(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    const col = c.fg[i] || bgp[i];
    const [r, g, b] = hex(col);
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = 255;
  }
  writePng(path.join(OUTDIR, `${name}.png`), rgba);
  console.log(`PNG ${name}`);
}
