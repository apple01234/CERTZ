/**
 * 타일맵 에디터 — 순수 로직 (지시: "타일맵 에디터").
 *
 * [왜 별도 모듈인가]
 *  에디터는 게임과 **픽셀 단위로 동일한** 결과를 보여야 한다. 렌더 규칙을 에디터에
 *  복사하면 반드시 갈라진다(치수·프레임 선택·스냅·충돌 판정). 그래서 순수 계산만
 *  여기 모으고, `AuthoredMapLayers`(게임)와 에디터가 **같은 함수**를 호출한다.
 *
 *  이 파일은 Phaser/DOM 의존이 없다 — node 테스트에서 그대로 import 해 검증한다.
 */

import { isSolidDecor } from "./decorObjects";

/* ─────────────────────────── 바닥 소스 ─────────────────────────── */

/** 지면 텍스처 규격 — `AuthoredMapLayers.AUTHORED_GROUND_SOURCES` 와 동일해야 한다.
 *  (게임이 이 표를 import 하도록 바꿔 단일 출처로 만든다.)
 *  vc259 — 5종을 256px 무이음새 타일로 교체(unit 32 = 256/8 조각). */
export const GROUND_SOURCES: Record<string, { size: number; unit: number }> = {
  ground_meadow: { size: 256, unit: 32 },
  ground_dirt: { size: 84, unit: 28 },
  ground_sand: { size: 256, unit: 32 },
  ground_forest: { size: 256, unit: 32 },
  ground_slate: { size: 256, unit: 32 },
  ground_ash: { size: 256, unit: 32 },
  ground_violet: { size: 256, unit: 32 },
  ground_cavern: { size: 256, unit: 32 },
};

/** 에디터 팔레트에 노출할 바닥 — 게임에서 실제로 쓰이는 것만(미검증 텍스처 제외). */
export const GROUND_PALETTE = Object.keys(GROUND_SOURCES);

/* ─────────────────────────── 테마 프리셋 ─────────────────────────── */

export type EditorLayerRole = "ground" | "paths" | "structures";

export const GROUND_ROLES: { name: EditorLayerRole; label: string; depth: number }[] = [
  { name: "ground", label: "지면", depth: 0 },
  { name: "paths", label: "길", depth: 0.5 },
  { name: "structures", label: "구조", depth: 2 },
];

/* ─────────────────────────── 타일 프레임 계산 ─────────────────────────── */

/**
 * 특정 셀·역할에 그릴 타일의 gid 를 계산한다. 게임과 **완전히 같은 식**.
 *
 * @returns  gid(1-based), 또는 -1(그리지 않음)
 *
 * [게임 규칙 (AuthoredMapLayers 와 동일)]
 *  · 타일 한 장은 `unit` px, 셀은 `cellW`×`cellH`
 *  · 셀 → 원본 텍스처 좌표를 (c+0.5)*unit / cellW 로 역산해 조각 인덱스를 고른다
 *  · ground 는 항상, paths 는 paths[cell] 일 때만, structures 는 !open[cell] 일 때만
 *  · 아틀라스가 있으면 셀 해시로 4프레임 중 하나를 골라 반복 주기를 4배로 늘린다
 */
export function tileGidFor(opts: {
  role: EditorLayerRole;
  /** 타일 그리드 좌표 (셀 기준이 아니라 unit 기준) */
  tc: number;
  tr: number;
  /** 셀 좌표 */
  cell: number;
  cellOpen: boolean;
  isPath: boolean;
  /** 원본 텍스처의 한 변 조각 수 (size / unit) */
  sourceCols: number;
}): number {
  const { role, tc, tr, cellOpen, isPath, sourceCols } = opts;
  const show = role === "ground" || (role === "paths" ? isPath : !cellOpen);
  if (!show) return -1;
  /* vc259 (지시 #1) — 변형 아틀라스 분기 제거. 256px 무이음새 타일로 교체해
   *  회전 아틀라스가 불필요해졌다(격자를 못 없앴고, 생성기도 삭제).
   *  256px/32px = 8열이므로 64조각을 순환해 반복 주기가 8칸 = 256px 이다. */
  return 1 + (tr % sourceCols) * sourceCols + (tc % sourceCols);
}

/** 지면/길/구조 3개 레이어의 타일 배열을 만든다 — 에디터 미리보기용.
 *  Phaser 없이 순수 배열만 반환하므로 테스트에서 게임 결과와 대조할 수 있다. */
