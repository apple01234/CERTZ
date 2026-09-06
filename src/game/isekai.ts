/* =====================================================================
 * v4.0.0 "바르가 업데이트" — 균열 수비전 + 수집형 성장 시스템
 *  - 세계수 뿌리에서 열리는 균열(바르가)을 방어하는 웨이브 디펜스,
 *    3인 협동 몬스터 웨이브 디펜스 RPG)에서 착안해 SERTZ에 맞게 재해석한 콘텐츠.
 *  - 이 파일은 데이터 테이블 + 순수 계산 헬퍼만 담당 (Phaser 의존 없음).
 *  실제 상태는 SaveData(config.ts) + Player/WorldScene에 존재한다.
 * ===================================================================== */

/* ================= 1. 피규어 수집 (바르가 피규어 뽑기) ================= */

export type FigureGrade = 0 | 1 | 2 | 3; // 0=노말 1=레어 2=에픽 3=전설

export type FigureDef = {
  key: string;
  name: string;
  grade: FigureGrade;
  desc: string;
  /** 보너스 — 보유만으로 항상 적용 (노말/레어 flat, 에픽/전설 %) */
  bonus: { atk?: number; def?: number; hp?: number; crit?: number; atkPct?: number };
};

export const FIGURE_GRADE_META: Record<FigureGrade, { name: string; color: string; css: string; shard: number; weight: number }> = {
  0: { name: "노말", color: "#cfd8e3", css: "text-white/80", shard: 5, weight: 62 },
  1: { name: "레어", color: "#6fb8ff", css: "text-sky-300", shard: 15, weight: 27 },
  2: { name: "에픽", color: "#c08aff", css: "text-purple-300", shard: 40, weight: 9 },
  3: { name: "전설", color: "#ffd76a", css: "text-amber-300", shard: 100, weight: 2 },
};

export const FIGURES: FigureDef[] = [
  { key: "fig_slime", name: "필드 슬라임", grade: 0, desc: "첫 사냥 상대의 피규어", bonus: { hp: 40 } },
  { key: "fig_gob", name: "고블린 정찰병", grade: 0, desc: "숲의 단골손님", bonus: { atk: 3 } },
  { key: "fig_wolf", name: "서릿늑대", grade: 0, desc: "니플헤임의 주민", bonus: { def: 2 } },
  { key: "fig_mush", name: "황금 버섯", grade: 0, desc: "숨겨진 하늘색 반짝임", bonus: { crit: 1 } },
  { key: "fig_knight", name: "쿠소디아 기사", grade: 1, desc: "철벽의 방패 자세", bonus: { def: 6, hp: 80 } },
  { key: "fig_archer", name: "요정 궁수", grade: 1, desc: "알프헤임의 명사수", bonus: { atk: 6 } },
  { key: "fig_dragon", name: "새끼 파이어드레이크", grade: 1, desc: "아직 작은 화염", bonus: { atk: 4, crit: 2 } },
  { key: "fig_reaper", name: "작은 사신", grade: 1, desc: "헬의 초보 사자", bonus: { crit: 3 } },
  { key: "fig_golem", name: "룬 골렘", grade: 2, desc: "고대 룬이 깨어났다", bonus: { atkPct: 2, hp: 150 } },
  { key: "fig_fenrir", name: "펜리르 그림자", grade: 2, desc: "포효가 남겨둔 흔적", bonus: { atkPct: 3 } },
  { key: "fig_valk", name: "발키리 날개", grade: 2, desc: "빛의 결정 날개", bonus: { crit: 4, def: 8 } },
  { key: "fig_worldtree", name: "세계수의 심장", grade: 3, desc: "아홉 왕국을 지탱하는 전설", bonus: { atkPct: 4, hp: 300, crit: 2 } },
];

export const FIGURE_MAP: Record<string, FigureDef> = Object.fromEntries(FIGURES.map((f) => [f.key, f]));

/** 가챠 1회 — 등급 가중치 → 해당 등급에서 랜덤 1종. 결과 {key, dup} 반환 */
export function rollFigure(owned: string[]): { key: string; dup: boolean; grade: FigureGrade } {
  const r = Math.random() * 100;
  let grade: FigureGrade = 0;
  let acc = 0;
  for (const g of [0, 1, 2, 3] as FigureGrade[]) {
    acc += FIGURE_GRADE_META[g].weight;
    if (r < acc) { grade = g; break; }
  }
  const pool = FIGURES.filter((f) => f.grade === grade);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return { key: pick.key, dup: owned.includes(pick.key), grade };
}

