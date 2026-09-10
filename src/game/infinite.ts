/* =====================================================================
 * v1.0.8 "무한 콘텐츠 패치" — 10종 신규 무한 콘텐츠 (유저 지시 "무한 컨텐츠 10가지 이상")
 *  ① 심연의 탑 — 무한 층수 탑등반 (층마다 강해지는 적 · 5층마다 보스 · 층 보상)
 *  ② 심층 균열 — 균열 던전 무한 티어 (티어마다 적/보상 무한 스케일 + 티어 기록)
 *  ③ 일일 시련 — 매일 바뀌는 수정자 던전 (7종 수정자 로테이션)
 *  ④ 환생 — Lv 달성 시 무한 성장 루프 (영구 스탯 % + 환생 코인)
 *  ⑤ 연금 제작대 — 재료 수집 → 아이템 제작 (무한 파밍 싱크)
 *  ⑥ 펫 육성 — 펫 경험치/레벨/진화 (소환 중 사냥이 펫을 키운다)
 *  ⑦ 황금 몬스터 러시 — 필드 랜덤 이벤트 (황금 변이 몬스터 대량 보상)
 *  ⑧ 심연 상점 — 심연 코인 무한 상점 (영구 부여아 등)
 *  ⑨ 주간 보스 레이드 — 요일 로테이션 보스 보너스 (드롭 2배)
 *  ⑩ 탑 랭킹 — 서버 랭킹 타워 모드 (net.ts RankMode 확장)
 *
 *  이 파일은 순수 데이터 + 계산 헬퍼만 담당 (Phaser/React 의존 없음).
 *  상태는 SaveData.inf + WorldScene, UI는 Panels.tsx ContentPanel이 담당한다.
 * ===================================================================== */

import type { EnemyKey } from "./data";

/* ================= 저장 스냅샷 (SaveData.inf + RpgState.inf) ================= */

export type InfSave = {
  /** ① 탑 — 최고 도달 층 */
  towerBest: number;
  /** ② 심층 균열 — 해금된 최고 티어 (0=기본, 클리어 시 +1) */
  closetTier: number;
  /** ③ 일일 시련 — 마지막 클리어 날짜 (YYYY-MM-DD) */
  trialDone: string;
  /** ④ 환생 — 누적 횟수 (영구 스탯 %) */
  rebirths: number;
  /** ⑤ 제작 재료 보유 (ItemKey → 개수) */
  mats: Record<string, number>;
  /** ⑥ 펫 육성 — 레벨/경험치 (누적) */
  petLv: number;
  petExp: number;
  /** ⑧ 심연 코인 (탑/시련/황금몬스터 획득) */
  abyss: number;
  /** ⑧ 부여아 구매 누적 (orb_atk 등 → 개수) */
  orbs: Record<string, number>;
  /** 환생의 정수 구매 누적 (요구 레벨 −5/개) */
  rebirthEss: number;
};

export const INF_DEFAULT: InfSave = {
  towerBest: 0,
  closetTier: 0,
  trialDone: "",
  rebirths: 0,
  mats: {},
  petLv: 1,
  petExp: 0,
  abyss: 0,
  orbs: {},
  rebirthEss: 0,
};

/** 안전 병합 — 구 세이브/부분 객체 → 완전한 InfSave */
export function infMerge(p?: Partial<InfSave> | null): InfSave {
  return { ...INF_DEFAULT, ...(p ?? {}), mats: { ...(p?.mats ?? {}) }, orbs: { ...(p?.orbs ?? {}) } };
}

/* ================= ① 심연의 탑 (무한 층수) ================= */

export const TOWER = {
  /** 층 스케일: 적 HP/ATK ×(1 + 0.17×(층-1)) — 무한 증가 */
  hpPerFloor: 0.17,
  atkPerFloor: 0.12,
  goldBase: 55,
  goldPerFloor: 0.24,
  expBase: 26,
  expPerFloor: 0.22,
  /** 보스층 간격 */
  bossEvery: 5,
  /** 층 클리어 심연 코인 (보스층 5배) */
  abyssFloor: 1,
} as const;

