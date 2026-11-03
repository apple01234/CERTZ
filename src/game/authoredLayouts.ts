import { HOWLRSTONE_CHAPTERS } from "./howlrstone";
import type { RoomLayout } from "./mapgen";

export type AuthoredTheme = "library" | "coast" | "grove" | "citadel" | "town" | "ruins" | "conduit" | "arena";
export type AuthoredPresentation = {
  theme: AuthoredTheme;
  /** Walkable route surface; never a second collision definition. */
  paths: boolean[];
  landmarks: { kind: string; cell: number }[];
  ground: string;
  path: string;
  structure: string;
  structureTint: number;
};

const THEMES: Record<AuthoredTheme, Pick<AuthoredPresentation, "ground" | "path" | "structure" | "structureTint">> = {
  library: { ground: "ground_ash", path: "ground_slate", structure: "ground_cavern", structureTint: 0x967958 },
  coast: { ground: "ground_sand", path: "ground_dirt", structure: "ground_slate", structureTint: 0x467d9a },
  grove: { ground: "ground_meadow", path: "ground_dirt", structure: "ground_forest", structureTint: 0x64855a },
  citadel: { ground: "ground_ash", path: "ground_violet", structure: "ground_slate", structureTint: 0x807891 },
  town: { ground: "ground_meadow", path: "ground_dirt", structure: "ground_ash", structureTint: 0x9a8b78 },
  ruins: { ground: "ground_forest", path: "ground_ash", structure: "ground_cavern", structureTint: 0x8e8398 },
  conduit: { ground: "ground_slate", path: "ground_ash", structure: "ground_violet", structureTint: 0x677aa5 },
  arena: { ground: "ground_slate", path: "ground_ash", structure: "ground_cavern", structureTint: 0x81788f },
};

const CHAPTER_THEMES: AuthoredTheme[] = ["library", "town", "coast", "coast", "town", "grove", "ruins", "ruins", "grove", "citadel", "citadel", "ruins", "citadel", "ruins", "town"];
const PLANET_THEMES: Record<string, AuthoredTheme> = {
  stargate: "conduit", prisma: "ruins", ocean: "coast", reverse: "conduit", neocity: "town",
  mech: "conduit", swallow: "coast", opinicia: "ruins", novel: "grove", sernium: "citadel",
};

/** Clearance spans adjacent open cells; a visual grid seam is not an obstacle. */
export function authoredOpenXY(lay: RoomLayout, x: number, y: number, pad: number): boolean {
  const left = Math.floor((x - pad) / lay.cellW), right = Math.floor((x + pad) / lay.cellW);
  const top = Math.floor((y - pad) / lay.cellH), bottom = Math.floor((y + pad) / lay.cellH);
  if (left < 0 || top < 0 || right >= lay.cols || bottom >= lay.rows) return false;
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) if (!lay.open[r * lay.cols + c]) return false;
  }
  return true;
}

/** Original placement data, informed by retained WYDTTM room/transfer graphs and
 * Bloodkeeper's distinct ground/collision layers. No reference-game map is copied.
 * Evidence: docs/campaign/REFERENCE_DEEP_ANALYSIS.md sections 7–8. */
