import type Phaser from "phaser";
import type { RoomLayout } from "../mapgen";

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
  return { maps, layers, images };
}
