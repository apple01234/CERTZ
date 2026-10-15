/* =====================================================================
 * v1.0.8 "무한 콘텐츠 패치" — 10종 신규 무한 콘텐츠 (유저 지시 "무한 컨텐츠 10가지 이상")
 *  ① 심연의 탑 — 무한 층수 탑등반 (층마다 강해지는 적 · 10층마다 보스 · 층 보상)
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
import type { BossKey } from "./stages";

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
  /** v1.0.18 — 환생 기록 로그 (최근 30건 — 직전 직업/레벨/횟수) */
  rebirthLog?: { at: number; lv: number; cls: string | null; n: number }[];
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
  /** 층 스케일: 적 HP ×(1 + 0.17×(층-1)) — 무한 증가 */
  hpPerFloor: 0.17,
  atkPerFloor: 0.12,
  /** vc142 (#4 탑 리워크) — 파워(속도) 배율: 층마다 +1.5%, 상한 +60% (체력·공격력과 함께 점점 증가) */
  spdPerFloor: 0.015,
  spdCap: 0.6,
  /* v1.0.13 피드백#1 — 탑 보상 nerf: 층 보상 골드/EXP 성장 과속 완화 (55/0.24 · 26/0.22 → 35/0.12 · 15/0.10) */
  goldBase: 35,
  goldPerFloor: 0.12,
  expBase: 15,
  expPerFloor: 0.1,
  /** 보스층 간격 — v1.0.15 (피드백 #2): 5층 → 10층마다 보스가 나온다 */
  bossEvery: 10,
  /** v1.0.15 (피드백 #2) — 심층 배율 구간: 10층마다 몬스터가 2배씩 강해진다
   *  (1~10층 ×1 · 11~20층 ×2 · 21~30층 ×4 · 31~40층 ×8 … — 유저 딜이 세도 심층은 계속 위협) */
  depthEvery: 10,
  /** 심층 공격력 배율 — 체력 ×2에 비해 완만한 ×1.5 (한 방 컷 방지 · 체감 난이도는 보장) */
  atkDepthFactor: 1.5,
  /** 층 클리어 심연 코인 (보스층 5배) */
  abyssFloor: 1,
} as const;

export function towerFloorScale(floor: number): number {
  return 1 + Math.max(0, floor - 1) * TOWER.hpPerFloor;
}
/** vc142 — 파워 배율(속도): 층이 오를수록 몬스터가 빨라진다 (체력·공격력 배율과 병행) */
export function towerSpeedScale(floor: number): number {
  return 1 + Math.min(TOWER.spdCap, Math.max(0, floor - 1) * TOWER.spdPerFloor);
}
export function isTowerBossFloor(floor: number): boolean {
  return floor % TOWER.bossEvery === 0;
}
/** v1.0.15 (피드백 #2) — 심층 체력 배율: 10층마다 ×2 (지수 증가) */
export function towerDepthMul(floor: number): number {
  return Math.pow(2, Math.floor((floor - 1) / TOWER.depthEvery));
}
/** v1.0.15 (피드백 #2) — 심층 공격력 배율: 10층마다 ×1.5 (체력보다 완만 — 원 킬 방지) */
export function towerAtkDepthMul(floor: number): number {
  return Math.pow(TOWER.atkDepthFactor, Math.floor((floor - 1) / TOWER.depthEvery));
}
/** vc142 (#4) — 층별 지정 처치 마릿수: 전멸식이 아닌 할당제. 1층 6마리 → 18마리까지 완만 상승
 *  v1.0.15 — 보스층 간격이 10층으로 변경돼도 할당 로직은 동일 (보스층은 보스 1기가 할당 전부) */
export function towerKillNeed(floor: number): number {
  if (isTowerBossFloor(floor)) return 1; // 보스층은 보스 1기가 할당 전부
  return Math.min(18, 6 + Math.floor((floor - 1) * 0.55));
}
/** 실제 스폰수 — 할당보다 여유분을 깔아서 "전부 잡기"가 아니라도 되게 한다.
 *  vc147 (#15) — 동시 스폰 상한 20마리: 18층(할당 18)+여유 4 = 22마리로 "한 번에 20 초과"
 *  생성되던 빈틈 봉합. 부족분은 층 내 처치마다 리스폰(20 캡)으로 목표 마릿수까지 반복 충원된다. */
export function towerSpawnCount(floor: number): number {
  return Math.min(20, towerKillNeed(floor) + 4);
}
/** vc142 (#4) — 보스층 로테이션: 12보스 전원이 보스층마다 "각각 다르게" 배치되는 고정 로테이션
 *  v1.0.15 (피드백 #2) — 보스층이 10의 배수로 변경 (bossEvery=10) — slot 계산 자동 동기 */
