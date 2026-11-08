import footprints from "./decorFootprints.json" with { type: "json" };
/**
 * vc235 — 장식 오브젝트 카탈로그 (에셋 추출분 연결)
 *
 * [배경]
 *  `_assets_in` 에 탑다운 RPG 타일셋 3종(던전/숲/마을)이 있었는데 게임은
 *  `tree`/`rock`/`pine` 같은 단순 텍스처만 썼다. 왕좌·책장·항아리·횃불·천막·
 *  가구 같은 **실제 오브젝트는 한 번도 배치되지 않았다**. 그래서 맵이
 *  "같은 바닥이 끝없이 반복되는" 화면으로 보였다.
 *
 * [도구]
 *  tools/collect_objects.py 가 미리 잘린 낱개를 우선하고(타일셋 좌표 절단은
 *  캐노피만 남거나 지형이 섞이는 사고가 난다), 없을 때만 타일셋에서 자른다.
 *  결과는 public/assets/objects/<set>/catalog.json + PNG.
 *
 * [이 파일의 역할]
 *  카탈로그를 Phaser 에 등록하고, 챕터별로 "어떤 오브젝트를 얼마나" 배치할지
 *  규칙을 제공한다. 배치 자체는 WorldScene.placeDecor 가 한다.
 */

/** 오브젝트 태그 — 배치 위치를 결정한다. */
export type ObjTag = "wall" | "floor" | "big" | "small";

export type DecorObj = {
  /** 카탈로그 키 (PNG 파일명과 동일) */
  key: string;
  tag: ObjTag;
  /** 원본 대비 배율 (1이면 원본 크기) */
  w: number;
  h: number;
};

/** 세트별 오브젝트 목록.
 *
 *  [vc253 — 이름·태그 정정] 34개 PNG 를 전부 눈으로 확인한 결과, 여러 항목이
 *  **파일명과 실제 그림이 다르거나** 한 캔버스에 여러 오브젝트가 뭉쳐 있었다.
 *  뭉친 것은 `tools/split_prop_atlas.py` 로 낱개 분리해 `_split/` 에 두었고
 *  (원본 PNG 는 보존), 카탈로그는 **낱개 기준**으로 다시 적는다.
 *
 *  주요 정정:
 *   · obj_town_bench  (88×128) = 자판기였다 → 이름과 태그를 자판기로.
 *   · obj_town_vending(88×24)  = 카운터 상판이었다 → 카운터로.
 *   · obj_dungeon_table(112×52) = 탁자가 아니라 화분 2개 → 화분(__1/__2).
 *   · obj_dungeon_fence(46×13)  = 울타리가 아니라 진열장 3개 → 진열장.
 *   · obj_dungeon_jar (48×116)  = 항아리 2개 → 낱개 2종.
 *   · obj_dungeon_tree_dead     = 마른나무 3개 → 낱개.
 *   · obj_forest_rock           = 바위 1 + 작은 돌 3 → 큰 바위만 대표로.
 *   · obj_town_shop_black(224×112) = 가게 + 소품 21개가 흩어진 시트 → 대표 조각만.
 *   · obj_town_stall_stripe     = 가판대 2 + 깃대 2 → 가판대 낱개. */
