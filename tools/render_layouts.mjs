/**
 * render_layouts.mjs — 9개 챕터 레이아웃을 PNG로 렌더 + 구조 지표 측정
 *
 * 유저 지적 #6 "맵 구조가 너무 다 똑같음" 을 **눈으로** 검증하기 위한 도구.
 * tools/measure_layouts.mjs 의 생성기를 그대로 재사용하되,
 *   ① 실제 격자 해상도로 PNG 를 그려 (벽/바닥 대비) 구조를 확인하고
 *   ② 구조 지표(방 크기·복도 폭·막다른 길·연결도·개방률)를 수치로 낸다.
 *
 * 출력: /root/.hermes/cache/scratch/layout_preview/*.png + 콘솔 지표
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/* ---- Alea PRNG (Phaser RandomDataGenerator 이식) ---- */
class RNG {
  constructor(seeds) {
    this.s0 = 0; this.s1 = 0; this.s2 = 0; this.c = 1;
    this.init(seeds);
  }
  init(seeds) {
    const mash = (data) => {
      let n = 0xefc8249d;
      const str = String(data);
      for (let i = 0; i < str.length; i++) {
        n += str.charCodeAt(i);
        let h = 0.02519603282416938 * n;
        n = h >>> 0; h -= n; h *= n; n = h >>> 0; h -= n; n += h * 0x100000000;
      }
      return (n >>> 0) * 2.3283064365386963e-10;
    };
    const arr = Array.isArray(seeds) ? seeds : [seeds];
    this.s0 = mash(" "); this.s1 = mash(" "); this.s2 = mash(" ");
    for (const s of arr) {
      this.s0 -= mash(s); if (this.s0 < 0) this.s0 += 1;
      this.s1 -= mash(s); if (this.s1 < 0) this.s1 += 1;
      this.s2 -= mash(s); if (this.s2 < 0) this.s2 += 1;
    }
  }
  rnd() {
    const t = 2091639 * this.s0 + this.c * 2.3283064365386963e-10;
    this.c = t | 0; this.s0 = this.s1; this.s1 = this.s2; this.s2 = t - this.c;
    return this.s2;
  }
  frac() { return this.rnd(); }
  realInRange(a, b) { return this.frac() * (b - a) + a; }
  between(a, b) { return Math.floor(this.realInRange(0, b - a + 1) + a); }
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function bfsFarthest(open, cols, rows, from) {
  const dist = new Array(open.length).fill(-1);
  if (!open[from]) return from;
  dist[from] = 0;
  const q = [from];
  let far = from;
  while (q.length) {
    const cur = q.shift();
    const c = cur % cols, r = Math.floor(cur / cols);
    const nb = [];
    if (c > 0) nb.push(cur - 1);
    if (c < cols - 1) nb.push(cur + 1);
    if (r > 0) nb.push(cur - cols);
    if (r < rows - 1) nb.push(cur + cols);
    for (const nn of nb) {
      if (!open[nn] || dist[nn] !== -1) continue;
      dist[nn] = dist[cur] + 1;
      if (dist[nn] > dist[far]) far = nn;
      q.push(nn);
    }
  }
  return far;
}

const CHAPTER_STYLE = {
  forest: "grotto", kingdom: "cavern", alfheim: "terrace",
  muspelheim: "circuit", niflheim: "cavern", cave: "grotto",
  nidavellir: "terrace", hel: "circuit", abyss: "grotto",
};
const PROFILE = {
  grotto:  { openMin: 0.45, openMax: 0.62, extend: 0.60 },
  cavern:  { openMin: 0.62, openMax: 0.80, extend: 0.30 },
  circuit: { openMin: 0.34, openMax: 0.48, extend: 0.82 },
  terrace: { openMin: 0.52, openMax: 0.66, extend: 0.48 },
};
const CELL_TARGET = {
  grotto:  { w: 330, h: 250 },
  cavern:  { w: 470, h: 380 },
  circuit: { w: 390, h: 300 },
  terrace: { w: 440, h: 270 },
};
const styleOf = (s) => CHAPTER_STYLE[/^([a-z]+?)\d/.exec(s)?.[1] ?? s] ?? "grotto";

function generateRoomLayout(seed, mapW, mapH) {
  const style = styleOf(seed);
  const prof = PROFILE[style];
  const cell = CELL_TARGET[style];
  const cols = Math.max(4, Math.round(mapW / cell.w));
  const rows = Math.max(3, Math.round(mapH / cell.h));
  const total = cols * rows;
  const rng = new RNG([seed + "-rooms"]);
  const idx = (c, r) => r * cols + c;
  const open = new Array(total).fill(false);

  const midRow = clamp(Math.floor(rows / 2) + rng.between(-1, 0), 1, rows - 2);
  const entry = idx(0, midRow);
  open[entry] = true;

  const target = clamp(Math.round(total * rng.realInRange(prof.openMin, prof.openMax)), 8, total - 4);
  let opened = 1;
  let tunnelTip = entry;

  const closedNeighbors = (cellI) => {
    const c = cellI % cols, r = Math.floor(cellI / cols);
    const out = [];
    if (c > 0 && !open[idx(c - 1, r)]) out.push(idx(c - 1, r));
    if (c < cols - 1 && !open[idx(c + 1, r)]) out.push(idx(c + 1, r));
    if (r > 0 && !open[idx(c, r - 1)]) out.push(idx(c, r - 1));
    if (r < rows - 1 && !open[idx(c, r + 1)]) out.push(idx(c, r + 1));
    return out;
  };

  if (style === "terrace") {
    const shift = rng.between(0, 2);
    for (let r = 0; r < rows; r++) {
      const lead = Math.max(0, Math.min(cols - 2, Math.round((r + shift) * 0.8) - 1));
      const width = 1 + rng.between(0, 1);
      for (let w = 0; w < width; w++) {
        const c = lead + w;
        if (c >= 0 && c < cols) open[idx(c, r)] = true;
      }
    }
    opened = open.filter(Boolean).length;
    tunnelTip = bfsFarthest(open, cols, rows, entry);
  }
  if (style === "circuit") {
    for (let c = 0; c < cols; c++) open[idx(c, midRow)] = true;
    const vCount = 1 + rng.between(0, 1);
    for (let v = 0; v < vCount; v++) {
      const vc = clamp(rng.between(1, cols - 2), 1, cols - 2);
      for (let r = 0; r < rows; r++) open[idx(vc, r)] = true;
    }
    opened = open.filter(Boolean).length;
    tunnelTip = idx(cols - 1, midRow);
  }

  let guard = total * 8;
  while (opened < target && guard-- > 0) {
    let base = tunnelTip;
    if (rng.frac() >= prof.extend || closedNeighbors(base).length === 0) {
      const cands = [];
      for (let i = 0; i < total; i++) if (open[i] && closedNeighbors(i).length > 0) cands.push(i);
      if (cands.length === 0) break;
      base = cands[rng.between(0, cands.length - 1)];
    }
    const nb = closedNeighbors(base);
    if (nb.length === 0) continue;
    const next = nb[rng.between(0, nb.length - 1)];
    open[next] = true;
    tunnelTip = next;
    opened++;
  }
  const exit = bfsFarthest(open, cols, rows, entry);
  return { cols, rows, cellW: mapW / cols, cellH: mapH / rows, open, entry, exit, style };
}

/* ---- 구조 지표 ---- */
function metrics(lay) {
  const { cols, rows, open, entry, exit } = lay;
  const idx = (c, r) => r * cols + c;
  const opened = open.filter(Boolean).length;

  /* 연결 요소 (개방 셀 그래프) */
  const seen = new Array(open.length).fill(false);
  let comps = 0;
  let largest = 0;
  for (let i = 0; i < open.length; i++) {
    if (!open[i] || seen[i]) continue;
    comps++;
    let size = 0;
    const q = [i]; seen[i] = true;
    while (q.length) {
      const cur = q.shift(); size++;
      const c = cur % cols, r = Math.floor(cur / cols);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
        const n = idx(cc, rr);
        if (open[n] && !seen[n]) { seen[n] = true; q.push(n); }
      }
    }
    largest = Math.max(largest, size);
  }

