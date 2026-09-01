/**
 * SERTZ 게임 데이터 (v2.0)
 *  - 스테이지/몬스터/보스 정의는 stages.ts (9챕터 × 10구역 생성기)에서 재수출
 *  - v1.5 스토리 대사 전면 복원 (아뜰란티스 7보석 스토리라인 — 사용자 지시 #19)
 *  - v1.9 아이템/BM(버프·펫·치장) 유지 + 강화 12단계 확장 (메이플 스타포스식)
 */
import { CHAPTERS, ENEMIES, type ChapterKey } from "./stages";
import type { FamilyKey } from "./classes";

/* ================= 스테이지/전투 데이터 (stages.ts 생성기) ================= */

export {
  CHAPTERS,
  STAGES,
  NEXT_STAGE,
  PREV_STAGE,
  STAGE_SHORT,
  STAGE_THEME,
  ENEMIES,
  BOSS_DEFS,
  parseStage,
  chapterSpec,
  stageScale,
  resolveStage,
  stageIntro,
} from "./stages";

export type {
  ChapterKey,
  StageKey,
  EnemyKey,
  EnemyDef,
  QuestDef,
  BossKey,
  BossDef,
  BossAttackKind,
  StageDef,
} from "./stages";

/** 몬스터 골드 드롭 조정 계수 (사용자 지시 #6 — 골드 과다 수정) */
export const GOLD_DROP_SCALE = 0.62;

/** 강화 비용 — 단계별 눈덩이 곡선 (높은 단계일수록 골드 소모 급증 → 골드 싱크)
 *  v3.0.5 — ★12부터 추가 계수 1.6^(성-11) 가산 (스타포스 후반부 급증 구간) */
export function upgradeCost(slot: "weapon" | "armor", level: number): number {
  const base = slot === "weapon" ? 45 : 38;
  const core = base * Math.pow(1.45, level);
  const late = level > 11 ? Math.pow(1.6, level - 11) : 1;
  return Math.round(core * late);
}

/* ================= 아이템 (v1.9 유지) ================= */

export type ItemKey =
  | "potion_hp"
  | "potion_mp"
  | "potion_hp2"
  | "potion_mp2"
  | "weapon_1"
  | "weapon_2"
  | "weapon_3"
  | "weapon_4"
  | "weapon_5"
  | "weapon_6"
  | "armor_1"
  | "armor_2"
  | "armor_3"
  | "armor_4"
  | "armor_5"
  | "armor_6"
  | "ring_power"
  | "ring_vital"
  | "ring_crit"
  | "ring_guard"
  | "pendant_vital"
  | "pendant_arcane"
  | "scroll_return"
  | "scroll_warp"
  | "scroll_star"
  | "buff_atk"
  | "buff_def"
  | "buff_spd"
  | "buff_exp"
  | "pet_slime"
  | "pet_pixie"
  | "cos_dawn"
  | "cos_gold"
  | "cos_abyss"
  | "cos_wings"
  /* v3.0.6 (지시 #9) — 보스 전용 드롭 (상점 판매 금지 — 유저 거래소 예정) */
  | "bd_guardian"
  | "bd_behemoth"
  | "bd_nidhog"
  | "bd_surt"
  | "bd_fenrir"
  | "bd_skoll"
  | "bd_gram"
  | "bd_abysslord"
  | "bd_abudditos"
  /* v3.0.6 — BM 상점 (에메랄드 전용 — 상점과 분리) */
  | "pet_atlas"
  | "cos_aurora"
  | "ring_bless"
  | "buff_king";

/** 아이템 등급 (클래식 MMORPG 관례 — 테두리/이름색 구분)
 *  v3.0.6 — "legend" 추가 (보스 전용 드롭 전용 등급) */
export type ItemTier = "common" | "rare" | "epic" | "legend";

/**
 * v3.0.5 — 스타포스 강화 (메이플스토리 Star Force식)
 *  - 상한 +15로 확장, 15단계 성공률 곡선
 *  - ★5/★10/★15 마일스톤 돌파 시 추가 효과(공격/치명/방어/HP) + 돌파 연출
 *  - +9 이상 실패 시 1성 하락 (스타포스식 리스크)
 */
export const UPGRADE_MAX = 15;
/** 강화 성공률 (%) — 현재 성 인덱스 (0=★0→★1, … 14=★14→★15) */
export const UPGRADE_RATES = [100, 85, 70, 55, 40, 35, 30, 25, 20, 15, 12, 10, 8, 6, 5];
/** 강화 하락 시작 단계 (★9 이상 실패 시 1성 하락 — 스타포스식 리스크) */
export const UPGRADE_FALLBACK_FROM = 9;

/** 마일스톤 성 구간 */
export const STAR_MILESTONES = [5, 10, 15] as const;

/** 무기 마일스톤 보너스 (누적 — ★15 도달 시 공격+18·치명+10%) */
export const WEAPON_MILESTONES: Readonly<Record<number, { atk: number; crit: number }>> = {
  5: { atk: 4, crit: 2 },
  10: { atk: 6, crit: 3 },
  15: { atk: 8, crit: 5 },
};
/** 방어구 마일스톤 보너스 (누적 — ★15 도달 시 방어+5·최대HP+155) */
export const ARMOR_MILESTONES: Readonly<Record<number, { def: number; hp: number }>> = {
  5: { def: 0, hp: 25 },
  10: { def: 2, hp: 50 },
  15: { def: 3, hp: 80 },
};

/** 성수 up에서 누적된 무기 마일스톤 보너스 */
export function starWeaponBonus(up: number): { atk: number; crit: number } {
  let atk = 0, crit = 0;
  for (const m of STAR_MILESTONES) {
    if (up >= m) { atk += WEAPON_MILESTONES[m].atk; crit += WEAPON_MILESTONES[m].crit; }
  }
  return { atk, crit };
}
/** 성수 up에서 누적된 방어구 마일스톤 보너스 */
export function starArmorBonus(up: number): { def: number; hp: number } {
  let def = 0, hp = 0;
  for (const m of STAR_MILESTONES) {
    if (up >= m) { def += ARMOR_MILESTONES[m].def; hp += ARMOR_MILESTONES[m].hp; }
  }
  return { def, hp };
}

/** v3.0.7 — 강화 주문서 1장당 성공률 보너스 (%p, 중첩 최대 3장 = +45%p) */
export const STAR_BLESS_RATE = 15;
export const STAR_BLESS_MAX = 3;

/** v3.0.7 — 장신구 스타포스 마일스톤 보너스 (crit 트랙: 반지 계열 / hp 트랙: 펜던트 계열)
 *  무기·방어구와 동일 ★5/★10/★15 구간. crit 스탯이 있으면 치명 트랙, maxHp가 있으면 HP 트랙 (둘 다 가능). */
export function starAccBonus(up: number, item: { crit?: number; maxHp?: number }): { crit: number; hp: number } {
  let crit = 0, hp = 0;
  if (item.crit) crit = up >= 15 ? 12 : up >= 10 ? 6 : up >= 5 ? 2 : 0;
  if (item.maxHp) hp = up >= 15 ? 110 : up >= 10 ? 55 : up >= 5 ? 20 : 0;
  return { crit, hp };
}

/** 성급 티어 (0=흰색 ★1~4 / 1=청록 ★5~9 / 2=보라 ★10~14 / 3=금색 ★15) */
export function starTier(up: number): 0 | 1 | 2 | 3 {
  return up >= 15 ? 3 : up >= 10 ? 2 : up >= 5 ? 1 : 0;
}
/** 성급 티어 색상 (hex) — 오라/파티클/피커업 텍스트 공용 */
export const STAR_TIER_COLORS = [0xffffff, 0x6ff2d8, 0xd29dff, 0xffd76a] as const;
export const STAR_TIER_CSS = ["#e8ecf2", "#6ff2d8", "#d29dff", "#ffd76a"] as const;

export type ItemDef = {
  key: ItemKey;
  kind: "consumable" | "weapon" | "armor" | "accessory" | "buff" | "pet" | "cosmetic";
  name: string;
  icon: string; // 텍스처 키
  price: number; // 상점 구매가 (0 = 판매 안 함/기본 지급)
  tier: ItemTier; // 등급 (UI 테두리/이름색)
  heal?: number; // HP 회복
  restore?: number; // MP 회복
  atk?: number; // 무기 공격력 보너스
  def?: number; // 방어구 방어력
  crit?: number; // 장신구 — 크리티컬 확률 증가 (%p)
  maxHp?: number; // 장신구 — 최대 HP 증가
  slot?: "ring" | "pendant"; // v2.9 (#8) — 중복 장착 슬롯 종류 (기본 ring)
  /** v3.0.6 (지시 #9) — 상점 구매 금지 (보스 드롭 전용 — 추후 유저 거래소 판매 예정) */
  tradeLock?: boolean;
  /** v3.0.6 — BM 상점(에메랄드) 전용 가격 / 골드 상점 판매 금지 플래그 */
  bmPrice?: number;
  bmOnly?: boolean;
  /** v3.0.6 — 보스 드롭 설명 (인벤토리 툴팁용) */
  bossDrop?: string;
};

