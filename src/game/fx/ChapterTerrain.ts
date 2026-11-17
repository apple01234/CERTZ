import type Phaser from "phaser";
import terrain from "../../../public/assets/chapter-terrain/manifest.json" with { type: "json" };
import storyTerrain from "../../../public/assets/chapter-terrain/story-terrain.json" with { type: "json" };
import { storyPlaceOf, type Place, type TerrainMaterial } from "../chapterStoryPlan";
import type { RoomLayout } from "../mapgen";
import { nextStepToward } from "../navigation";
import type { AuthoredMapRender } from "./AuthoredMapLayers";

export const TERRAIN_KEY = "chapter_terrain";
const materials = terrain.materials as Record<TerrainMaterial, { tiles: number[]; center: number; edge: boolean }>;
const details = storyTerrain.groups;
const ROSE_KEY = "story_rose_core";
type Detail = keyof typeof details;

const INLAYS: Partial<Record<Place["role"], Detail>> = {
  observatory: "mosaic", court: "marble", throne: "marble", city: "marble",
  garden: "flowers", sanctuary: "flowers", rail: "grates", factory: "grates",
  deck: "grates", rift: "crystal", snowfield: "ice", domain: "crystal", ruin: "gravel",
};
const WALL_TILES: Partial<Record<TerrainMaterial, Detail>> = {
  castle: "masonry", ruin: "brick", machine: "metal", snow: "ice",
};

export function preloadChapterTerrain(scene: Phaser.Scene): void {
  scene.load.image(TERRAIN_KEY, "chapter-terrain/story-terrain.png");
  scene.load.image(ROSE_KEY, "chapter-terrain/stargate-rose-core.png");
  for (const name of Object.keys(materials)) scene.load.image(`terrain_${name}`, `chapter-terrain/${name}.png`);
}

/** Fine tiles inherit the exact authored collision cells, including their fractional world size.
 *  vc278 — framedRoom 이면 **열린 셀에만** 지면/경계를 칠한다(검은 배경에 떠 있는 방).
 *  종전에는 모든 셀에 지면이 깔려 방이 스테이지를 꽉 채웠다. */
export function chapterTerrainData(lay: RoomLayout, place: Place, framedRoom = false) {
  const detail = 4, cols = lay.cols * detail, rows = lay.rows * detail;
  const cellOf = (c: number, r: number) => Math.floor(r / detail) * lay.cols + Math.floor(c / detail);
  const open = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows && lay.open[cellOf(c, r)];
  const variation = (ids: readonly number[], c: number, r: number) => ids[((c * 37 + r * 61) ^ (c * r * 7)) % ids.length];
  const tile = (material: TerrainMaterial, c: number, r: number) => {
    const mat = materials[material];
    if (mat.edge && material !== "rock") {
      const x = !open(c - 1, r) ? 0 : !open(c + 1, r) ? 2 : 1;
      const y = !open(c, r - 1) ? 0 : !open(c, r + 1) ? 2 : 1;
      return mat.tiles[y * 3 + x];
    }
    return variation(mat.tiles, c, r);
  };
  // Reuse gameplay navigation to draw ONE continuous road, rather than a cross in every cell.
  const road = new Set<number>();
  // Six fine tiles (about 192–240px) leave room for several character bodies.
  // Clip against the shared walkable mask so wider bends never paint over walls.
  const railRoute: { x: number; y: number }[] = [];
  const railPoint = (cell: number) => ({ x: (cell % lay.cols + .5) * lay.cellW, y: (Math.floor(cell / lay.cols) + .5) * lay.cellH });
  const paint = (x: number, y: number) => {
    for (let dx = -3; dx < 3; dx++) for (let dy = -3; dy < 3; dy++) {
      if (open(x + dx, y + dy)) road.add((y + dy) * cols + x + dx);
    }
  };
  let cur = lay.entry;
  for (let count = 0; count < lay.open.length && cur !== lay.exit; count++) {
    const next = nextStepToward(lay, cur, lay.exit); if (next === null) break;
    if (place.role === "rail") railRoute.push(railPoint(cur));
    const x0 = cur % lay.cols * detail + 2, y0 = Math.floor(cur / lay.cols) * detail + 2;
    const x1 = next % lay.cols * detail + 2, y1 = Math.floor(next / lay.cols) * detail + 2;
    for (let i = 0; i <= detail; i++) paint(x0 + Math.sign(x1 - x0) * i, y0 + Math.sign(y1 - y0) * i);
    cur = next;
  }
  if (railRoute.length) railRoute.push(railPoint(cur));
  const accents = new Map<number, Detail>();
  const isScarlet = lay.authored?.stageKey?.startsWith("lilacworld11") || place.boss === "scarlet_blood";
  const accent = place.floor === "snow" ? "ice" : isScarlet ? "redStone" : INLAYS[place.role];
  if (accent) for (const { cell } of lay.authored?.landmarks ?? []) {
    const x = cell % lay.cols * detail + 2, y = Math.floor(cell / lay.cols) * detail + 2;
    const ring = place.role === "observatory" || place.role === "domain" || !!place.boss;
    const garden = accent === "flowers";
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      if (!open(x + dx, y + dy)) continue;
      const radius = dx * dx + dy * dy;
      const decorative = ring ? radius >= 14 && radius <= 27
        : garden ? Math.abs(dy) === 3 && Math.abs(dx) < 4
        : (place.role === "rail" || place.role === "deck") ? Math.abs(dy) === 2
        : Math.abs(dx) <= 3 && Math.abs(dy) <= 3 && radius <= 17;
      if (decorative) accents.set((y + dy) * cols + x + dx, accent);
    }
  }

  const boundary = WALL_TILES[place.border];
  const ground: number[][] = [], border: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const g: number[] = [], b: number[] = [];
    for (let c = 0; c < cols; c++) {
      const isOpen = open(c, r);
      const index = r * cols + c;
      const mat = road.has(index) ? place.path : place.floor;
      const overlay = accents.get(index);
      if (isOpen) {
        const floor = overlay ? details[overlay] : mat === "grass" ? details.meadow : undefined;
        g.push(floor ? variation(floor, c, r) : tile(mat, c, r));
        b.push(-1);
        continue;
      }
      g.push(-1);
      const edge = open(c, r - 1) || open(c, r + 1) || open(c - 1, r) || open(c + 1, r);
      if (framedRoom && !edge) b.push(-1);
      else if (place.border === "water") {
        const shallows = place.role !== "deck" && [1, 2].some(n => open(c, r - n) || open(c, r + n) || open(c - n, r) || open(c + n, r));
        b.push(variation(shallows ? details.shoal : details.deepWater, c, r));
      }
      else if (boundary) b.push(variation(details[boundary], c, r));
      else if (place.border !== "rock") b.push(variation(materials[place.border].tiles, c, r));
      else if (open(c, r - 1)) b.push(materials.rock.tiles[9 + c % 3]);
      else b.push(edge ? materials.rock.center : -1);
    }
    ground.push(g); border.push(b);
  }
  return { ground, border, tileW: lay.cellW / detail, tileH: lay.cellH / detail, detail, railRoute };
}

