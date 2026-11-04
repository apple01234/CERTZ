import type Phaser from "phaser";
import type { RoomLayout } from "../mapgen";
import { isSolidDecor } from "../decorObjects";

/** Verified seamless floor textures in assets/ground/manifest.json. Native tiles
 * are sliced/reassembled in the Tilemap, without a raster copy or a prop fallback. */
export const AUTHORED_GROUND_SOURCES: Record<string, { size: number; unit: number }> = {
  ground_meadow: { size: 64, unit: 32 },
  ground_dirt: { size: 84, unit: 28 },
  ground_sand: { size: 84, unit: 28 },
  ground_forest: { size: 96, unit: 32 },
  ground_slate: { size: 96, unit: 32 },
  ground_ash: { size: 96, unit: 32 },
  ground_violet: { size: 96, unit: 32 },
  ground_cavern: { size: 96, unit: 32 },
};

export type AuthoredMapRender = {
  maps: Phaser.Tilemaps.Tilemap[];
  layers: Phaser.Tilemaps.TilemapLayer[];
  images: Phaser.GameObjects.Image[];
};

/** 지면 경계 장식 후보 — **발밑 충돌이 없는 키만** 넣는다.
 *  isSolidDecor 가 true 인 키(bookshelf·barrel·bush 계열 일부·bench·planter·monument·anvil)를
 *  넣으면 통행로에 투명 벽이 생긴다. 여기 있는 키는 전부 바닥 장식/작은 불꽃류다.
 *
 *  [scale 기준] 기존 placeDecor 는 소품을 **원본 픽셀 크기 그대로** 깐다(setScale 없음).
 *  여기서 0.7~0.9 로 줄였더니 촛불(24×40)이 20×34 가 되어 맵 타일(≈144px)의 1/7 —
 *  사실상 점 하나로 보였다(스크린샷 확인).
 *  [대비] 촛불은 실측 주색이 (44,30,49)·(16,18,28) 인 **어두운 남보라**라, 갈색/회색
 *  바닥 위에서 윤곽이 사라졌다(픽셀 검사로 확인). 그래서 테마별로 **밝거나 큰**
 *  소품을 고른다 — torch(불꽃 192px), sign/chest(짙은 대비), bush(7024px) 등. */
const EDGE_PROP: Record<string, { key: string; scale: number }[]> = {
  library: [{ key: "obj_dungeon_torch", scale: 1.4 }, { key: "obj_dungeon_chest", scale: 1 }],
  coast: [{ key: "obj_dungeon_torch", scale: 1.4 }, { key: "obj_dungeon_carpet_v", scale: 1 }],
  grove: [{ key: "obj_forest_bush", scale: 1 }, { key: "obj_forest_bush_tall", scale: 1 }],
  town: [{ key: "obj_dungeon_torch", scale: 1.4 }, { key: "obj_forest_bush", scale: 1 }],
  citadel: [{ key: "obj_dungeon_torch", scale: 1.6 }, { key: "obj_dungeon_sign", scale: 1 }],
  ruins: [{ key: "obj_dungeon_stump", scale: 1.4 }, { key: "obj_forest_bush", scale: 1 }],
  conduit: [{ key: "obj_dungeon_torch", scale: 1.4 }, { key: "obj_dungeon_pentagram", scale: 1.2 }],
  arena: [],
};