/** 피규어 보너스 합산 */
export function figureBonus(owned: string[]): { atk: number; def: number; hp: number; crit: number; atkPct: number } {
  const out = { atk: 0, def: 0, hp: 0, crit: 0, atkPct: 0 };
  for (const k of owned) {
    const f = FIGURE_MAP[k];
    if (!f) continue;
    out.atk += f.bonus.atk ?? 0;
    out.def += f.bonus.def ?? 0;
    out.hp += f.bonus.hp ?? 0;
    out.crit += f.bonus.crit ?? 0;
    out.atkPct += f.bonus.atkPct ?? 0;
  }
  return out;
}

/* ================= 2. 배지 (바르가 배지 세팅 — 3슬롯) ================= */

export type BadgeDef = {
  key: string;
  name: string;
  desc: string;
  bonus: { atk?: number; def?: number; hp?: number; crit?: number; goldPct?: number; speedPct?: number };
  /** 획득 경로 표기 */
  src: string;
};

export const BADGES: BadgeDef[] = [
  { key: "bdg_gate1", name: "차원문의 문지기", desc: "게이트 첫 승리 기념", bonus: { hp: 100 }, src: "게이트 ★1 달성" },
  { key: "bdg_gate2", name: "웨이브 사냥꾼", desc: "20웨이브 방어의 증표", bonus: { atk: 8 }, src: "게이트 ★2 달성" },
  { key: "bdg_gate3", name: "바르가 수호자", desc: "30웨이브 방어의 전설", bonus: { atk: 12, hp: 150 }, src: "게이트 ★3 달성" },
  { key: "bdg_closet", name: "균열 탐험가", desc: "균열 던전 파밍광", bonus: { goldPct: 5 }, src: "균열 던전 누적 10만G" },
  { key: "bdg_hunter", name: "토벌자 인장", desc: "1,000마리 사냛 증명", bonus: { atk: 5, def: 3 }, src: "업적 — 토벌 1000" },
  { key: "bdg_star", name: "별의 인장", desc: "성좌 6개 개방 기념", bonus: { crit: 3 }, src: "업적 — 성좌 수집가" },
  { key: "bdg_coins", name: "황금 돼지 배지", desc: "부자의 상징", bonus: { goldPct: 8 }, src: "조각 상점 교환" },
  { key: "bdg_boots", name: "질풍 발판", desc: "발이 가벼워진다", bonus: { speedPct: 5 }, src: "조각 상점 교환" },
];

export const BADGE_MAP: Record<string, BadgeDef> = Object.fromEntries(BADGES.map((b) => [b.key, b]));

export const BADGE_SLOTS = 3;

export function badgeBonus(slots: (string | null)[]): { atk: number; def: number; hp: number; crit: number; goldPct: number; speedPct: number } {
  const out = { atk: 0, def: 0, hp: 0, crit: 0, goldPct: 0, speedPct: 0 };
  for (const k of slots) {
    const b = k ? BADGE_MAP[k] : null;
    if (!b) continue;
    out.atk += b.bonus.atk ?? 0;
    out.def += b.bonus.def ?? 0;
    out.hp += b.bonus.hp ?? 0;
    out.crit += b.bonus.crit ?? 0;
    out.goldPct += b.bonus.goldPct ?? 0;
    out.speedPct += b.bonus.speedPct ?? 0;
  }
  return out;
}

/* ================= 3. 룬 합성 (바르가 룬 합성 — 4슬롯) ================= */

export type RuneKind = "rune_fire" | "rune_ice" | "rune_light" | "rune_dark";

export const RUNE_META: Record<RuneKind, { name: string; stat: "atk" | "def" | "crit" | "hp"; color: string; icon: string }> = {
  rune_fire: { name: "화염 룬", stat: "atk", color: "#ff8a5c", icon: "🔥" },
  rune_ice: { name: "냉기 룬", stat: "def", color: "#7dd8ff", icon: "❄" },
  rune_light: { name: "빛 룬", stat: "crit", color: "#ffe86a", icon: "✦" },
  rune_dark: { name: "어둠 룬", stat: "hp", color: "#c08aff", icon: "☾" },
};

