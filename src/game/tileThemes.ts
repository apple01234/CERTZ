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

/* vc252 (지시 #1) — 바닥 변형 아틀라스.
 *
 * [문제] 96×96 단일 타일을 넓게 깔면 특징적인 돌 배치가 96px 주기로 반복돼 "타일 붙인 티"가 난다.
 * [해결] 같은 타일의 회전·반전 4변형을 세로로 이은 아틀라스(96×384)를 만들어
 *        셀마다 다른 프레임을 고른다 → 반복 주기가 4배로 늘어난다. 팔레트가 동일해 톤도 그대로다.
 *        (scripts/make_stone_floors.py 가 생성)
 */
export const GROUND_ATLAS_KEYS = ["ground_slate_atlas", "ground_ash_atlas"] as const;

/** 실제로 파일이 존재해 로드 가능한 아틀라스 — BootScene 이 존재 확인 없이 큐잉하면 404 로 로더가 죽는다. */
export const GROUND_ATLAS_AVAILABLE: readonly string[] = [...GROUND_ATLAS_KEYS];

/** 아틀라스 1개의 프레임 수 (세로 분할) */
export const GROUND_ATLAS_FRAMES = 4;

/** 원본 바닥 키 → 변형 아틀라스 키 (없으면 null = 단일 타일 사용) */
export function groundAtlasOf(baseKey: string): string | null {
  const k = `${baseKey}_atlas`;
  return (GROUND_ATLAS_KEYS as readonly string[]).includes(k) ? k : null;
}
