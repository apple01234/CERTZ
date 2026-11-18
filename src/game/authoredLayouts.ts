import type { RoomLayout } from "./mapgen";
import { overrideToLayout } from "./mapOverrides";
import { storyPlaceOf, type Place } from "./chapterStoryPlan";

export type AuthoredTheme = "library" | "cliff" | "coast" | "grove" | "citadel" | "town" | "ruins" | "conduit" | "arena";
export type AuthoredPresentation = {
  stageKey?: string;
  theme: AuthoredTheme;
  /** Walkable route surface; never a second collision definition. */
  paths: boolean[];
  landmarks: { kind: string; cell: number }[];
  focus?: number;
  ground: string;
  path: string;
  structure: string;
  structureTint: number;
  /** vc253 — 맵 파일(public/maps/*.json)에 **손으로 적은** 프롭 좌표.
   *  있으면 렌더러가 해시 자동 배치 대신 이것만 그린다.
   *  없으면(절차 생성 맵) 종전 자동 배치를 유지한다. */
  props?: { key: string; cell: number; x: number; y: number; scale: number; solid: boolean }[];
};

const THEMES: Record<AuthoredTheme, Pick<AuthoredPresentation, "ground" | "path" | "structure" | "structureTint">> = {
  library: { ground: "ground_ash", path: "ground_slate", structure: "ground_cavern", structureTint: 0x967958 },
  cliff: { ground: "ground_meadow", path: "ground_dirt", structure: "ground_slate", structureTint: 0x788474 },
  coast: { ground: "ground_sand", path: "ground_dirt", structure: "ground_slate", structureTint: 0x467d9a },
  grove: { ground: "ground_meadow", path: "ground_dirt", structure: "ground_forest", structureTint: 0x64855a },
  citadel: { ground: "ground_ash", path: "ground_violet", structure: "ground_slate", structureTint: 0x807891 },
  town: { ground: "ground_meadow", path: "ground_dirt", structure: "ground_ash", structureTint: 0x9a8b78 },
  ruins: { ground: "ground_forest", path: "ground_ash", structure: "ground_cavern", structureTint: 0x8e8398 },
  conduit: { ground: "ground_slate", path: "ground_ash", structure: "ground_violet", structureTint: 0x677aa5 },
  arena: { ground: "ground_slate", path: "ground_ash", structure: "ground_cavern", structureTint: 0x81788f },
};