export const RUNE_MAX_TIER = 5;

/** 룬 티어별 스탯치 (atk/def/hp/crit 공용 스케일) */
export function runeStat(kind: RuneKind, tier: number): number {
  const base = [0, 4, 9, 16, 26, 40][Math.max(1, Math.min(RUNE_MAX_TIER, tier))];
  if (kind === "rune_dark") return base * 14; // hp는 크게
  if (kind === "rune_light") return Math.max(1, Math.round(base * 0.5)); // crit %p
  return base;
}

export const RUNE_KINDS: RuneKind[] = ["rune_fire", "rune_ice", "rune_light", "rune_dark"];
/** 장착 슬롯 4개 */
export const RUNE_SLOTS = 4;
/** 합성: 동일 룬 3개 → 다음 티어 1개 */
export const RUNE_SYNTH_COST = 3;

/** runes 소유 레코드: "rune_fire#1" → 개수 */
export type RuneOwned = Record<string, number>;

export function runeKey(kind: RuneKind, tier: number): string {
  return `${kind}#${tier}`;
}

export function parseRuneKey(k: string): { kind: RuneKind; tier: number } | null {
  const m = /^rune_(fire|ice|light|dark)#(\d)$/.exec(k);
  if (!m) return null;
  return { kind: `rune_${m[1]}` as RuneKind, tier: Number(m[2]) };
}

export function runeBonus(owned: RuneOwned, slots: (string | null)[]): { atk: number; def: number; hp: number; crit: number } {
  const out = { atk: 0, def: 0, hp: 0, crit: 0 };
  for (const k of slots) {
    const p = k ? parseRuneKey(k) : null;
    if (!p) continue;
    const v = runeStat(p.kind, p.tier);
    if (p.kind === "rune_fire") out.atk += v;
    else if (p.kind === "rune_ice") out.def += v;
    else if (p.kind === "rune_light") out.crit += v;
    else out.hp += v;
  }
  return out;
}

/* ================= 4. 성좌 (바르가 성좌 — 12성좌 × 3노드) ================= */

export type ConstellationDef = { key: string; name: string; nodes: { atk?: number; def?: number; hp?: number; crit?: number; atkPct?: number }[] };

export const CONSTELLATIONS: ConstellationDef[] = [
  { key: "aries", name: "양자리", nodes: [{ atk: 4 }, { atk: 5 }, { atk: 6 }] },
  { key: "taurus", name: "황소자리", nodes: [{ hp: 80 }, { hp: 120 }, { hp: 180 }] },
  { key: "gemini", name: "쌍둥이자리", nodes: [{ crit: 2 }, { crit: 3 }, { crit: 4 }] },
  { key: "cancer", name: "게자리", nodes: [{ def: 4 }, { def: 6 }, { def: 8 }] },
  { key: "leo", name: "사자자리", nodes: [{ atkPct: 2 }, { atk: 8 }, { atkPct: 3 }] },
  { key: "virgo", name: "처녀자리", nodes: [{ hp: 120 }, { def: 6 }, { hp: 200 }] },
  { key: "libra", name: "천칭자리", nodes: [{ atk: 5 }, { def: 5 }, { crit: 3 }] },
  { key: "scorpio", name: "전갈자리", nodes: [{ crit: 3 }, { atk: 7 }, { crit: 4 }] },
  { key: "sagittarius", name: "궁수자리", nodes: [{ atk: 6 }, { atk: 8 }, { atk: 10 }] },
  { key: "capricorn", name: "염소자리", nodes: [{ hp: 150 }, { def: 7 }, { hp: 220 }] },
  { key: "aquarius", name: "물병자리", nodes: [{ atkPct: 2 }, { crit: 4 }, { atkPct: 3 }] },
  { key: "pisces", name: "물고기자리", nodes: [{ hp: 200 }, { atkPct: 3 }, { atkPct: 4 }] },
];

/** 노드 개방 비용 (성좌 내 1/2/3번째) */
export const CONSTEL_NODE_COST = [20, 45, 90];
/** 성좌 다음 노드는 이전 노드 개방 필요 (순차) */

