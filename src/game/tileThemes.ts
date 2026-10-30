/**
 * tileThemes.ts — 지역(groundTex) → 지면 타일 단일 매핑 테이블
 *
 * 왜 이 파일이 필요한가:
 *   v1.4.35 부터 WorldScene 의 NATIVE_TILE 이 지면 텍스처를 "팩 타일"로 치환한다.
 *   그런데 그 매핑이 14개 지면 키를 단 3장(tile_grass_pack / tile_sand_pack /
 *   tile_dirt_pack)으로 붕괴시켰다. 세 장 모두 64px 에 최빈색 비율 89% 수준이라
 *   사실상 단색이고, 결과적으로 숲·설원·사막·용암·동굴이 "같은 바닥에 색만 다른"
 *   화면이 됐다(사용자 지적: "타일맵이 똑같음").
 *
 *   반대로 저장소에는 이미 256px 고품질 지형 타일이 45장 있다(tile_grass 787색,
 *   tile_forest 1361색, tile_magma 3124색 …). 이它们是 NATIVE_TILE 에 가려져
 *   한 번도 화면에 나오지 않았다.
 *
 * 이 파일의 역할:
 *   "어떤 지역이 어떤 지면 타일을 쓰는가"를 한 곳에 모은다. 지역 분위기를 바꾸고
 *   싶으면 이 표만 고치면 된다(지시서 §6·8-추가 요구사항).
 *
 * 규칙:
 *   1. 값은 반드시 256px 이상 + 고유색 100개 이상인 "진짜 지형" 타일이어야 한다.
 *      (tools/check_tiles.py 가 이 조건을 검사한다)
 *   2. 한 지역 안에서 서로 다른 무늬를 쓰고, 지역끼리 무늬가 겹치지 않게 한다.
 *   3. 틴트로 지역 차이를 만들지 않는다. 타일 자체 색이 지역 분위기를 낸다.
 *   4. 오브젝트/캐릭터 컷(tile_lava 의 붉은 게, tile_path 의 나무 등)은 절대 쓰지 않는다.
 *
 * 새 타일을 추가할 때:
 *   - public/assets/<key>.webp 로 넣고
 *   - BootScene 의 ASSET_LIST 에 key 를 등록해야 한다(미등록이면 textures.exists()
 *     가 false 라서 치환이 조용히 무시된다 — 실제로 이걸로 한 번 놓쳤다).
 */

/**
 * 지역 지면 → 실제로 깔릴 지면 타일 키.
 * 여기 없는 키는 자기 자신을 그대로 쓴다(기존 동작 보존).
 */
export const GROUND_TILE_MAP: Record<string, string> = {
  /* 숲 계열 — 각각 다른 잎/이끼 밀도 */
  tile_grass: "tile_grass",
  tile_grass2: "tile_grass_flower", // 꽃 흩어진 풀 (grass2 는 3색 단색이었다)
  tile_forest: "tile_forest",
  tile_moss: "tile_moss",
  tile_garden: "tile_garden",

  /* 길/모래 계열 */
  tile_path: "tile_dirt",       // 흙길 (path 는 주황 나무 그림이었다)
  tile_sand: "tile_sand",
  tile_desert: "tile_sand",     // 사막 = 모래 (desert 는 3색 벽돌이었다)
  tile_amber: "tile_gold",      // 호박빛 모래 = 금빛 지형 (amber 는 3색 점이었다)

  /* 눈/얼음 */
  tile_snow: "tile_snow",
  tile_ice: "tile_ice",

  /* 화산 — 무스펠헤임의 "꽃게 타일" 해결 지점 */
  tile_lava: "tile_magma",          // 용암 (lava 는 붉은 게 그림이었다)
  tile_magma_path: "tile_basalt",   // 현무암 균열 (magma_path 는 4색이었다)
  tile_blood: "tile_basalt",        // 핏빛 현무암 (blood 는 창문 그림이었다)

  /* 동굴/지하 */
  tile_cave: "tile_cave",
  tile_deep: "tile_cave_wet",   // 젖은 동굴 (deep 은 거미 그림이었다)
  tile_dark: "tile_basalt",     // 어두운 현무암 (dark 는 모니터 그림이었다)
  tile_stone: "tile_stone",

  /* 폐허/묘지/기계 */
  tile_ruin: "tile_rust",     // 녹슨 폐허 (ruin 은 철로 그림이었다)
  tile_morgue: "tile_bone",   // 뼈 납골당 (morgue 는 철로 그림이었다)
  tile_vault: "tile_metal",   // 금속 금고 (vault 는 철로 그림이었다)

  /* 심연/신성/우주 */
  tile_hel: "tile_hel",
  tile_abyss: "tile_abyss",
  tile_nebula: "tile_nebula",
  tile_ash: "tile_ash",
};

/**
 * 지역 지면 키를 실제로 깔릴 타일 키로 해석한다.
 * 매핑이 없으면 원본 키를 그대로 돌려준다(기존 동작 보존).
 */
export function resolveGroundTile(groundTex: string): string {
  return GROUND_TILE_MAP[groundTex] ?? groundTex;
}