export const ITEMS: Record<ItemKey, ItemDef> = {
  potion_hp: { key: "potion_hp", kind: "consumable", name: "HP 물약", icon: "item_potion_hp", price: 30, tier: "common", heal: 50 },
  potion_mp: { key: "potion_mp", kind: "consumable", name: "MP 물약", icon: "item_potion_mp", price: 25, tier: "common", restore: 30 },
  /* v2.5 — 상급 물약 (지시 #5 아이템 확장) */
  potion_hp2: { key: "potion_hp2", kind: "consumable", name: "상급 HP 물약", icon: "item_potion_hp2", price: 70, tier: "rare", heal: 130 },
  potion_mp2: { key: "potion_mp2", kind: "consumable", name: "상급 MP 물약", icon: "item_potion_mp2", price: 60, tier: "rare", restore: 80 },
  /* v2.5 — 이동 소모품 (지시 #6 귀환서 / #7 지역 워프 부적) */
  scroll_return: { key: "scroll_return", kind: "consumable", name: "마을 귀환서", icon: "item_scroll_return", price: 40, tier: "common" },
  scroll_warp: { key: "scroll_warp", kind: "consumable", name: "지역 이동 부적", icon: "item_scroll_warp", price: 120, tier: "rare" },
  /* v3.0.7 — 강화 주문서: 사용 시 다음 강화 시도 1회 성공률 +15%p (최대 3중첩) */
  scroll_star: { key: "scroll_star", kind: "consumable", name: "강화 주문서", icon: "item_scroll_star", price: 150, tier: "rare" },
  weapon_1: { key: "weapon_1", kind: "weapon", name: "낡은 단검", icon: "item_weapon_1", price: 0, tier: "common", atk: 0 },
  weapon_2: { key: "weapon_2", kind: "weapon", name: "강철 검", icon: "item_weapon_2", price: 110, tier: "rare", atk: 6 },
  weapon_3: { key: "weapon_3", kind: "weapon", name: "기사단 대검", icon: "item_weapon_3", price: 260, tier: "epic", atk: 14 },
  weapon_4: { key: "weapon_4", kind: "weapon", name: "심연의 대검", icon: "item_weapon_4", price: 420, tier: "epic", atk: 20 },
  /* v2.5 — 상위 장비 티어 (지시 #5 아이템 확장) */
  weapon_5: { key: "weapon_5", kind: "weapon", name: "용인의 마검", icon: "item_weapon_5", price: 560, tier: "epic", atk: 28 },
  weapon_6: { key: "weapon_6", kind: "weapon", name: "심연룡의 절세검", icon: "item_weapon_6", price: 900, tier: "epic", atk: 38 },
  armor_1: { key: "armor_1", kind: "armor", name: "여행자의 옷", icon: "item_armor_1", price: 0, tier: "common", def: 0 },
  armor_2: { key: "armor_2", kind: "armor", name: "가죽 갑옷", icon: "item_armor_2", price: 95, tier: "rare", def: 3 },
  armor_3: { key: "armor_3", kind: "armor", name: "기사단 갑옷", icon: "item_armor_3", price: 230, tier: "epic", def: 7 },
  armor_4: { key: "armor_4", kind: "armor", name: "수호자의 갑옷", icon: "item_armor_4", price: 380, tier: "epic", def: 10 },
  armor_5: { key: "armor_5", kind: "armor", name: "용린 갑주", icon: "item_armor_5", price: 480, tier: "epic", def: 14 },
  armor_6: { key: "armor_6", kind: "armor", name: "심연룡의 비늘갑옷", icon: "item_armor_6", price: 820, tier: "epic", def: 18 },
  ring_power: { key: "ring_power", kind: "accessory", name: "힘의 반지", icon: "item_ring_power", price: 150, tier: "rare", crit: 7, slot: "ring" },
  ring_vital: { key: "ring_vital", kind: "accessory", name: "생명의 반지", icon: "item_ring_vital", price: 130, tier: "rare", maxHp: 25, slot: "ring" },
  /* v2.5 — 상위 장신구 (지시 #5 아이템 확장) */
  ring_crit: { key: "ring_crit", kind: "accessory", name: "매의 눈 반지", icon: "item_ring_crit", price: 400, tier: "epic", crit: 12, slot: "ring" },
  ring_guard: { key: "ring_guard", kind: "accessory", name: "수호 반지", icon: "item_ring_guard", price: 380, tier: "epic", maxHp: 60, slot: "ring" },
  /* v2.9 (#8) — 펜던트 (2개 중복 장착) */
  pendant_vital: { key: "pendant_vital", kind: "accessory", name: "생명의 펜던트", icon: "item_pendant_vital", price: 300, tier: "rare", maxHp: 45, slot: "pendant" },
  pendant_arcane: { key: "pendant_arcane", kind: "accessory", name: "신비의 펜던트", icon: "item_pendant_arcane", price: 520, tier: "epic", crit: 10, slot: "pendant" },
  /* ---- BM (v1.9): 버프 물약 / 펫 / 치장 ---- */
  buff_atk: { key: "buff_atk", kind: "buff", name: "분노의 물약", icon: "item_buff_atk", price: 60, tier: "rare" },
  buff_def: { key: "buff_def", kind: "buff", name: "수호의 물약", icon: "item_buff_def", price: 55, tier: "rare" },
  buff_spd: { key: "buff_spd", kind: "buff", name: "신속의 물약", icon: "item_buff_spd", price: 50, tier: "rare" },
  buff_exp: { key: "buff_exp", kind: "buff", name: "지혜의 물약", icon: "item_buff_exp", price: 90, tier: "rare" },
  pet_slime: { key: "pet_slime", kind: "pet", name: "슬라임 젤리", icon: "pet_slime", price: 280, tier: "rare" },
  pet_pixie: { key: "pet_pixie", kind: "pet", name: "요정 핑크이", icon: "pet_pixie", price: 520, tier: "epic" },
  cos_dawn: { key: "cos_dawn", kind: "cosmetic", name: "새벽빛 오라", icon: "cos_dawn", price: 200, tier: "rare" },
  cos_gold: { key: "cos_gold", kind: "cosmetic", name: "황금 오라", icon: "cos_gold", price: 200, tier: "rare" },
  cos_abyss: { key: "cos_abyss", kind: "cosmetic", name: "심연 오라", icon: "cos_abyss", price: 260, tier: "epic" },
  cos_wings: { key: "cos_wings", kind: "cosmetic", name: "요정 날개", icon: "cos_wings", price: 340, tier: "epic" },
  /* ---- v3.0.6 (지시 #9) — 보스 전용 드롭 아이템 (전설 등급) ----
   *  상점에서 살 수 없음(tradeLock) — 추후 유저 거래소에서 사고팔게 할 예정.
   *  보스별 1종, 100% 드롭. 상점 에픽 대비 확실히 강한 수치. */
  bd_guardian: { key: "bd_guardian", kind: "accessory", name: "수호자의 문장", icon: "item_ring_guard", price: 0, tier: "legend", maxHp: 90, crit: 5, slot: "ring", tradeLock: true, bossDrop: "심연의 수호자 드롭 — 상점 판매 금지 · 거래소 예정" },
  bd_behemoth: { key: "bd_behemoth", kind: "accessory", name: "눈보라의 심장", icon: "item_ring_vital", price: 0, tier: "legend", maxHp: 120, def: 2, slot: "pendant", tradeLock: true, bossDrop: "눈보라의 거수 드롭 — 상점 판매 금지 · 거래소 예정" },
  bd_nidhog: { key: "bd_nidhog", kind: "accessory", name: "탐식의 비늘", icon: "item_ring_power", price: 0, tier: "legend", crit: 8, maxHp: 60, slot: "ring", tradeLock: true, bossDrop: "니드호그 드롭 — 상점 판매 금지 · 거래소 예정" },
  bd_surt: { key: "bd_surt", kind: "accessory", name: "화염 정령의 인장", icon: "item_ring_power", price: 0, tier: "legend", crit: 10, slot: "pendant", tradeLock: true, bossDrop: "수르트 드롭 — 상점 판매 금지 · 거래소 예정" },
  bd_fenrir: { key: "bd_fenrir", kind: "accessory", name: "탐욕의 속니", icon: "item_ring_crit", price: 0, tier: "legend", crit: 12, maxHp: 50, slot: "ring", tradeLock: true, bossDrop: "펜리르 드롭 — 상점 판매 금지 · 거래소 예정" },
  bd_skoll: { key: "bd_skoll", kind: "accessory", name: "교만의 쌍두 귀걸이", icon: "item_pendant_arcane", price: 0, tier: "legend", crit: 8, maxHp: 80, slot: "pendant", tradeLock: true, bossDrop: "스콜&하티 드롭 — 상점 판매 금지 · 거래소 예정" },
  bd_gram: { key: "bd_gram", kind: "accessory", name: "대지의 핵", icon: "item_ring_guard", price: 0, tier: "legend", maxHp: 150, def: 3, slot: "ring", tradeLock: true, bossDrop: "그람 드롭 — 상점 판매 금지 · 거래소 예정" },
  bd_abysslord: { key: "bd_abysslord", kind: "accessory", name: "심연의 군주의 관", icon: "item_pendant_arcane", price: 0, tier: "legend", crit: 14, maxHp: 100, slot: "pendant", tradeLock: true, bossDrop: "심연의 군주 드롭 — 상점 판매 금지 · 거래소 예정" },
  bd_abudditos: { key: "bd_abudditos", kind: "accessory", name: "대악마의 계약서", icon: "item_pendant_arcane", price: 0, tier: "legend", crit: 18, maxHp: 130, slot: "pendant", tradeLock: true, bossDrop: "아부디토스 드롭 — 최고 보스 전리품 · 거래소 예정" },
  /* ---- v3.0.6 — BM 상점 (에메랄드 전용 — 골드 상점과 분리, 지시 #1) ---- */
  pet_atlas: { key: "pet_atlas", kind: "pet", name: "별의 정령 아틀라스", icon: "pet_atlas", price: 0, bmPrice: 30, bmOnly: true, tier: "legend" },
  ring_bless: { key: "ring_bless", kind: "accessory", name: "가호의 반지", icon: "ring_bless", price: 0, bmPrice: 45, bmOnly: true, tier: "legend", crit: 15, maxHp: 100, slot: "ring" },
  buff_king: { key: "buff_king", kind: "buff", name: "왕의 가호", icon: "buff_king", price: 0, bmPrice: 15, bmOnly: true, tier: "legend" },
  cos_aurora: { key: "cos_aurora", kind: "cosmetic", name: "오로라 후광", icon: "cos_aurora", price: 0, bmPrice: 20, bmOnly: true, tier: "legend" },
};

/* v3.0.6 (지시 — "나중가면 플레이어가 너무 쌔닌까 보스 및 몬스터가 체력% 고정 데미지를 주게해"):
 *  몬스터/보스 피해의 maxHP % 하한 — 방어력 스택으로 피해가 1로 굳는 후반 탱킹 방지.
 *  최종 피해 = max(방어 감쇄 피해, maxHP × pct). 초반엔 원래 수치가 지배, 후반엔 %가 지배. */
export const DMG_PCT = {
  mob: 0.045,        // 일반 몬스터 접촉/투사체
  elite: 0.06,       // 정예/시험 상대
  boss: 0.09,        // 보스 탄막·돌진
  bossSlam: 0.12,    // 보스 강타
  plant: 0.05,       // 육식 식물
} as const;

/** 강화 1단계당 보너스 */
export const UPGRADE_BONUS = { weaponAtk: 2, armorDef: 1 } as const;

/* ================= BM (v1.9 — 버프/펫/치장, 메이플 BM 감각) ================= */

export type BuffKey = "buff_atk" | "buff_def" | "buff_spd" | "buff_exp" | "buff_king";
export type PetKey = "pet_slime" | "pet_pixie" | "pet_atlas";
export type CosmeticKey = "cos_dawn" | "cos_gold" | "cos_abyss" | "cos_wings" | "cos_aurora";

