import type Phaser from "phaser";
import terrain from "../../../public/assets/chapter-terrain/manifest.json" with { type: "json" };
import { chapterPlace, type Place, type TerrainMaterial } from "../chapterStoryPlan";
import type { RoomLayout } from "../mapgen";
import type { AuthoredMapRender } from "./AuthoredMapLayers";

export const TERRAIN_KEY = "chapter_terrain";
const materials = terrain.materials as Record<TerrainMaterial, { tiles: number[]; center: number; edge: boolean }>;

export function preloadChapterTerrain(scene: Phaser.Scene): void {
  scene.load.image(TERRAIN_KEY, "chapter-terrain/terrain.png");
  for (const name of Object.keys(materials)) scene.load.image(`terrain_${name}`, `chapter-terrain/${name}.png`);
}

/** Fine tiles inherit the exact authored collision cells, including their fractional world size. */
export function chapterTerrainData(lay: RoomLayout, place: Place) {
  const detail = 4, cols = lay.cols * detail, rows = lay.rows * detail;
  const cellOf = (c: number, r: number) => Math.floor(r / detail) * lay.cols + Math.floor(c / detail);
  const open = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows && lay.open[cellOf(c, r)];
  const tile = (material: TerrainMaterial, c: number, r: number) => {
    const mat = materials[material];
    if (mat.edge && material !== "rock") {
      const x = !open(c - 1, r) ? 0 : !open(c + 1, r) ? 2 : 1;
      const y = !open(c, r - 1) ? 0 : !open(c, r + 1) ? 2 : 1;
      return mat.tiles[y * 3 + x];
    }
    return mat.tiles[((c * 37 + r * 61) ^ (c * r * 7)) % mat.tiles.length];
  };
  const ground: number[][] = [], border: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const g: number[] = [], b: number[] = [];
    for (let c = 0; c < cols; c++) {
      const isOpen = open(c, r);
      const mat = lay.authored?.paths[cellOf(c, r)] ? place.path : place.floor;
      g.push(isOpen ? tile(mat, c, r) : -1);
      if (isOpen) b.push(-1);
      else if (place.border === "water") b.push(materials.water.center);
      else if (open(c, r - 1)) b.push(materials.rock.tiles[9 + c % 3]); // actual vertical rock face, not another floor texture
      else b.push(materials.rock.tiles[4]);
    }
    ground.push(g); border.push(b);
  }
  return { ground, border, tileW: lay.cellW / detail, tileH: lay.cellH / detail, detail };
}

/** Rendering only; existing WorldScene route bodies remain the sole source of collision. */
export function renderChapterTerrain(scene: Phaser.Scene, lay: RoomLayout, onDecor?: (image: Phaser.GameObjects.Image) => void): AuthoredMapRender | null {
  const match = /^(howlrstone\d+)x(\d+)$/.exec(lay.authored?.stageKey ?? "")
    ?? /^(dlc[a-z]+)(\d+)$/.exec(lay.authored?.stageKey ?? "");
  const place = match ? chapterPlace(match[1], Number(match[2])) : undefined;
  if (!place || !scene.textures.exists(TERRAIN_KEY)) return null;
  const data = chapterTerrainData(lay, place);
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
  const props: Partial<Record<Place["role"], string[]>> = {
    cliff: ["obj_forest_rock__1", "obj_forest_tree_orange"], road: ["obj_forest_tree_orange", "obj_forest_rock__1"],
    garden: ["obj_forest_tree_pink", "obj_dungeon_table__1"], sanctuary: ["obj_forest_tree_pink", "obj_dungeon_jar__1"],
    inn: ["obj_dungeon_barrel", "obj_dungeon_bookshelf"], dungeon: ["obj_dungeon_torch", "obj_dungeon_barrel"],
    camp: ["obj_dungeon_chest", "obj_dungeon_barrel"], harbor: ["obj_dungeon_barrel", "obj_forest_sign"], deck: ["obj_dungeon_barrel"],
    observatory: ["obj_dungeon_bookshelf", "obj_dungeon_candle"], throne: ["obj_dungeon_throne", "obj_dungeon_torch"],
    factory: ["obj_dungeon_anvil", "obj_town_bench"], city: ["obj_town_bench", "obj_town_planter"],
    village: ["house_a", "house_b"], ruin: ["obj_dungeon_tree_dead__2", "obj_forest_rock__1"], tunnel: ["obj_dungeon_torch"],
  };
  const pool = props[place.role] ?? [];
  // At most six complete, role-appropriate props, with solid feet inside closed cells.
  for (let r = 1; r < lay.rows - 1 && images.length < 6; r++) for (let c = 1; c < lay.cols - 1 && images.length < 6; c++) {
    const cell = r * lay.cols + c;
    if (lay.open[cell] || (c + r) % 3 || !pool.length) continue;
    if (![cell - 1, cell + 1, cell - lay.cols, cell + lay.cols].some((n) => lay.open[n])) continue;
    if ([lay.entry, lay.exit].some((n) => Math.abs(c - n % lay.cols) + Math.abs(r - Math.floor(n / lay.cols)) <= 2)) continue;
    const key = pool[(c + r) % pool.length];
    if (!scene.textures.exists(key)) continue;
    const x = (c + .5) * lay.cellW, y = (r + .8) * lay.cellH;
    const image = scene.add.image(x, y, key).setOrigin(.5, 1).setDepth(9 + y / (lay.rows * lay.cellH) - .001).setName(`chapter-prop:${place.role}:${key}`);
    images.push(image); onDecor?.(image);
  }
  scene.events.once("shutdown", () => { for (const map of maps) map.destroy(); for (const img of images) img.destroy(); });
  return { maps, layers, images };
}
