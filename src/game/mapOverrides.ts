/**
 * 맵 오버라이드 레지스트리 — 에디터에서 저장한 맵을 게임이 읽는다.
 *
 * [왜 이 파일이 필요한가]
 *  에디터가 JSON 을 내려받기만 하면 사용자 지적("맵메이커 최종 완성")의 절반만 된다.
 *  만든 맵이 **실제 스테이지에 반영**되어야 도구가 완성된다.
 *
 * [동작]
 *  · 에디터에서 저장 → `public/assets/maps/<seed>.json` (정적 파일)
 *  · 게임 부팅 시 `loadMapOverrides()` 가 그 목록을 fetch 해 캐시
 *  · `authoredRoomLayout()` 이 프리셋보다 오버라이드를 **우선** 적용
 *
 * [왜 정적 파일인가]
 *  DB·서버 변경 없이 git 으로 버전 관리되고, APK/Electron 정적 export 에도
 *  그대로 실린다. 사용자 지시 "작업과 무관한 보안·인증·DB 코드는 건드리지 말 것" 준수.
 *
 * [실패 시]
 *  fetch 가 실패해도 게임은 반드시 실행되어야 한다(오프라인·APK 최초 실행).
 *  그래서 모든 경로를 try/catch 로 감싸고, 실패하면 프리셋 레이아웃으로 폴백한다.
 */

import type { RoomLayout } from "./mapgen";
import type { AuthoredTheme } from "./authoredLayouts";

/** 에디터 저장 형식 — `tilemapEditorCore.serializeLayout` 과 동일. */
export type MapOverride = {
  version: 1;
  name: string;
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  openRows: string[];      // "." 개방 / "#" 벽
  pathRows?: string[];     // "=" 길
  entry: number;
  exit: number;
  theme: string;
  ground: string;
  path: string;
  structure: string;
  structureTint: number;
  /* vc253 — solid:true 면 그 셀이 막힌다. 생략하면 순수 장식(충돌 없음). */
  props?: { key: string; cell: number; x: number; y: number; scale: number; solid?: boolean }[];
};

/** seed → 오버라이드. 부팅 시 한 번 채워지고 이후 동기 조회된다. */
const OVERRIDES = new Map<string, MapOverride>();
let loaded = false;

const MANIFEST_URL = "/assets/maps/_index.json";
const BASE = "/assets/maps";

/** 부팅 시 호출 — 매니페스트를 읽어 오버라이드를 메모리에 올린다.
 *  실패해도 throw 하지 않는다(게임 실행이 우선). */
export async function loadMapOverrides(fetcher: typeof fetch = fetch): Promise<number> {
  if (loaded) return OVERRIDES.size;
  loaded = true;
  try {
    const res = await fetcher(MANIFEST_URL, { cache: "no-cache" });
    if (!res.ok) return 0;
    const list = (await res.json()) as { seed: string; file: string }[] | string[];
    const seeds = Array.isArray(list)
      ? list.map((it) => (typeof it === "string" ? it : it.seed)).filter(Boolean)
      : [];
    /* 동시 fetch — 스테이지가 늘어도 부팅이 느려지지 않게 */
    const docs = await Promise.all(
      seeds.map(async (seed) => {
        try {
          const r = await fetcher(`${BASE}/${seed}.json`, { cache: "no-cache" });
          if (!r.ok) return null;
          return [seed, (await r.json()) as MapOverride] as const;
        } catch { return null; }
      }),
    );
    for (const d of docs) if (d && d[1] && Array.isArray(d[1].openRows)) OVERRIDES.set(d[0], d[1]);
  } catch { /* 매니페스트 없음 — 정상(에디터로 아무것도 저장하지 않은 상태) */ }
  return OVERRIDES.size;
}

export function hasMapOverride(seed: string): boolean {
  return OVERRIDES.has(seed);
}

export function mapOverrideSeeds(): string[] {
  return [...OVERRIDES.keys()];
}

/** 오버라이드를 `RoomLayout` 으로 변환한다.
 *  `ok` 가 false 면 호출부는 프리셋 레이아웃을 써야 한다(잘못된 맵으로 게임을 막지 않는다). */
