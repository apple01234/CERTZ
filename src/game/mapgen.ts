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

/** from → to 최단 경로의 "다음" 셀 (BFS, 자동사냥 경로 유도용) — 같은 셀이면 null */
export function nextStepToward(layout: RoomLayout, from: number, to: number): number | null {
  if (from === to) return null;
  const { cols, rows, open } = layout;
  if (!open[to] || !open[from]) return null;
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
      if (n >= 0 && n < open.length && open[n] && !seen[n]) {
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