export function constellationBonus(unlocked: string[]): { atk: number; def: number; hp: number; crit: number; atkPct: number } {
  const out = { atk: 0, def: 0, hp: 0, crit: 0, atkPct: 0 };
  for (const id of unlocked) {
    const [ck, ni] = id.split(":");
    const c = CONSTELLATIONS.find((x) => x.key === ck);
    const idx = Number(ni);
    if (!c || !Number.isInteger(idx) || idx < 0 || idx >= c.nodes.length) continue;
    const n = c.nodes[idx];
    out.atk += n.atk ?? 0;
    out.def += n.def ?? 0;
    out.hp += n.hp ?? 0;
    out.crit += n.crit ?? 0;
    out.atkPct += n.atkPct ?? 0;
  }
  return out;
}

/* ================= 5. 스킨 능력치 (바르가 스킨 = 추가 능력치) ================= */

/** 치장 아이템 → 능력치 (기존 cos_* 포함, 보유 착용 시 적용) */
export const COSMETIC_BONUS: Record<string, { atk?: number; def?: number; hp?: number; crit?: number; goldPct?: number }> = {
  cos_aurora: { crit: 2, hp: 60 },
  cos_isekai: { atk: 10, hp: 120 },
  cos_pixel: { atk: 6, crit: 2 },
  cos_crown: { goldPct: 6 },
};

export function cosmeticBonus(key: string | null): { atk: number; def: number; hp: number; crit: number; goldPct: number } {
  const out = { atk: 0, def: 0, hp: 0, crit: 0, goldPct: 0 };
  if (!key) return out;
  const b = COSMETIC_BONUS[key];
  if (!b) return out;
  out.atk += b.atk ?? 0;
  out.def += b.def ?? 0;
  out.hp += b.hp ?? 0;
  out.crit += b.crit ?? 0;
  out.goldPct += b.goldPct ?? 0;
  return out;
}

/* ================= 6. 외부 보너스 합산 — Player에 주입하는 최종 값 ================= */

export type ExtBonus = {
  atk: number;
  atkPct: number;
  def: number;
  hp: number;
  crit: number;
  speedPct: number;
  goldPct: number;
};

export const ZERO_EXT: ExtBonus = { atk: 0, atkPct: 0, def: 0, hp: 0, crit: 0, speedPct: 0, goldPct: 0 };

/** 피규어+배지+룬+성좌+스킨 전체 합산 */
export function computeExtBonus(input: {
  figures: string[];
  badgeSlots: (string | null)[];
  runes: RuneOwned;
  runeSlots: (string | null)[];
  constel: string[];
  cosmetic: string | null;
}): ExtBonus {
  const f = figureBonus(input.figures);
  const b = badgeBonus(input.badgeSlots);
  const r = runeBonus(input.runes, input.runeSlots);
  const c = constellationBonus(input.constel);
  const s = cosmeticBonus(input.cosmetic);
  return {
    atk: f.atk + b.atk + r.atk,
    atkPct: f.atkPct + c.atkPct,
    def: f.def + b.def + r.def + c.def + s.def,
    hp: f.hp + b.hp + r.hp + c.hp + s.hp,
    crit: f.crit + b.crit + r.crit + c.crit + s.crit,
    speedPct: b.speedPct,
    goldPct: b.goldPct + s.goldPct,
  };
}

/* ================= 7. 게이트 디펜스 — 로그라이크 카드 풀 (1~3성) ================= */

export type GateCard = {
  id: string;
  tier: 1 | 2 | 3;
  name: string;
  desc: string;
  stat: {
    atkPct?: number;
    skillPct?: number;
    hpPct?: number;
    crit?: number;
    lifesteal?: number;
    silverPct?: number;
    speedPct?: number;
  };
};

