/**
 * villageThemes.ts — 챕터별 마을 테마 (vc189, 지시 D4)
 *
 * 문제(실측)
 *   `WorldScene.buildVillage()` 는 모든 챕터에서 **같은 좌표**에 같은 건물 3채를 놓고
 *   `houseTint` 만 바꿨다. 그래서 9개 챕터 마을이 "색만 다른 같은 마을"로 보였다.
 *   지면도 단일 `theme.ground` 타일 + 틴트뿐이라 타일맵 배치 차이가 없었다.
 *
 * 해결
 *   ① 건물 배치를 챕터별 **좌표 세트**로 분리 (광장 위치·건물 각도·개수)
 *   ② 지면을 타일셋(`tx_*`) 레이어로 덮어 지형 느낌 부여
 *   ③ NPC 복장(전직관 카이엔·상인 라고스 포함)을 테마별 텍스처로 교체
 *
 * 설계 원칙
 *   · 좌표는 stageW/stageH 대비 **비율**로 정의해 맵 크기가 달라도 유지된다.
 *   · 모든 좌표는 광장 중심(0,0) 기준 상대값 — 절대 픽셀 하드코딩 금지.
 *   · 타일 레이어는 지면 위·건물 아래(depth 1~2)에만 깔아 충돌/렌더 순서를 깨지 않는다.
 */

export type VillageLayoutKey =
  | "forest" | "kingdom" | "alfheim" | "muspelheim" | "niflheim"
  | "cave" | "nidavellir" | "hel" | "abyss";

/** 건물 슬롯 — 광장 중심 기준 오프셋(비율: -1~1) */
export type BuildingSlot = {
  /** 가로 오프셋 비율 (-1 = 맵 왼쪽 끝) */
  dx: number;
  /** 세로 오프셋 비율 (-1 = 맵 위쪽 끝) */
  dy: number;
  /** house_a | house_b */
  tex: "house_a" | "house_b";
  /** 좌우 반전 */
  flip?: boolean;
};

export type VillageTheme = {
  /** 마을 이름 (간판) */
  title: string;
  /** 간판 색 */
  signColor: string;
  /** 건물 틴트 (챕터 분위기) */
  houseTint: number;
  /** 지면 타일 텍스처 키 (STAGE_THEME 값과 별개로 마을 전용) */
  ground: string;
  /** 지면 위에 까는 타일셋 세트 키 (tx_{set}_edge_*) — 지형 경계 표현 */
  terrainSet?: string;
  /** 지면 틴트 */
  groundTint?: number;
  /** 건물 배치 (광장 기준 상대 비율) */
  buildings: BuildingSlot[];
  /** 광장(우물) 위치 비율 — 맵 크기 대비 */
  plaza: { x: number; y: number };
  /** 마을 전용 장식: 나무/바위 개수 배수 (기본 대비) */
  decorScale: number;
  /** 전직관(카이엔) 텍스처 — 테마 복장 */
  jobMasterTex: string;
  /** 상인(라고스) 텍스처 — 테마 복장 */
  merchantTex: string;
  /** 주민 A/B 텍스처 */
  villagerATex: string;
  villagerBTex: string;
  /** 주민 A/B 이름 */
  villagerAName: string;
  villagerBName: string;
}

/* ─────────────────────────────────────────────────────────────
 * 챕터별 테마.
 *
 * 배치 의도의 차이를 명확히 둔다:
 *   forest      — 광장이 남쪽, 건물이 북쪽에 몰림 (숲 사이 개간지)
 *   kingdom     — 광장 정중앙, 건물이 사방 대칭 (계획된 성채 마을)
 *   alfheim     — 건물이 외곽 원형, 광장이 중앙 (요정의 고리)
 *   muspelheim  — 광장이 서쪽, 건물이 동쪽 일렬 (용암 지대 피난 구조)
 *   niflheim    — 광장이 북쪽, 건물이 남쪽 (설원 언덕)
 *   cave        — 광장이 중앙, 건물 밀집 (지하 공동)
 *   nidavellir  — 광장 남서, 건물 북동 대각 (광산 캠프)
 *   hel         — 건물 분산, 광장 없음에 가깝게 (망자의 들판)
 *   abyss       — 광장 중앙, 건물이 안쪽으로 (폐허)
 * ───────────────────────────────────────────────────────────── */