/** Rendering only; existing WorldScene route bodies remain the sole source of collision. */
export function renderChapterTerrain(scene: Phaser.Scene, lay: RoomLayout, onDecor?: (image: Phaser.GameObjects.Image) => void, framedRoom = false): AuthoredMapRender | null {
  const site = storyPlaceOf(lay.authored?.stageKey ?? "");
  const place = site?.place;
  if (!place || !scene.textures.exists(TERRAIN_KEY)) return null;
  const data = chapterTerrainData(lay, place, framedRoom);
  const maps: Phaser.Tilemaps.Tilemap[] = [], layers: AuthoredMapRender["layers"] = [], images: Phaser.GameObjects.Image[] = [];
  for (const [name, grid, depth] of [["border", data.border, 0], ["floor", data.ground, 1]] as const) {
    const map = scene.make.tilemap({ data: grid, tileWidth: 64, tileHeight: 64 });
    const set = map.addTilesetImage(TERRAIN_KEY, TERRAIN_KEY, 64, 64, 0, 0);
    if (!set) { map.destroy(); for (const m of maps) m.destroy(); return null; }
    const layer = map.createLayer(0, set, 0, 0);
    if (!layer) { map.destroy(); for (const m of maps) m.destroy(); return null; }
    layer.setScale(data.tileW / 64, data.tileH / 64).setDepth(depth).setName(`chapter-terrain:${name}:${place.role}`);
    maps.push(map); layers.push(layer);
  }
  const track = data.railRoute.length > 1 ? renderRailTrack(scene, data.railRoute, Math.min(data.tileW, data.tileH)) : undefined;
  const props: Partial<Record<Place["role"], string[]>> = {
    cliff: ["obj_forest_rock__1", "obj_forest_tree_orange"], road: ["obj_forest_tree_orange", "obj_forest_rock__1"],
    garden: ["obj_forest_tree_pink", "obj_dungeon_table__1"], sanctuary: ["obj_forest_tree_pink", "obj_dungeon_jar__1"],
    inn: ["obj_dungeon_barrel", "obj_dungeon_bookshelf"], dungeon: ["obj_dungeon_torch", "obj_dungeon_barrel"],
    camp: ["obj_dungeon_chest", "obj_dungeon_barrel"], harbor: ["obj_dungeon_barrel", "obj_forest_sign"], deck: ["obj_dungeon_barrel"],
    observatory: ["obj_dungeon_bookshelf", "obj_dungeon_candle"], throne: ["obj_dungeon_throne", "obj_dungeon_torch"],
    factory: ["obj_dungeon_anvil", "obj_town_bench"], city: ["obj_town_bench", "obj_town_planter", "obj_town_waterfall"],
    village: ["house_a", "house_b"], ruin: ["obj_dungeon_tree_dead__2", "obj_forest_rock__1"], tunnel: ["obj_dungeon_torch"],
    court: ["obj_forest_rock_monument", "obj_dungeon_torch"], shore: ["obj_forest_rock__1", "obj_forest_sign"],
    snowfield: ["obj_forest_tree_dried", "obj_forest_rock__1"], rail: ["obj_dungeon_barrel", "obj_dungeon_anvil"],
    rift: ["obj_forest_rock_monument"], domain: ["obj_dungeon_candle", "obj_forest_rock_monument"],
  };
  const pool = props[place.role] ?? [];
  const waterside = place.border === "water" && ["shore", "deck", "harbor"].includes(place.role);
  const propEdges: number[] = [];
  for (let r = 1; r < lay.rows - 1; r++) for (let c = 1; c < lay.cols - 1; c++) {
    const cell = r * lay.cols + c;
    if (lay.open[cell] !== waterside) continue;
    if (![cell - 1, cell + 1, cell - lay.cols, cell + lay.cols].some(n => lay.open[n] !== waterside)) continue;
    if ([lay.entry, lay.exit].some((n) => Math.abs(c - n % lay.cols) + Math.abs(r - Math.floor(n / lay.cols)) <= 2)) continue;
    propEdges.push(cell);
  }
  const addProp = (key: string, cell: number, scale = 1) => {
    if (!scene.textures.exists(key)) return;
    const c = cell % lay.cols, r = Math.floor(cell / lay.cols);
    const x = (c + .5) * lay.cellW, y = (r + .8) * lay.cellH;
    const image = scene.add.image(x, y, key).setOrigin(.5, 1).setScale(scale).setDepth(9 + y / (lay.rows * lay.cellH) - .001).setName(`chapter-prop:${place.role}:${key}`);
    images.push(image); onDecor?.(image);
  };
  const focus = lay.authored?.focus;
  let roseCell: number | undefined;
  if (site?.chapter === "dlcstargate" && [3, 4, 9].includes(site.sub) && focus !== undefined) {
    const distance = (cell: number) => Math.abs(cell % lay.cols - focus % lay.cols) + Math.abs(Math.floor(cell / lay.cols) - Math.floor(focus / lay.cols));
    roseCell = propEdges.reduce<number | undefined>((best, cell) => best === undefined || distance(cell) < distance(best) ? cell : best, undefined);
    if (roseCell !== undefined) addProp(ROSE_KEY, roseCell, 1.35);
  }
  // Sample across the entire field so decor does not collect only along the first wall.
  if (pool.length) {
    const count = Math.min(place.boss ? 6 : 10, propEdges.length);
    for (let i = 0; i < count; i++) {
      const cell = propEdges[Math.floor((i + .5) * propEdges.length / count)];
      if (cell !== roseCell) addProp(pool[i % pool.length], cell);
    }
  }
  scene.events.once("shutdown", () => { track?.destroy(); for (const map of maps) map.destroy(); for (const img of images) img.destroy(); });
  return { maps, layers, images };
}