export const GATE_CARD_POOL: GateCard[] = [
  /* 1성 */
  { id: "c_atk1", tier: 1, name: "날카로운 여운", desc: "공격력 +8%", stat: { atkPct: 8 } },
  { id: "c_skl1", tier: 1, name: "집중된 기류", desc: "스킬 피해 +10%", stat: { skillPct: 10 } },
  { id: "c_hp1", tier: 1, name: "튼튼한 아귀", desc: "최대 HP +15%", stat: { hpPct: 15 } },
  { id: "c_spd1", tier: 1, name: "가벼운 발", desc: "이동 속도 +12%", stat: { speedPct: 12 } },
  { id: "c_ag1", tier: 1, name: "코인 코인", desc: "실버 획득 +25%", stat: { silverPct: 25 } },
  /* 2성 */
  { id: "c_atk2", tier: 2, name: "전사의 격", desc: "공격력 +15%", stat: { atkPct: 15 } },
  { id: "c_skl2", tier: 2, name: "주문 갈고닦기", desc: "스킬 피해 +20%", stat: { skillPct: 20 } },
  { id: "c_hp2", tier: 2, name: "심장 보강", desc: "최대 HP +25%", stat: { hpPct: 25 } },
  { id: "c_cri2", tier: 2, name: "약점 간파", desc: "크리티컬 +10%p", stat: { crit: 10 } },
  { id: "c_ls2", tier: 2, name: "흡혈 송곳니", desc: "처치 시 HP 흡수 5%", stat: { lifesteal: 5 } },
  /* 3성 */
  { id: "c_atk3", tier: 3, name: "바르가의 축복", desc: "공격력 +25%", stat: { atkPct: 25 } },
  { id: "c_skl3", tier: 3, name: "궁극의 마수렬", desc: "스킬 피해 +35%", stat: { skillPct: 35 } },
  { id: "c_hp3", tier: 3, name: "불굴의 각오", desc: "최대 HP +40%", stat: { hpPct: 40 } },
  { id: "c_cri3", tier: 3, name: "신의 시선", desc: "크리티컬 +18%p", stat: { crit: 18 } },
  { id: "c_ls3", tier: 3, name: "피의 문장", desc: "처치 시 HP 흡수 10%", stat: { lifesteal: 10 } },
];

/** 웨이브 클리어 → 티어 가중치로 3장 뽑기 (웨이브가 깊을수록 고성능 등장) */
export function drawGateCards(wave: number): GateCard[] {
  const w2 = Math.min(45, wave * 1.2); // 2성 가중치
  const w3 = Math.max(2, wave - 5); // 3성 가중치
  const pickTier = (): 1 | 2 | 3 => {
    const r = Math.random() * (100 + w2 + w3);
    if (r < w3) return 3;
    if (r < w3 + w2) return 2;
    return 1;
  };
  const out: GateCard[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 3; i++) {
    let t = pickTier();
    // 중복 방지 — 같은 티어 풀에서 안 뽑히면 아무거나
    let pool = GATE_CARD_POOL.filter((c) => c.tier === t && !used.has(c.id));
    if (pool.length === 0) pool = GATE_CARD_POOL.filter((c) => !used.has(c.id));
    const c = pool[Math.floor(Math.random() * pool.length)] ?? GATE_CARD_POOL[0];
    used.add(c.id);
    out.push(c);
    void t;
  }
  return out;
}

/* ================= 8. 인런 실버 상점 (웨이브 사이 구매) ================= */

export type SilverShopItem = {
  id: string;
  name: string;
  desc: string;
  cost: number;
  icon: string;
};

export const SILVER_SHOP: SilverShopItem[] = [
  { id: "sh_heal", name: "응급 키트", desc: "HP 60% 즉시 회복", cost: 40, icon: "✚" },
  { id: "sh_bomb", name: "차원 폭탄", desc: "모든 적에게 강력한 피해", cost: 90, icon: "☄" },
  { id: "sh_repair", name: "게이트 수리", desc: "게이트 HP 30% 복구", cost: 120, icon: "⛨" },
  { id: "sh_mp", name: "정신 안정제", desc: "MP 100% 회복", cost: 35, icon: "◇" },
];

/* ================= 9. 별점 (웨이브 → ★) ================= */

export const GATE_STAR_WAVES = [10, 20, 30]; // ★1/★2/★3
/** 최초 달성 보상 (에메랄드) */
export const GATE_STAR_REWARD = [3, 6, 10];

/* ================= 10. 쿠폰 (게임 고유 쿠폰 코드) ================= */

export type CouponDef = {
  code: string;
  name: string;
  desc: string;
  grant: { gold?: number; emerald?: number; tickets?: number; tierCube?: number };
};

