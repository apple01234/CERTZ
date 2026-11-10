import type { RoomLayout } from "./mapgen";

/** Existing collision-aware navigation, shared by auto-hunt and native road placement. */
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