/** 결정적 해시 — 같은 구역은 항상 같은 배치(리로드 시 흔들리지 않는다). */
function edgeHash(cell: number, salt: number): number {
  let h = (cell * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 15; h = (h * 2246822519) >>> 0; h ^= h >>> 13;
  return (h >>> 8) / 16777216;
}

/** Ground/path/structure are presentation only. WorldScene builds exact solid
 * bodies from lay.open; an art tile never creates an accidental extra blocker. */
export function renderAuthoredMapLayers(
  scene: Phaser.Scene,
  lay: RoomLayout,
  onDecor?: (image: Phaser.GameObjects.Image) => void,
): AuthoredMapRender | null {
  const art = lay.authored;
  if (!art) return null;
  const roles = [
    { name: "ground", key: art.ground, depth: 0, tint: 0xffffff },
    { name: "paths", key: art.path, depth: 0.5, tint: 0xffffff },
    { name: "structures", key: art.structure, depth: 2, tint: art.structureTint },
  ] as const;
  // Missing/corrupt source images leave the original renderer available to the caller.
  for (const { key } of roles) {
    const source = AUTHORED_GROUND_SOURCES[key];
    if (!source || !scene.textures.exists(key)) return null;
    const image = scene.textures.get(key).getSourceImage();
    if (image.width !== source.size || image.height !== source.size) return null;
  }
  const maps: Phaser.Tilemaps.Tilemap[] = [];
  const layers: Phaser.Tilemaps.TilemapLayer[] = [];
  const width = lay.cols * lay.cellW, height = lay.rows * lay.cellH;
  for (const role of roles) {
    const { size, unit } = AUTHORED_GROUND_SOURCES[role.key];
    const sourceCols = size / unit;
    const cols = Math.ceil(width / unit), rows = Math.ceil(height / unit);
    const data = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => {
      const x = Math.min(lay.cols - 1, Math.floor((c + 0.5) * unit / lay.cellW));
      const y = Math.min(lay.rows - 1, Math.floor((r + 0.5) * unit / lay.cellH));
      const cell = y * lay.cols + x;
      const show = role.name === "ground" || (role.name === "paths" ? art.paths[cell] : !lay.open[cell]);
      return show ? 1 + (r % sourceCols) * sourceCols + c % sourceCols : -1;
    }));
    const map = scene.make.tilemap({ data, tileWidth: unit, tileHeight: unit });
    const tiles = map.addTilesetImage(role.key, role.key, unit, unit, 0, 0, 1);
    // Phaser4's fifth argument explicitly selects the regular, tintable layer.
    const layer = tiles && map.createLayer(0, tiles, 0, 0, false);
    if (!layer || !("setTint" in layer)) {
      map.destroy();
      for (const created of maps) created.destroy();
      return null;
    }
    layer.setName(`rea:${role.name}`).setDepth(role.depth).setTint(role.tint);
    maps.push(map);
    layers.push(layer);
  }
  scene.events.once("shutdown", () => {
    for (const map of maps) map.destroy();
  });
  const images: Phaser.GameObjects.Image[] = [];
  const prop = (key: string, x: number, y: number, scale = 1, tint?: number) => {
    if (!scene.textures.exists(key)) return;
    // Match WorldScene.yDepthFor's9–10 band so canopies sort with actors' feet.
    const depth = 9 + Math.max(0, Math.min(1, y / height)) - 0.001;
    const image = scene.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(depth).setName(`rea:prop:${key}`);
    if (tint) image.setTint(tint);
    images.push(image);
    onDecor?.(image);
  };
  const theme = art.theme;
  /* 지면 경계 장식은 이동을 막으면 안 된다.
   *  [함정] WorldScene 은 prop 마다 attachDecorCollision() 을 호출하고, 그 함수는
   *   isSolidDecor(key) 로 발밑 충돌체를 만든다(bookshelf·barrel·bush·bench 등이 전부 대상).
   *   즉 온갖 소품을 경계에 뿌리면 통행로에 투명 벽이 생긴다.
   *  [해결] 원본 prop 의 onDecor(발밑 충돌) 경로를 타지 않는 전용 emitter 를 쓰고,
   *   발밑 충돌이 없는(또는 아주 얇은) 표시물만 배치한다. 바닥 장식·작은 불꽃류는
   *   isSolidDecor 가 false 라 안전하고, 그 외에는 아래 EDGE_FREE 목록만 허용한다.
   *  → 충돌 0 을 코드가 아니라 **화이트리스트**로 보장한다. */
  const EDGE_FREE = (key: string) => !isSolidDecor(key);
  const propNoCollide = (key: string, x: number, y: number, scale = 1) => {
    if (!scene.textures.exists(key) || !EDGE_FREE(key)) return;
    /* depth 는 위 prop() 과 **같은 규칙**(9~10 밴드)을 쓴다.
     *  [함정] 여기서 자체 식(y / height)을 쓰면 height 가 타일맵 높이라
     *   WorldScene.yDepthFor(y) (= perspDepthOf(y, stageH)) 와 값이 미세하게
     *   어긋나고, 그 오차 때문에 지면/구조 레이어에 깔려 안 보였다(브라우저에서 확인:
     *   depth 30 으로 강제하면 보이고 9.15 에서는 안 보임). */
    const depth = 9 + Math.max(0, Math.min(1, y / height)) - 0.001;
    const image = scene.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(depth).setName(`rea:edge:${key}`);
    images.push(image);
  };
  const structuralProp = theme === "library" ? "obj_dungeon_bookshelf"
    : theme === "grove" ? "obj_forest_tree_pink"
    : theme === "town" ? "obj_town_house_blue"
    : theme === "citadel" ? "obj_dungeon_torch"
    : theme === "ruins" ? "obj_forest_rock_monument"
    : theme === "conduit" ? "obj_dungeon_anvil" : null;
  if (structuralProp) {
    // Solid feet stay inside already-closed cells; presentation cannot seal an aisle.
    for (let r = 1; r < lay.rows - 1 && images.length < 20; r++) {
      for (let c = 1; c < lay.cols - 1 && images.length < 20; c++) {
        const cell = r * lay.cols + c;
        if (lay.open[cell] || (c + r) % (theme === "town" ? 4 : 2)) continue;
        if (![cell - 1, cell + 1, cell - lay.cols, cell + lay.cols].some(i => lay.open[i])) continue;
        const safe = [lay.entry, lay.exit].every(i => Math.abs(c - i % lay.cols) + Math.abs(r - Math.floor(i / lay.cols)) > 2);
        if (!safe) continue;
        prop(structuralProp, (c + 0.5) * lay.cellW, (r + 0.8) * lay.cellH, theme === "grove" ? 2 : 1);
      }
    }
  }
  for (const { kind, cell } of art.landmarks) {
    const x = (cell % lay.cols + 0.5) * lay.cellW;
    const y = (Math.floor(cell / lay.cols) + 0.5) * lay.cellH;
    if (kind.startsWith("gate-")) {
      const colors: Record<string, number> = { "gate-water": 0x76bcff, "gate-wind": 0x8fe8ac, "gate-lightning": 0xe5c977, "gate-fire": 0xf28d79 };
      prop("obj_dungeon_torch", x - lay.cellW * 0.55, y, 1, colors[kind]);
      prop("obj_dungeon_torch", x + lay.cellW * 0.55, y, 1, colors[kind]);
    } else if (kind === "pier") {
      // The pier is three cells wide; a small barrel on its outer corner leaves the route clear.
      prop("obj_dungeon_barrel", x - lay.cellW * 0.75, y + lay.cellH * 0.15);
    } else if (kind === "arena") {
      prop("obj_dungeon_torch", x - lay.cellW * 2, lay.cellH * 1.5);
      prop("obj_dungeon_torch", x + lay.cellW * 2, lay.cellH * 1.5);
    }
  }

  /* ── 지면 경계 장식 (오토타일 엣지) ────────────────────────────────────
   *  [왜] 종전엔 방/복도 모양만 깔려 열린 바닥이 사방으로 뚝 끊겨 보였다.
   *   벽에 닿은 "열린 셀"의 안쪽에 소품을 세워 바닥 윤곽을 읽히게 한다.
   *   클로드 데모의 물가 거품/벽 상단 장식과 같은 발상이지만, 여기서는 실제
   *   런타임 텍스처를 쓰고 판정에는 절대 관여하지 않는다.
   *  [안전 규칙]
   *   · 열린 셀 안쪽으로만 밀어 넣어 통행 폭을 줄이지 않는다(발밑 충돌 없음).
   *   · 입구/출구 반경 2셀은 비운다(스폰·포탈 가림 방지).
   *   · 통행로(art.paths) **안쪽 중앙**에는 세우지 않는다 — 길이 막히면 안 된다.
   *     단 통행로라도 벽에 딱 붙은 가장자리는 허용한다(바닥 윤곽선 역할).
   *   · 최대 28개.
   *  [밀도] 종전 18% + "통행로 제외" 조합이면 coast 테마에서 배치가 0개였다
   *   (coast 는 열린 셀이 전부 통행로). 그래서 규칙을 위처럼 완화하고
   *   후보가 적은 맵은 밀도를 올려 최소 몇 개는 반드시 깔리게 한다. */
  {
    const pool = EDGE_PROP[theme] ?? [];
    if (pool.length > 0) {
      const ec = lay.entry % lay.cols, er = Math.floor(lay.entry / lay.cols);
      const xc = lay.exit % lay.cols, xr = Math.floor(lay.exit / lay.cols);
      const candidates: { cell: number; c: number; r: number; sides: string[] }[] = [];
      for (let r = 1; r < lay.rows - 1; r++) {
        for (let c = 1; c < lay.cols - 1; c++) {
          const cell = r * lay.cols + c;
          if (!lay.open[cell]) continue;
          const sides: string[] = [];
          if (!lay.open[cell - lay.cols]) sides.push("n");
          if (!lay.open[cell + lay.cols]) sides.push("s");
          if (!lay.open[cell - 1]) sides.push("w");
          if (!lay.open[cell + 1]) sides.push("e");
          if (sides.length === 0) continue;
          if (Math.abs(c - ec) + Math.abs(r - er) <= 2) continue;
          if (Math.abs(c - xc) + Math.abs(r - xr) <= 2) continue;
          candidates.push({ cell, c, r, sides });
        }
      }
      // 후보가 적으면 더 촘촘히 깐다(0개 맵 방지). 24개 이상이면 22%.
      /* [vc238-2] 종전 밀도(18~85%)로는 맵당 8~12개만 깔려 카메라 뷰포트(약 54셀)에
       *  1~2개만 보였다 — "바닥 윤곽이 읽힌다"는 목적을 못 살렸다(스크린샷 확인).
       *  벽에 닿은 열린 셀은 **경계선 자체**이므로 장식 예산이 아니라 지형 일부로 본다.
       *  → 후보를 전부 깔되(100%), 스캔 순서 대신 결정적 셔플로 맵 전체에 고르게 퍼뜨린다.
       *  상한은 뷰포트에 항상 여러 개 보일 만큼만 둔다(과밀 방지). */
      const density = 1;
      // 결정적 셔플 — 앞에서부터 채우면 맵 위쪽만 칠해진다.
      candidates.sort((a, b) => edgeHash(a.cell, 23) - edgeHash(b.cell, 23));
      let placed = 0;
      for (const { cell, c, r, sides } of candidates) {
        if (placed >= 96) break;
        if (edgeHash(cell, 7) > density) continue;
        const pick = pool[Math.floor(edgeHash(cell, 11) * pool.length) % pool.length];
        if (!scene.textures.exists(pick.key)) continue;
        // 벽 쪽으로 붙인다 — 셀 안쪽으로 최대 0.3셀까지만 밀어 넣는다.
        const nudge = 0.28;
        let px = (c + 0.5) * lay.cellW;
        let py = (r + 0.5) * lay.cellH;
        if (sides.includes("n")) py -= lay.cellH * nudge;
        else if (sides.includes("s")) py += lay.cellH * nudge;
        if (sides.includes("w")) px -= lay.cellW * nudge;
        else if (sides.includes("e")) px += lay.cellW * nudge;
        /* 발밑 충돌 훅(onDecor)을 타지 않는 경로 — 통행을 줄이지 않는다. */
        propNoCollide(pick.key, px, py, pick.scale);
        placed++;
      }
    }
  }
  return { maps, layers, images };
}
