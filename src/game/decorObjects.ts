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

/** 세트별 오브젝트 목록 — tools/collect_objects.py 산출과 일치해야 한다. */
export const DECOR_SETS: Record<string, DecorObj[]> = {
  dungeon: [
    { key: "obj_dungeon_throne", tag: "big", w: 58, h: 32 },
    { key: "obj_dungeon_bookshelf", tag: "wall", w: 64, h: 128 },
    { key: "obj_dungeon_table", tag: "floor", w: 112, h: 52 },
    { key: "obj_dungeon_chest", tag: "small", w: 48, h: 40 },
    { key: "obj_dungeon_barrel", tag: "small", w: 64, h: 72 },
    { key: "obj_dungeon_jar", tag: "small", w: 48, h: 116 },
    { key: "obj_dungeon_anvil", tag: "small", w: 52, h: 36 },
    { key: "obj_dungeon_torch", tag: "wall", w: 28, h: 52 },
    { key: "obj_dungeon_candle", tag: "small", w: 24, h: 40 },
    { key: "obj_dungeon_carpet_v", tag: "floor", w: 28, h: 124 },
    { key: "obj_dungeon_tree_dead", tag: "big", w: 61, h: 33 },
    { key: "obj_dungeon_stump", tag: "small", w: 12, h: 16 },
    { key: "obj_dungeon_rock_small", tag: "small", w: 64, h: 64 },
    { key: "obj_dungeon_pentagram", tag: "floor", w: 48, h: 46 },
    { key: "obj_dungeon_grave", tag: "small", w: 116, h: 64 },
    { key: "obj_dungeon_fence", tag: "wall", w: 46, h: 13 },
    { key: "obj_dungeon_sign", tag: "wall", w: 56, h: 56 },
  ],
  forest: [
    { key: "obj_forest_tree_orange", tag: "big", w: 65, h: 80 },
    { key: "obj_forest_tree_pink", tag: "big", w: 65, h: 80 },
    { key: "obj_forest_tree_dried", tag: "big", w: 96, h: 104 },
    { key: "obj_forest_rock_monument", tag: "big", w: 100, h: 89 },
    { key: "obj_forest_rock", tag: "small", w: 124, h: 112 },
    { key: "obj_forest_bush", tag: "small", w: 116, h: 92 },
    { key: "obj_forest_bush_tall", tag: "small", w: 64, h: 108 },
    { key: "obj_forest_sign", tag: "wall", w: 72, h: 88 },
    { key: "obj_forest_trunk", tag: "small", w: 37, h: 33 },
  ],
  town: [
    { key: "obj_town_house_blue", tag: "big", w: 160, h: 112 },
    { key: "obj_town_shop_black", tag: "big", w: 224, h: 112 },
    { key: "obj_town_stall_stripe", tag: "big", w: 118, h: 58 },
    { key: "obj_town_vending", tag: "wall", w: 88, h: 24 },
    { key: "obj_town_bench", tag: "small", w: 88, h: 128 },
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
    /(tree|rock|trunk|house|shop|stall|bench|barrel|jar|anvil|throne|bookshelf|table|fence|grave|planter|monument|well|pillar|column|altar|fountain|armory)/.test(
      key,
    )
  );
}
