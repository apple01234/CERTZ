/* =====================================================================
 * v1.1.9 (#개편 A47·A48) — 채집 + 요리
 *
 * 왜 만들었나:
 *   A46 낚시로 물고기를 잡게 했지만 쓸 곳이 없었다(골드로만 환산). 수집품이
 *   실제로 다른 시스템을 먹여야 루프가 닫힌다.
 *   → 필드에서 약초/광물을 캐고(A48), 그것과 물고기로 요리를 만든다(A47).
 *   요리는 전투 버프를 주므로 "사냥 → 재료 → 더 강한 사냥" 순환이 완성된다.
 *
 * 설계:
 *   · 채집 노드는 필드에 주기적으로 리스폰. 지역마다 다른 재료가 나온다.
 *   · 요리는 재료 2~3종을 조합. 결과물은 기존 BUFF_DEFS와 같은 형태의 버프.
 *   · 실패 없음 — 재료만 소모. 대신 "잘 만든 요리"(10% 확률)는 지속시간 1.5배.
 *
 * 이 파일은 순수 데이터/계산만 담당한다(Phaser·React 의존 없음).
 * ===================================================================== */

import type { FishingZone } from "./fishing";

/** 채집 재료 */
export type GatherKey =
  | "herb_sun" | "herb_frost" | "herb_ember" | "herb_shadow"
  | "ore_iron" | "ore_crystal" | "ore_rune" | "ore_abyss"
  | "mush_red" | "mush_blue" | "salt_rock" | "honey_drop";

export type GatherDef = {
  key: GatherKey;
  name: string;
  /** 채집 가능 지역 */
  zones: FishingZone[];
  /** 리스폰 대기(ms) — 짧을수록 흔함 */
  respawn: number;
  /** 한 번에 얻는 개수 범위 */
  yield: [number, number];
  desc: string;
  color: string;
};

export const GATHER_DEFS: GatherDef[] = [
  /* 약초 — 요리의 기본 */
  { key: "herb_sun", name: "햇살풀", zones: ["forest", "kingdom", "alfheim"], respawn: 25000, yield: [1, 2], desc: "양지에서 자라는 노란 약초. 은은한 단맛.", color: "#fde68a" },
  { key: "herb_frost", name: "서리꽃", zones: ["niflheim", "cave"], respawn: 30000, yield: [1, 2], desc: "얼음 틈에서 피는 꽃. 만지면 차갑다.", color: "#a5f3fc" },
  { key: "herb_ember", name: "불씨잎", zones: ["muspelheim"], respawn: 30000, yield: [1, 2], desc: "불에 타지 않는 잎. 씹으면 매콤하다.", color: "#fca5a5" },
  { key: "herb_shadow", name: "그늘버섯", zones: ["hel", "abyss", "nidavellir"], respawn: 35000, yield: [1, 2], desc: "빛이 없는 곳에서만 자란다. 향이 강하다.", color: "#c4b5fd" },

  /* 광물 — 제작/강화와 연결 */
  { key: "ore_iron", name: "철광석", zones: ["forest", "kingdom", "cave"], respawn: 40000, yield: [1, 2], desc: "흔한 광석. 대장간에서 쓰인다.", color: "#d4d4d8" },
  { key: "ore_crystal", name: "수정조각", zones: ["alfheim", "cave"], respawn: 50000, yield: [1, 1], desc: "빛을 굴절시키는 조각. 장신구 재료.", color: "#93c5fd" },
  { key: "ore_rune", name: "룬원석", zones: ["nidavellir"], respawn: 60000, yield: [1, 1], desc: "룬이 새겨진 원석. 난쟁이들의 보물.", color: "#fbbf24" },
  { key: "ore_abyss", name: "심연결정", zones: ["hel", "abyss"], respawn: 70000, yield: [1, 1], desc: "심연의 기운이 응축된 결정. 만지면 손이 저리다.", color: "#a78bfa" },

  /* 부재료 */
  { key: "mush_red", name: "붉은버섯", zones: ["forest", "cave"], respawn: 28000, yield: [2, 3], desc: "독은 없지만 맛이 강하다. 요리의 감초.", color: "#f87171" },
  { key: "mush_blue", name: "푸른버섯", zones: ["alfheim", "niflheim"], respawn: 32000, yield: [2, 3], desc: "시원한 향이 난다. 생으로도 먹을 수 있다.", color: "#60a5fa" },
  { key: "salt_rock", name: "소금바위", zones: ["muspelheim", "kingdom"], respawn: 45000, yield: [2, 3], desc: "깨면 소금이 나온다. 어떤 요리에나 맞는다.", color: "#e5e7eb" },
  { key: "honey_drop", name: "벌꿀방울", zones: ["forest", "alfheim"], respawn: 55000, yield: [1, 2], desc: "야생벌이 남긴 방울. 달콤함의 정점.", color: "#fcd34d" },
];