/** 버프 물약 효과 — 사용 시 지속시간 동안 적용 (같은 버프 재사용 시 시간 갱신) */
export type BuffDef = {
  key: BuffKey;
  name: string;
  icon: string;
  desc: string;
  duration: number;
  color: string;
  price: number;
};
export const BUFF_DEFS: Record<BuffKey, BuffDef> = {
  buff_atk: { key: "buff_atk", name: "분노의 물약", icon: "item_buff_atk", desc: "공격력 +25%", duration: 60_000, color: "#ff8a8a", price: 60 },
  buff_def: { key: "buff_def", name: "수호의 물약", icon: "item_buff_def", desc: "방어력 +8", duration: 60_000, color: "#8fb8ff", price: 55 },
  buff_spd: { key: "buff_spd", name: "신속의 물약", icon: "item_buff_spd", desc: "이동속도 +25%", duration: 60_000, color: "#9af0c8", price: 50 },
  buff_exp: { key: "buff_exp", name: "지혜의 물약", icon: "item_buff_exp", desc: "경험치 +50%", duration: 120_000, color: "#e8a8ff", price: 90 },
  /* v3.0.6 — BM 전용 올인원 버프 (왕의 가호) */
  buff_king: { key: "buff_king", name: "왕의 가호", icon: "buff_king", desc: "공격 +30% · 방어 +10 · 신속 +25%", duration: 90_000, color: "#ffe29a", price: 0 },
};

/** 펫 정의 — 플레이어를 따라다니며 드롭 자동 줍기 + 골드 보너스 */
export type PetDef = {
  key: PetKey;
  name: string;
  icon: string;
  desc: string;
  bonusGoldPct: number;
  price: number;
};
export const PET_DEFS: Record<PetKey, PetDef> = {
  pet_slime: { key: "pet_slime", name: "슬라임 젤리", icon: "pet_slime", desc: "드롭 자동 줍기 · 골드 +10%", bonusGoldPct: 10, price: 280 },
  pet_pixie: { key: "pet_pixie", name: "요정 핑크이", icon: "pet_pixie", desc: "드롭 자동 줍기 · 골드 +20%", bonusGoldPct: 20, price: 520 },
  /* v3.0.6 — 3번째 펫: 맵 전체 드롭을 즉시 끌어오는 자석 정령 (BM 전용, 지시 #5) */
  pet_atlas: { key: "pet_atlas", name: "별의 정령 아틀라스", icon: "pet_atlas", desc: "맵 전체 드롭 즉시 흡수 · 골드 +30%", bonusGoldPct: 30, price: 0 },
};

/** 치장 아이템 — 플레이어 뒤에 따라붙는 오라 연출 (전투 능력 없음, 순수 치장) */
export type CosmeticDef = {
  key: CosmeticKey;
  name: string;
  icon: string;
  desc: string;
  price: number;
  tint: number;
};
export const COSMETIC_DEFS: Record<CosmeticKey, CosmeticDef> = {
  cos_dawn: { key: "cos_dawn", name: "새벽빛 오라", icon: "cos_dawn", desc: "하늘빛 후광", price: 200, tint: 0x7dc0ff },
  cos_gold: { key: "cos_gold", name: "황금 오라", icon: "cos_gold", desc: "금빛 후광", price: 200, tint: 0xffd76a },
  cos_abyss: { key: "cos_abyss", name: "심연 오라", icon: "cos_abyss", desc: "보라빛 후광", price: 260, tint: 0xa875ff },
  cos_wings: { key: "cos_wings", name: "요정 날개", icon: "cos_wings", desc: "반짝임 입자 트레일", price: 340, tint: 0xbaf3ff },
  cos_aurora: { key: "cos_aurora", name: "오로라 후광", icon: "cos_aurora", desc: "무지빛 오로라 후광", price: 0, tint: 0x9df0ff },
};

/** 상점 판매 목록 (표시 순서 — BM 섹션은 kind로 분리 렌더) */
export const SHOP_STOCK: ItemKey[] = [
  "potion_hp",
  "potion_mp",
  "potion_hp2",
  "potion_mp2",
  "scroll_star", // v3.0.7 — 강화 주문서
  "weapon_2",
  "armor_2",
  "weapon_3",
  "armor_3",
  "weapon_4",
  "armor_4",
  "weapon_5",
  "armor_5",
  "weapon_6",
  "armor_6",
  "ring_power",
  "ring_vital",
  "ring_crit",
  "ring_guard",
  "pendant_vital",
  "pendant_arcane",
  "scroll_return",
  "scroll_warp",
  "buff_atk",
  "buff_def",
  "buff_spd",
  "buff_exp",
  "pet_slime",
  "pet_pixie",
  "cos_dawn",
  "cos_gold",
  "cos_abyss",
  "cos_wings",
];

/** v3.0.6 (지시 #4) — 아이템 판매가 (상점가의 40%, 최소 1G · 보스 전용은 고정가)
 *  v3.0.7 — 보스 전용 드롭(tradeLock)은 골드 판매 불가 → 거래소 에메랄드 판매(tradeValue)로 이동 */
export function sellValue(item: ItemDef): number {
  if (item.tradeLock) return 0;
  if (item.tier === "legend") return item.bmOnly ? 0 : 400;
  return Math.max(1, Math.floor(item.price * 0.4));
}

/* ================= v3.0.7 — 유저 거래소 (보스 드롭 전용 사고팔기) =================
 *  보스 드롭 9종은 상점에서 살 수 없다(tradeLock) → 거래소에서 에메랄드로만 거래.
 *  판매가 = 구매가의 60% (거래 수수료 컨셉). 에메랄드 수급처: 보스+2/정예+1/반복 사이클+1/GM. */
export const TRADE_PRICES: Record<string, number> = {
  bd_guardian: 8,   // 심연의 수호자 (1챕터)
  bd_behemoth: 10,  // 눈보라의 거수
  bd_nidhog: 12,    // 니드호그
  bd_surt: 14,      // 수르트
  bd_fenrir: 16,    // 펜리르
  bd_skoll: 18,     // 스콜&하티
  bd_gram: 20,      // 그람
  bd_abysslord: 24, // 심연의 군주
  bd_abudditos: 30, // 아부디토스 (최종 보스)
};

/** 거래소 판매가 (에메랄드) — 구매가의 60%, 최소 1 */
export function tradeValue(key: ItemKey): number {
  const p = TRADE_PRICES[key];
  return p ? Math.max(1, Math.floor(p * 0.6)) : 0;
}

/** 거래소 진열 목록 (보스 드롭 9종 — 등급순) */
export const TRADE_STOCK: ItemKey[] = [
  "bd_guardian", "bd_behemoth", "bd_nidhog", "bd_surt", "bd_fenrir",
  "bd_skoll", "bd_gram", "bd_abysslord", "bd_abudditos",
];

/** v3.0.6 (지시 #1) — BM 상점 판매 목록 (에메랄드 전용 — 골드 상점과 분리) */
export const BM_STOCK: ItemKey[] = ["pet_atlas", "ring_bless", "buff_king", "cos_aurora"];

/** v3.0.6 (지시 #9) — 보스 → 전용 드롭 아이템 매핑 (100% 드롭, 상점 구매 불가) */
export const BOSS_DROP_ITEMS: Record<string, ItemKey> = {
  guardian: "bd_guardian",
  behemoth: "bd_behemoth",
  nidhog: "bd_nidhog",
  surt: "bd_surt",
  fenrir: "bd_fenrir",
  skoll: "bd_skoll",
  gram: "bd_gram",
  abysslord: "bd_abysslord",
  abudditos: "bd_abudditos",
};

export type DialogueDef = { speaker: string; lines: string[] };

/* ================= 스토리 대사 (v1.5 원문 복원 — 아뜰란티스 7보석 라인) ================= */