export function buildLayerData(lay: {
  cols: number; rows: number; cellW: number; cellH: number;
  open: boolean[];
  paths?: boolean[];
}, role: EditorLayerRole, sourceKey: string) {
  const src = GROUND_SOURCES[sourceKey];
  if (!src) return null;
  const { size, unit } = src;
  const sourceCols = size / unit;
  const width = lay.cols * lay.cellW;
  const height = lay.rows * lay.cellH;
  const cols = Math.ceil(width / unit);
  const rows = Math.ceil(height / unit);
  const data = Array.from({ length: rows }, (_, tr) =>
    Array.from({ length: cols }, (_, tc) => {
      const x = Math.min(lay.cols - 1, Math.floor(((tc + 0.5) * unit) / lay.cellW));
      const y = Math.min(lay.rows - 1, Math.floor(((tr + 0.5) * unit) / lay.cellH));
      const cell = y * lay.cols + x;
      return tileGidFor({
        role, tc, tr, cell,
        cellOpen: lay.open[cell],
        isPath: !!lay.paths?.[cell],
        sourceCols,
      });
    }),
  );
  return { data, tileWidth: unit, tileHeight: unit, cols, rows };
}

/* ─────────────────────────── 프롭 스냅 ─────────────────────────── */

/** 프롭 키 — public/assets/objects 아래 실제 PNG 와 **1:1** 이어야 한다.
 *  vc253: tools/split_prop_atlas.py 로 낱개 분리한 조각(`__1`, `__2` …)도 포함한다. */
export type PropKey =
  | "obj_dungeon_throne"
  | "obj_dungeon_bookshelf"
  | "obj_dungeon_table__1"
  | "obj_dungeon_table__2"
  | "obj_dungeon_chest"
  | "obj_dungeon_barrel"
  | "obj_dungeon_jar__1"
  | "obj_dungeon_jar__2"
  | "obj_dungeon_anvil"
  | "obj_dungeon_torch"
  | "obj_dungeon_candle"
  | "obj_dungeon_carpet_v"
  | "obj_dungeon_tree_dead__2"
  | "obj_dungeon_stump"
  | "obj_dungeon_pentagram__1"
  | "obj_dungeon_grave__1"
  | "obj_dungeon_grave__2"
  | "obj_dungeon_fence__1"
  | "obj_dungeon_fence__2"
  | "obj_dungeon_fence__3"
  | "obj_dungeon_sign"
  | "obj_forest_tree_orange"
  | "obj_forest_tree_pink"
  | "obj_forest_tree_dried"
  | "obj_forest_rock_monument"
  | "obj_forest_rock__1"
  | "obj_forest_bush"
  | "obj_forest_bush_tall"
  | "obj_forest_sign__1"
  | "obj_forest_trunk"
  | "obj_town_house_blue"
  | "obj_town_stall_stripe__1"
  | "obj_town_stall_stripe__2"
  | "obj_town_vending"
  | "obj_town_bench"
  | "obj_town_barrel"
  | "obj_town_planter"
  | "obj_town_waterfall";

/** 프롭별 최대 점유 칸수 — 실제 PNG 크기에서 계산한다.
 *  vc253: 아래 값들은 tools/split_prop_atlas.py + PNG 헤더로 자동 산출했다.
 *  셀 = 144×128, 큰 축 비율을 0.5칸 단위로 올림(최소 0.5, 최대 2).
 *  손으로 고칠 때는 **파일 크기를 먼저 확인**하고 여기를 맞춘다. */
export const PROP_MAX_CELLS: Record<string, number> = {
/* dungeon */
  obj_dungeon_throne: 0.5,
  obj_dungeon_bookshelf: 1,
  obj_dungeon_table__1: 0.5,
  obj_dungeon_table__2: 0.5,
  obj_dungeon_chest: 0.5,
  obj_dungeon_barrel: 1,
  obj_dungeon_jar__1: 0.5,
  obj_dungeon_jar__2: 0.5,
  obj_dungeon_anvil: 0.5,
  obj_dungeon_torch: 0.5,
  obj_dungeon_candle: 0.5,
  obj_dungeon_carpet_v: 1,
  obj_dungeon_tree_dead__2: 0.5,
  obj_dungeon_stump: 0.5,
  obj_dungeon_pentagram__1: 0.5,
  obj_dungeon_grave__1: 0.5,
  obj_dungeon_grave__2: 0.5,
  obj_dungeon_fence__1: 0.5,
  obj_dungeon_fence__2: 0.5,
  obj_dungeon_fence__3: 0.5,
  obj_dungeon_sign: 0.5,
  /* forest */
  obj_forest_tree_orange: 1,
  obj_forest_tree_pink: 1,
  obj_forest_tree_dried: 1,
  obj_forest_rock_monument: 1,
  obj_forest_rock__1: 1,
  obj_forest_bush: 1,
  obj_forest_bush_tall: 1,
  obj_forest_sign__1: 1,
  obj_forest_trunk: 0.5,
  /* town */
  obj_town_house_blue: 1.5,
  obj_town_stall_stripe__1: 0.5,
  obj_town_stall_stripe__2: 0.5,
  obj_town_vending: 1,
  obj_town_bench: 1,
  obj_town_barrel: 1,
  obj_town_planter: 1,
  obj_town_waterfall: 0.5,
};;

