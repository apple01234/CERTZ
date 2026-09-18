import Phaser from "phaser";

/**
 * v3.0 (사용자 지시 #7) — 아이작/개미굴식 구역 레이아웃 생성기
 *
 *  기존: 전 맵이 동일한 직사각형 개방 필드 + 포탈이 양 끝 고정 → 단조로움
 *  신규: 스테이지 키를 시드로 셀 그리드를 성장시켜 "굴" 형태의 개방 셀 집합을 만들고,
 *        나머지 셀은 벽으로 막는다. 포탈은 입구 셀(복귀) / 최원거리 셀(전진)에 배치.
 *
 *  - 시드 = 스테이지 키 → 같은 구역은 항상 같은 구조 (리젠/멀티 동기화 안전)
 *  - 성장 방식: 최근 개방 셀을 이어가는 터널 확장(60%) + 무작위 분기(40%)
 *    → 긴 굴 + 가지치기가 자연스럽게 섞이는 개미굴 형태
 *  - 개방률 45~62% — 너무 텅 비지 않고, 벽이 지루할 만큼 많지도 않게
 */

export type RoomLayout = {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  /** open[r * cols + c] = 개방 셀 */
  open: boolean[];
  entry: number;
  exit: number;
  /* v1.3.0 (#9 층식 구조) — 유저 지시 "레이어와 콜리전을 잘 이용하여 층 식 구조의 타일비맵을 좀 활용해":
   *  level[c] = 0 지상 / 1 단(높은 지대). 단은 걸어 다닐 수 있는 높은 층 — 절벽 면(남측)이
   *  플레이어를 덮는 레이어 연출 + 콜리전으로 통행 차단, 계단(stairs)으로만 오르내린다. */
  level?: Uint8Array;
  /** 단 ↔ 지상 통행이 허용된 계단 셀 (이 셀의 경계는 절벽 콜리전이 없다) */
  stairs?: Set<number>;
};