export const DIALOGUES: Record<string, DialogueDef> = {
  /* ================= 공통 / 인트로 ================= */
  introNamed: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "{name}…! 좋은 이름이야. 바다가 기억할 이름이야.",
      "칼립소 할머니가 물거품이 되어 사라지기 전, 마지막으로 남긴 말 — 기억하지?",
      "'뒷산 폐허의 신전으로 가라.' 자, {name}. 인어의 숙명이 시작된다!",
    ],
  },
  villageIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "{name}, 나는 아부디토스. 네 펜던트에 깃든 정령이지.",
      "옛날 아뜰란티스 — 아홉 해역이 하나였던 대륙. 그 대륙이 흩어진 뒤, 일곱 개의 보석이 각 해역에 흩어졌어.",
      "보석이 한 곳에 모이면 세계가 멸망한다… 는 말은 내가 거짓말을 하고 있을지도? 후후.",
      "아무튼! 마을 동쪽 차원문을 지나면 서쪽 숲의 신전. 출발 전에 라고스 아저씨에게 물약을 챙기자, {name}!",
    ],
  },
  villager1: {
    speaker: "마을 주민",
    lines: [
      "어머, {name}! 칼립소 할머니를 따라가기로 했구나.",
      "차원문 너머 숲엔 늑대들이 돌아다녀. 물약 꼭 챙기고 다녀오렴.",
      "…할머니는 좋은 분이었어. 갑자기 물거품처럼 사라지셨다는 게 아직도 믿기지가 않아.",
    ],
  },
  villager2: {
    speaker: "마을 아이",
    lines: [
      "{name} 형아도 이제 진짜 모험가다! 부러워요.",
      "저는 마을 우물을 지키고 있을게요. 우물 물은 아프면 꼭 필요하답니다!",
      "할머니가 자주 그랬어요. '바다는 기억한다'라고… 무슨 뜻일까요?",
    ],
  },
  /* ================= 제2장 숲의 신전 ================= */
  intro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "저기 하늘로 빛 기둥이 솟았어 — 보석의 기운이야, {name}!",
      "숲의 신전은 저쪽. 신전에 도착하면 네가 해야 할 일을 자세히 말해 줄게.",
      "숲이 어두우니, 빛나는 기둥과 화살표를 따라가 보자.",
    ],
  },
  fragment: {
    speaker: "{name}",
    lines: [
      "이게… 보석의 흔적! 손안에서 뜨거워진다.",
      "아부디토스, 이거 진짜 보석이야?",
      "…흔적이야. 진짜 보석은 각 해역의 괴물들이 삼켰지. 하지만 훌륭한 시작이야, {name}!",
    ],
  },
  fragment2: {
    speaker: "{name}",
    lines: [
      "또 하나의 보석의 흔적… 몸속에서 바다가 출렁인다.",
      "아부디토스, 이 흔적도 어딘가의 보석이 삼킨 조각이야?",
      "…그래. 흔적이 모이면 진짜 보석의 위치가 드러나. 훌륭해, {name}!",
    ],
  },
  wolfRoutDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "능대 무리가 완전히 흩어졌어!",
      "…그런데 이상해. 무리의 왕이 없었어. 저마다 뭔가에 이끌리듯 동쪽으로 달려갔었지.",
      "보석의 기운이 숲을 지나 바다로 흘러가고 있어, {name}.",
    ],
  },
  wolvesDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "숲의 신전이 조금씩 눈을 뜨고 있어! 저기 차원문이 열리고 있어!",
      "저 문 너머는 쿠소디아 왕국 — 선박의 왕국이지. 왕을 만나면 바다를 건널 수 있어.",
      "가자, {name}. 아홉 해역 순행이 시작된다!",
    ],
  },
  /* ================= 제3장 쿠소디아 왕국 ================= */
  kingdomIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "쿠소디아 왕국에 도착했어. 왕족은 알프헤임과 동맹을 맺은 유서 깊은 왕국이지.",
      "…그런데 늪지대가 이상해. 보석의 기운을 먹고 자란 식인초가 왕국을 위협하고 있어.",
      "기사단을 도우면 왕에게 갈 수 있을 거야. 대사 하나가 백 금자리지, {name}!",
    ],
  },
  swampDone: {
    speaker: "쿠소디아 기사단장",
    lines: [
      "훌륭하다, 젊은 모험가여! 왕국의 은혜를 잊지 않겠다.",
      "왕께서 그대를 왕성에서 기다리신다. 저 차원문 너머 왕성으로 들어가게.",
      "…한 가지 더. 왕성 앞 동상이 며칠 전부터 이상하게 울고 있다는 소문이 있네…",
    ],
  },
  kingdomDone: {
    speaker: "라이언 드 쿠소디아 국왕",
    lines: [
      "잘 왔네, 모험가. 나는 쿠소디아의 왕 라이언이다.",
      "그대가 인어의 후예라는 것 — 나는 알고 있네. 옥새를 받아라.",
      "이 옥새를 들고 샘에 서면, 요정들이 왕족으로 인식해 알프헤임으로 안내할 것이다.",
      "폐하… 늪지의 동상이 니드호그로 변했다는 급보가! — 자, {name}. 서두르게!",
    ],
  },
  /* ================= 제4장 알프헤임 성전 ================= */
  alfheimIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "알프헤임에 도착했어… 하지만 공기가 무거워.",
      "니드호그 — 원래 알프헤임의 숲을 지키던 드래곤이었지. 지금은 탐식에 물들어 성전을 삼켰어.",
      "저 하수인들은 니드호그의 전령. 놈들이 의식을 마치기 전에 끊어야 해.",
      "여왕 요정에게 '절제의 검'을 받을 수 있도록, 먼저 하수인들을 정리하자, {name}!",
    ],
  },
  minionPurgeDone: {
    speaker: "알프헤임의 여왕 요정",
    lines: [
      "어서 오게, 인어의 후예여. 나는 이 해역의 여왕이다.",
      "이 검의 이름은 '절제의 검' — 인어들이 괴물을 상대하기 위해 만든 일곱 성물 중 하나다.",
      "조심하게. 성물은 인어의 피를 가진 자만 발동시킬 수 있고… 발동하면 힘을 강제로 끌어당겨. 대가가 있을 테니.",
      "니드호그는 저 성전 한가운데에서 대기하고 있네. 준비되면 가게, {name}!",
    ],
  },
  bossIntroNidhog: {
    speaker: "탐식의 드래곤 니드호그",
    lines: [
      "…빛나는 것이 보이는군. 인어의 피… 좋아, 좋아!",
      "내 위장 속 보석이 네 것을 부러워하겠군. 탐식의 드래곤이 네게 뭐라 말해줬으면 좋겠느냐!",
      "먹어 주마, 후예여! 이 성전째로!",
    ],
  },
  guardianDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "니드호그를 물리쳤어! 저기, 떨어진 빛 — 그게 '숲(탐식)의 보석'이야!",
      "…그런데 {name}, 네 얼굴이 창백해. 절제의 검이 수명을 끌어갔어… 시동무기는 무겁다.",
      "여왕이 성문을 열어 줬어. 다음은 극열의 해역 무스펠헤임. 쉬어가며 가자!",
    ],
  },
  /* ================= 제5장 무스펠헤임 ================= */
  muspelIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "무스펠헤임 — 극열의 해역이야. 1년 주기로 열이 변하는 바다지.",
      "하필 오늘이 열이 가장 강해지는 '극열의 날'이야. 화염 정령들이 네빌라를 뒤덮고 있어!",
      "저기 구조되어 있는 호족 소녀가 보여? 엘렌. 먼저 구해 주자, {name}!",
    ],
  },
  spiritPurgeDone: {
    speaker: "호족 소녀 엘렌",
    lines: [
      "고마워! 넌 인어가 아니지? …그래도 강하네.",
      "수르트가 화염 정령들을 이끌고 지하도시를 내려앉히려고 해.",
      "촌장님이 성물 보물고를 열어 주셨어. '자선의 목걸이'를 가져 가! 행운을 빌어.",
    ],
  },
  bossIntroSurt: {
    speaker: "분노의 정령 수르트",
    lines: [
      "작은 것… 내 영역을 침범했느냐!",
      "오늘의 태양은 내 것이다. 불의 정령이 막강해지는 날 — 네가 온 날이 바로 그날!",
      "재로 돌아가라, 인어의 후예!!",
    ],
  },
  surtDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "수르트가 무너졌어! 그런데… 저기 검은 화살이 뭔지?",
      "『인내의 창 — 사라져라.』",
      "…누구야?! 불의 보석이, 수르트의 것도 전부 저 사내한테…! 사라졌어, {name}!",
      "기억을 잃은 인어라… '루안'이라 자칭했어. 우리와 같은… 인어의 피를 가진 자야.",
    ],
  },
  /* ================= 제6장 니플헤임 ================= */
  niflIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "니플헤임이야… 숨만 쉴어도 몸이 얼어붙는 극한의 해역.",
      "저 앞 얼음의 성전에 마법사가 있대. 얼음의 보석을 지키고 있어서… 돕고 나면 정보를 얻을지도?",
      "그리고 조심해 — '탐욕의 늑대 펜리르'가 이 해역을 배회하고 있어. 보석을 두 개나 삼킨 괴물이야!",
    ],
  },
  frostRoutDone: {
    speaker: "마법사 흐레스",
    lines: [
      "…고맙군, 젊은이. 나는 흐레스. 이 성전의 수호자였다.",
      "펜리르에게 얼음의 보석을 빼앗겼다. 놈은 폭풍의 늑대였던 것 — 보석을 삼키고 변질되었지.",
      "성전 보물고의 '친절의 반지'를 가져가게. 탐욕을 베는 검이 되길.",
      "…저 녀석이 온다. 얼음의 성전으로 도망쳐라! 서두르게!",
    ],
  },
  bossIntroFenrir: {
    speaker: "탐욕의 늑대 펜리르",
    lines: [
      "이것이… 네가 말한 운명이라는 것인가, 칼립소…!",
      "보석 두 개의 힘을 지닌 나에게 — 인간이 무엇을 할 수 있겠느냐!",
      "네 보석까지 삼켜 주마, 후예여!!",
    ],
  },
  fenrirDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "펜리르가 쓰러졌어! 폭풍(탐욕)의 보석과 얼음(질투)의 보석 — 두 개를 한 번에 되찾았어!",
      "…{name}, 저기 사람이 있어. …루안이야!",
      "『시동무기는 사용자에게 귀속된다. 네가 쓴 성물은 네 것이야.』 …뭐야, 갑자기 등장해서 정보만 던지고 가네.",
      "어쨌든 보석이 네 개. 다음은 스바르트알프헤임 — 어둠 요정들의 지하야.",
    ],
  },
  /* ================= 제7장 스바르트알프헤임 ================= */
  caveIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "스바르트알프헤임 — 알프헤임 아래에 숨은 어둠 요정들의 해역이야.",
      "여긴 옛 아뜰란티스 사람들이 빛나던 수정을 캐던 곳이래.",
      "지금은 어둠이 수정을 삼켰어. 물든 거미와 골렘이 돌아다녀. 여왕을 돕자, {name}!",
    ],
  },
  spiderDone: {
    speaker: "땅의 요정 여왕",
    lines: [
      "지하가 다시 빛을 머금기 시작했네. 고맙다, 인어의 피를 지닌 자여.",
      "…들려주겠다. 헬 — 무스펠헤임과 니플헤임 사이의 절벽 너머.",
      "대전쟁의 유일한 생존자 두 인어가 있었지. 하나는 칼립소… 다른 하나는 그 여동생 '헬'이야.",
      "헬이 무엇을 숨기고 있는지는… 스스로 확인하게. 난쟁이들의 해역으로 가게.",
    ],
  },
  caveDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "지하 반대편 차원문이 열리고 있어!",
      "저 문 너머는 니다벨리르 — 난쟁이들의 해역이야. 스콜과 하티가 해와 달을 삼켰다던데…",
    ],
  },
  /* ================= 제8장 니다벨리르 ================= */
  nidavellirIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "이다벨리르… 아니, 니다벨리르 — 난쟁이들의 해역이야. 룬 광산이 유명하지.",
      "…하늘이 어두워. 해와 달의 기운이 사라졌어. 스콜과 하티 — 교만의 쌍두 늑대가 깨어난 거야!",
      "광산 곳곳에 룬 골렘이 폭주하고 있어. 마을을 구하고, 성물 '겸손의 지팡이'를 찾자!",
    ],
  },
  runePurgeDone: {
    speaker: "난쟁이 광산 조합장",
    lines: [
      "광산이 우리 것으로 돌아왔구나! 대단한 실력이네, 작은 영웅.",
      "이 지팡이를 가져가게. '겸손의 지팡이' — 교만을 꺾는 유일한 성물이지.",
      "스콜과 하티는 광산 최심부의 룬 제단에 잠들어 있네. 해와 달을 되돌려 다오!",
    ],
  },
  bossIntroSkoll: {
    speaker: "교만의 쌍두 스콜&하티",
    lines: [
      "해는 내 것이고, 달도 내 것이다!",
      "하늘을 삼킨 우리가 — 작은 인간 따위에게 굴복하겠느냐!",
      "교만은 꺾이지 않아. 부서져라!",
    ],
  },
  skollDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "쌍두가 소멸했어! …{name}, 봐! 하늘에 해와 달이 돌아왔어!",
      "저기 빛나는 것 — '하늘(교만)의 보석'이야. 이제 여섯 개!",
      "마지막 단서는 헬. …{name}, 아부디토스로서 네게 부탁할 게 있어. 무슨 일이 있어도… 나를 믿어 줘.",
    ],
  },
  /* ================= 제9장 헬 ================= */
  helIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "헬의 절벽이야. 칼립소 할머니의 여동생 — 헬이 자기 이름을 딴 해역이지.",
      "대전쟁 이후 아무도 여기 못 들어왔어. 절벽을 지키는 하운드들을 먼저 정리하자.",
      "…그리고 {name}. 여기서 네가 '진실'을 알게 될 거야. 각오하고 가자.",
    ],
  },
  houndPurgeDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "절벽이 비었어! 저기 헬의 저택… 일기장이 있어.",
      "『…칼립소의 두 손주. 쌍둥이 — 하나는 언니가, 하나는 내가 데리고 갔다. 루안… 네가 그 아이로구나…』",
      "{name}, 루안은 네… 쌍둥이 남매야. 칼립소 할머니의 다른 손주. 지금까지 우연이라고 생각했던 만남이…",
      "그리고 저기 — 대지의 결정. '희망의 방패'와 함께 절벽의 주인 그람이 기다리고 있어.",
    ],
  },
  bossIntroGram: {
    speaker: "대지의 괴물 그람",
    lines: [
      "…인어의 피. 봉인된 주인의 냄새다.",
      "나는 그람. 비탄이 만든 쌍두의 용. 헬 님을 지키는 자.",
      "…가라. 하지 않겠다면 — 갈라 놓겠다.",
    ],
  },
  gramDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "그람까지 쓰러뜨렸어! 대지(비탄)의 보석 — 일곱 개를 전부 모았어, {name}!",
      "…그리고 이제, 진실을 말할 시간이야.",
      "나는 펜던트의 정령이 아니야. 대전쟁을 일으킨 '대악마 아부디토스' — 네가 모은 보석이 모두 나를 되살릴 수단이었지!",
      "『바다의 보석 — 하라.』 …바다의 보석까지 빼앗겼어! 네가 인어로서 품고 있던 마지막 보석…",
      "{name}, 이건… 나도 몰랐어. …아니, 몰랐던 척을 했던 걸지도. 미안해!",
    ],
  },
  /* ================= 제10장 아뜰란티스 — 최종 ================= */
  abyssIntro: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "…{name}. 배가 침몰하고 있어 — 요르문간드! 바다의 수호신이야.",
      "『…펜던트를 든 자여. 나는 너희를 공격한 것이 아니다. 대악마의 기운을 쫓은 것뿐. — 삼켜 주마. 왕좌로.』",
      "요르문간드가 우리를 삼켰어… 어디로 가는 거지? …{name}, 잠깐. 저기 왕좌의 불빛…",
      "왕좌를 지키는 유령들을 정리하면 길이 열려. 마지막이야, {name}.",
    ],
  },
  wraithDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "왕좌 앞이 비었다… 이제 마지막 전투만 남았어.",
      "{name}, 손을 봐. 네가 모은 여섯 보석의 빛… 네 마음이 빛나고 있어.",
      "칼립소가 말했었지 — '마지막 성물은 마음속에 있다'고.",
      "근면의 활. 마음의 빛을 내면 발동된대. 심호흡… 진정해. 우리가 함께할게!",
    ],
  },
  bossIntroAbudditos: {
    speaker: "대악마 아부디토스",
    lines: [
      "『후후… 왔구나, 후예여. 나의 일곱 힘이 모두 돌아왔다.』",
      "『펜던트의 정령? 아부디토스? 그래, 그게 내 이름이다. 세계를 갈라놓은 대악마의 이름이지.』",
      "『성물? 웃기지 마라. 인어는 멸종했다. 발동시킬 자조차 없는 죽은 전설 — 』",
      "『…아니. 네가 있구나. 칼립소의 피를 이은 마지막 후예여 — 재미있게 구경해 주마!』",
    ],
  },
  victory: {
    speaker: "요르문간드",
    lines: [
      "『…끝났군. 대악마 아부디토스의 기운이 소멸했다.』",
      "『인어의 후예여. 일곱 성물의 빛이 하나가 되어, 마물들은 힘을 잃고 잠들 것이다.』",
      "『아홉 왕국은 다시 교류를 시작하리라. 이 바다의 이름은 — 아뜰란티스로 부르게 되리라.』",
      "『…인어의 힘을 모두 쓴 너희는 이제 인간이 될 것이다. 아쉬우냐? — 아니겠지. 새로운 모험이 시작됐으니.』",
    ],
  },
  /* ================= 구 보스 (정의 유지 — 표기만 갱신) ================= */
  bossIntroGuardian: {
    speaker: "심연의 수호자",
    lines: [
      "…보석의 빛을 든 자여. 여기서 끝장내 주지.",
      "가라앉은 아뜰란티스처럼, 너의 세계도 어둠에 잠길 것이다!",
    ],
  },
  bossIntroBehemoth: {
    speaker: "눈보라의 거수",
    lines: [
      "…이 뿌리는 이제 심연의 것이다. 얼어붙어라!",
      "아뜰란티스가 그랬던 것처럼, 너희의 숨결도 얼음 아래 가라앉힐 것이다!",
    ],
  },
  bossIntroLord: {
    speaker: "심연의 군주",
    lines: [
      "작은 보석 수집가가 여기까지 왔군…",
      "나는 가라앉은 왕국의 원한이다. 아뜰란티스와 함께, 모든 것이 심연으로 귀할 것이다!",
      "보석의 빛도, 이 세계도, 네 이름조차도 — 전부 잊히리라!",
    ],
  },
  behemothDone: {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "거수가 무너지자 얼어붙은 차원문이 녹아나고 있어!",
      "…그런데 저 마지막 문에서 느껴지는 기운은 달라. 왕좌로 가는 길이야.",
      "마지막이야, {name}. 준비됐지?",
    ],
  },
  /* ================= 여관 (v2.2 — 실내 취침 연출) ================= */
  innkeeper: {
    speaker: "여관 주인 로안",
    lines: [
      "어서 오세요, {name}. 여관 '쉼터'예요.",
      "숙박은 20G — 따뜻한 침대에서 푹 자면 HP/MP가 전부 회복돼요.",
      "잠깐 동안 몸이 개운해지는 버프 효과도 따라와요. 쉬어 갈까요?",
    ],
  },
  innkeeperNoMoney: {
    speaker: "여관 주인 로안",
    lines: [
      "앗, 골드가 부족하네요… 숙박비는 20G예요.",
      "밖에서 몬스터나 잡고 오면 금방 모이지 않을까? 죄송해요~",
    ],
  },
  innkeeperSlept: {
    speaker: "여관 주인 로안",
    lines: ["좋은 잠자리였나요? 천천히 가세요, 모험가님!"],
  },
  /* ================= 전직 (v1.8 클래스 트리) ================= */
  jobMaster: {
    speaker: "직업 교관 카이엔",
    lines: [
      "어서 오게, {name}. 나는 모험가들에게 길을 열어 주는 직업 교관 카이엔이다.",
      "이제 네 몸에 흐르는 힘이 꽤 뚜렷해졌군. 전직할 자격이 있는지 보자!",
      "전사·궁수·마법사 — 세 계열 중 하나를 택하면 2차, 3차로 더 깊이 들어갈 수 있어.",
      "계열 안에서 방향이 바뀌고 싶으면 언제든 자유 전직을 찾아오게. 골드만 있으면 된다!",
      "자, 결정하게. 네 가호를 새겨 주마!",
    ],
  },
  /* ================= 반복 토벌 의뢰 수주 (v2.3 — NPC 수주 게이트, 지시 #4) ================= */
  merchantRepeat: {
    speaker: "상인 라고스",
    lines: [
      "오, {name}! 그 근방 소문 다 들었어. 토벌 실력이 대단하다며?",
      "의뢰판에 네 눈짐을 띤 토벌 의뢰가 붙었어. 구역 스토리를 끝낸 곳이라면 언제든 반복 수주할 수 있어!",
      "의뢰를 수주하면 퀘스트창에 [반복] 토벌 의뢰가 떠. 목표를 채울 때마다 골드와 경험치를 받지.",
      "자, 오늘의 의뢰 — 수주해 가게!",
    ],
  },
  /* __FILLER_DIALOGUES__ */
};

