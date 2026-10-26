/* =====================================================================
 * v1.1.8 (#개편 A46) — 낚시 시스템
 *
 * 왜 만들었나:
 *   이 게임의 무한 콘텐츠 10종은 전부 "싸운다"로 수렴한다(탑·균열·시련·파크·레이드…).
 *   전투가 아닌 손맛/수집 루프가 없어, 사냥에 지친 유저가 할 일이 없다.
 *   낚시는 (1) 전투 스탯과 무관하게 즐길 수 있고 (2) 수집 욕구를 자극하며
 *   (3) 물고기를 재료로 쓰게 하면 자연스럽게 다른 시스템과 연결된다.
 *
 * 설계 원칙:
 *   · 타이밍 게임 — 릴을 감는 구간마다 "성공 구간"이 지나가고, 그 안에서 멈춰야 잡힌다.
 *     (무작위 확률만 두면 손맛이 없다. 조작이 결과를 바꿔야 한다.)
 *   · 지역별 어종 — 설원/화산/수중/심연에서만 나오는 물고기를 둬 탐험 동기가 된다.
 *   · 실패 페널티 없음 — 미끼만 소모. 좌절보다 "한 번 더"를 유도한다.
 *
 * 이 파일은 순수 데이터/계산만 담당한다(Phaser·React 의존 없음).
 * ===================================================================== */

/** 어종 등급 */
export type FishTier = "common" | "rare" | "epic" | "legend";

/** 낚시 가능 지역 (스테이지 챕터 키와 매핑) */
export type FishingZone = "forest" | "kingdom" | "alfheim" | "muspelheim" | "niflheim" | "cave" | "nidavellir" | "hel" | "abyss";

export type FishDef = {
  key: string;
  name: string;
  tier: FishTier;
  /** 이 물고기가 나오는 지역 (빈 배열이면 모든 지역) */
  zones: FishingZone[];
  /** 무게 범위(kg) — 표시용 연출 */
  weight: [number, number];
  /** 낚았을 때 주는 골드 */
  gold: number;
  /** 첫 낚시 시 주는 심연 코인 (수집 보상) */
  firstAbyss?: number;
  /** 설명 (도감용) */
  desc: string;
};

export const FISH_DEFS: FishDef[] = [
  /* ── 일반 (자주 낚임) ── */
  { key: "fish_minnow", name: "피라미", tier: "common", zones: [], weight: [0.05, 0.3], gold: 120, desc: "어디서나 잡히는 작은 물고기. 튀김으로 먹으면 고소하다." },
  { key: "fish_carp", name: "잉어", tier: "common", zones: ["forest", "kingdom"], weight: [0.8, 3.2], gold: 320, desc: "느긋하게 헤엄치는 강의 주인. 낚시꾼의 기본기." },
  { key: "fish_trout", name: "송어", tier: "common", zones: ["forest", "alfheim"], weight: [0.4, 1.8], gold: 280, desc: "맑은 물에서만 산다. 물이 깨끗하다는 증거." },
  { key: "fish_icefish", name: "빙어", tier: "common", zones: ["niflheim"], weight: [0.02, 0.15], gold: 260, desc: "얼음 아래에서 은빛으로 빛난다. 한 마리로는 배가 안 부른다." },
  { key: "fish_lavafish", name: "화염어", tier: "common", zones: ["muspelheim"], weight: [0.3, 1.2], gold: 340, desc: "끓는 물에서 산다. 만지면 뜨겁다." },
  { key: "fish_cavefish", name: "동굴어", tier: "common", zones: ["cave", "nidavellir"], weight: [0.2, 0.9], gold: 300, desc: "눈이 퇴화해 촉수로 먹이를 찾는다." },

  /* ── 고급 ── */
  { key: "fish_salmon", name: "은연어", tier: "rare", zones: ["forest", "niflheim"], weight: [1.5, 5.0], gold: 780, desc: "거슬러 오르는 강자. 살이 단단하다." },
  { key: "fish_crystal", name: "수정비늘", tier: "rare", zones: ["alfheim", "cave"], weight: [0.6, 2.4], gold: 950, desc: "비늘이 수정처럼 굳어 빛을 굴절시킨다." },
  { key: "fish_ember", name: "불씨鰓", tier: "rare", zones: ["muspelheim"], weight: [1.0, 3.5], gold: 880, desc: "아가미에서 불티가 떨어진다. 화로에 넣으면 불이 붙는다." },
  { key: "fish_frost", name: "서리지느러미", tier: "rare", zones: ["niflheim"], weight: [1.2, 4.0], gold: 910, desc: "지느러미가 얼음 보석으로 덮여 있다." },
  { key: "fish_rune", name: "룬비늘", tier: "rare", zones: ["nidavellir"], weight: [0.9, 2.8], gold: 870, desc: "비늘 하나하나에 룬이 새겨져 있다. 누가 새겼는지는 아무도 모른다." },

  /* ── 에픽 ── */
  { key: "fish_golden", name: "황금잉어", tier: "epic", zones: ["kingdom"], weight: [2.0, 6.0], gold: 2400, desc: "왕국의 연못에 산다는 전설. 잡으면 복이 온다더라." },
  { key: "fish_spirit", name: "정령어", tier: "epic", zones: ["alfheim"], weight: [0.4, 1.5], gold: 2600, desc: "물속에 사는 정령이 물고기 형상을 빌린 것이라는 설." },
  { key: "fish_void", name: "공허어", tier: "epic", zones: ["hel", "abyss"], weight: [1.0, 3.0], gold: 2800, desc: "그림자가 물고기 모양으로 굳은 것 같다. 눈을 오래 보면 어지럽다." },
  { key: "fish_magma", name: "용암룡어", tier: "epic", zones: ["muspelheim"], weight: [4.0, 9.0], gold: 3000, desc: "비늘 사이로 용암이 흐른다. 낚싯대가 타들어간다." },

  /* ── 전설 ── */
  { key: "fish_yggdrasil", name: "인피니트보석의 잎새", tier: "legend", zones: ["abyss"], weight: [0.1, 0.5], gold: 8000, firstAbyss: 5, desc: "물고기가 아니라 인피니트보석에서 떨어진 잎. 뿌리 물에 떠내려왔다." },
  { key: "fish_nidhogg", name: "라시온의 비늘", tier: "legend", zones: ["cave", "nidavellir"], weight: [6.0, 14.0], gold: 7500, firstAbyss: 5, desc: "용의 비늘이 물속에 가라앉아 굳은 것. 아직 따뜻하다." },
  { key: "fish_aurora", name: "오로라송어", tier: "legend", zones: ["niflheim"], weight: [2.0, 5.0], gold: 7800, firstAbyss: 5, desc: "빛을 머금은 비늘이 오로라처럼 흐른다. 밤에만 잡힌다." },
  { key: "fish_principle", name: "근원의 고기", tier: "legend", zones: ["abyss"], weight: [10.0, 30.0], gold: 9500, firstAbyss: 8, desc: "심연의 근원에서만 산다. 이걸 낚은 자는 무한의 탑 최심부를 본 것이라 한다." },
];