export function towerFloorScale(floor: number): number {
  return 1 + Math.max(0, floor - 1) * TOWER.hpPerFloor;
}
export function isTowerBossFloor(floor: number): boolean {
  return floor % TOWER.bossEvery === 0;
}
/** 층 클리어 보상 — 층수에 무한 스케일 */
export function towerFloorReward(floor: number, lv: number): { gold: number; exp: number; abyss: number } {
  const boss = isTowerBossFloor(floor);
  const gold = Math.round((TOWER.goldBase + lv * 5) * (1 + (floor - 1) * TOWER.goldPerFloor) * (boss ? 3 : 1));
  const exp = Math.round((TOWER.expBase + lv * 2) * (1 + (floor - 1) * TOWER.expPerFloor) * (boss ? 3 : 1));
  return { gold, exp, abyss: TOWER.abyssFloor * (boss ? 5 : 1) };
}
/** 층별 등장 몬스터 풀 — 층수가 오를수록 강한 종 추가 (무한 반복 재활용) */
const TOWER_TIERS: EnemyKey[][] = [
  ["wolf", "x2_frog", "x2_rat"],
  ["spider", "x3_goblin", "x2_bat"],
  ["swampbeast", "golem", "x3_swampy"],
  ["minion", "wraith", "x3_imp"],
  ["frostwolf", "icegolem", "x3_icezombie"],
  ["emberwolf", "firespirit", "x3_wogol"],
  ["runegolem", "helhound", "x3_orcwarrior"],
  ["x3_ogre", "x3_chort", "x3_bigzombie"],
];
export function towerPool(floor: number): EnemyKey[] {
  const idx = Math.max(0, Math.min(TOWER_TIERS.length - 1, Math.floor((floor - 1) / 8)));
  return TOWER_TIERS[idx] ?? TOWER_TIERS[0];
}

/* ================= ② 심층 균열 (무한 티어) ================= */

export type ClosetTierScale = { hpMul: number; atkMul: number; goldMul: number };
/** 티어 t (0=기본 균열) — 적/보상 무한 스케일 */
export function closetTierScale(t: number): ClosetTierScale {
  return { hpMul: 1 + t * 0.5, atkMul: 1 + t * 0.38, goldMul: 1 + t * 0.65 };
}
/** 티어 클리어 보상 심연 코인 (기본 티어 0은 미지급) */
export function closetTierAbyss(t: number): number {
  return t <= 0 ? 0 : 3 + t * 2;
}

/* ================= ③ 일일 시련 (수정자 던전) ================= */

export type TrialMod = {
  id: string;
  name: string;
  desc: string;
  color: string;
  /** 적 배율 */
  hpMul?: number;
  atkMul?: number;
  spawnMul?: number;
  /** 플레이어 배율/효과 */
  expMul?: number;
  goldMul?: number;
  abyssMul?: number;
  defZero?: boolean;
  healMul?: number;
};
export const TRIAL_MODS: TrialMod[] = [
  { id: "frenzy", name: "광폭화의 균열", desc: "적 공격 +60% · 획득 경험치 ×2", color: "#ff7a6a", atkMul: 1.6, expMul: 2 },
  { id: "glass", name: "유리 대검의 균열", desc: "내 공격 ×2.2 · 방어력 0", color: "#7de8ff", defZero: true },
  { id: "swarm", name: "군집의 균열", desc: "적 2배 스폰 · 적 HP 40%", color: "#8fe84a", hpMul: 0.4, spawnMul: 2 },
  { id: "gilded", name: "황금의 균열", desc: "골드 ×3 · 적 HP +80%", color: "#ffd76a", hpMul: 1.8, goldMul: 3 },
  { id: "titan", name: "거인의 균열", desc: "적 HP ×3 · 처치 시 심연 코인 ×3", color: "#c08aff", hpMul: 3, abyssMul: 3 },
  { id: "vampire", name: "흡혈의 균열", desc: "회복 효과 50% 감소 · 적 HP +40%", color: "#ff8a9c", hpMul: 1.4, healMul: 0.5 },
  { id: "rush", name: "질풍의 균열", desc: "이속 +30% · 적 HP +50%", color: "#a8ecff", hpMul: 1.5 },
];
/** 오늘의 시련 — 날짜 시드로 결정 (전 유저 동일) */
export function todayTrial(d = new Date()): TrialMod {
  const seed = d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate();
  return TRIAL_MODS[seed % TRIAL_MODS.length];
}
/** 시련 클리어 보상 (1일 1회) */
export function trialReward(lv: number, mod: TrialMod): { gold: number; abyss: number } {
  return {
    gold: Math.round((300 + lv * 40) * (mod.goldMul ?? 1)),
    abyss: Math.round(10 * (mod.abyssMul ?? 1)),
  };
}