  /* 막다른 길(이웃 1개) / 교차점(이웃 3개+) */
  let dead = 0, junction = 0, corridor = 0;
  for (let i = 0; i < open.length; i++) {
    if (!open[i]) continue;
    const c = i % cols, r = Math.floor(i / cols);
    let deg = 0;
    if (c > 0 && open[idx(c - 1, r)]) deg++;
    if (c < cols - 1 && open[idx(c + 1, r)]) deg++;
    if (r > 0 && open[idx(c, r - 1)]) deg++;
    if (r < rows - 1 && open[idx(c, r + 1)]) deg++;
    if (deg === 1) dead++;
    else if (deg >= 3) junction++;
    else if (deg === 2) corridor++;
  }

  /* 최장 경로 길이 (entry → exit BFS) */
  const dist = new Array(open.length).fill(-1);
  dist[entry] = 0;
  const q = [entry];
  while (q.length) {
    const cur = q.shift();
    const c = cur % cols, r = Math.floor(cur / cols);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
      const n = idx(cc, rr);
      if (open[n] && dist[n] === -1) { dist[n] = dist[cur] + 1; q.push(n); }
    }
  }

  return {
    openPct: (opened / open.length) * 100,
    comps,
    largestPct: (largest / opened) * 100,
    dead,
    junction,
    corridor,
    corridorPct: (corridor / opened) * 100,
    pathLen: dist[exit],
    cells: open.length,
  };
}