/* ================= 구역 안내 대사 자동 생성 (구역별 탐험 분위기 대사) ================= */

const WALK_AMBIENT: Record<ChapterKey, string[]> = {
  forest: [
    "숲의 신전 폐허가 점점 가까워져. 돌기둥 사이로 보석 기운이 새어 나오고 있어.",
    "나뭇잎 사이로 심연의 기운이 배어 나와. {name}, 물약 상태 확인했지?",
    "이 늑대들… 보석 기운에 미친 것 같아. 발소리가 점점 요란해진다.",
  ],
  kingdom: [
    "쿠소디아의 함대가 늪지 너머에 정박해 있어. 왕국의 기을 본다?",
    "식인초들이 점점 왕국 성벽 쪽으로 번지고 있어. 시간이 없다, {name}!",
    "기사단이 이 근방을 순찰 중이래. 조금만 더 버티면 왕성 초대장이 올 거야.",
  ],
  alfheim: [
    "성전의 기둥이 하나씩 불이 꺼지듯 어두워지고 있어… 니드호그가 깨어나는 소리.",
    "요정들의 노래가 아까까지 들렸는데… 이제는 하수인의 낮은 울림만 남았어.",
    "여왕의 가호가 네를 지켜보고 있어. 서두르자, {name}!",
  ],
  muspelheim: [
    "지열이 발밑을 태운다. 극열의 날이 다가올수록 정령들이 포악해져.",
    "멀리 지하도시의 첨탑이 보여. 엘렌이 그 안에 갇혀 있대.",
    "용암이 올라오는 소리… 무스펠헤임의 심장이 뛰고 있어, {name}.",
  ],
  niflheim: [
    "내쉰 숨이 얼음 결정이 돼. 극한의 해역은 이름대로야.",
    "얼음 성전의 불빛이 저기 희미하게 보여. 흐레스라는 마법사가 있대.",
    "펜리르의 발자국이… 커지고 있어. 절대 정면 승부하지 마. 아직은!",
  ],
  cave: [
    "수정 광맥이 흐릿하게 빛나. 어둠 요정들이 이곳을 지키고 있어.",
    "거미줄이 점점 촘촘해져. 둥지가 가까워졌다는 증거야, {name}.",
    "여왕의 목소리가 뿌리를 타고 들려와. '아직이다…' 라고.",
  ],
  nidavellir: [
    "룬 각인이 빛나는 광산. 난쟁이 조합의 망치 소리가 들리지?",
    "폭주한 골렘이 광맥을 부숴대. 해와 달이 없으니 기계도 미쳐 돌아가.",
    "광산 최심부에 룬 제단이 있대. 스콜과 하티가 거기 잠들어 있대, {name}.",
  ],
  hel: [
    "절벽 아래 전쟁의 잔재가 늘어서 있어. 대전쟁의 흉터야.",
    "헬 하운드의 눈이 어둠 속에서 반짝여… 지지 말고 앞서 가자.",
    "저기 저택 불빛… 칼립소 할머니의 여동생이 그곳에 있다고 했지.",
  ],
  abyss: [
    "가라앉은 대륙의 폐허… 옛 아뜰란티스의 자국이 바닥마다 보여.",
    "왕좌의 불빛이 점점 커진다. 대악마의 기운이… 숨을 쉬고 있어.",
    "요르문간드의 울림이 바다를 타고 와. 마지막이야, {name}.",
  ],
};