/** 프롭 배율 — 셀 대비 반 칸 배수로 정규화한다(게임과 동일 식). */
export function snapPropScale(srcW: number, srcH: number, baseScale: number, cellW: number, cellH: number, key: string): number {
  const cap = PROP_MAX_CELLS[key] ?? 1;
  const rawW = (srcW * baseScale) / cellW;
  const rawH = (srcH * baseScale) / cellH;
  const cellsW = Math.max(0.5, Math.min(cap, Math.round(rawW * 2) / 2));
  const cellsH = Math.max(0.5, Math.min(cap, Math.round(rawH * 2) / 2));
  const fit = Math.min((cellsW * cellW) / srcW, (cellsH * cellH) / srcH);
  return Math.max(0.5, Math.min(2.5, fit));
}

/** 경계 장식 배치 좌표 — 셀 안쪽으로 밀고 반 칸 격자에 맞춘다(게임과 동일). */
export function edgeDecorPlacement(opts: {
  c: number; r: number; cellW: number; cellH: number; sides: string[]; nudge?: number;
}) {
  const { c, r, cellW, cellH, sides, nudge = 0.28 } = opts;
  let px = (c + 0.5) * cellW;
  let py = (r + 0.5) * cellH;
  if (sides.includes("n")) py -= cellH * nudge;
  else if (sides.includes("s")) py += cellH * nudge;
  if (sides.includes("w")) px -= cellW * nudge;
  else if (sides.includes("e")) px += cellW * nudge;
  const snapInCell = (v: number, cell: number, idx: number) => {
    const half = cell * 0.5;
    const snapped = Math.round(v / half) * half;
    if (snapped >= (idx + 1) * cell || snapped <= idx * cell) return idx * cell + half;
    return snapped;
  };
  return { x: snapInCell(px, cellW, c), y: snapInCell(py, cellH, r) };
}

/** 이 프롭이 발밑 충돌체를 만드는가 — 게임과 동일 규칙(import 공유). */
export function propIsSolid(key: string): boolean {
  return isSolidDecor(key);
}

/* ─────────────────────────── 레이아웃 편집 연산 ─────────────────────────── */

/**
 * 레이아웃 정합성 — 게임이 요구하는 불변식을 만족하는지 검사한다.
 *  · entry/exit 는 open 셀
 *  · 모든 open 셀이 entry 에서 도달 가능(고립된 방 = 갈 수 없는 방)
 *  · 최소 2칸 폭 통로를 보장하지는 않는다(작은 맵에서 불가능) — 경고로만 보고
 */
export function validateLayout(lay: {
  cols: number; rows: number; open: boolean[]; entry: number; exit: number;
}): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { cols, rows, open, entry, exit } = lay;
  if (!open[entry]) errors.push(`입구 셀 ${entry} 이 막혀 있습니다`);
  if (!open[exit]) errors.push(`출구 셀 ${exit} 이 막혀 있습니다`);
  if (entry === exit) errors.push("입구와 출구가 같은 셀입니다");

  /* BFS — entry 에서 도달 가능한 open 셀 */
  const seen = new Uint8Array(cols * rows);
  if (open[entry]) {
    const q = [entry];
    seen[entry] = 1;
    while (q.length) {
      const cur = q.pop()!;
      const cy = Math.floor(cur / cols), cx = cur % cols;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (seen[ni] || !open[ni]) continue;
        seen[ni] = 1;
        q.push(ni);
      }
    }
  }
  const openCount = open.filter(Boolean).length;
  const reachable = seen.reduce((a, b) => a + b, 0);
  if (reachable !== openCount) {
    errors.push(`도달 불가능한 개방 셀 ${openCount - reachable}개 — 갈 수 없는 방이 있습니다`);
  }
  if (!seen[exit]) errors.push("출구에 도달할 수 없습니다");

  /* 2칸 통로 경고 — 1칸 폭만 있으면 플레이어 충돌체가 낄 수 있다 */
  let narrow = 0;
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c;
      if (!open[i]) continue;
      const lr = open[i - 1] || open[i + 1];
      const ud = open[i - cols] || open[i + cols];
      if (!(lr && ud)) narrow++;
    }
  }
  if (narrow > 0) warnings.push(`1칸 폭 통로 후보 ${narrow}칸 — 큰 몬스터가 끼일 수 있습니다`);

  return { ok: errors.length === 0, errors, warnings };
}