/* ---- 최소 PNG 인코더 (외부 의존 없이) ---- */
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
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePNG(file, width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
}

const SCALE = 44; // 셀 1개 = 44px
const OUT = "/root/.hermes/cache/scratch/layout_preview";
fs.mkdirSync(OUT, { recursive: true });

const CH = [
  ["forest", 1900, 1070], ["kingdom", 1750, 990], ["alfheim", 1500, 860],
  ["muspelheim", 2200, 1250], ["niflheim", 1670, 950], ["cave", 1670, 950],
  ["nidavellir", 1670, 950], ["hel", 1670, 950], ["abyss", 1430, 830],
];

const results = [];
for (const [ch, w, h] of CH) {
  const lay = generateRoomLayout(`${ch}1`, w + 130, h + 30);
  const m = metrics(lay);
  results.push({ ch, ...m, cols: lay.cols, rows: lay.rows, style: lay.style });

  const W = lay.cols * SCALE, H = lay.rows * SCALE;
  const rgb = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = Math.floor(x / SCALE), r = Math.floor(y / SCALE);
      const isOpen = lay.open[r * lay.cols + c];
      const onGrid = x % SCALE === 0 || y % SCALE === 0;
      let col;
      if (!isOpen) col = [22, 24, 30];             // 벽
      else if (onGrid) col = [40, 52, 66];         // 격자선
      else col = [96, 148, 196];                   // 바닥
      const i = (y * W + x) * 3;
      rgb[i] = col[0]; rgb[i + 1] = col[1]; rgb[i + 2] = col[2];
    }
  }
  /* 입구(초록) / 출구(주황) 마커 */
  const mark = (cellI, color) => {
    const c = cellI % lay.cols, r = Math.floor(cellI / lay.cols);
    for (let y = r * SCALE + 6; y < (r + 1) * SCALE - 6; y++)
      for (let x = c * SCALE + 6; x < (c + 1) * SCALE - 6; x++) {
        const i = (y * W + x) * 3;
        rgb[i] = color[0]; rgb[i + 1] = color[1]; rgb[i + 2] = color[2];
      }
  };
  mark(lay.entry, [80, 220, 120]);
  mark(lay.exit, [240, 160, 60]);

  writePNG(path.join(OUT, `${ch}1.png`), W, H, rgb);
}

console.log("=== 구조 지표 (sub1, 실측) ===");
console.log(
  "ch".padEnd(12), "style".padEnd(9), "grid".padEnd(8), "open%".padEnd(7),
  "comp".padEnd(6), "largest%".padEnd(9), "dead".padEnd(6), "junc".padEnd(6),
  "corr%".padEnd(7), "path",
);
for (const r of results) {
  console.log(
    r.ch.padEnd(12), r.style.padEnd(9),
    `${r.cols}x${r.rows}`.padEnd(8),
    r.openPct.toFixed(1).padEnd(7),
    String(r.comps).padEnd(6),
    r.largestPct.toFixed(0).padEnd(9),
    String(r.dead).padEnd(6),
    String(r.junction).padEnd(6),
    r.corridorPct.toFixed(0).padEnd(7),
    r.pathLen,
  );
}

/* 구조 지표 벡터로 챕터 간 거리 (정규화 유클리드) */
const feats = results.map((r) => [r.openPct / 100, r.largestPct / 100, r.dead / 10, r.junction / 10, r.corridorPct / 100, r.pathLen / 10]);
const dist = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.length);
let sum = 0, n = 0, minD = Infinity;
for (let i = 0; i < feats.length; i++)
  for (let j = i + 1; j < feats.length; j++) {
    const d = dist(feats[i], feats[j]);
    sum += d; n++; minD = Math.min(minD, d);
  }
console.log(`\n구조 지표 평균 거리: ${(sum / n).toFixed(3)}  (최소 ${minD.toFixed(3)}) — 클수록 서로 다름`);
console.log(`PNG 출력: ${OUT}`);