export function authoredRoomLayout(seed: string, mapW: number, mapH: number): RoomLayout | null {
  const story = /^howlrstone(\d+)x(\d+)$/.exec(seed);
  const planet = /^dlc([a-z]+)([1-9]|10)$/.exec(seed);
  let theme: AuthoredTheme;
  let variant: number;
  if (story) {
    const chapter = Number(story[1]), sub = Number(story[2]);
    const spec = HOWLRSTONE_CHAPTERS.find((item) => item.key === `howlrstone${chapter}`);
    if (!spec || sub < 1 || sub > spec.stages) return null;
    theme = spec.boss && sub === spec.stages ? "arena" : CHAPTER_THEMES[chapter - 1];
    variant = sub;
  } else if (planet && PLANET_THEMES[planet[1]]) {
    variant = Number(planet[2]);
    theme = variant === 10 ? "arena" : PLANET_THEMES[planet[1]];
  } else {
    return null;
  }

  const cols = Math.max(10, Math.floor(mapW / 144));
  const rows = Math.max(8, Math.floor(mapH / 128));
  const open = new Array<boolean>(cols * rows).fill(false);
  const paths = new Array<boolean>(open.length).fill(false);
  const landmarks: AuthoredPresentation["landmarks"] = [];
  const mid = Math.floor((rows - 1) / 2);
  const left = Math.max(3, Math.floor(cols * 0.28));
  const right = Math.min(cols - 4, Math.floor(cols * 0.7));
  const upper = 1, lower = rows - 3;
  const rect = (x0: number, y0: number, x1: number, y1: number, path = false) => {
    for (let y = Math.max(1, y0); y <= Math.min(rows - 2, y1); y++) {
      for (let x = Math.max(1, x0); x <= Math.min(cols - 2, x1); x++) {
        const index = y * cols + x;
        open[index] = true;
        if (path) paths[index] = true;
      }
    }
  };
  // Two-cell corridors leave room for the existing player/monster bodies and entry +70px.
  const route = (points: number[][]) => {
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1], [bx, by] = points[i];
      rect(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx) + 1, Math.max(ay, by) + 1, true);
    }
  };
  const mark = (kind: string, x: number, y: number) => landmarks.push({ kind, cell: y * cols + x });

  if (theme === "library") {
    // Reading rooms above/below a spine, with solid stack islands between aisles.
    route([[1, mid], [cols - 3, mid]]);
    for (let x = 2; x <= cols - 4; x += 4) {
      rect(x, 1, x + 2, mid - 1);
      rect(x, mid + 2, x + 2, rows - 2);
      route([[x + (variant % 2), 1], [x + (variant % 2), rows - 3]]);
      mark("archive", x + 1, 1);
    }
  } else if (theme === "coast") {
    const bend = variant % 2 ? upper : Math.max(1, mid - 1);
    route([[1, mid], [left, mid], [left, bend], [cols - 3, bend], [cols - 3, mid]]);
    for (const x of [left + 2, right]) {
      route([[x, bend], [x, lower]]);
      rect(x - 1, lower, x + 1, rows - 2, true);
      mark("pier", x, rows - 2);
    }
  } else if (theme === "grove") {
    // A connected ring around an unwalkable grove, with broad clearing rooms.
    route([[1, mid], [left, mid], [left, upper], [right, upper], [right, lower], [left, lower], [left, mid]]);
    route([[right, mid], [cols - 3, mid]]);
    rect(1, mid - 1, left, mid + 1);
    rect(right, mid - 1, cols - 2, mid + 1);
    if (variant % 2 === 0) route([[left, mid], [right, mid]]);
    mark("grove", left, upper);
  } else if (theme === "citadel") {
    const cx = Math.floor(cols / 2);
    rect(cx - 1, mid - 1, cx + 1, mid + 1, true);
    route([[1, mid], [cols - 3, mid]]);
    route([[cx, upper], [cx, lower]]);
    // Four gated side rooms, each reached through a two-cell passage.
    for (const [kind, x, y] of [["gate-water", 3, upper], ["gate-wind", cols - 4, upper], ["gate-lightning", 3, lower], ["gate-fire", cols - 4, lower]] as const) {
      rect(x - 1, y, x + 1, y + 1);
      route([[x, y], [x, mid]]);
      mark(kind, x, y);
    }
  } else if (theme === "arena") {
    // Combat ground has no internal collision islands or narrow random tunnels.
    rect(2, 1, cols - 3, rows - 2);
    route([[1, mid], [cols - 3, mid]]);
    rect(left, mid - 1, right + 1, mid + 1, true);
    mark("arena", Math.floor(cols / 2), mid);
  } else if (theme === "town") {
    // Staggered courtyards joined by a dogleg street, not a random cavern.
    const bend = variant % 2 ? upper : lower;
    rect(1, mid - 1, left, mid + 1);
    rect(right, mid - 1, cols - 2, mid + 1);
    rect(left, bend, right + 1, bend + 1);
    route([[1, mid], [left, mid], [left, bend], [right, bend], [right, mid], [cols - 3, mid]]);
    mark("court", left, bend);
  } else if (theme === "conduit") {
    // Three linked platforms and two bends form an industrial transit route.
    const bend = variant % 2 ? upper : lower;
    route([[1, mid], [left, mid], [left, bend], [right, bend], [right, mid], [cols - 3, mid]]);
    rect(1, mid - 1, 3, mid + 1);
    rect(left, bend, right, bend + 1);
    rect(cols - 4, mid - 1, cols - 2, mid + 1);
    mark("relay", Math.floor((left + right) / 2), bend);
  } else {
    // Ruin chambers vary which side the cross passage runs along.
    const bend = variant % 2 ? upper : lower;
    rect(1, mid - 1, left, mid + 1);
    rect(right, mid - 1, cols - 2, mid + 1);
    route([[1, mid], [left, mid], [left, bend], [right, bend], [right, mid], [cols - 3, mid]]);
    rect(left + 1, bend, right - 1, bend + 1);
    mark("ruin", right, mid);
  }

  const entry = mid * cols + 1;
  const exit = mid * cols + cols - 2;
  // Keep both portals on the authored main route, even in small map variants.
  rect(1, mid, 2, mid + 1, true);
  rect(cols - 3, mid, cols - 2, mid + 1, true);
  return {
    cols, rows, cellW: mapW / cols, cellH: mapH / rows, open, entry, exit,
    authored: { theme, paths, landmarks, ...THEMES[theme] },
  };
}