const ROLE_THEME: Record<Place["role"], AuthoredTheme> = {
  cliff: "cliff", snowfield: "cliff", village: "town", camp: "town", city: "town",
  inn: "library", observatory: "conduit", rail: "conduit", factory: "conduit",
  harbor: "coast", deck: "coast", shore: "coast", road: "grove", garden: "grove",
  sanctuary: "grove", court: "citadel", dungeon: "citadel", tunnel: "citadel",
  throne: "citadel", ruin: "ruins", rift: "ruins", domain: "citadel",
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
  /* [vc258 — 맵에디터] 에디터로 저장한 맵이 있으면 프리셋보다 **우선**한다.
   *  사용자가 직접 배치한 맵을 게임이 무시하면 도구가 무의미해진다.
   *  단 레이아웃이 불변식(입구/출구 개방, 서로 다름)을 어기면 프리셋으로 폴백한다
   *  — 잘못된 맵 하나 때문에 스테이지에 진입할 수 없으면 안 된다. */
  const ov = overrideToLayout(seed);
  if (ov?.ok) {
    const { layout } = ov;
    /* [vc258 주의] 저장된 맵의 open 배열 크기는 **에디터에서 만든 cols×rows** 다.
     *  필드가 다른 크기로 만들어졌다고 여기서 cols/rows 만 바꾸면 배열과 어긋나
     *  인덱스가 깨진다(개방 셀이 엉뚱한 위치로 밀리고 도달 불가 방이 생긴다).
     *  그래서 저장된 맵의 격자를 **그대로** 쓰고, 렌더러가 필드 크기에 맞춰
     *  타일을 늘려 그리게 둔다. 셀 크기만 필드에 맞춰 늘린다. */
    return {
      ...layout,
      cellW: mapW / layout.cols,
      cellH: mapH / layout.rows,
    };
  }

  const site = storyPlaceOf(seed);
  if (!site) return null;
  const { place, sub } = site;
  const theme = place.boss ? "arena" : ROLE_THEME[place.role];
  const cols = Math.max(10, Math.floor(mapW / 144));
  const rows = Math.max(8, Math.floor(mapH / 128));
  const open = new Array<boolean>(cols * rows).fill(false);
  const paths = new Array<boolean>(open.length).fill(false);
  const landmarks: AuthoredPresentation["landmarks"] = [];
  const mid = Math.floor((rows - 1) / 2), center = Math.floor(cols / 2);
  const left = Math.max(3, Math.floor(cols * .26)), right = cols - 4;
  const top = 1, bottom = rows - 2;
  const bend = sub % 2 ? Math.max(top + 1, mid - 2) : Math.min(bottom - 1, mid + 2);
  const rect = (x0: number, y0: number, x1: number, y1: number, path = false) => {
    for (let y = Math.max(top, y0); y <= Math.min(bottom, y1); y++) {
      for (let x = Math.max(1, x0); x <= Math.min(cols - 2, x1); x++) {
        const cell = y * cols + x;
        open[cell] = true;
        if (path) paths[cell] = true;
      }
    }
  };
  type Cell = [number, number];
  const start: Cell = [1, mid], end: Cell = [cols - 2, mid];
  const route = (points: Cell[], width = 2) => {
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1], [bx, by] = points[i];
      rect(Math.min(ax, bx) - width + 1, Math.min(ay, by) - width + 1,
        Math.max(ax, bx) + width, Math.max(ay, by) + width, true);
    }
  };
  const court = (x: number, y: number, rx: number, ry: number) => {
    for (let dy = -ry; dy <= ry; dy++) {
      const corner = Math.abs(dy) === ry ? 1 : 0;
      rect(x - rx + corner, y + dy, x + rx - corner, y + dy);
    }
  };
  const mark = (kind: string, x: number, y: number) => {
    const cell = y * cols + x;
    if (open[cell]) landmarks.push({ kind, cell });
  };
  const turningRoad = () => route([start, [left, mid], [left, bend], [right, bend], [right, mid], end]);

  if (place.boss) {
    // Keep boss bodies and telegraphed attacks inside one uninterrupted combat floor.
    rect(2, top, cols - 3, bottom);
    route([start, end]);
    mark("arena", center, mid);
  } else switch (place.role) {
    case "cliff":
      route([start, end]);
      court(left + 1, mid - 1, 3, 2);
      rect(center, mid + 2, right, mid + 3);
      mark("cliff", right, mid + 2);
      break;
    case "village":
      route([start, end]);
      court(left, mid - 1, 3, 2);
      court(right, mid + (sub % 2 ? -1 : 1), 2, 2);
      rect(center - 1, mid + 2, center + 2, bottom);
      mark("village", right - 1, mid);
      break;
    case "inn":
      route([start, end]);
      rect(left - 1, top, center - 1, mid);
      rect(center + 1, mid + 1, right + 1, bottom);
      mark("inn", left + 1, mid - 1);
      break;
    case "harbor":
      route([start, end]);
      rect(left - 1, top, right + 1, mid);
      for (const x of [left + 1, right]) {
        route([[x, mid], [x, bottom - 1]], 1);
        rect(x - 1, bottom - 1, x + 1, bottom);
        mark("pier", x, bottom);
      }
      break;
    case "deck":
      route([start, end]);
      for (let x = 2; x < cols - 2; x++) {
        const beam = Math.min(x - 1, cols - 2 - x, Math.max(2, mid - 1));
        rect(x, mid - beam, x, mid + beam);
      }
      mark("deck", center, mid);
      break;
    case "shore":
      turningRoad();
      court(left + 1, mid, 4, 2);
      rect(right - 1, bend - 1, right + 2, mid + 1);
      route([[right, mid], [right, bottom - 1]], 1);
      mark("pier", right, bottom - 1);
      break;
    case "observatory":
      route([start, end]);
      court(center, mid, Math.max(3, right - center), Math.max(2, mid - 1));
      rect(left, top, left + 1, mid);
      rect(right, mid, right + 1, bottom);
      mark("observatory", center, mid);
      break;
    case "road":
    case "snowfield":
      turningRoad();
      court(left, mid, 2, 2);
      court(center, bend, 2, 2);
      court(right, mid, 2, 2);
      mark(place.role, center, bend);
      break;
    case "garden":
    case "sanctuary":
      turningRoad();
      court(left, mid, 2, 2);
      court(right, mid, 3, 2);
      if (place.role === "garden") {
        const branch = bend < mid ? bottom - 1 : top + 1;
        route([[left, mid], [left, branch], [right, branch], [right, mid]], 1);
      }
      mark(place.role, right - 1, mid);
      break;
    case "camp":
      route([start, end]);
      for (const x of [left, right]) {
        rect(x - 1, top, x + 1, mid);
        rect(x - 1, mid + 1, x + 1, bottom);
        mark("camp", x, mid + 1);
      }
      break;
    case "tunnel":
    case "dungeon":
      route([start, end]);
      rect(left - 1, top, left + 1, mid);
      rect(right - 2, mid, right + 1, bottom);
      if (sub % 2 === 0) rect(center - 1, top, center, mid);
      mark(place.role, right - 1, mid + 1);
      break;
    case "throne":
      route([start, end]);
      court(right - 1, mid, 3, Math.max(2, mid - 1));
      rect(left - 1, top + 1, left + 1, bottom - 1);
      mark("throne", right, mid);
      break;
    case "court":
    case "domain":
      route([start, end]);
      court(center, mid, Math.max(3, right - center), Math.max(2, mid - 1));
      if (place.role === "court") rect(left, bend - 1, left + 2, mid + 1);
      mark(place.role, center, mid);
      break;
    case "rift":
      route([start, [left, mid], [center, mid], [center, bend], [right, bend], [right, mid], end], 1);
      court(left, mid, 2, 2);
      court(center, bend, 2, 2);
      court(right, mid, 2, 2);
      mark("rift", center, bend);
      break;
    case "rail":
      route([start, end]);
      rect(left - 1, mid - 2, center - 1, mid);
      rect(center + 1, mid, right + 1, mid + 3);
      mark("rail", center, mid);
      break;
    case "factory":
      turningRoad();
      rect(left - 1, top, left + 2, mid + 1);
      rect(right - 2, mid, right + 1, bottom);
      mark("factory", right - 1, mid);
      break;
    case "city":
      turningRoad();
      court(left + 1, mid, 3, 2);
      court(right, mid, 2, 2);
      if (sub % 2 === 0) route([[left, mid], [right, mid]], 1);
      mark("city", left + 1, mid);
      break;
    case "ruin":
      turningRoad();
      court(left, mid, 2, 2);
      rect(center - 1, bend - 1, center + 1, bend + 1);
      court(right, mid + 1, 2, 2);
      mark("ruin", right - 1, mid);
      break;
  }

  const entry = mid * cols + 1;
  const exit = mid * cols + cols - 2;
  rect(1, mid - 1, 2, mid + 1, true);
  rect(cols - 3, mid - 1, cols - 2, mid + 1, true);
  return {
    cols, rows, cellW: mapW / cols, cellH: mapH / rows, open, entry, exit,
    authored: {
      stageKey: seed, theme, paths, landmarks,
      focus: landmarks.find(marker => !marker.kind.startsWith("gate-"))?.cell,
      ...THEMES[theme],
    },
  };
}