export function generateRoomLayout(seed: string, mapW: number, mapH: number): RoomLayout {
  const cols = Math.max(4, Math.round(mapW / 400));
  const rows = Math.max(3, Math.round(mapH / 310));
  const cellW = mapW / cols;
  const cellH = mapH / rows;
  const total = cols * rows;
  const rng = new Phaser.Math.RandomDataGenerator([seed + "-rooms"]);
  const idx = (c: number, r: number) => r * cols + c;
  const open = new Array<boolean>(total).fill(false);

  // 입구 셀 — 왼쪽 열 중앙행 (이전 구역 차원문 위치 관례와 유사)
  const midRow = Phaser.Math.Clamp(Math.floor(rows / 2) + rng.between(-1, 0), 1, rows - 2);
  const entry = idx(0, midRow);
  open[entry] = true;

  const target = Phaser.Math.Clamp(Math.round(total * rng.realInRange(0.45, 0.62)), 8, total - 4);
  let opened = 1;
  let tunnelTip = entry; // 터널을 길게 이어가는 팁

  const closedNeighbors = (cell: number): number[] => {
    const c = cell % cols;
    const r = Math.floor(cell / cols);
    const out: number[] = [];
    if (c > 0 && !open[idx(c - 1, r)]) out.push(idx(c - 1, r));
    if (c < cols - 1 && !open[idx(c + 1, r)]) out.push(idx(c + 1, r));
    if (r > 0 && !open[idx(c, r - 1)]) out.push(idx(c, r - 1));
    if (r < rows - 1 && !open[idx(c, r + 1)]) out.push(idx(c, r + 1));
    return out;
  };

  let guard = total * 8;
  while (opened < target && guard-- > 0) {
    // 60% — 마지막 셀에서 이어 굴착(터널) / 40% — 기존 개방 셀에서 분기
    let base = tunnelTip;
    if (rng.frac() >= 0.6 || closedNeighbors(base).length === 0) {
      const cands: number[] = [];
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

  // exit — 입구에서 BFS 최원거리 개방 셀 (전진 차원문/보스 방)
  const exit = bfsFarthest(open, cols, rows, entry);

  return { cols, rows, cellW, cellH, open, entry, exit };
}

/* ================= v1.3.0 (#9 층식 구조) — 단(plateau) 조각 =================
 *  개방 셀 중 인접 2~3개를 골라 "높은 지대(단)"로 승격한다.
 *  · 입구/출구 셀과 그 주변은 제외 (이동 동선 보호)
 *  · 단 경계는 절벽 — WorldScene이 절벽 면(남측) 레이어 + 콜리전을 만든다
 *  · 단 인접 지상 셀 1개를 계단으로 지정 — 유일한 통로
 *  결정적(seed)이므로 같은 구역은 항상 같은 단 구조 (리젠/멀티 안전) */
export function carvePlateaus(lay: RoomLayout, seed: string): void {
  const rng = new Phaser.Math.RandomDataGenerator([seed + "-plateau"]);
  const { cols, rows, open, entry, exit } = lay;
  const idx = (c: number, r: number) => r * cols + c;
  const level = new Uint8Array(cols * rows); // 0 = 지상
  const stairs = new Set<number>();

  // 입구/출구 제외 (셀 중심 기준 2셀 이내)
  const protectedCells = new Set<number>([entry, exit]);
  const guardRing = (cell: number) => {
    const c = cell % cols, r = Math.floor(cell / cols);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const cc = c + dc, rr = r + dr;
        if (cc >= 0 && rr >= 0 && cc < cols && rr < rows) protectedCells.add(idx(cc, rr));
      }
  };
  guardRing(entry);
  guardRing(exit);

  const openNeighbors = (cell: number): number[] => {
    const c = cell % cols, r = Math.floor(cell / cols);
    const out: number[] = [];
    if (c > 0 && open[idx(c - 1, r)]) out.push(idx(c - 1, r));
    if (c < cols - 1 && open[idx(c + 1, r)]) out.push(idx(c + 1, r));
    if (r > 0 && open[idx(c, r - 1)]) out.push(idx(c, r - 1));
    if (r < rows - 1 && open[idx(c, r + 1)]) out.push(idx(c, r + 1));
    return out;
  };

  // 단 후보: 보호 셀이 아니면서 이웃 지상 셀이 2개 이상인 개방 셀
  const candidates: number[] = [];
  for (let i = 0; i < open.length; i++) {
    if (!open[i] || protectedCells.has(i)) continue;
    const nbs = openNeighbors(i).filter((n) => !protectedCells.has(n));
    if (nbs.length >= 1) candidates.push(i);
  }
  if (candidates.length === 0) {
    lay.level = level;
    lay.stairs = stairs;
    return;
  }

  const plateauN = Math.min(candidates.length >= 8 ? 2 : 1, Math.max(1, Math.floor(cols * rows / 10)));
  const used = new Set<number>();
  for (let p = 0; p < plateauN; p++) {
    // 후보 셀에서 성장 — 2~3셀짜리 단 덩어리
    let seed0 = candidates[rng.between(0, candidates.length - 1)];
    if (used.has(seed0)) continue;
    const cells = [seed0];
    used.add(seed0);
    const want = rng.between(2, 3);
    let guard = 12;
    while (cells.length < want && guard-- > 0) {
      const base = cells[rng.between(0, cells.length - 1)];
      const nbs = openNeighbors(base).filter((n) => open[n] && !used.has(n) && !protectedCells.has(n) && !cells.includes(n));
      if (nbs.length === 0) break;
      const next = nbs[rng.between(0, nbs.length - 1)];
      cells.push(next);
      used.add(next);
    }
    for (const c of cells) level[c] = 1;
    // 계단 — 단 셀에 인접한 지상 셀 1개 (보호 셀 회피)
    const stairCands: number[] = [];
    for (const c of cells) {
      for (const n of openNeighbors(c)) {
        if (level[n] === 0 && !protectedCells.has(n) && !cells.includes(n)) stairCands.push(n);
      }
    }
    if (stairCands.length > 0) {
      // 최후의 보루: 후보가 전부 보호셀이면 단 자체를 계단 가능으로 (통행 보장)
      stairs.add(stairCands[rng.between(0, stairCands.length - 1)]);
    } else {
      const anyNb = openNeighbors(cells[0]);
      if (anyNb.length > 0) stairs.add(anyNb[0]);
    }
  }

  lay.level = level;
  lay.stairs = stairs;
}

/** from 셀에서 가장 먼 개방 셀 인덱스 (BFS) */
export function bfsFarthest(open: boolean[], cols: number, rows: number, from: number): number {
  const seen = new Array<boolean>(open.length).fill(false);
  const queue = [from];
  seen[from] = true;
  let last = from;
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    last = cur;
    const c = cur % cols;
    const r = Math.floor(cur / cols);
    const push = (n: number) => {
      if (n >= 0 && n < open.length && open[n] && !seen[n]) {
        seen[n] = true;
        queue.push(n);
      }
    };
    if (c > 0) push(cur - 1);
    if (c < cols - 1) push(cur + 1);
    if (r > 0) push(cur - cols);
    if (r < rows - 1) push(cur + cols);
  }
  return last;
}