export const DECOR_SETS: Record<string, DecorObj[]> = {
  dungeon: [
    { key: "obj_dungeon_throne", tag: "big", w: 58, h: 32 },
    { key: "obj_dungeon_bookshelf", tag: "wall", w: 64, h: 128 },
    /* 탁자가 아니라 벽난로/화분 2종이었다. 바닥 가구로 쓸 수 있는 낱개만 등록. */
    { key: "obj_dungeon_table__1", tag: "floor", w: 48, h: 52 },
    { key: "obj_dungeon_table__2", tag: "floor", w: 48, h: 52 },
    { key: "obj_dungeon_chest", tag: "small", w: 48, h: 40 },
    { key: "obj_dungeon_barrel", tag: "small", w: 64, h: 72 },
    /* 항아리 2개가 세로로 붙어 있던 것을 낱개로 */
    { key: "obj_dungeon_jar__1", tag: "small", w: 48, h: 52 },
    { key: "obj_dungeon_jar__2", tag: "small", w: 48, h: 52 },
    { key: "obj_dungeon_anvil", tag: "small", w: 52, h: 36 },
    { key: "obj_dungeon_torch", tag: "wall", w: 28, h: 52 },
    { key: "obj_dungeon_candle", tag: "small", w: 24, h: 40 },
    { key: "obj_dungeon_carpet_v", tag: "floor", w: 28, h: 124 },
    /* 마른나무 3개가 나란히 있던 것을 대표 1개로 */
    { key: "obj_dungeon_tree_dead__2", tag: "big", w: 19, h: 33 },
    { key: "obj_dungeon_stump", tag: "small", w: 12, h: 16 },
    /* "rock_small" 은 실제로 **이음새없는 흙 타일**이었다 → 바위로 쓰면 안 된다.
     *  dungeon 세트의 바닥 장식 후보에서 제외하고, 진짜 돌은 forest 쪽을 쓴다. */
    { key: "obj_dungeon_pentagram__1", tag: "floor", w: 32, h: 6 },
    /* 묘비 2종 */
    { key: "obj_dungeon_grave__1", tag: "small", w: 56, h: 64 },
    { key: "obj_dungeon_grave__2", tag: "small", w: 52, h: 64 },
    /* "fence" 는 실제로 진열장 3개였다 */
    { key: "obj_dungeon_fence__1", tag: "wall", w: 14, h: 13 },
    { key: "obj_dungeon_fence__2", tag: "wall", w: 14, h: 13 },
    { key: "obj_dungeon_fence__3", tag: "wall", w: 14, h: 13 },
    { key: "obj_dungeon_sign", tag: "wall", w: 56, h: 56 },
  ],
  forest: [
    { key: "obj_forest_tree_orange", tag: "big", w: 65, h: 80 },
    { key: "obj_forest_tree_pink", tag: "big", w: 65, h: 80 },
    { key: "obj_forest_tree_dried", tag: "big", w: 96, h: 104 },
    { key: "obj_forest_rock_monument", tag: "big", w: 100, h: 89 },
    /* 큰 바위 1개 + 작은 돌 3개가 한 장이었다. 큰 바위만 대표로. */
    { key: "obj_forest_rock__1", tag: "small", w: 124, h: 112 },
    { key: "obj_forest_bush", tag: "small", w: 116, h: 92 },
    { key: "obj_forest_bush_tall", tag: "small", w: 64, h: 108 },
    /* 표지판 + 화분 3개가 한 장이었다. 표지판만 대표로. */
    { key: "obj_forest_sign__1", tag: "wall", w: 64, h: 88 },
    { key: "obj_forest_trunk", tag: "small", w: 37, h: 33 },
  ],
  town: [
    /* ═══ vc283 (지시 #11 "문제의 파란 지붕 타일셋 완전 교체") ═══
     * `obj_town_house_blue`(160×112) 를 제거했다. 지붕과 벽이 분리 합성돼
     * 상단 22% 가 투명이라 삼각 지붕이 잘린 듯 보였고, 지붕/벽 색이 무관해
     * "건물과 비정상 결합"으로 읽혔다. 요구사항 4.3 이 반복 수정 대신
     * **에셋 교체**를 명시하므로 `house_a`/`house_b`(156×194, 지붕+벽+입구가
     * 한 덩어리) 로 대체했다. 그 둘은 ASSET_LIST 소속이라 여기 등록하지 않는다
     * (decorObjects 는 objects/ 하위 프롭만 담당).
     * 224×112 에 가게 + 소품 21개가 흩어진 시트 조각이었다.
     *  건물(__1, 64×32)은 너무 작아 건물로 못 쓰므로 big 후보에서 빼고
     *  실제로 단독 사용 가능한 가판대·카운터만 남긴다. */
    { key: "obj_town_stall_stripe__1", tag: "big", w: 22, h: 32 },
    { key: "obj_town_stall_stripe__2", tag: "big", w: 22, h: 32 },
    /* 파일명이 뒤바뀌어 있었다: "vending"(88×24)이 카운터, "bench"가 자판기. */
    { key: "obj_town_vending", tag: "wall", w: 88, h: 24 },
    { key: "obj_town_bench", tag: "wall", w: 88, h: 128 },
    { key: "obj_town_barrel", tag: "small", w: 20, h: 104 },
    { key: "obj_town_planter", tag: "small", w: 112, h: 80 },
    { key: "obj_town_waterfall", tag: "wall", w: 32, h: 48 },
  ],
};