export const VILLAGE_THEMES: Record<VillageLayoutKey, VillageTheme> = {
  forest: {
    title: "숲의 마을",
    signColor: "#b8f0a0",
    houseTint: 0xbfe4a8,
    ground: "tile_grass",
    terrainSet: "gp",
    decorScale: 1.6,
    plaza: { x: 0.5, y: 0.62 },
    buildings: [
      { dx: -0.26, dy: -0.22, tex: "house_a" },
      { dx: 0.06, dy: -0.28, tex: "house_b" },
      { dx: -0.12, dy: 0.14, tex: "house_a", flip: true },
      { dx: 0.22, dy: -0.06, tex: "house_b" },
    ],
    jobMasterTex: "spum_forager",
    merchantTex: "spum_villager_m",
    villagerATex: "spum_forager",
    villagerBTex: "spum_villager_f",
    villagerAName: "허브 채집가 베르",
    villagerBName: "숲의 아이 린",
  },
  kingdom: {
    title: "왕국 마을",
    signColor: "#ffe9a8",
    houseTint: 0xf0e0b0,
    ground: "tile_path",
    terrainSet: "ap",
    decorScale: 0.8,
    plaza: { x: 0.5, y: 0.5 },
    buildings: [
      { dx: -0.28, dy: -0.20, tex: "house_a" },
      { dx: 0.08, dy: -0.24, tex: "house_b" },
      { dx: -0.14, dy: 0.22, tex: "house_a", flip: true },
      { dx: 0.28, dy: 0.10, tex: "house_b" },
    ],
    jobMasterTex: "spum_knight",
    merchantTex: "spum_butler",
    villagerATex: "spum_villager_m",
    villagerBTex: "spum_villager_f",
    villagerAName: "선원 롤프",
    villagerBName: "마을 아이",
  },
  alfheim: {
    title: "요정 마을",
    signColor: "#c8b0ff",
    houseTint: 0xd8c8ff,
    ground: "tile_grass",
    terrainSet: "gp",
    groundTint: 0xd8e8ff,
    decorScale: 1.3,
    plaza: { x: 0.5, y: 0.46 },
    buildings: [
      { dx: -0.30, dy: -0.24, tex: "house_b" },
      { dx: 0.16, dy: -0.26, tex: "house_b", flip: true },
      { dx: -0.20, dy: 0.24, tex: "house_a", flip: true },
      { dx: 0.26, dy: 0.20, tex: "house_a" },
    ],
    jobMasterTex: "spum_elf",
    merchantTex: "spum_elf",
    villagerATex: "spum_elf",
    villagerBTex: "spum_mystic",
    villagerAName: "요정 사절 리안",
    villagerBName: "빛의 요정",
  },
  muspelheim: {
    title: "불의 마을",
    signColor: "#ffb070",
    houseTint: 0xffb090,
    /* tile_dirt 파일 없음(실측) — tile_path 에 붉은 틴트를 곱해 용암 지대 바닥을 만든다 */
    ground: "tile_magma",
    terrainSet: "cp",
    groundTint: 0xffd0b0,
    decorScale: 0.6,
    plaza: { x: 0.32, y: 0.55 },
    buildings: [
      { dx: 0.14, dy: -0.18, tex: "house_a" },
      { dx: 0.30, dy: 0.04, tex: "house_b" },
      { dx: 0.02, dy: 0.22, tex: "house_a", flip: true },
    ],
    jobMasterTex: "spum_smith",
    merchantTex: "spum_devil",
    villagerATex: "spum_smith",
    villagerBTex: "spum_devil",
    villagerAName: "대장장이 브라키",
    villagerBName: "화염의 대장",
  },
  niflheim: {
    title: "설원 마을",
    signColor: "#bfe8ff",
    houseTint: 0xc4d6ea,
    ground: "tile_snow",
    terrainSet: "si",
    decorScale: 0.7,
    plaza: { x: 0.5, y: 0.34 },
    buildings: [
      { dx: -0.24, dy: 0.06, tex: "house_a" },
      { dx: 0.10, dy: 0.02, tex: "house_b" },
      { dx: -0.08, dy: 0.30, tex: "house_a", flip: true },
    ],
    jobMasterTex: "spum_scout",
    merchantTex: "spum_fisher",
    villagerATex: "spum_villager_f",
    villagerBTex: "spum_scout",
    villagerAName: "얼음 낚시꾼 시그룬",
    villagerBName: "설원 정찰병",
  },
  cave: {
    title: "동굴 마을",
    signColor: "#9ad8d0",
    houseTint: 0xb0d8d0,
    ground: "tile_cave",
    terrainSet: "dp",
    groundTint: 0xa8c8c0,
    decorScale: 1.9,
    plaza: { x: 0.48, y: 0.52 },
    buildings: [
      { dx: -0.18, dy: -0.16, tex: "house_b" },
      { dx: 0.14, dy: -0.12, tex: "house_b", flip: true },
      { dx: -0.10, dy: 0.18, tex: "house_a", flip: true },
      { dx: 0.18, dy: 0.22, tex: "house_a" },
    ],
    jobMasterTex: "spum_miner",
    merchantTex: "spum_mystic",
    villagerATex: "spum_mystic",
    villagerBTex: "spum_miner",
    villagerAName: "수정 채굴자 그밀",
    villagerBName: "동굴 안내인",
  },
  nidavellir: {
    title: "룬 광산 마을",
    signColor: "#d0b0ff",
    houseTint: 0xc0a8e0,
    ground: "tile_stone",
    terrainSet: "dp",
    decorScale: 1.4,
    plaza: { x: 0.38, y: 0.60 },
    buildings: [
      { dx: 0.10, dy: -0.22, tex: "house_a" },
      { dx: 0.26, dy: -0.04, tex: "house_b" },
      { dx: 0.04, dy: 0.16, tex: "house_a", flip: true },
    ],
    jobMasterTex: "spum_smith",
    merchantTex: "spum_miner",
    villagerATex: "spum_miner",
    villagerBTex: "spum_smith",
    villagerAName: "룬 대장장이 두린",
    villagerBName: "광산 감독관",
  },
  hel: {
    title: "망자의 마을",
    signColor: "#a8b0c8",
    houseTint: 0xa8b0c8,
    ground: "tile_hel",
    terrainSet: "si",
    groundTint: 0x9aa8c0,
    decorScale: 1.2,
    plaza: { x: 0.5, y: 0.58 },
    buildings: [
      { dx: -0.30, dy: -0.10, tex: "house_a" },
      { dx: -0.04, dy: -0.26, tex: "house_b", flip: true },
      { dx: 0.24, dy: 0.06, tex: "house_a" },
      { dx: -0.16, dy: 0.26, tex: "house_b" },
    ],
    jobMasterTex: "spum_skel",
    merchantTex: "spum_skel",
    villagerATex: "spum_skel",
    villagerBTex: "spum_villager_f",
    villagerAName: "전쟁 유령 아르벨",
    villagerBName: "망자의 안내인",
  },
  abyss: {
    title: "폐허 마을",
    signColor: "#c8a0d8",
    houseTint: 0xb890c8,
    ground: "tile_abyss",
    terrainSet: "cp",
    groundTint: 0xc0a8d0,
    decorScale: 1.0,
    plaza: { x: 0.5, y: 0.5 },
    buildings: [
      { dx: -0.16, dy: -0.20, tex: "house_a" },
      { dx: 0.18, dy: -0.16, tex: "house_a", flip: true },
      { dx: -0.20, dy: 0.20, tex: "house_b", flip: true },
      { dx: 0.16, dy: 0.24, tex: "house_b" },
    ],
    jobMasterTex: "spum_mage",
    merchantTex: "spum_butler",
    villagerATex: "spum_mage",
    villagerBTex: "spum_mystic",
    villagerAName: "폐허 학자 테일",
    villagerBName: "심연의 기록자",
  },
};

/** 챕터 키가 없으면 기본(왕국) 테마 */
export function villageThemeOf(chapter: string): VillageTheme {
  return VILLAGE_THEMES[chapter as VillageLayoutKey] ?? VILLAGE_THEMES.kingdom;
}