for (const spec of CHAPTERS) {
  const lines = WALK_AMBIENT[spec.key];
  for (let i = 0; i < 3; i++) {
    DIALOGUES[`ch${spec.num}Walk${i + 1}`] = {
      speaker: "펜던트의 정령 아부디토스",
      lines: [lines[i]],
    };
  }
  DIALOGUES[`eliteWarn${spec.num}`] = {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      "…{name}, 잠깐. 이 구역의 기운이 뒤틀리고 있어.",
      `정예 ${ENEMIES[spec.main].name} — 무리의 대장이 우리를 기다리고 있어.`,
      "물약을 챙기고, 상대의 공격 패턴을 봐가며 싸우자!",
    ],
  };
  DIALOGUES[`bossApproach${spec.num}`] = {
    speaker: "펜던트의 정령 아부디토스",
    lines: [
      `제${spec.num}장의 심장부 — ${spec.title}의 왕좌가 눈앞이야.`,
      "마지막 물약 확인, 장비 점검… 그리고 {name}, 긴장 풀어. 우리가 함께야.",
      "문을 열자. 이 해역의 진짜 주인을 만나러!",
    ],
  };
}

/* ================= 전직 스토리 (v2.0 — 사용자 지시 #13) ================= */
/*  2차/3차 전직마다 직업 계열 고유 스토리 퀘스트 체인 (퀘스트 + 컷씬 대사 + 보상) */

export type JobStoryStep = {
  id: string;
  type: "hunt" | "collect" | "elite";
  title: string;
  desc: string;
  need?: number;
  /** hunt 단계 — 현재 해역의 대표 몬스터로 동적 치환 (null = 어떤 몬스터든) */
  targetLabel: string;
  dialogue: string;
  reward: number;
  expReward: number;
};

export type JobStoryDef = {
  family: FamilyKey;
  tier: 1 | 2 | 3;
  title: string;
  startDialogue: string;
  doneDialogue: string;
  reward: { gold: number; ap: number; buffKey?: BuffKey };
  steps: JobStoryStep[];
};

const JOB_SPKR: Record<FamilyKey, string> = {
  warrior: "전사 계열의 시조 '강철의 마르테'",
  ranger: "궁수 계열의 시조 '바람의 세이렌'",
  mage: "마법사 계열의 시조 '만개한 세이렌'",
  thief: "도적 계열의 시조 '그림자의 로크'",
};

/* v3.0.2 (지시 #12 — "전직 스토리 퀘스트 어디감, 1차 10분 2차 20분 3차 30분 이런식으로"):
 *  전 계열 × 전 티어(1~3차) 스토리 체인 — 단계 수가 티어마다 늘어난다 (t1 3단계/약10분, t2 4단계/약20분, t3 5단계/약30분) */
function jobStory(family: FamilyKey, tier: 1 | 2 | 3): JobStoryDef {
  const nameOf: Record<FamilyKey, string> = { warrior: "전사", ranger: "궁수", mage: "마법사", thief: "도적" };
  const stepBase = tier === 1 ? 8 : tier === 2 ? 10 : 14;
  const huntMid = tier === 1 ? 0 : tier === 2 ? 15 : 20;
  const titles: Record<FamilyKey, Record<1 | 2 | 3, string>> = {
    warrior: { 1: "강철의 싹", 2: "강철의 각오", 3: "전장의 정점" },
    ranger: { 1: "바람의 씨앗", 2: "바람의 재능", 3: "천공의 사수" },
    thief: { 1: "그림자의 태동", 2: "그림자의 맹세", 3: "검의 그림자" },
    mage: { 1: "마나의 눈뜸", 2: "마나의 문", 3: "심연의 지혜" },
  };
  const title = titles[family][tier];
  const steps: JobStoryDef["steps"] = [
    {
      id: "s1",
      type: "hunt",
      title: tier === 1 ? "[전직 스토리] 첫 수련" : tier === 2 ? "[전직 스토리] 무장 훈련" : "[전직 스토리] 정예 사냥",
      desc: `지금 머무는 해역의 몬스터 ${stepBase}마리를 처치하고 실전 감각을 되찾자.`,
      need: stepBase,
      targetLabel: "지금 해역의 몬스터",
      dialogue: `js${family}${tier}Step1`,
      reward: 120 + tier * 40,
      expReward: 200 + tier * 120,
    },
    {
      id: "s2",
      type: "collect",
      title: tier === 1 ? "[전직 스토리] 가호의 인연" : tier === 2 ? "[전직 스토리] 가호의 증표" : "[전직 스토리] 유산의 조각",
      desc: "보석의 흔적 1개를 회수해 계열의 시조에게 바치자. (해역 어디든 빛나는 흔적)",
      targetLabel: "보석의 흔적",
      dialogue: `js${family}${tier}Step2`,
      reward: 150 + tier * 50,
      expReward: 240 + tier * 140,
    },
  ];
  if (tier >= 2) {
    steps.push({
      id: "s3",
      type: "hunt",
      title: "[전직 스토리] 전장 적응",
      desc: `더 강해진 몸을 확인하자 — 몬스터 ${huntMid}마리를 처치하자.`,
      need: huntMid,
      targetLabel: "지금 해역의 몬스터",
      dialogue: `js${family}${tier}Step1`,
      reward: 200 + tier * 60,
      expReward: 320 + tier * 180,
    });
  }
  if (tier >= 3) {
    steps.push({
      id: "s4",
      type: "collect",
      title: "[전직 스토리] 심심의 유물",
      desc: "보석의 흔적 2개를 모아 시조의 가호를 완성하자.",
      targetLabel: "보석의 흔적",
      dialogue: `js${family}${tier}Step2`,
      reward: 320,
      expReward: 900,
    });
  }
  steps.push({
    id: `s${steps.length + 1}`,
    type: "elite",
    title: tier === 1 ? "[전직 스토리] 시조의 인정" : tier === 2 ? "[전직 스토리] 시조의 시험" : "[전직 스토리] 심연의 정예",
    desc: "전직관에서 시조가 소환한 시험 상대를 쓰러뜨리자. (카이엔에게 말 걸기)",
    targetLabel: "시험 상대",
    dialogue: `js${family}${tier}Step3`,
    reward: tier === 1 ? 260 : tier === 2 ? 250 : 800,
    expReward: tier === 1 ? 380 : tier === 2 ? 400 : 1400,
  });
  return {
    family,
    tier,
    title: `${nameOf[family]} 계열 ${tier}차 전직 스토리 — ${title} (약 ${tier * 10}분)`,
    startDialogue: `js${family}${tier}Start`,
    doneDialogue: `js${family}${tier}Done`,
    reward: {
      gold: tier === 1 ? 260 : tier === 2 ? 400 : 1200,
      ap: tier === 1 ? 3 : tier === 2 ? 5 : 10,
      buffKey: tier === 3 ? "buff_exp" : "buff_atk",
    },
    steps,
  };
}

export const JOBSTORY: Record<FamilyKey, Record<1 | 2 | 3, JobStoryDef>> = {
  warrior: { 1: jobStory("warrior", 1), 2: jobStory("warrior", 2), 3: jobStory("warrior", 3) },
  ranger: { 1: jobStory("ranger", 1), 2: jobStory("ranger", 2), 3: jobStory("ranger", 3) },
  mage: { 1: jobStory("mage", 1), 2: jobStory("mage", 2), 3: jobStory("mage", 3) },
  thief: { 1: jobStory("thief", 1), 2: jobStory("thief", 2), 3: jobStory("thief", 3) },
};

/* 전직 스토리 대사 (계열 × 차수 × 단계) */
const T1_LINES: Record<FamilyKey, { start: string[]; s1: string[]; s2: string[]; s3: string[]; done: string[] }> = {
  warrior: {
    start: ["『…어느 쪽이든 검을 든 팔이군. 나는 강철의 마르테 — 최초의 전사다.』", "『전사의 길은 힘이 아니라 '버티는 법'부터다. 몸으로 배워라!』"],
    s1: ["『호오, 검이 몸에 붙기 시작했군.』", "『계속해라. 몸은 거짓말을 하지 않는다.』"],
    s2: ["『그 흔적의 무게가 느껴지는가. 그것이 가호의 씨앗이다.』"],
    s3: ["『인정한다. 이제 마지막 — 내가 부린 시험 상대를 상대해라!』"],
    done: ["『오늘부로 너는 전사다. 강철의 싹이 되어 자라라!』"],
  },
  ranger: {
    start: ["『…바람의 인연이 느껴지는 손이다. 나는 바람의 세이렌 — 최초의 궁수다.』", "『활은 멀리를 보는 자의 무기. 먼저 '눈'부터 트게 해주마!』"],
    s1: ["『호오, 시야가 조금씩 열리는군.』", "『바람을 믿고 화살을 맡겨 봐라.』"],
    s2: ["『그 빛나는 흔적 — 바람이 너를 알아보는 증표다.』"],
    s3: ["『인정한다. 마지막으로 시험 상대를 겨눠라!』"],
    done: ["『오늘부로 너는 궁수다. 바람의 씨앗이 되어 날아오르라!』"],
  },
  mage: {
    start: ["『…마나가 손끝에 머무는구나. 나는 만개한 세이렌 — 최초의 마법사다.』", "『마법은 지혜가 곧 힘. 먼저 마나와 '대화'하는 법을 가르쳐주마!』"],
    s1: ["『마나가 네 말을 듣기 시작했군.』", "『집중이 흐트러지면 마나는 도망친다. 계속해라.』"],
    s2: ["『마나가 형태를 얻었다 — 그것이 너의 첫 주문이다.』"],
    s3: ["『인정한다. 마지막으로 시험 상대에게 주문을 쏘아라!』"],
    done: ["『오늘부로 너는 마법사다. 마나의 눈이 떴으니, 세계가 보일 것이다.』"],
  },
  thief: {
    start: ["『…발소리가 없는 녀석이군. 나는 그림자의 로크 — 최초의 도적이다.』", "『도적의 첫 재능은 '보이지 않는 법'이다. 몸으로 배워라!』"],
    s1: ["『호오, 그림자에 몸을 맡기기 시작했군.』", "『좋아. 칼날은 조용해야 한다.』"],
    s2: ["『그 흔적 — 어둠이 너를 알아보는 증표다.』"],
    s3: ["『인정한다. 마지막으로 시험 상대를 뒤에서 놀려라!』"],
    done: ["『오늘부로 너는 도적이다. 그림자의 태동을 잊지 마라.』"],
  },
};

