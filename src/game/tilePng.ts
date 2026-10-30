/** vc206 (지시 #11 "왜 종이 쪼가리임?") — PNG 원본 보유 타일.
 *
 *  문제: BootScene 이 `ASSET_LIST` 를 **항상 `.webp`** 로 로드했다. 그런데 그 webp 중 5종은
 *  PNG 원본(256px, 70~193색)에서 뽑은 **열화본**이었다:
 *    tile_magma  107색 →  7색   ← "종이 쪼가리"의 정체
 *    tile_abyss   67색 → 39색
 *    tile_hel    129색 → 49색
 *    tile_ice    193색 → 129색
 *    tile_stone   70색 → 39색
 *  webp 자체가 이미 뭉개져 있어, webp 를 정상화해도 복구되지 않는다.
 *
 *  해법: 아래 목록에 있으면 **PNG 를 먼저** 쓰고, 없을 때만 webp 로 폴백한다.
 *  (Phaser 는 같은 키를 두 번 load 하면 뒤엣것이 이기므로, PNG 를 나중에 큐잉한다.)
 */
export const TILE_PNG_KEYS: readonly string[] = [
  "tile_abyss",
  "tile_cave",
  "tile_dark",
  "tile_grass",
  "tile_hel",
  "tile_ice",
  "tile_magma",
  "tile_magma_path",
  "tile_path",
  "tile_path_dark",
  "tile_snow",
  "tile_stone",
];
