import type { Theme } from "./catalog.ts";
export const TILE_SIZE = 64;
export const MAP_COLS = 16;
export const MAP_ROWS = 10;
export type Point = { x: number; y: number };
export type CampaignMap = {
  ground: string[];
  structures: (string | null)[];
  collision: boolean[];
};

/** Own layouts: visual materials and passage flags are independent layers. */
export function buildCampaignMap(
  theme: Theme,
  episode: number,
  arena = false,
): CampaignMap {
  const ground: string[] = [],
    structures: (string | null)[] = [],
    collision: boolean[] = [];
  const outside = ["garden", "forest", "snow", "desert"].includes(theme);
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const variation = (col * 17 + row * 11 + episode) % 3;
      let key = `floor-${theme}${variation ? `-${variation}` : ""}`;
      let blocked =
        col === 0 || col === MAP_COLS - 1 || row <= 1 || row === MAP_ROWS - 1;
      if (outside && (col === 7 || col === 8 || row === 5)) key = "path";
      if (theme === "harbor" && (col < 2 || col > 13)) {
        key = "water";
        blocked = true;
      }
      if (theme === "volcano" && (col < 2 || col > 13)) {
        key = "lava";
        blocked = true;
      }
      const partition =
        !arena &&
        ["castle", "machine", "ruin"].includes(theme) &&
        col === 6 &&
        row >= 2 &&
        row <= 6 &&
        row !== 4;
      structures.push(partition ? `wall-${theme}` : null);
      ground.push(key);
      collision.push(blocked || partition);
    }
  }
  return { ground, structures, collision };
}
function cellAt(p: Point) {
  const col = Math.floor(p.x / TILE_SIZE),
    row = Math.floor(p.y / TILE_SIZE);
  return col < 0 || row < 0 || col >= MAP_COLS || row >= MAP_ROWS
    ? -1
    : row * MAP_COLS + col;
}
export function canWalkAt(map: CampaignMap, p: Point, radius = 13) {
  return [-radius, radius].every((dx) =>
    [-radius, radius].every((dy) => {
      const cell = cellAt({ x: p.x + dx, y: p.y + dy });
      return cell >= 0 && !map.collision[cell];
    }),
  );
}
/** Bounded 160-cell BFS; never sends click-to-walk through water or walls. */
export function walkingRoute(
  map: CampaignMap,
  from: Point,
  to: Point,
): Point[] {
  const start = cellAt(from),
    end = cellAt(to);
  if (start < 0 || end < 0 || !canWalkAt(map, to)) return [];
  if (start === end) return [to];
  const queue = [start],
    previous = new Map<number, number>([[start, -1]]);
  for (let cursor = 0; cursor < queue.length && !previous.has(end); cursor++) {
    const cell = queue[cursor],
      col = cell % MAP_COLS,
      row = Math.floor(cell / MAP_COLS);
    for (const [x, y] of [
      [col + 1, row],
      [col - 1, row],
      [col, row + 1],
      [col, row - 1],
    ]) {
      const next = y * MAP_COLS + x;
      if (
        x < 0 ||
        x >= MAP_COLS ||
        y < 0 ||
        y >= MAP_ROWS ||
        map.collision[next] ||
        previous.has(next)
      )
        continue;
      previous.set(next, cell);
      queue.push(next);
    }
  }
  if (!previous.has(end)) return [];
  const route: Point[] = [];
  for (let cell = end; cell !== start; cell = previous.get(cell)!)
    route.push({
      x: ((cell % MAP_COLS) + 0.5) * TILE_SIZE,
      y: (Math.floor(cell / MAP_COLS) + 0.5) * TILE_SIZE,
    });
  route.reverse();
  route.push(to);
  return route;
}