export const FISH_TIER_META: Record<FishTier, { label: string; color: string; catchPct: number }> = {
  common: { label: "일반", color: "#cbd5e1", catchPct: 55 },
  rare: { label: "고급", color: "#6ee7b7", catchPct: 28 },
  epic: { label: "희귀", color: "#c4b5fd", catchPct: 13 },
  legend: { label: "전설", color: "#fcd34d", catchPct: 4 },
};

/** 지역별 후보 어종 (전체 지역 공통 어종 포함) */
export function fishPoolFor(zone: FishingZone): FishDef[] {
  return FISH_DEFS.filter((f) => f.zones.length === 0 || f.zones.includes(zone));
}

/**
 * 등급 추첨 — 성공 구간 판정을 통과한 뒤 어떤 물고기가 걸릴지 정한다.
 * 낚시 숙련도(연속 성공)가 높을수록 상위 등급 확률이 올라간다(0~1).
 */
export function rollFish(zone: FishingZone, skill = 0, rng: () => number = Math.random): FishDef {
  const pool = fishPoolFor(zone);
  const bonus = Math.max(0, Math.min(1, skill)) * 0.18; // 최대 +18%p
  const tierRoll = rng() * 100;
  const legendary = FISH_TIER_META.legend.catchPct + bonus * 40;
  const epic = FISH_TIER_META.epic.catchPct + bonus * 60;
  const rare = FISH_TIER_META.rare.catchPct + bonus * 100;
  let tier: FishTier = "common";
  if (tierRoll < legendary) tier = "legend";
  else if (tierRoll < legendary + epic) tier = "epic";
  else if (tierRoll < legendary + epic + rare) tier = "rare";
  const cands = pool.filter((f) => f.tier === tier);
  const use = cands.length > 0 ? cands : pool;
  return use[Math.floor(rng() * use.length) % use.length];
}

/** 무게 추첨 */
export function rollWeight(fish: FishDef, rng: () => number = Math.random): number {
  const [lo, hi] = fish.weight;
  return Math.round((lo + (hi - lo) * rng()) * 100) / 100;
}

/** 낚시 결과를 세이브에 반영할 때 쓰는 순수 계산 */
export type FishCatch = { key: string; weight: number; gold: number; firstAbyss: number };

export function makeCatch(fish: FishDef, weight: number, isFirst: boolean): FishCatch {
  return {
    key: fish.key,
    weight,
    gold: fish.gold,
    firstAbyss: isFirst ? fish.firstAbyss ?? 0 : 0,
  };
}

/** 도감 완성률 */
export function fishCollectionPct(caught: string[]): number {
  const set = new Set(caught);
  return Math.round((FISH_DEFS.filter((f) => set.has(f.key)).length / FISH_DEFS.length) * 100);
}

/** 도감 완성 보너스 — 모든 물고기를 모으면 영구 골드 획득 +3% */
export function fishCollectionBonus(caught: string[]): number {
  const pct = fishCollectionPct(caught);
  return pct >= 100 ? 0.03 : 0;
}