export const COUPONS: CouponDef[] = [
  { code: "HELLOSERTZ", name: "환영 쿠폰", desc: "뽑기권 3 + 골드 1만", grant: { tickets: 3, gold: 10000 } },
  { code: "GATEOPEN", name: "차원문 개방 기념", desc: "뽑기권 2 + 에메랄드 5", grant: { tickets: 2, emerald: 5 } },
  { code: "SERTZV4", name: "v4.0.0 업데이트 축하", desc: "등급업 큐브 1 + 뽑기권 1", grant: { tierCube: 1, tickets: 1 } },
];

/* ================= 11. 출석부 (14일 사이클) ================= */

export const ATTEND_CYCLE = 14;
export const ATTEND_REWARDS: { label: string; grant: { gold?: number; emerald?: number; tickets?: number; shards?: number } }[] = [
  { label: "골드 5,000", grant: { gold: 5000 } },
  { label: "골드 8,000", grant: { gold: 8000 } },
  { label: "뽑기권 1", grant: { tickets: 1 } },
  { label: "골드 10,000", grant: { gold: 10000 } },
  { label: "피규어 조각 20", grant: { shards: 20 } },
  { label: "뽑기권 2", grant: { tickets: 2 } },
  { label: "골드 15,000", grant: { gold: 15000 } },
  { label: "에메랄드 3", grant: { emerald: 3 } },
  { label: "뽑기권 2", grant: { tickets: 2 } },
  { label: "골드 20,000", grant: { gold: 20000 } },
  { label: "피규어 조각 40", grant: { shards: 40 } },
  { label: "에메랄드 5", grant: { emerald: 5 } },
  { label: "뽑기권 3", grant: { tickets: 3 } },
  { label: "대박! 에메랄드 10 + 조각 50", grant: { emerald: 10, shards: 50 } },
];

/* ================= 12. 일일 퀘스트 (3종) ================= */

export type DailyQuestDef = {
  id: string;
  name: string;
  desc: string;
  goal: number;
  reward: { label: string; gold?: number; emerald?: number; tickets?: number };
};

export const DAILY_QUESTS: DailyQuestDef[] = [
  { id: "hunt", name: "오늘의 토벌", desc: "몬스터 50마리 처치", goal: 50, reward: { label: "골드 15,000", gold: 15000 } },
  { id: "gate", name: "게이트 방어", desc: "바르가 수비전 1회 입장", goal: 1, reward: { label: "뽑기권 1 + 골드 5,000", tickets: 1, gold: 5000 } },
  { id: "closet", name: "균열 던전", desc: "균열 던전 1회 입장", goal: 1, reward: { label: "뽑기권 1 + 에메랄드 2", tickets: 1, emerald: 2 } },
];

/* ================= 13. 티켓 (행동력 대체 — 일일 입장권) ================= */

export const TICKETS_PER_DAY = { gate: 3, closet: 2 };

/* ================= 14. 업적 (마일스톤 → 조각 보상) ================= */

export type AchDef = {
  id: string;
  name: string;
  desc: string;
  shards: number;
  /** 진행도 조회기 — WorldScene에서 채워줌 */
  prog: (s: AchSnapshot) => number;
  goal: number;
};

export type AchSnapshot = {
  totalKills: number;
  lv: number;
  gateBest: number;
  closetBest: number;
  upSum: number;
  collection: number;
  figures: number;
  constelNodes: number;
  dojangBest: number;
};

export const ACHIEVEMENTS: AchDef[] = [
  { id: "ach_h1", name: "첫 사냥", desc: "몬스터 100마리 처치", shards: 10, prog: (s) => s.totalKills, goal: 100 },
  { id: "ach_h2", name: "토벌자", desc: "몬스터 1,000마리 처치", shards: 30, prog: (s) => s.totalKills, goal: 1000 },
  { id: "ach_h3", name: "살육의 화신", desc: "몬스터 10,000마리 처치", shards: 80, prog: (s) => s.totalKills, goal: 10000 },
  { id: "ach_lv", name: "성장하는 자", desc: "레벨 100 달성", shards: 20, prog: (s) => s.lv, goal: 100 },
  { id: "ach_g1", name: "게이트 수호", desc: "게이트 10웨이브 방어", shards: 15, prog: (s) => s.gateBest, goal: 10 },
  { id: "ach_g2", name: "게이트의 전설", desc: "게이트 30웨이브 방어", shards: 60, prog: (s) => s.gateBest, goal: 30 },
  { id: "ach_c1", name: "균열 파밍꾼", desc: "균열 던전 누적 10만G", shards: 15, prog: (s) => s.closetBest, goal: 100000 },
  { id: "ach_u1", name: "강화 장인", desc: "장비 강화 합계 +20성", shards: 25, prog: (s) => s.upSum, goal: 20 },
  { id: "ach_col", name: "도감 수집가", desc: "몬스터 도감 20종 등록", shards: 20, prog: (s) => s.collection, goal: 20 },
  { id: "ach_fig", name: "피규어 대가", desc: "피규어 8종 수집", shards: 30, prog: (s) => s.figures, goal: 8 },
  { id: "ach_con", name: "성좌 수집가", desc: "성좌 노드 10개 개방", shards: 30, prog: (s) => s.constelNodes, goal: 10 },
  { id: "ach_doj", name: "도장 돌파자", desc: "무릉도장 누적 30만 피해", shards: 25, prog: (s) => s.dojangBest, goal: 300000 },
];