const JS_LINES: Record<FamilyKey, Record<1 | 2 | 3, { start: string[]; s1: string[]; s2: string[]; s3: string[]; done: string[] }>> = {
  warrior: {
    1: T1_LINES.warrior,
    2: {
      start: ["『…왔는가, 후예여. 나는 강철의 마르테 — 최초의 전사다.』", "『전사의 힘은 검이 아니라 '버틸 결심'에서 나온다. 몸으로 보여라!』"],
      s1: ["『좋다. 검이 몸에 붙기 시작했군.』", "『하지만 힘만으로는 전장을 못 넘는다. 다음을 보여라.』"],
      s2: ["『…그 빛, 옛 전우들의 가호와 같다.』", "『인정한다. 이제 마지막 시험 — 내 앞에서 쓰러져라!』"],
      s3: ["『…통과다. 그 상처, 숨김없이 받아냈군.』", "『오늘부로 너는 진정한 전사다. 강철의 각오를 이어받아라!』"],
      done: ["『앞으로 맞서는 적이 강할수록 — 너의 검은 더 무거워질 것이다.』", "『기대하마, 전사여.』"],
    },
    3: {
      start: ["『시간이 흘렀군, 전사여. 3차 계승의 시간이다.』", "『이번 시험은 전장 그 자체. 죽음의 냄새를 견뎌라!』"],
      s1: ["『전장의 냄새를 익혔군. 하지만 아직 부족하다.』", "『전사의 검은 무게를 견디는 자의 것이다!』"],
      s2: ["『그 조각… 전설의 전사들의 유산이다.』", "『그 무게를 감당할 자만이 정점에 선다!』"],
      s3: ["『…심연의 정예를 베어냈군.』", "『인정한다. 지금이야말로 — 전장의 정점에 서라!』"],
      done: ["『너의 이름은 이제 전설의 한 페이지가 될 것이다.』", "『서라, 워로드(팔라딘). 바다가 너를 기억한다!』"],
    },
  },
  ranger: {
    1: T1_LINES.ranger,
    2: {
      start: ["『…바람을 타고 왔구나. 나는 바람의 세이렌 — 최초의 궁수다.』", "『활은 멀리를 보는 자의 무기다. 네 '눈'을 보여라!』"],
      s1: ["『호오, 바람의 흐름을 읽기 시작했군.』", "『하지만 시야가 좁다. 더 넓은 세계를 봐라!』"],
      s2: ["『…그 빛을 겨눌 수 있었나. 눈이 트였군.』", "『인정한다. 마지막으로 — 나에게 화살을 쏘아라!』"],
      s3: ["『…단 한 발로 나를 흘렬케 했군.』", "『오늘부로 너는 진정한 궁수다. 바람의 재능을 이어받아라!』"],
      done: ["『바람이 네 편이 될 것이다. 어디에 있든.』", "『즐겁게 쏘아라, 궁수여!』"],
    },
    3: {
      start: ["『천공의 자리가 비어 있었다. 이제 네가 오를 때다.』", "『최후의 시험 — 심연을 겨누어라!』"],
      s1: ["『심연의 움직임을 한 발로 읽다니.』", "『하지만 천공은 그 정도가 아니다! 더 쏴라!』"],
      s2: ["『…유산의 조각을 화살처럼 다루다니.』", "『그 눈이라면 — 하늘 위까지 닿는다!』"],
      s3: ["『심연의 정예를 격추했군. 완벽하다.』", "『오르라! 천공의 사수가 되어라!』"],
      done: ["『이제 네 화살은 지평선 너머의 어둠도 꿰뚫는다.』", "『날아라, 이글아이(템페스트)!』"],
    },
  },
  mage: {
    1: T1_LINES.mage,
    2: {
      start: ["『…마나가 네게 궁금해하고 있구나. 나는 만개한 세이렌 — 최초의 마법사다.』", "『마법은 지식이 아니라 '질문'이다. 물어봐라, 세계에!』"],
      s1: ["『오, 마나와 호흡이 맞기 시작했군.』", "『하지만 아직 얕다. 더 깊이 물어봐라!』"],
      s2: ["『…보석의 문답을 읽었군.』", "『인정한다. 마지막 시험 — 나의 마법을 받아라!』"],
      s3: ["『…정면에서 받아냈군. 훌륭하다.』", "『오늘부로 너는 진정한 마법사다. 마나의 문을 열어라!』"],
      done: ["『세계의 모든 마나가 네 질문에 답할 것이다.』", "『쓰고 싶은 만큼 써라, 마법사여!』"],
    },
    3: {
      start: ["『심연의 지혜… 마지막 문이 열리는군.』", "『이번 시험은 '심연 그 자체'. 견뎌라!』"],
      s1: ["『심연의 파동을 마나로 짜냈군.』", "『하지만 심연은 무한하다. 더 들어가라!』"],
      s2: ["『…유산의 문장을 해독했다니.』", "『그 지혜라면 — 심연의 왕좌도 뒤집을 수 있다!』"],
      s3: ["『심연의 정예를 지식으로 제압했군.』", "『완성이다. 심연의 지혜를 받아라!』"],
      done: ["『이제 너의 마법은 세계의 법칙을 다시 쓸 것이다.』", "『일어나라, 아크메이지(세이지)!』"],
    },
  },
  /* v2.9 — 도적 계열 전직 스토리 (시조 '그림자의 로크') */
  thief: {
    1: T1_LINES.thief,
    2: {
      start: ["『…소리도 없이 왔군. 나는 그림자의 로크 — 최초의 도적이다.』", "『도적의 힘은 칼날이 아니라 '보이지 않음'에서 나온다. 증명해라!』"],
      s1: ["『발소리가 사라졌군. 이제 칼이 남았다.』", "『그림자는 다치지 않는 법. 다음을 보여라.』"],
      s2: ["『…그 빛, 훔친 보석의 빛과 같군.』", "『인정한다. 마지막 시험 — 나에게서 훔쳐라!』"],
      s3: ["『…내 품의 금화를 건드리지 않고 베었군.』", "『오늘부로 너는 진정한 도적이다. 그림자의 맹세를 이어받아라!』"],
      done: ["『어둠이 짙을수록 — 너의 단검은 더 날카로워질 것이다.』", "『기대하마, 도적여.』"],
    },
    3: {
      start: ["『시간이 흘렀군, 도적여. 검의 그림자가 너를 부른다.』", "『이번 시험은 '빛 그 자체'. 가장 밝은 곳에서 숨어라!』"],
      s1: ["『빛 속의 그림자를 익혔군. 하지만 아직 부족하다.』", "『도적의 칼날은 눈에 보이지 않아야 한다!』"],
      s2: ["『…전설 도적들의 유물을 훔쳐왔군.』", "『그 가치를 감당할 자만이 그림자의 정점에 선다!』"],
      s3: ["『…심연의 정예도 네 앞에서는 시야에서 사라졌군.』", "『완성이다. 검의 그림자를 받아라!』"],
      done: ["『이제 너의 이름은 어둠의 전설이 될 것이다.』", "『서라, 어세신(스와시버클러). 바다가 너를 기억한다!』"],
    },
  },
};

for (const fam of ["warrior", "ranger", "mage", "thief"] as FamilyKey[]) {
  for (const tier of [2, 3] as const) {
    const L = JS_LINES[fam][tier];
    const base = `js${fam}${tier}`;
    DIALOGUES[`${base}Start`] = { speaker: JOB_SPKR[fam], lines: L.start };
    DIALOGUES[`${base}Step1`] = { speaker: JOB_SPKR[fam], lines: L.s1 };
    DIALOGUES[`${base}Step2`] = { speaker: JOB_SPKR[fam], lines: L.s2 };
    DIALOGUES[`${base}Step3`] = { speaker: JOB_SPKR[fam], lines: L.s3 };
    DIALOGUES[`${base}Done`] = { speaker: JOB_SPKR[fam], lines: L.done };
  }
}

/* ================= 스탯 자동 배분 (v2.0 — 사용자 지시 #18, 메이플 4:1 감각) ================= */

export const AUTO_ALLOC: Record<FamilyKey, { str: number; dex: number; int: number; luk: number }> = {
  warrior: { str: 4, dex: 1, int: 0, luk: 0 }, // 힘 4 : 민첩 1
  ranger: { str: 1, dex: 4, int: 0, luk: 0 }, // 민첩 4 : 힘 1
  mage: { str: 0, dex: 0, int: 4, luk: 1 }, // 지력 4 : 행운 1
  thief: { str: 2, dex: 2, int: 0, luk: 1 }, // 힘 2 : 민첩 2 : 행운 1 (치명타 특화)
};

/** AP를 계열 배분 비율로 나눠 담는다 (남는 AP는 주스탯에 몰아줌) */
export function autoAllocPlan(family: FamilyKey, ap: number): { str: number; dex: number; int: number; luk: number } {
  const r = AUTO_ALLOC[family];
  const total = r.str + r.dex + r.int + r.luk;
  const out = { str: 0, dex: 0, int: 0, luk: 0 };
  if (total === 0 || ap <= 0) return out;
  const keys: (keyof typeof out)[] = ["str", "dex", "int", "luk"];
  let left = ap;
  // 라운드 로빈 배분 — 4:1 비율 유지
  let round = 0;
  while (left > 0) {
    for (const k of keys) {
      if (left <= 0) break;
      if (r[k] > 0 && round < r[k]) {
        out[k]++;
        left--;
      }
    }
    if (keys.every((k) => r[k] === 0 || round >= r[k])) {
      // 비율 1사이클 완료 → 주스탯 몰아주기
      const main = keys.reduce((a, b) => (r[a] >= r[b] ? a : b));
      out[main] += left;
      left = 0;
    }
    round++;
  }
  return out;
}

/* ================= v3.0 (사용자 지시 #4) — 챕터 분위기별 마을 주민 =================
 *  v2.9에서 모든 챕터 마을이 같은 주민·같은 대사를 재사용했다.
 *  챕터마다 이름·성격·대사가 바뀌는 주민 2인 + 건물 틴트로 마을 분위기를 분리한다. */

export type VillageNpcSpec = {
  /** 건물 3채 공통 틴트 (챕터 분위기색) */
  houseTint: number;
  /** 마을 간판 색 */
  signColor: string;
  /** 주민 2인 — 이름 + 대사키 */
  npcA: { name: string; tex: string; dlg: string };
  npcB: { name: string; tex: string; dlg: string };
};

