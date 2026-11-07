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

/* vc252 → v259 (지시 #1) — 바닥 변형 아틀라스 **폐기**.
 *
 * [폐기 이유] 아틀라스는 `ground_violet`(5색 얼룩)을 회전·반전해 만든 것이었다.
 *  회전은 반복 주기만 4배로 늘릴 뿐 **격자 자체는 그대로 남는다** — 5색 얼룩을
 *  4번 돌려도 5색 얼룩이다. 근본 원인(색이 5개뿐이라 96px 격자가 보임)을 못 고쳤다.
 *  이제 5종을 **256px 무이음새 고색수 타일**로 교체했으므로(seam ratio 0.97~1.30)
 *  아틀라스가 필요 없다. 생성기 `scripts/make_stone_floors.py` 도 함께 삭제했다.
 *
 * [재도입 조건] 새 지면이 seam ratio 2.0 을 넘어 격자가 보일 때만.
 *  그때는 회전이 아니라 **다른 실제 타일**을 섞어야 한다(회전은 해법이 아니었다).
 */