export const GATHER_BY_KEY: Record<GatherKey, GatherDef> = Object.fromEntries(
  GATHER_DEFS.map((g) => [g.key, g]),
) as Record<GatherKey, GatherDef>;

/** 지역별 채집 후보 */
export function gatherPoolFor(zone: FishingZone): GatherDef[] {
  return GATHER_DEFS.filter((g) => g.zones.includes(zone));
}

/** 요리 결과 버프 종류 */
export type DishBuff = "atk" | "def" | "spd" | "exp" | "gold" | "crit";

export type RecipeDef = {
  key: string;
  name: string;
  /** 필요한 재료 (물고기는 fish_ 접두사 키로 지정) */
  need: { item: string; n: number }[];
  buff: DishBuff;
  /** 버프 배율 (atk면 +25% → 0.25) */
  power: number;
  /** 지속 시간(ms) */
  duration: number;
  desc: string;
};

/**
 * 요리 레시피 — 재료는 낚시(물고기)·채집(약초/광물)에서 모은다.
 * "잘 만든 요리"는 지속시간 1.5배.
 */
export const COOK_RECIPES: RecipeDef[] = [
  /* ── 초급 (재료 2종) ── */
  { key: "dish_fishgrill", name: "숯불 생선구이", need: [{ item: "fish_minnow", n: 2 }, { item: "salt_rock", n: 1 }], buff: "atk", power: 0.12, duration: 90_000, desc: "공격력 +12% · 90초" },
  { key: "dish_herbsoup", name: "햇살풀 수프", need: [{ item: "herb_sun", n: 2 }, { item: "mush_red", n: 1 }], buff: "def", power: 4, duration: 90_000, desc: "방어력 +4 · 90초" },
  { key: "dish_berrytea", name: "벌꿀 차", need: [{ item: "honey_drop", n: 1 }, { item: "herb_sun", n: 1 }], buff: "spd", power: 0.15, duration: 75_000, desc: "이동속도 +15% · 75초" },

  /* ── 중급 (재료 3종 / 물고기 활용) ── */
  { key: "dish_carpsteak", name: "잉어 스테이크", need: [{ item: "fish_carp", n: 1 }, { item: "salt_rock", n: 1 }, { item: "herb_ember", n: 1 }], buff: "atk", power: 0.20, duration: 110_000, desc: "공격력 +20% · 110초" },
  { key: "dish_frostsashimi", name: "서리 회", need: [{ item: "fish_icefish", n: 3 }, { item: "herb_frost", n: 1 }], buff: "crit", power: 8, duration: 100_000, desc: "치명타 +8% · 100초" },
  { key: "dish_troutbake", name: "송어 구이", need: [{ item: "fish_trout", n: 2 }, { item: "salt_rock", n: 1 }, { item: "mush_blue", n: 1 }], buff: "exp", power: 0.25, duration: 130_000, desc: "경험치 +25% · 130초" },
  { key: "dish_mushpot", name: "버섯 전골", need: [{ item: "mush_red", n: 2 }, { item: "mush_blue", n: 2 }, { item: "herb_sun", n: 1 }], buff: "def", power: 7, duration: 110_000, desc: "방어력 +7 · 110초" },

  /* ── 고급 (희귀 재료) ── */
  { key: "dish_salmonplate", name: "은연어 플레이트", need: [{ item: "fish_salmon", n: 1 }, { item: "salt_rock", n: 2 }, { item: "honey_drop", n: 1 }], buff: "gold", power: 0.30, duration: 140_000, desc: "골드 획득 +30% · 140초" },
  { key: "dish_crystaldish", name: "수정비늘 정찬", need: [{ item: "fish_crystal", n: 1 }, { item: "ore_crystal", n: 1 }, { item: "herb_frost", n: 2 }], buff: "atk", power: 0.28, duration: 150_000, desc: "공격력 +28% · 150초" },
  { key: "dish_emberhotpot", name: "용암 전골", need: [{ item: "fish_ember", n: 1 }, { item: "herb_ember", n: 2 }, { item: "ore_iron", n: 1 }], buff: "crit", power: 12, duration: 140_000, desc: "치명타 +12% · 140초" },
  { key: "dish_runebread", name: "룬 빵", need: [{ item: "ore_rune", n: 1 }, { item: "herb_sun", n: 2 }, { item: "honey_drop", n: 1 }], buff: "exp", power: 0.35, duration: 160_000, desc: "경험치 +35% · 160초" },

  /* ── 최고급 (전설 재료) ── */
  { key: "dish_voidstew", name: "공허 스튜", need: [{ item: "fish_void", n: 1 }, { item: "herb_shadow", n: 2 }, { item: "ore_abyss", n: 1 }], buff: "atk", power: 0.40, duration: 180_000, desc: "공격력 +40% · 180초" },
  { key: "dish_aurorafeast", name: "오로라 만찬", need: [{ item: "fish_aurora", n: 1 }, { item: "herb_frost", n: 2 }, { item: "ore_crystal", n: 2 }], buff: "crit", power: 18, duration: 180_000, desc: "치명타 +18% · 180초" },
  { key: "dish_yggfeast", name: "인피니트보석 잎새 요리", need: [{ item: "fish_yggdrasil", n: 1 }, { item: "ore_abyss", n: 1 }, { item: "honey_drop", n: 2 }], buff: "exp", power: 0.60, duration: 200_000, desc: "경험치 +60% · 200초" },
];

