/** 지역→지면. 물가·절벽·프롭 컷은 반복 바닥에 사용하지 않는다.
 * ground_*는 tools/prepare-ground-tiles.py로 원본 셀을 무손실 추출하며
 * 출처/좌표는 public/assets/ground/manifest.json에서 확인한다.
 * 타일 크기·고유색 개수만으로 지면 적합성을 판정하지 않는다. */
export const GROUND_TILE_MAP: Record<string, string> = {
  tile_grass: "ground_meadow",
  tile_grass2: "tile_grass_flower",
  tile_forest: "ground_forest",
  tile_moss: "ground_forest",
  tile_garden: "tile_grass_flower",
  tile_path: "ground_dirt",
  tile_path_dark: "ground_slate",
  tile_dirt: "ground_dirt",
  tile_sand: "ground_sand",
  tile_desert: "ground_sand",
  tile_amber: "tile_gold",
  tile_snow: "ground_snow",
  tile_ice: "ground_snow",
  tile_lava: "ground_lava",
  tile_magma: "ground_lava",
  tile_magma_path: "ground_slate",
  tile_basalt: "ground_slate",
  tile_blood: "tile_rust",
  tile_cave: "ground_cavern",
  tile_deep: "ground_cavern",
  tile_dark: "ground_slate",
  tile_stone: "ground_ash",
  tile_ruin: "ground_violet",
  tile_morgue: "tile_bone",
  tile_vault: "tile_metal",
  tile_hel: "tile_hel",
  tile_abyss: "tile_abyss",
  tile_nebula: "tile_nebula",
  tile_ash: "ground_ash",
};

export function resolveGroundTile(groundTex: string): string {
  return GROUND_TILE_MAP[groundTex] ?? groundTex;
}