/** 빈 레이아웃 생성 — 가장자리를 벽으로 두고 내부를 개방한다. */
export function createLayout(cols: number, rows: number, cellW = 144, cellH = 128) {
  const open = new Array(cols * rows).fill(false);
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) open[r * cols + c] = true;
  }
  const mid = Math.floor(rows / 2);
  open[mid * cols + 1] = true;
  open[mid * cols + (cols - 2)] = true;
  return {
    cols, rows, cellW, cellH, open,
    entry: mid * cols + 1,
    exit: mid * cols + (cols - 2),
    paths: new Array(cols * rows).fill(false),
  };
}

/** 레이아웃을 JSON 으로 (에디터 저장 형식). */
export function serializeLayout(lay: {
  cols: number; rows: number; cellW: number; cellH: number;
  open: boolean[]; paths: boolean[]; entry: number; exit: number;
  theme: string; ground: string; path: string; structure: string; structureTint: number;
  props: { key: string; cell: number; x: number; y: number; scale: number; solid?: boolean }[];
  name?: string;
}) {
  return {
    version: 1 as const,
    name: lay.name ?? "untitled",
    cols: lay.cols, rows: lay.rows,
    cellW: Math.round(lay.cellW * 1000) / 1000,
    cellH: Math.round(lay.cellH * 1000) / 1000,
    /* open 을 행 문자열로 압축 — 사람이 읽고 diff 하기 쉽게 */
    openRows: Array.from({ length: lay.rows }, (_, r) =>
      Array.from({ length: lay.cols }, (_, c) => (lay.open[r * lay.cols + c] ? "." : "#")).join(""),
    ),
    pathRows: Array.from({ length: lay.rows }, (_, r) =>
      Array.from({ length: lay.cols }, (_, c) => (lay.paths[r * lay.cols + c] ? "=" : ".")).join(""),
    ),
    entry: lay.entry, exit: lay.exit,
    theme: lay.theme,
    ground: lay.ground, path: lay.path, structure: lay.structure,
    structureTint: lay.structureTint,
    props: lay.props.map((p) => ({
      key: p.key, cell: p.cell,
      x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100,
      scale: Math.round(p.scale * 1000) / 1000,
      /* vc253 — true 일 때만 적는다. 파일이 짧고, 없으면 장식(충돌 없음)이 기본. */
      ...(p.solid ? { solid: true as const } : {}),
    })),
  };
}

export type SavedLayout = ReturnType<typeof serializeLayout>;

/** JSON → 레이아웃 복원. 손상된 입력은 null. */
export function deserializeLayout(d: unknown) {
  const o = d as Partial<SavedLayout> | null;
  if (!o || typeof o !== "object") return null;
  const { cols, rows } = o;
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || !cols || !rows) return null;
  if (!Array.isArray(o.openRows) || o.openRows.length !== rows) return null;
  const open: boolean[] = [];
  const paths: boolean[] = [];
  for (let r = 0; r < rows; r++) {
    const row = String(o.openRows[r]);
    const prow = String(o.pathRows?.[r] ?? "");
    if (row.length !== cols) return null;
    for (let c = 0; c < cols; c++) {
      open.push(row[c] === ".");
      paths.push(prow[c] === "=");
    }
  }
  return {
    cols, rows,
    cellW: Number(o.cellW) || 144,
    cellH: Number(o.cellH) || 128,
    open, paths,
    entry: Number(o.entry) || 0,
    exit: Number(o.exit) || 0,
    theme: String(o.theme ?? "library"),
    ground: String(o.ground ?? "ground_ash"),
    path: String(o.path ?? "ground_slate"),
    structure: String(o.structure ?? "ground_cavern"),
    structureTint: Number(o.structureTint) || 0x967958,
    props: Array.isArray(o.props) ? o.props : [],
    name: String(o.name ?? "untitled"),
  };
}