export const COOK_BY_KEY: Record<string, RecipeDef> = Object.fromEntries(COOK_RECIPES.map((r) => [r.key, r]));

/** "잘 만든 요리" 확률 — 지속시간 1.5배 */
export const COOK_PERFECT_CHANCE = 0.1;

/**
 * 레시피 제작 가능 여부.
 * @param have 재료 보유량 맵 (ItemKey/GatherKey/FishKey 공용 문자열 키)
 */
export function canCook(recipe: RecipeDef, have: Record<string, number>): boolean {
  return recipe.need.every((n) => (have[n.item] ?? 0) >= n.n);
}

/** 제작 후 남는 재료 맵 (원본 불변) */
export function applyCook(recipe: RecipeDef, have: Record<string, number>): Record<string, number> {
  const next = { ...have };
  for (const n of recipe.need) next[n.item] = Math.max(0, (next[n.item] ?? 0) - n.n);
  return next;
}

/** 요리 결과를 BUFF_DEFS 형태로 변환할 때 쓰는 메타 */
export const DISH_BUFF_META: Record<DishBuff, { label: string; color: string }> = {
  atk: { label: "공격", color: "#ff8a8a" },
  def: { label: "방어", color: "#8fb8ff" },
  spd: { label: "이동", color: "#9af0c8" },
  exp: { label: "경험치", color: "#e8a8ff" },
  gold: { label: "골드", color: "#ffd76a" },
  crit: { label: "치명", color: "#ffb0e8" },
};

/** 버프 표시 문자열 */
export function dishBuffText(r: RecipeDef, perfect: boolean): string {
  const m = DISH_BUFF_META[r.buff];
  const unit = r.buff === "def" || r.buff === "crit" ? "" : "%";
  const val = r.buff === "def" || r.buff === "crit" ? r.power : Math.round(r.power * 100);
  const dur = Math.round((r.duration * (perfect ? 1.5 : 1)) / 1000);
  return `${m.label} +${val}${unit} · ${dur}초${perfect ? " (잘 만듦!)" : ""}`;
}