export function overrideToLayout(seed: string): { layout: RoomLayout; ok: boolean } | null {
  const doc = OVERRIDES.get(seed);
  if (!doc) return null;

  const { cols, rows } = doc;
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 3 || rows < 3) return null;
  if (!Array.isArray(doc.openRows) || doc.openRows.length !== rows) return null;

  const open: boolean[] = [];
  const paths = new Array<boolean>(cols * rows).fill(false);
  for (let r = 0; r < rows; r++) {
    const row = String(doc.openRows[r] ?? "");
    if (row.length !== cols) return null;
    for (let c = 0; c < cols; c++) open.push(row[c] === ".");
    const prow = String(doc.pathRows?.[r] ?? "");
    if (prow.length === cols) {
      for (let c = 0; c < cols; c++) if (prow[c] === "=") paths[r * cols + c] = true;
    }
  }

  /* 불변식 — 입구/출구가 열려 있고 서로 달라야 한다. 어기면 프리셋으로 폴백. */
  const entry = Number(doc.entry), exit = Number(doc.exit);
  const ok = Number.isInteger(entry) && Number.isInteger(exit)
    && entry >= 0 && exit >= 0 && entry < open.length && exit < open.length
    && open[entry] && open[exit] && entry !== exit;

  /* ── vc253: props 를 **실제로 넘긴다** ─────────────────────────────────
   *  [버그] 종전엔 이 블록이 없어서 `doc.props` 를 읽지도 않고 버렸다.
   *  그래서 에디터에서 프롭을 아무리 배치해도 게임에는 프리셋 해시 배치만 나왔다.
   *  유저 지적 "타일맵을 코드로 자동배치 하지말고 파일기반으로" 의 직접 원인.
   *
   *  [좌표] 에디터는 cell(인덱스)만 저장하는 경우와 x/y 를 저장하는 경우가 둘 다 있다.
   *  x/y 가 유효하면 그걸 쓰고, 아니면 cell 로부터 격자 중앙을 계산한다.
   *  [solid] 파일에 solid 가 있으면 그 셀을 막는다. 없으면 순수 장식(충돌 없음) —
   *  종전 isSolidDecor 로 자동 충돌체를 붙이던 동작은 파일 기반에서 쓰지 않는다
   *  (그림과 판정이 어긋나 "안 보이는데 막히는 벽"이 생기는 원인이었다). */
  const cw = Number(doc.cellW) || 144;
  const chh = Number(doc.cellH) || 128;
  const placed: NonNullable<NonNullable<RoomLayout["authored"]>["props"]> = [];
  if (Array.isArray(doc.props)) {
    for (const p of doc.props) {
      if (!p || typeof p.key !== "string") continue;
      const cell = Number(p.cell);
      if (!Number.isInteger(cell) || cell < 0 || cell >= open.length) continue;
      const solid = (p as { solid?: boolean }).solid === true;
      if (solid) open[cell] = false;
      const px = Number(p.x), py = Number(p.y);
      const col = cell % cols, row = Math.floor(cell / cols);
      placed.push({
        key: p.key,
        cell,
        x: Number.isFinite(px) && px > 0 ? px : (col + 0.5) * cw,
        y: Number.isFinite(py) && py > 0 ? py : (row + 1) * chh,
        scale: Number(p.scale) || 1,
        solid,
      });
    }
  }

  const layout: RoomLayout = {
    cols, rows,
    cellW: cw,
    cellH: chh,
    open,
    entry: ok ? entry : 0,
    exit: ok ? exit : 0,
    authored: {
      theme: (doc.theme || "library") as AuthoredTheme,
      paths,
      landmarks: [],
      ground: doc.ground || "ground_ash",
      path: doc.path || "ground_slate",
      structure: doc.structure || "ground_cavern",
      structureTint: Number(doc.structureTint) || 0x967958,
      ...(placed.length > 0 ? { props: placed } : {}),
    },
  };
  return { layout, ok };
}

/** 테스트용 — 모듈 상태를 초기화한다. */
export function __resetMapOverrides(): void {
  OVERRIDES.clear();
  loaded = false;
}

/** 테스트/에디터 미리보기용 — 직접 주입. */
export function __setMapOverride(seed: string, doc: MapOverride): void {
  OVERRIDES.set(seed, doc);
}