/** from → to 최단 경로의 "다음" 셀 (BFS, 자동사냥 경로 유도용) — 같은 셀이면 null
 *  v1.3.0 (#9) — 단(높은 지대) 경계는 계단 셀을 통해서만 통과 (절벽 콜리전과 일치 —
 *  자동사냥이 절벽에 막힌 경로를 따라가 벽에 끼는 버그 원천 차단) */
export function nextStepToward(layout: RoomLayout, from: number, to: number): number | null {
  if (from === to) return null;
  const { cols, rows, open } = layout;
  if (!open[to] || !open[from]) return null;
  const lvl = layout.level;
  const stairs = layout.stairs;
  const canCross = (a: number, b: number): boolean => {
    if (!lvl || !stairs) return true;
    const la = lvl[a] ?? 0;
    const lb = lvl[b] ?? 0;
    if (la === lb) return true;
    return stairs.has(a) || stairs.has(b); // 계단 셀(또는 그 이웃)만 단↔지상 통과
  };
  const prev = new Array<number>(open.length).fill(-1);
  const seen = new Array<boolean>(open.length).fill(false);
  const queue = [from];
  seen[from] = true;
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    if (cur === to) break;
    const c = cur % cols;
    const r = Math.floor(cur / cols);
    const push = (n: number) => {
      if (n >= 0 && n < open.length && open[n] && !seen[n] && canCross(cur, n)) {
        seen[n] = true;
        prev[n] = cur;
        queue.push(n);
      }
    };
    if (c > 0) push(cur - 1);
    if (c < cols - 1) push(cur + 1);
    if (r > 0) push(cur - cols);
    if (r < rows - 1) push(cur + cols);
  }
  if (!seen[to]) return null;
  // to에서 from까지 역추적 — from 바로 다음 셀
  let cur = to;
  while (prev[cur] !== from && prev[cur] !== -1) cur = prev[cur];
  return prev[cur] === from ? cur : null;
}

export function cellIndexOf(layout: RoomLayout, x: number, y: number): number {
  const c = Phaser.Math.Clamp(Math.floor(x / layout.cellW), 0, layout.cols - 1);
  const r = Phaser.Math.Clamp(Math.floor(y / layout.cellH), 0, layout.rows - 1);
  return r * layout.cols + c;
}

export function cellCenterOf(layout: RoomLayout, idx: number): { x: number; y: number } {
  const c = idx % layout.cols;
  const r = Math.floor(idx / layout.cols);
  return { x: (c + 0.5) * layout.cellW, y: (r + 0.5) * layout.cellH };
}

/** 월드 좌표가 개방 영역(패딩 고려)인지 — 스폰/장식 배치 판정용 */
export function isOpenXY(layout: RoomLayout, x: number, y: number, pad = 26): boolean {
  const c = Math.floor(x / layout.cellW);
  const r = Math.floor(y / layout.cellH);
  if (c < 0 || r < 0 || c >= layout.cols || r >= layout.rows) return false;
  if (!layout.open[r * layout.cols + c]) return false;
  const lx = x - c * layout.cellW;
  const ly = y - r * layout.cellH;
  return lx > pad && lx < layout.cellW - pad && ly > pad && ly < layout.cellH - pad;
}