export const CHAPTER_VILLAGE_NPC: Record<string, VillageNpcSpec> = {
  forest: {
    houseTint: 0xbfe4a8,
    signColor: "#b8f0a0",
    npcA: { name: "허브 채집가 베르", tex: "npc_villager1", dlg: "vlgForestA" },
    npcB: { name: "신전 관리인 노아", tex: "npc_villager2", dlg: "vlgForestB" },
  },
  kingdom: {
    houseTint: 0xe8d0a0,
    signColor: "#ffe9b0",
    npcA: { name: "선원 롤프", tex: "npc_villager1", dlg: "vlgKingdomA" },
    npcB: { name: "늪지 어부 팰", tex: "npc_villager2", dlg: "vlgKingdomB" },
  },
  alfheim: {
    houseTint: 0xc2aef8,
    signColor: "#d8c8ff",
    npcA: { name: "요정 사절 리안", tex: "npc_villager1", dlg: "vlgAlfheimA" },
    npcB: { name: "성전 견습 기사", tex: "npc_villager2", dlg: "vlgAlfheimB" },
  },
  muspelheim: {
    houseTint: 0xffa878,
    signColor: "#ffb080",
    npcA: { name: "대장장이 브라키", tex: "npc_villager1", dlg: "vlgMuspelA" },
    npcB: { name: "용암 광부 코일", tex: "npc_villager2", dlg: "vlgMuspelB" },
  },
  niflheim: {
    houseTint: 0x9cccff,
    signColor: "#a8e0ff",
    npcA: { name: "얼음 낚시꾼 시그룬", tex: "npc_villager1", dlg: "vlgNiflA" },
    npcB: { name: "눈보라 정찰병", tex: "npc_villager2", dlg: "vlgNiflB" },
  },
  cave: {
    houseTint: 0xb09ccc,
    signColor: "#c9a0ff",
    npcA: { name: "수정 채굴자 그밀", tex: "npc_villager1", dlg: "vlgCaveA" },
    npcB: { name: "어둠 요정 피난민", tex: "npc_villager2", dlg: "vlgCaveB" },
  },
  nidavellir: {
    houseTint: 0xe8c474,
    signColor: "#ffd76a",
    npcA: { name: "룬 대장장이 두린", tex: "npc_villager1", dlg: "vlgNidavA" },
    npcB: { name: "광산 감독관", tex: "npc_villager2", dlg: "vlgNidavB" },
  },
  hel: {
    houseTint: 0xc89ae8,
    signColor: "#d0a8ff",
    npcA: { name: "전쟁 유령 아르벨", tex: "npc_villager1", dlg: "vlgHelA" },
    npcB: { name: "저택 집사 무르", tex: "npc_villager2", dlg: "vlgHelB" },
  },
  abyss: {
    houseTint: 0x9a8ade,
    signColor: "#b09aff",
    npcA: { name: "폐허 학자 테일", tex: "npc_villager1", dlg: "vlgAbyssA" },
    npcB: { name: "마지막 항해사", tex: "npc_villager2", dlg: "vlgAbyssB" },
  },
};

/* 챕터 마을 주민 대사 일괄 등록 — 각 챕터 분위기에 맞는 3줄 멘트 */
{
  const VLG: Record<string, { a: { sp: string; lines: string[] }; b: { sp: string; lines: string[] } }> = {
    forest: {
      a: { sp: "허브 채집가 베르", lines: [
        "숲이 요즘 좀 이상해, {name}. 늑대들 눈빛이 달라졌어.",
        "신전 깊은 곳에서 빛이 난다고 하던데… 네 펜던트도 반응하는 것 같아.",
        "허브 물약이 필요하면 언제든 와. 사냥꾼들한테는 서비스야!",
      ] },
      b: { sp: "신전 관리인 노아", lines: [
        "오래된 신전을 지키는 노아라고 해. 얼굴에 흙 묻은 채 미안하네.",
        "신전 안 벽화에 '일곱 보석'이 새겨져 있어… 네가 찾는 것도 거기 있을까?",
        "조심하고 가, {name}. 숲은 밤이 되면 완전히 다른 얼굴이 되거든.",
      ] },
    },
    kingdom: {
      a: { sp: "선원 롤프", lines: [
        "배 밑바닥에 이상한 종양이 붙었다고, {name}. 심연에서 뭔가 자라나는 것 같아.",
        "쿠소디아의 선박들은 모두 심연을 건너야 해. 바다가 불안하단 말이지.",
        "네가 보석을 모은다니? 선원들의 미신으론 그게 유일한 희망이야.",
      ] },
      b: { sp: "늪지 어부 팰", lines: [
        "늪 물고기들이 죄다 식인초를 물어왔어. 소화기관이 뒤집히는 줄 알았지.",
        "움직이는 초들… 원래 저러는 게 아니야. 뭔가가 저들을 깨운 것 같아.",
        "우물 물은 여전히 깨끗해. 마음 놓고 마셔, {name}.",
      ] },
    },
    alfheim: {
      a: { sp: "요정 사절 리안", lines: [
        "요정왕의 명으로 이 마을을 돕고 있어, {name}. 네 펜던트에서 고대의 냄새가 나네.",
        "알프헤임의 빛이 흐려지고 있어. 심연 유령들이 성전을 침식하고 있어.",
        "요정들은 네 펜던트를 오래전부터 알고 있었대. '인어의 상징'이라고.",
      ] },
      b: { sp: "성전 견습 기사", lines: [
        "성전 기사단 견습입니다! 아직 검이 무겁지만, 훈련은 매일 빠지지 않아요.",
        "심연 유령은 물리 공격이 잘 안 먹힌다고 하니, 마법 계열이라면 큰 도움이 될 거예요.",
        "{name} 님도 언젠가 제 실력을 시험해 주세요. 약속이에요!",
      ] },
    },
    muspelheim: {
      a: { sp: "대장장이 브라키", lines: [
        "화염 정령이 날로 거세진다, {name}. 용광로가 흔들리고 있어.",
        "이 지옥 같은 열기에서도 우물은 차갑지. 세계수의 은혜라고나 할까.",
        "좋은 무기가 필요하면 상점을 가라. 내가 갈아놓은 물건들이다!",
      ] },
      b: { sp: "용암 광부 코일", lines: [
        "광맥이 녹아내려… 일이 불가능해졌다고, {name}.",
        "불꽃 늑대 무리가 광부들만 노려. 뭔가에게 부려진 것 같은데.",
        "아이스크림… 그게 뭐냐? 여기선 얼음을 꿈꾸는 게 취미야.",
      ] },
    },
    niflheim: {
      a: { sp: "얼음 낚시꾼 시그룬", lines: [
        "호수가 또 얼었어, {name}. 서리 늑대들이 얼음 위로 다니거든.",
        "얼음 아래에서 무언가 빛나는 걸 봤어… 네가 찾는 보석일까?",
        "여관에서 온기를 판다. 북극성 아래서 자면 감기 걸린다!",
      ] },
      b: { sp: "눈보라 정찰병", lines: [
        "정찰 보고 — 얼음 골렘이 남쪽 언덕에서 내려오고 있습니다, {name}.",
        "니플헤임의 밤은 영원해. 하지만 사람들은 불을 지키며 살아가죠.",
        "네 펜던트… 흥미롭군요. 눈보라 속에서도 빛을 잃지 않아.",
      ] },
    },
    cave: {
      a: { sp: "수정 채굴자 그밀", lines: [
        "수정 광맥이 울고 있어, {name}. 동굴 거미 떼가 채굴장을 삼켰다니까.",
        "가장 깊은 갱도엔 어둠 요정들의 제단이 있대. 가까이 가지 마.",
        "수정은 빛을 기억해. 네 펜던트처럼 말이야.",
      ] },
      b: { sp: "어둠 요정 피난민", lines: [
        "저는 저들을 따르지 않았어요, {name}. 마을에 와주셔서 감사해요.",
        "여왕의 속삭임이 갱도를 타고 퍼져요… 귀를 막고 다니세요.",
        "언젠가 이 동굴에도 빛이 돌아올까요? …네가 그 빛이 될 수 있을까?",
      ] },
    },
    nidavellir: {
      a: { sp: "룬 대장장이 두린", lines: [
        "룬 각인이 폭주했다, {name}. 골렘들이 망치 대신 광산을 부수고 다녀.",
        "스콜과 하티가 최심부에 잠들었다던데… 전설인 줄만 알았지.",
        "좋은 장비를 공짜로 줄 순 없지만, 테스트용 아드레날린은 무한하다!",
      ] },
      b: { sp: "광산 감독관", lines: [
        "광산 인부 결근률 40%… 이러다 조합이 망한다, {name}.",
        "룬 골렘은 머리의 룬 돌이 심장이야. 그걸 깨면 멈춘다!",
        "네 펜던트에서 열기가 느껴지네. 다행히 이 광산엔 그게 필요해.",
      ] },
    },
    hel: {
      a: { sp: "전쟁 유령 아르벨", lines: [
        "나는 이 절벽에서 목숨을 잃은 병사다… 하지만 두렵지 않다, {name}.",
        "헬 하운드들은 대전쟁의 잔재야. 그들도 잊혀지길 원하지 않을 뿐이지.",
        "저택의 불빛? 칼립소 할머니의 여동생이 살던 곳이다… 예전에는.",
      ] },
      b: { sp: "저택 집사 무르", lines: [
        "어서 오세요, {name}. 죽음의 땅에서도 다과 시간은 유효합니다.",
        "이 저택의 주인은 오래전 사라졌지요. 저는 약속을 지키며 기다릴 뿐입니다.",
        "여관에서 잠이나 자고 가세요. 꿈에 유령이 나온다면… 그건 서비스입니다.",
      ] },
    },
    abyss: {
      a: { sp: "폐허 학자 테일", lines: [
        "가라앉은 대륙 — 아뜰란티스의 수도였지, {name}. 네 고향이기도 하고.",
        "왕좌의 불빛이 커지고 있어. 대악마 아부디토스… 펜던트의 정령과 같은 이름이라니.",
        "기록에 따르면 '펜던트의 정령'은 둘이 될 수 없대. 그럼 저건 뭘까?",
      ] },
      b: { sp: "마지막 항해사", lines: [
        "요르문간드가 바다를 감고 있어, {name}. 저 바다 위를 지날 수 있는 배는 없어.",
        "모든 항로가 끝났다. 남은 건 네 발뿐이야.",
        "마지막 보석을 박아 넣을 자리… 왕좌의 가장 깊은 곳에 있을 거야.",
      ] },
    },
  };
  for (const [key, v] of Object.entries(VLG)) {
      DIALOGUES[`vlg${key.charAt(0).toUpperCase()}${key.slice(1)}A`] = { speaker: v.a.sp, lines: v.a.lines };
      DIALOGUES[`vlg${key.charAt(0).toUpperCase()}${key.slice(1)}B`] = { speaker: v.b.sp, lines: v.b.lines };
    }
  }
