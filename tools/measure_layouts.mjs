/**
 * measure_layouts.mjs — 9개 챕터 레이아웃 실측 (유저 지적 #6 "맵 구조가 너무 다 똑같음")
 *
 * Phaser 의존 없이 mapgen.ts 의 generateRoomLayout 과 동일한 알고리즘(Alea PRNG)을
 * 사용해 각 챕터 레이아웃을 재현하고, 챕터 간 유사도를 수치로 낸다.
 *
 * ⚠ 이 파일은 mapgen.ts 를 손으로 옮긴 사본이다. mapgen.ts 의 구조 성격
 *   (CHAPTER_STYLE / PROFILE / terrace·circuit 뼈대)을 바꾸면 여기도 함께 고칠 것.
 *   (Phaser 를 Node 에서 부팅할 수 없어 순수 이식본으로 측정한다)
 */

/* ---- Phaser.Math.RandomDataGenerator (Alea) 이식 ---- */
class RNG {
  constructor(seeds) {
    this.s0 = 0; this.s1 = 0; this.s2 = 0; this.c = 1; this.n = 0;
    this.init(seeds);
  }
  init(seeds) {
    const mash = (data) => {
      let n = 0xefc8249d;
      const str = String(data);
      for (let i = 0; i < str.length; i++) {
        n += str.charCodeAt(i);
        let h = 0.02519603282416938 * n;
        n = h >>> 0;
        h -= n;
        h *= n;
        n = h >>> 0;
        h -= n;
        n += h * 0x100000000;
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
  realInRange(min, max) { return this.frac() * (max - min) + min; }
  between(min, max) { return Math.floor(this.realInRange(0, max - min + 1) + min); }
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
  dlcstargate: "circuit", dlcprisma: "terrace", dlcocean: "cavern",
  dlcreverse: "circuit", dlcneocity: "terrace", dlcmech: "circuit",
  dlcswallow: "cavern", dlcopinicia: "terrace", dlcnovel: "grotto",
  dlcsernium: "circuit",
  r1: "grotto", r2: "terrace", r3: "cavern", r4: "circuit", r5: "grotto",
  r6: "terrace", r7: "cavern", r8: "circuit", r9: "grotto", r10: "terrace",
  r11: "cavern", r12: "circuit", r13: "grotto", r14: "terrace", r15: "cavern",
};
const PROFILE = {
  grotto:  { openMin: 0.45, openMax: 0.62, extend: 0.60 },
  cavern:  { openMin: 0.62, openMax: 0.80, extend: 0.30 },
  circuit: { openMin: 0.34, openMax: 0.48, extend: 0.82 },
  terrace: { openMin: 0.52, openMax: 0.66, extend: 0.48 },
};
/* mapgen.ts CELL_TARGET 과 반드시 동일하게 유지 */
const CELL_TARGET = {
  grotto:  { w: 330, h: 250 },
  cavern:  { w: 470, h: 380 },
  circuit: { w: 390, h: 300 },
  terrace: { w: 440, h: 270 },
};

function styleOf(s) {
  const hw = /^(howlrstone\d+)/.exec(s);
  if (hw) {
    const n = parseInt(hw[1].replace("howlrstone", ""), 10);
    return ["grotto", "terrace", "cavern", "circuit"][n % 4];
  }
  const rb = /^(r\d+)/.exec(s);
  if (rb && CHAPTER_STYLE[rb[1]]) return CHAPTER_STYLE[rb[1]];
  const base = /^([a-z]+?)\d/.exec(s)?.[1] ?? s;
  return CHAPTER_STYLE[base] ?? "grotto";
}

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

  const closedNeighbors = (cell) => {
    const c = cell % cols, r = Math.floor(cell / cols);
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

const CH = [
  ["forest", 1900, 1070], ["kingdom", 1750, 990], ["alfheim", 1500, 860],
  ["muspelheim", 2200, 1250], ["niflheim", 1670, 950], ["cave", 1670, 950],
  ["nidavellir", 1670, 950], ["hel", 1670, 950], ["abyss", 1430, 830],
];

const rows = [];
for (const [ch, w, h] of CH) {
  for (const sub of [1, 5, 10]) {
    const key = `${ch}${sub}`;
    const lay = generateRoomLayout(key, w + sub * 130, h + sub * 30);
    rows.push({ key, ch, sub, ...lay });
  }
}

console.log("=== 챕터 sub1 격자 (실측) ===");
console.log("key".padEnd(14), "style".padEnd(9), "cols x rows".padEnd(12), "open%");
for (const r of rows.filter((x) => x.sub === 1)) {
  const opened = r.open.filter(Boolean).length;
  console.log(
    r.key.padEnd(14),
    r.style.padEnd(9),
    `${r.cols} x ${r.rows}`.padEnd(12),
    `${((opened / r.open.length) * 100).toFixed(1)}%`,
  );
}

function norm(r, W = 12, H = 9) {
  const out = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = Math.min(r.cols - 1, Math.floor((x / W) * r.cols));
      const rr = Math.min(r.rows - 1, Math.floor((y / H) * r.rows));
      out.push(r.open[rr * r.cols + c] ? 1 : 0);
    }
  return out;
}
function jaccard(a, b) {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] || b[i]) uni++; if (a[i] && b[i]) inter++; }
  return uni ? inter / uni : 0;
}

const s1 = rows.filter((r) => r.sub === 1).map((r) => ({ ...r, v: norm(r) }));
console.log("\n=== 챕터 간 레이아웃 Jaccard 유사도 (정규화 12x9) ===");
console.log("".padEnd(14) + s1.map((r) => r.ch.slice(0, 6).padStart(7)).join(""));
let tot = 0, n = 0;
for (const a of s1) {
  let line = a.ch.slice(0, 13).padEnd(14);
  for (const b of s1) {
    if (a === b) { line += "   -- "; continue; }
    const j = jaccard(a.v, b.v);
    tot += j; n++;
    line += (j * 100).toFixed(0).padStart(6) + "%";
  }
  console.log(line);
}
console.log(`\n평균 쌍별 유사도: ${((tot / n) * 100).toFixed(1)}%  (${n}쌍)`);
const sizes = new Set(s1.map((r) => `${r.cols}x${r.rows}`));
console.log(`격자 크기 종류: ${sizes.size}/9 → ${[...sizes].join(", ")}`);
const styles = new Set(s1.map((r) => r.style));
console.log(`구조 성격 종류: ${styles.size} → ${[...styles].join(", ")}`);

console.log("\n=== 챕터 내 구역 변화 (sub1 → sub5 → sub10 유사도) ===");
for (const ch of CH) {
  const g = rows.filter((r) => r.ch === ch[0]);
  const v = g.map((r) => norm(r));
  console.log(
    ch[0].padEnd(14),
    `1↔5 ${(jaccard(v[0], v[1]) * 100).toFixed(0)}%`.padEnd(10),
    `5↔10 ${(jaccard(v[1], v[2]) * 100).toFixed(0)}%`.padEnd(10),
    `1↔10 ${(jaccard(v[0], v[2]) * 100).toFixed(0)}%`,
  );
}