/* ================= ④ 환생 (무한 성장 루프) ================= */

export const REBIRTH_BASE_LV = 60;
/** 환생 요구 레벨 — 환생의 정수 1개당 −5 */
export function rebirthReqLv(rebirthEss: number): number {
  return Math.max(20, REBIRTH_BASE_LV - rebirthEss * 5);
}
/** 환생 스택당 영구 보너스 — 공 +8% · HP +60 · 골드 +2% (무한 누적) */
export function rebirthBonus(rebirths: number): { atkPct: number; hp: number; goldPct: number } {
  return { atkPct: rebirths * 8, hp: rebirths * 60, goldPct: rebirths * 2 };
}
/** 환생 1회 보상 — 심연 코인 50 + 스택 1 */
export const REBIRTH_ABYSS = 50;

/* ================= ⑤ 연금 제작대 ================= */

/** 재료 드롭 확률 (필드/던전 적 처치) — 타워/균열에서 1.6배 */
export const MAT_CHANCES: { key: string; name: string; chance: number }[] = [
  { key: "mat_mana", name: "마나 결정", chance: 0.055 },
  { key: "mat_heart", name: "몬스터 심장", chance: 0.042 },
  { key: "mat_mithril", name: "미스릴 가루", chance: 0.03 },
];
export type CraftRecipe = {
  id: string;
  name: string;
  desc: string;
  mats: Record<string, number>;
  out: { item: string; n: number };
};
export const CRAFT_RECIPES: CraftRecipe[] = [
  { id: "cr_hp2", name: "상급 HP 물약", desc: "마나 결정 4개 → 상급 HP 물약 ×1", mats: { mat_mana: 4 }, out: { item: "potion_hp2", n: 1 } },
  { id: "cr_mp2", name: "상급 MP 물약", desc: "마나 결정 3개 → 상급 MP 물약 ×1", mats: { mat_mana: 3 }, out: { item: "potion_mp2", n: 1 } },
  { id: "cr_book", name: "경험치 책", desc: "심장 4 + 마나 3 → 경험치 책 ×2", mats: { mat_heart: 4, mat_mana: 3 }, out: { item: "exp_book", n: 2 } },
  { id: "cr_scroll", name: "강화 주문서", desc: "미스릴 6 + 마나 2 → 강화 주문서 ×1", mats: { mat_mithril: 6, mat_mana: 2 }, out: { item: "scroll_star", n: 1 } },
  { id: "cr_chest", name: "은 상자", desc: "심장 8개 → 은 상자 ×1", mats: { mat_heart: 8 }, out: { item: "chest_silver", n: 1 } },
  { id: "cr_elixir", name: "엘릭서", desc: "미스릴 4 + 심장 6 + 마나 6 → 엘릭서 ×1", mats: { mat_mithril: 4, mat_heart: 6, mat_mana: 6 }, out: { item: "potion_elixir", n: 1 } },
  { id: "cr_abyss", name: "심연의 화석", desc: "미스릴 10개 → 심연 코인 +15 (무한 싱크)", mats: { mat_mithril: 10 }, out: { item: "__abyss15", n: 1 } },
];
export function canCraft(recipe: CraftRecipe, mats: Record<string, number>): boolean {
  return Object.entries(recipe.mats).every(([k, n]) => (mats[k] ?? 0) >= n);
}

/* ================= ⑥ 펫 육성 ================= */

export const PET = {
  /** 레벨업 필요 경험치 — 100 × 현재 레벨 */
  expPerLv: (lv: number) => 100 * lv,
  /** 킬당 펫 경험치 = 적 경험치 × 0.6 */
  expShare: 0.6,
  /** 레벨당 소유자 스탯: 공 +0.4% / HP +8 */
  atkPctPerLv: 0.4,
  hpPerLv: 8,
  /** 진화 단계 — Lv10/20/30 (스탯 보너스 2배 구간) */
  evoAt: [10, 20, 30] as const,
};
export function petEvoStage(lv: number): number {
  let stage = 0;
  for (const t of PET.evoAt) if (lv >= t) stage++;
  return stage;
}
export const PET_EVO_NAMES = ["포유기", "성장기", "숙련기", "궁극체"];
export function petBonus(lv: number): { atkPct: number; hp: number } {
  const evoMul = 1 + petEvoStage(lv) * 0.5;
  return { atkPct: lv * PET.atkPctPerLv * evoMul, hp: Math.round(lv * PET.hpPerLv * evoMul) };
}