/* ================= 15. 역할 시스템 (탱커/딜러/서포터 — 3인 협동 오마주) ================= */

export type RoleKind = "tank" | "dealer" | "support";
export const ROLE_META: Record<RoleKind, { name: string; color: string }> = {
  tank: { name: "탱커", color: "#7dd8ff" },
  dealer: { name: "딜러", color: "#ff8a5c" },
  support: { name: "서포터", color: "#7de86a" },
};

/** 4차 세부직업 8종 역할 매핑 */
export const ROLE_OF: Record<string, RoleKind> = {
  warbringer: "tank",
  crusader: "support",
  deadeye: "dealer",
  skylord: "dealer",
  arclord: "support",
  eternal: "dealer",
  shadowlord: "dealer",
  blademaster: "tank",
};

/** 팀워크 버프 계산 — 파티 2인 이상이고 역할 다양성에 따라 보너스
 *  서로 다른 역할 2종 이상: 공/HP +10% · 같은 역할 2인: +5% */
export function teamworkBuff(partySize: number, roles: RoleKind[]): { pct: number; label: string | null } {
  if (partySize < 2) return { pct: 0, label: null };
  const uniq = new Set(roles.filter(Boolean));
  if (uniq.size >= 2) return { pct: 10, label: "팀워크 버프! 공격력·HP +10% (역할 분담 완벽)" };
  return { pct: 5, label: "팀워크 버프! 공격력·HP +5%" };
}

/* ================= 16. 조각 상점 (피규어 조각 교환) ================= */

export type ShardShopItem = { id: string; name: string; desc: string; cost: number; grant: string };

export const SHARD_SHOP: ShardShopItem[] = [
  { id: "sh_ticket", name: "뽑기권", desc: "피규어 가챠 1회", cost: 30, grant: "ticket" },
  { id: "sh_badge", name: "무작위 배지", desc: "미보유 배지 1개 랜덤", cost: 60, grant: "badge" },
  { id: "sh_skin", name: "차원 여행자 스킨", desc: "cos_isekai 치장 (공+10 HP+120)", cost: 90, grant: "cos_isekai" },
  { id: "sh_skin2", name: "픽셀 히어로 스킨", desc: "cos_pixel 치장 (공+6 크리+2)", cost: 90, grant: "cos_pixel" },
  { id: "sh_rune", name: "무작위 룬(T1)", desc: "4속성 중 랜덤 1성 룬", cost: 15, grant: "rune" },
  { id: "sh_tier", name: "등급업 큐브", desc: "장착 장비 티어 승급", cost: 120, grant: "tier_cube" },
];

/* ================= 17. 오프라인 보상 / 경험치 책 ================= */

/** 오프라인 시간당 골드 (레벨 스케일), 최대 12시간, 30분 미만 미지급 */
export function offlineReward(elapsedMs: number, lv: number): { gold: number; exp: number; hours: number } {
  const hours = Math.min(12, elapsedMs / 3600000);
  if (hours < 0.5) return { gold: 0, exp: 0, hours: 0 };
  const gold = Math.round((600 + lv * 90) * hours);
  const exp = Math.round(lv * 60 * hours);
  return { gold, exp, hours };
}

/** 경험치 책 1권 — 레벨 스케일 경험치 */
export function expBookExp(lv: number): number {
  return Math.round(80 + lv * 45);
}