/** 챕터 → 오브젝트 세트. 스토리 분위기에 맞춰 고른다. */
export const CHAPTER_DECOR_SET: Record<string, string> = {
  forest: "forest",
  kingdom: "town",
  alfheim: "forest",
  muspelheim: "dungeon",
  niflheim: "forest",
  cave: "dungeon",
  nidavellir: "dungeon",
  hel: "dungeon",
  abyss: "dungeon",
  howlrstone: "town",
  dlcstargate: "town",
  village: "town",
};

/**
 * 챕터별 배치 예산 — 오브젝트를 몇 개까지 깔지.
 *  [왜 제한하나] vc232 에서 사용자가 "쓸데없는 오브젝트 배치 줄이기"를 지적했다.
 *  전투 중 시각 노이즈가 되고 드로우콜이 늘기 때문이다. 그래서 **큰 오브젝트는
 *  적게, 작은 소품은 조금 더** 두되 총량을 묶는다.
 */
export type DecorBudget = {
  big: number;
  wall: number;
  floor: number;
  small: number;
};

export const DECOR_BUDGET: Record<string, DecorBudget> = {
  /* forest 세트에는 floor 태그(카펫·식탁 같은 바닥 가구)가 없다.
   *  예산을 2로 두면 후보 0개를 채우려다 조용히 실패하므로 0으로 둔다
   *  — 테스트 tests/decor-objects.test.mjs 가 이 불일치를 잡는다. */
  forest: { big: 6, wall: 3, floor: 0, small: 10 },
  /* vc235 — town 은 floor 태그 후보가 카탈로그에 없다(바닥 가구 미추출).
   *  예산을 0으로 맞춰야 배치 코드가 조용히 실패하지 않는다. */
  town: { big: 3, wall: 4, floor: 0, small: 8 },
  dungeon: { big: 4, wall: 6, floor: 3, small: 9 },
};

/** 세트에서 태그별 오브젝트를 고른다(없으면 빈 배열). */
export function pickByTag(setKey: string, tag: ObjTag): DecorObj[] {
  return (DECOR_SETS[setKey] ?? []).filter((o) => o.tag === tag);
}

/** 챕터에 맞는 세트 키. 미등록 챕터는 dungeon 으로 폴백. */
export function decorSetFor(chapter: string): string {
  return CHAPTER_DECOR_SET[chapter] ?? "dungeon";
}

/** Feet-only collision shared by the original world and story scenes. */
export function decorFootprint(width: number, height: number, key?: string) {
  const mask = key
    ? (footprints as Record<string, { width: number; opaque: number[] }>)[key]
    : undefined;
  if (mask) {
    const scale = width / mask.width,
      [left, top, right, bottom] = mask.opaque.map((n) => n * scale);
    const w = Math.max(12, Math.round((right - left) * 0.7)),
      h = Math.max(12, Math.round((bottom - top) * 0.3));
    return {
      width: w,
      height: h,
      offsetX: Math.round((left + right - w) / 2),
      offsetY: Math.max(0, bottom - h - 2),
    };
  }
  const w = Math.max(20, Math.round(width * 0.55)),
    h = Math.max(18, Math.round(height * 0.3));
  return {
    width: w,
    height: h,
    offsetX: Math.round((width - w) / 2),
    offsetY: Math.max(0, height - h - 2),
  };
}
export function isSolidDecor(key: string) {
  return (
    !/(carpet|rug|pentagram|candle|torch|flower)/.test(key) &&
    /(tree|rock|trunk|house|shop|stall|bench|barrel|jar|anvil|throne|bookshelf|table|fence|grave|planter|monument|well|pillar|column|altar|fountain|armory|furn_(crate|bucket|chair|pots))/.test(
      key,
    )
  );
}

/** Rotate the measured feet with the artwork, including furniture's 0.9 origin. */
export function decorCollisionBounds(width: number, height: number, key: string, rotation = 0, originX = 0.5, originY = 0.5) {
  const foot = decorFootprint(width, height, key);
  const cx = foot.offsetX + foot.width / 2 - width * originX;
  const cy = foot.offsetY + foot.height / 2 - height * originY;
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  return {
    x: cx * cos - cy * sin,
    y: cx * sin + cy * cos,
    width: Math.abs(foot.width * cos) + Math.abs(foot.height * sin),
    height: Math.abs(foot.width * sin) + Math.abs(foot.height * cos),
  };
}