function renderRailTrack(scene: Phaser.Scene, route: { x: number; y: number }[], tileSize: number) {
  const track = scene.add.graphics().setDepth(2).setName("chapter-rail-track");
  const gauge = tileSize * .44;
  const normals = route.slice(1).map((point, i) => ({ x: Math.sign(route[i].y - point.y), y: Math.sign(point.x - route[i].x) }));
  const stroke = (points: typeof route) => {
    track.beginPath().moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) track.lineTo(point.x, point.y);
    track.strokePath();
  };
  track.lineStyle(gauge * 3.8, 0x232e35, .8);
  stroke(route);
  track.lineStyle(5, 0x806750, .9);
  for (let i = 0; i < normals.length; i++) {
    const a = route[i], b = route[i + 1];
    const dx = normals[i].x * gauge * 1.55, dy = normals[i].y * gauge * 1.55;
    const count = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (tileSize * .88));
    for (let j = 0; j < count; j++) {
      const t = (j + .5) / count, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      track.lineBetween(x - dx, y - dy, x + dx, y + dy);
    }
  }
  track.lineStyle(3, 0x9db5b8, .92);
  for (const side of [-gauge, gauge]) {
    stroke(route.map(({ x, y }, i) => {
      const before = normals[i - 1] ?? normals[0], after = normals[i] ?? before;
      // Offset both rails through a right-angle bend without breaking either line.
      const offset = before.x === after.x && before.y === after.y ? side / 2 : side;
      return { x: x + offset * (before.x + after.x), y: y + offset * (before.y + after.y) };
    }));
  }
  return track;
}