/* ================= ⑦ 황금 몬스터 러시 ================= */

export const GOLDEN = {
  /** 필드 스폰 체크 주기 (ms)와 확률 — 평균 60~100초에 1마리 */
  intervalMs: 45000,
  chance: 0.22,
  hpMul: 3.5,
  atkMul: 1.2,
  expMul: 5,
  goldMul: 14,
  /** 확정 심연 코인 */
  abyss: 2,
} as const;

/* ================= ⑧ 심연 상점 ================= */

export type AbyssShopItem = {
  id: string;
  name: string;
  desc: string;
  cost: number;
  /** 중복 구매 가능 (부여아) */
  repeatable: boolean;
};
export const ABYSS_SHOP: AbyssShopItem[] = [
  { id: "orb_atk", name: "부여아 — 공격", desc: "영구 공격력 +3", cost: 20, repeatable: true },
  { id: "orb_hp", name: "부여아 — 생명", desc: "영구 최대 HP +45", cost: 20, repeatable: true },
  { id: "orb_def", name: "부여아 — 견고", desc: "영구 방어력 +2", cost: 18, repeatable: true },
  { id: "orb_crit", name: "부여아 — 예리", desc: "영구 크리티컬 +1%", cost: 35, repeatable: true },
  { id: "rebirth_ess", name: "환생의 정수", desc: "환생 요구 레벨 −5 (누적)", cost: 120, repeatable: true },
  { id: "cos_box", name: "치장 상자", desc: "미보유 치장 1종 랜덤", cost: 90, repeatable: true },
  { id: "legend_chest", name: "전설 상자", desc: "chest_legend ×1 즉시 개봉 아님 — 인벤 지급", cost: 150, repeatable: true },
];
/** 부여아 보너스 합산 (orbs 카운트 → ExtBonus) */
export function orbBonus(orbs: Record<string, number>): { atk: number; hp: number; def: number; crit: number } {
  return {
    atk: (orbs.orb_atk ?? 0) * 3,
    hp: (orbs.orb_hp ?? 0) * 45,
    def: (orbs.orb_def ?? 0) * 2,
    crit: (orbs.orb_crit ?? 0) * 1,
  };
}

/* ================= ⑨ 주간 보스 레이드 (요일 로테이션) ================= */

/** 요일별 보너스 보스 (0=일요일) — 해당 보스 처치 시 드롭 ×2 + 심연 코인 +3 */
export const WEEKLY_RAID_BOSSES: string[] = [
  "guardian", // 일 — 숲의 수호자
  "behemoth", // 월 — 늪의 거수
  "nidhog", // 화 — 요정의 재앙
  "surt", // 수 — 화염의 군주
  "fenrir", // 목 — 탐욕의 늑대
  "skoll", // 금 — 추격의 늑대
  "abysslord", // 토 — 심연의 군주
];
export function weeklyRaidBoss(d = new Date()): string {
  return WEEKLY_RAID_BOSSES[d.getDay()];
}

/* ================= ⑩ 탑 랭킹 — net.ts RankMode 확장은 net.ts에서 처리 ================= */

/** ⑩-보조: 전투력 추정 (랭킹/업적 표기용) */
export function combatPower(atkTotal: number, defTotal: number, maxHp: number, crit: number): number {
  return Math.round(atkTotal * 2.2 + defTotal * 1.5 + maxHp * 0.5 + crit * 12);
}

/* ================= 무한 콘텐츠 통합 보너스 → extBonus 병합 ================= */

export function infBonus(
  inf: InfSave,
  collectionRegistered: number,
  petSummoned: boolean,
): { atk: number; hp: number; def: number; crit: number; atkPct: number; goldPct: number } {
  const ob = orbBonus(inf.orbs);
  const rb = rebirthBonus(inf.rebirths);
  const pb = petSummoned ? petBonus(inf.petLv) : { atkPct: 0, hp: 0 };
  /* 도감 보너스 — 등록 종수 ×0.35% 공격 (기존 collectionBonus와 별개 소폭 추가) */
  const dexPct = Math.min(25, collectionRegistered * 0.35);
  return {
    atk: ob.atk,
    hp: ob.hp + pb.hp + rb.hp,
    def: ob.def,
    crit: ob.crit,
    atkPct: rb.atkPct + pb.atkPct + dexPct,
    goldPct: rb.goldPct,
  };
}

/** 오늘 날짜 키 (WorldScene.today와 동일 포맷) */
export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