export const TOWER_BOSSES: BossKey[] = [
  "guardian", "behemoth", "nidhog", "surt", "fenrir", "skoll",
  "abysslord", "gram", "abudditos", "vord", "jorm", "nagr",
];
export function towerBossFor(floor: number): BossKey {
  const slot = Math.max(0, Math.floor(floor / TOWER.bossEvery) - 1);
  return TOWER_BOSSES[slot % TOWER_BOSSES.length];
}
/** 층 클리어 보상 — 층수에 무한 스케일 */
export function towerFloorReward(floor: number, lv: number): { gold: number; exp: number; abyss: number } {
  const boss = isTowerBossFloor(floor);
  const gold = Math.round((TOWER.goldBase + lv * 5) * (1 + (floor - 1) * TOWER.goldPerFloor) * (boss ? 3 : 1));
  const exp = Math.round((TOWER.expBase + lv * 2) * (1 + (floor - 1) * TOWER.expPerFloor) * (boss ? 3 : 1));
  return { gold, exp, abyss: TOWER.abyssFloor * (boss ? 5 : 1) };
}
/** 층별 등장 몬스터 풀 — vc142 리워드: 밴드 폭 확대(3종→4종) + 10밴드로 다양화.
 *  층이 오를수록 강한 종이 섞이고, 같은 밴드 안에서도 매 층 조합이 달라진다. */
const TOWER_TIERS: EnemyKey[][] = [
  ["wolf", "x2_frog", "x2_rat", "x3_goblin"],
  ["spider", "x2_bat", "x3_swampy", "x3_goblin"],
  ["swampbeast", "golem", "x3_imp", "x2_firebird"],
  ["minion", "wraith", "x3_tinyzombie", "x2_frostfly"],
  ["frostwolf", "icegolem", "x3_icezombie", "x3_orcshaman"],
  ["emberwolf", "firespirit", "x3_wogol", "x2_snail"],
  ["runegolem", "helhound", "x3_orcwarrior", "x2_stonegolem"],
  ["x3_ogre", "x3_chort", "x2_darkhound", "x2_reeffish"],
  ["x3_bigzombie", "x3_maskedorc", "x3_necromancer", "wraith"],
  ["x3_ogre", "x3_chort", "x3_necromancer", "x2_stonegolem"],
];
export function towerPool(floor: number): EnemyKey[] {
  const band = Math.min(TOWER_TIERS.length - 1, Math.floor((floor - 1) / 8));
  const tier = TOWER_TIERS[band] ?? TOWER_TIERS[0];
  /* 같은 밴드 안에서도 층마다 순환이 달라 종류가 섞이게 — 회전 오프셋 */
  const off = (floor - 1) % tier.length;
  return [...tier.slice(off), ...tier.slice(0, off)];
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

/* ================= ④ 환생 (무한 성장 루프) =================
 * v1.0.16 — 유저 지시 "환생을 하면 직업, 전직, 레벨, 스토리가 전부 초기화 되야지!! + 환생 레벨은 200렙":
 *  요구 레벨 60 → 200 상향 + 환생 시 레벨/AP뿐 아니라 직업·전직·스토리 진행까지 전부 초기화
 *  (클래스 null → 1차 시련부터, 스테이지 퀘스트 진행/스토리 클리어 플래그/대사 기록 리셋).
 *  대가가 커진 만큼 환생 보너스가 영구 성장의 핵심 축이 된다. */

export const REBIRTH_BASE_LV = 200;
/** 환생 요구 레벨 — 환생의 정수 1개당 −5 (하한 120) */
export function rebirthReqLv(rebirthEss: number): number {
  return Math.max(120, REBIRTH_BASE_LV - rebirthEss * 5);
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

/** v1.0.18 — 몬스터 파크 난이도 (일반/어려움/지옥)
 *  v1.0.13 피드백#1 — 파크 코인 nerf: 킬당 코인 과다 지급 완화 (어려움 3→2 · 지옥 8→5, 일반 1 유지) */
export const PARK_DIFFS = [
  { name: "일반", minLv: 15, hpMul: 1, atkMul: 1, coin: 1, spawnMs: 950, color: "#8fe84a" },
  { name: "어려움", minLv: 40, hpMul: 2.4, atkMul: 1.7, coin: 2, spawnMs: 800, color: "#a8ecff" },
  { name: "지옥", minLv: 80, hpMul: 6, atkMul: 3, coin: 5, spawnMs: 620, color: "#ff8ab0" },
] as const;
/** 파크 한 세션 길이 (ms) */
export const PARK_DURATION = 90000;
/** 파크 입장권 일일 장수 */
export const PARK_TICKETS = 2;
