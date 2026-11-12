/**
 * vc278 — 구역 분할 균등도 측정 (브라우저 불필요, 순수 함수만).
 *
 * 왜 이 스크립트가 있나
 * ---------------------
 * 핸드오프 작업 B: "splitCreepZones 의 보로노이 분할이 불균등(6구역 → cells 18/23/11/7/3/2).
 * k-means 스타일 반복(중심 재계산)으로 균등화 검토. 단 결정론은 유지."
 *
 * 브라우저 E2E 는 비싸고 느리다. 분할 균등도는 splitCreepZones 의 **순수 출력**만으로
 * 측정되므로 여기서 먼저 잰다. E2E 는 실제 몰이(ratio) 확인용으로 따로 돌린다.
 *
 * 지표
 * ----
 *  · min/max  구역 셀 수의 최소·최대
 *  · ratio    max/min — 1 에 가까울수록 균등 (1 = 완전 균등)
 *  · cv       변동계수(표준편차/평균) — 0 에 가까울수록 균등
 *  · empty    셀 0개인 구역 수 (있으면 그 종족 몬스터가 통째로 사라진다)
 *
 * 실행: node scripts/measure-zone-balance.mjs
 */
import { splitCreepZones, assignCreepZones } from "../src/game/creepZone.ts";

/** cols x rows 전부 개방 레이아웃 */
function fullLayout(cols, rows) {
  const n = cols * rows;
  return {
    cols, rows,
    open: new Array(n).fill(true),
    entry: 0,
  };
}

/** 열린 셀이 산재한 레이아웃 — 실제 스테이지에 가깝다 (가운데 방 + 통로) */
function caveLayout(cols, rows, seed = 7) {
  const n = cols * rows;
  const open = new Array(n).fill(false);
  // 결정론적 의사난수
  let x = seed >>> 0 || 1;
  const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      // 테두리는 벽, 안쪽은 78% 개방
      if (rnd() < 0.78) open[r * cols + c] = true;
    }
  }
  open[0] = true; // 입구
  return { cols, rows, open, entry: 0 };
}

function stats(zones) {
  const sizes = zones.map((z) => z.cells.length);
  const used = sizes.filter((s) => s > 0);
  if (!used.length) return { min: 0, max: 0, ratio: null, cv: null, empty: sizes.length, sizes };
  const min = Math.min(...used);
  const max = Math.max(...used);
  const mean = used.reduce((a, b) => a + b, 0) / used.length;
  const sd = Math.sqrt(used.reduce((a, b) => a + (b - mean) ** 2, 0) / used.length);
  return {
    min, max,
    ratio: min ? +(max / min).toFixed(2) : null,
    cv: +(sd / mean).toFixed(3),
    empty: sizes.filter((s) => s === 0).length,
    sizes,
  };
}

const cases = [
  { name: "1-1 규모 (개방 57, 종족2, zpg3)", layout: fullLayout(11, 9), groups: 6 },
  { name: "중형 (개방 100, 6구역)", layout: fullLayout(12, 12), groups: 6 },
  { name: "대형 (개방 196, 9구역)", layout: fullLayout(16, 16), groups: 9 },
  { name: "동굴형 (개방 ~150, 6구역)", layout: caveLayout(16, 16), groups: 6 },
  { name: "동굴형 (개방 ~150, 12구역)", layout: caveLayout(16, 16), groups: 12 },
];

console.log("=== splitCreepZones 균등도 ===");
const rows = [];
for (const c of cases) {
  // seq: 결정론 확보를 위해 여러 시드로 돌려 최악값을 본다
  const seeds = ["stage-1-1", "stage-1-2", "stage-2-5", "alpha", "omega", "seed42"];
  let worst = { ratio: 0 }, sumCv = 0, empties = 0;
  for (const s of seeds) {
    const z = splitCreepZones(c.layout, c.groups, s);
    const st = stats(z);
    if (st.ratio !== null && st.ratio > worst.ratio) worst = st;
    sumCv += st.cv ?? 0;
    empties += st.empty;
  }
  const row = {
    case: c.name,
    groups: c.groups,
    "worst ratio": worst.ratio,
    "worst sizes": worst.sizes ? worst.sizes.join("/") : "-",
    "avg cv": +(sumCv / seeds.length).toFixed(3),
    "empty total": empties,
  };
  rows.push(row);
}
console.table(rows);

console.log("\n=== assignCreepZones 반경 편차 (종족별) ===");
/* 작업 B 목표: "종족별 반경 편차 <= 30%" — 종족이 받은 셀들의 무게중심 기준 최대 반경. */
const radiusRows = [];
for (const c of cases.slice(0, 4)) {
  const seeds = ["stage-1-1", "stage-1-2", "stage-2-5", "alpha"];
  const deviations = [];
  for (const s of seeds) {
    const assigned = assignCreepZones(c.layout, 3, s, 3);
    const radii = assigned.map((zs) => {
      const all = zs.flatMap((z) => z.cells);
      if (!all.length) return 0;
      const cols = c.layout.cols;
      const cx = all.reduce((p, v) => p + (v % cols), 0) / all.length;
      const cy = all.reduce((p, v) => p + Math.floor(v / cols), 0) / all.length;
      return Math.max(...all.map((v) => Math.hypot((v % cols) - cx, Math.floor(v / cols) - cy)));
    }).filter((r) => r > 0);
    if (radii.length >= 2) {
      const mx = Math.max(...radii), mn = Math.min(...radii);
      deviations.push(((mx - mn) / mx) * 100);
    }
  }
  const avg = deviations.length ? deviations.reduce((a, b) => a + b, 0) / deviations.length : null;
  radiusRows.push({
    case: c.name,
    "반경 편차 %": avg === null ? "n/a" : +avg.toFixed(1),
    "목표 30% 이내": avg !== null && avg <= 30 ? "PASS" : "FAIL",
  });
}
console.table(radiusRows);
