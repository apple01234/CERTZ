/**
 * skillEvolution.ts — vc252 P5: 전직별 스킬 진화 데이터
 *
 * [유저 요구 원문]
 *  "n차 전직에서 (n+1)차 전직으로 넘어갈 때 보유한 모든 직업 스킬이 반드시
 *   강화되거나 새로운 상위 스킬로 교체되어야 한다.
 *   단순 공격력 증가만으로 전직을 처리하지 않는다."
 *
 * [왜 이 파일이 필요한가 — P0 실측]
 *  `classes.ts` 의 `resolveSkill1Of` / `resolveSkill2Of` 는 부모 체인을 거슬러 올라가며
 *  **첫 히트를 그대로 쓴다.** 그래서 3차 `eagleeye` 는 2차 `sniper` 와 똑같이 `"snipe"` 를,
 *  4차 `arclord` 는 `"arcbolt"` 를 실행한다. 이름·직업만 바뀌고 **메커니즘은 동일**하다.
 *  실측(35직업, Z/C 비교가능 60슬롯 기준): **28개(46.7%)가 부모와 같은 skillKind** 였다.
 *
 *  이 파일은 그 위에 "무엇이 실제로 달라지는가"를 **명시적 데이터**로 얹는다.
 *  기존 테이블(SKILL1_KIND 등)은 **대체하지 않는다** — 읽기 전용으로 참조만 한다.
 *
 * [중복 곱 금지]
 *  `Player.sTier` 는 이미 배율/반경/쿨다운을 올린다:
 *    · 쿨다운: `1 - 0.08*(sTier-1)` (1차 ×1.00 … 5차 ×0.68) — `skill1MaxEff`
 *    · 피해  : 각 `skill1*()` 안에서 `rollDamage(2.4 + 0.4*t, …)` 처럼 t 를 직접 곱한다
 *  따라서 이 파일의 `damageMultiplier` 는 **표시·검증용 계수**이며 런타임 피해에
 *  다시 곱하지 않는다. 실제 진화는 `Player` 의 `evolved*()` 헬퍼가
 *  **개수·범위·관통·부가효과** 같은 이산적(discrete) 값만 바꾼다.
 *
 * ponytail: 지금은 Z(주력기) 12슬롯만 실제 진화한다. C/V/B 로 넓히려면
 *  `EVOLVED_SLOTS` 에 슬롯을 추가하고 `Player.evolvedCount/evolvedRange` 를 쓰면 된다.
 */

export type EvoSlot = "z" | "c" | "v" | "b";

/** 한 직업·슬롯의 진화 정의. 모두 **파생값** — 세이브에 저장하지 않는다. */
export type SkillEvolution = {
  /** 예: "eagleeye:z" */
  skillId: string;
  /** `classes.ts` ClassKey */
  jobId: string;
  tier: number;
  /** 이전 차수의 같은 슬롯 skillId (부모가 있으면 항상 채운다) */
  evolvesFrom?: string;
  /** 같은 차수 안에서 대체 관계 (예: raider 가 pirate 의 Z 를 대체) */
  replacesSkillId?: string;
  /** 표시·검증용 피해 계수. **런타임 피해에 다시 곱하지 않는다** (위 주석 참조) */
  damageMultiplier: number;
  /** 쿨다운(ms). `Player.skill1MaxEff` 사다리와 같은 값 — 중복 적용 금지 */
  cooldownMs: number;
  /** 대표 이펙트 에셋 키 (연출 매칭용, 미로드면 무시됨) */
  effectAssetKey: string;
  /** ★실제로 달라지는 것들 — 이게 비어 있으면 "이름만 바뀐 승계"다. */
  changes: string[];
};

/* ─────────────────────────────────────────────────────────────────────────
 * 1) 부모 체인 — classes.ts 를 import 하지 않고 최소 정보만 복제한다.
 *    (Phaser·classes 의존 없는 순수 데이터 모듈로 유지 → 테스트가 가볍다)
 *    classes.ts 의 parent 와 어긋나면 tests/skill-evolution.test.mjs 가 잡는다.
 * ───────────────────────────────────────────────────────────────────────── */
const PARENT: Record<string, string | null> = {
  warrior: null, ranger: null, mage: null, thief: null, pirate: null,
  berserker: "warrior", guardian: "warrior",
  sniper: "ranger", windrunner: "ranger",
  archmage: "mage", sage: "mage",
  assassin: "thief", swashbuckler: "thief",
  raider: "pirate", corsair: "pirate",
  warlord: "berserker", paladin: "guardian",
  eagleeye: "sniper", tempest: "windrunner",
  stormbringer: "archmage", chronicle: "sage",
  nightblade: "assassin", duelist: "swashbuckler",
  stormcaptain: "raider", powdermaster: "raider",
  warbringer: "warlord", crusader: "paladin",
  deadeye: "eagleeye", skylord: "tempest",
  arclord: "stormbringer", eternal: "chronicle",
  shadowlord: "nightblade", blademaster: "duelist",
  seaking: "stormcaptain", dreadnought: "powdermaster",
};

const TIER: Record<string, number> = {
  warrior: 1, ranger: 1, mage: 1, thief: 1, pirate: 1,
  berserker: 2, guardian: 2, sniper: 2, windrunner: 2, archmage: 2, sage: 2,
  assassin: 2, swashbuckler: 2, raider: 2, corsair: 2,
  warlord: 3, paladin: 3, eagleeye: 3, tempest: 3, stormbringer: 3,
  chronicle: 3, nightblade: 3, duelist: 3, stormcaptain: 3, powdermaster: 3,
  warbringer: 4, crusader: 4, deadeye: 4, skylord: 4, arclord: 4,
  eternal: 4, shadowlord: 4, blademaster: 4, seaking: 4, dreadnought: 4,
};

/** `Player.sTier` 쿨다운 사다리와 동일 — 중복 곱 방지를 위해 값만 기록한다. */
function tierCooldownMs(baseMs: number, tier: number): number {
  const cd = Math.max(0.68, 1 - 0.08 * Math.max(0, tier - 1));
  return Math.round(baseMs * cd);
}

/** 표시용 피해 계수 — `rollDamage(a + b*t)` 사다리와 같은 기울기. */
function tierDamageMul(base: number, perTier: number, tier: number): number {
  return Number((base + perTier * tier).toFixed(2));
}

/* ─────────────────────────────────────────────────────────────────────────
 * 2) 실제 진화 정의 — **Z 슬롯 12개** (부모와 skillKind 가 같아 승계로 보이던 것들)
 *
 *    `changes` 는 "이 직업에서 실제로 달라지는 것"만 적는다. 비어 있으면
 *    진화로 치지 않고 테스트가 실패한다.
 * ───────────────────────────────────────────────────────────────────────── */

/** 기본 Z 쿨다운/피해 — `Player` 의 skill1 기본값과 맞춘다(검증은 테스트가 한다). */
const Z_BASE_CD = 1200;
const Z_BASE_DMG = 2.4;

type EvoSeed = {
  jobId: string;
  changes: string[];
  effectAssetKey: string;
  /** 이 직업이 실제로 쓰는 상위 메커니즘 (참고 표기) */
  note?: string;
};

/**
 * Z 슬롯 실제 진화 대상 — 1단계 실측에서 "부모와 동일 skillKind" 로 나온 12개.
 * 3단계에서 `Player.ts` 의 `evolvedCount/evolvedRange/evolvedPierce` 가 이 목록을 보고 분기한다.
 */
const Z_EVOLVED: EvoSeed[] = [
  /* ── 궁수 계열 ── */
  { jobId: "eagleeye", effectAssetKey: "vfx_crit", changes: ["pierce", "range"], note: "매안 — 관통 2회 + 사거리 +20%" },
  { jobId: "deadeye", effectAssetKey: "vfx_bolt2", changes: ["pierce", "range", "multiHit"], note: "사신 — 관통 무제한 + 사거리 +40% + 2연발" },
  { jobId: "tempest", effectAssetKey: "vfx_cl1", changes: ["count", "range"], note: "폭풍 — 화살 2발 + 유도 반경 확대" },
  /* ── 마법 계열 ── */
  { jobId: "stormbringer", effectAssetKey: "gvb_lightning_blue", changes: ["count", "range"], note: "뇌전 — 볼트 2발 + 폭발 반경 확대" },
  { jobId: "arclord", effectAssetKey: "vfx_crystal", changes: ["count", "pierce"], note: "아크 — 볼트 2발 + 관통" },
  { jobId: "chronicle", effectAssetKey: "vfx_hex", changes: ["count", "extraHit"], note: "기록 — 정화 2연 + 추가타" },
  { jobId: "eternal", effectAssetKey: "vfx_twinkle", changes: ["count", "extraHit", "range"], note: "영원 — 정화 3연 + 추가타" },
  /* ── 도적 계열 ── */
  { jobId: "nightblade", effectAssetKey: "vfx_is2", changes: ["count", "range"], note: "야습 — 대상 3 + 사거리 +30%" },
  { jobId: "shadowlord", effectAssetKey: "gvu_trail_ghost", changes: ["count", "range", "extraHit"], note: "그림자 군주 — 대상 4 + 추가타" },
  { jobId: "duelist", effectAssetKey: "vfx_slash_turn", changes: ["hits", "range"], note: "결투 — 난무 횟수 +2 + 사거리" },
  { jobId: "blademaster", effectAssetKey: "vfx_arc", changes: ["hits", "range", "extraHit"], note: "검무 — 난무 +3 + 추가타" },
  /* ── 해적 계열 ── */
  { jobId: "raider", effectAssetKey: "mg_slash0", changes: ["count", "range"], note: "레이더 — 포격 2발 + 범위" },
];

/** 1차/2차 기준 슬롯도 넣는다 (evolvesFrom 체인을 끊기지 않게). */
const Z_ROOTS = ["warrior", "ranger", "mage", "thief", "pirate"];
const Z_TIER2 = [
  "berserker", "guardian", "sniper", "windrunner", "archmage", "sage",
  "assassin", "swashbuckler", "raider", "corsair",
];

function mkZ(jobId: string): SkillEvolution {
  const tier = TIER[jobId] ?? 1;
  const parent = PARENT[jobId] ?? null;
  const seed = Z_EVOLVED.find((s) => s.jobId === jobId);
  return {
    skillId: `${jobId}:z`,
    jobId,
    tier,
    evolvesFrom: parent ? `${parent}:z` : undefined,
    replacesSkillId: jobId === "raider" ? "pirate:z" : undefined,
    damageMultiplier: tierDamageMul(Z_BASE_DMG, 0.4, tier),
    cooldownMs: tierCooldownMs(Z_BASE_CD, tier),
    effectAssetKey: seed?.effectAssetKey ?? "vfx_slash",
    changes: seed?.changes ?? [],
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 * 3) C/V/B 슬롯 — 데이터만 등록(실제 진화는 Z 와 같은 방식으로 확장 가능).
 *    changes 가 비어 있으면 "아직 이름만 바뀐 승계" 라는 뜻이고,
 *    `evolutionDelta()` 가 그 사실을 그대로 보고한다(거짓으로 채우지 않는다).
 * ───────────────────────────────────────────────────────────────────────── */
const C_EVOLVED: Record<string, string[]> = {
  raider: ["range"],
  powdermaster: ["range", "extraHit"],
  seaking: ["range", "extraHit"],
  dreadnought: ["range"],
};

function mkC(jobId: string): SkillEvolution {
  const tier = TIER[jobId] ?? 1;
  const parent = PARENT[jobId] ?? null;
  return {
    skillId: `${jobId}:c`,
    jobId,
    tier,
    evolvesFrom: parent ? `${parent}:c` : undefined,
    damageMultiplier: 1,
    cooldownMs: tierCooldownMs(2800, tier),
    effectAssetKey: "vfx_arc",
    changes: C_EVOLVED_V2[jobId] ?? C_EVOLVED[jobId] ?? [],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * vc280 (P5 확장) — C/V/B 슬롯 진화 확대
 *
 * [vc252 상태] Z 12개만 진화. C 는 4개(전부 해적 계열), V/B 는 데이터 0개.
 *  → 유저 요구 "n차 → (n+1)차에서 **보유한 모든** 스킬이 강화되거나 상위로 교체"의
 *    절반도 못 채운 상태였다.
 *
 * [이번 확장] 각 슬롯의 실제 스킬 종류(`SKILL3_KIND`/`SKILL4_KIND`)에 맞춰
 *  **메커니즘이 실제로 달라지는 것**만 `changes` 로 적는다.
 *  · V 는 3차 이상 18직업 전부 존재 → 18개 중 14개를 진화 대상으로
 *  · B 는 4차 10직업 전부 존재 → 10개 전부 진화 대상으로
 *  · C 는 4 → 10개로 확대(전사·궁수·마법·도적 계열 포함)
 *
 * [중요 — 중복 곱 금지] 여기 `changes` 는 **어떤 축이 변하는지**만 표기한다.
 *  실제 수치는 `Player` 의 `evoVCount/evoVRange/...` 가 차수에서 유도한다.
 *  `damageMultiplier` 는 표시·검증용이며 런타임 피해에 다시 곱하지 않는다.
 *
 * [정직성] 변화가 없는 직업(예: 단일 대상 즉발기라 개수·범위 축이 없는 것)은
 *  억지로 채우지 않고 빈 배열로 둔다 — `countUpgraded()` 가 사실대로 센다.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** C 슬롯 진화 확대 — 직업별로 실제 달라지는 축. */
const C_EVOLVED_V2: Record<string, string[]> = {
  /* 해적 계열 (vc252 기존) */
  raider: ["range"],
  powdermaster: ["range", "extraHit"],
  seaking: ["range", "extraHit"],
  dreadnought: ["range"],
  /* vc280 — 전사 계열 */
  berserker: ["range", "count"],     // 광폭 베기 → 다중 타격
  warlord: ["range", "extraHit"],    // 참격 파동 → 추가타
  warbringer: ["range", "count"],
  /* 궁수 계열 */
  sniper: ["pierce", "range"],       // 관통 화살
  eagleeye: ["pierce", "range", "multiHit"],
  deadeye: ["pierce", "range", "multiHit"],
  /* 마법 계열 */
  archmage: ["range", "count"],      // 광역 폭발 + 다중
  stormbringer: ["range", "count"],
  arclord: ["count", "pierce"],
  /* 도적 계열 */
  assassin: ["count", "range"],
  nightblade: ["count", "range", "extraHit"],
  shadowlord: ["count", "range", "extraHit"],
};

/**
 * V 슬롯(3차 이상) 진화 — `SKILL3_KIND` 의 스킬 종류에 맞춘 축.
 * 18직업 중 메커니즘 축이 실제로 있는 14개를 등록한다.
 */
const V_EVOLVED: Record<string, string[]> = {
  /* 전사 */
  warlord: ["range", "duration"],       // 함성 — 범위·지속
  warbringer: ["range", "duration"],    // 혈노 — 범위·지속
  paladin: ["range", "duration"],       // 성역 — 반경·지속
  crusader: ["range", "count"],         // 신성노바 — 반경·타격
  /* 궁수 */
  eagleeye: ["pierce", "range"],        // 관통 사격
  deadeye: ["count", "range"],          // 화살비
  tempest: ["count", "range"],          // 회오리
  skylord: ["count", "range"],          // 선풍
  /* 마법 */
  stormbringer: ["range", "count"],     // 뇌격
  arclord: ["pierce", "count"],         // 연쇄 번개
  chronicle: ["duration", "range"],     // 시간 왜곡
  eternal: ["range", "count"],          // 중력
  /* 도적 */
  nightblade: ["count", "range"],       // 그림자 칼날
  shadowlord: ["count", "range", "extraHit"], // 그림자 지뢰
  duelist: ["hits", "range"],           // 난무
  blademaster: ["hits", "range", "extraHit"], // 검기 오라
  /* 해적 */
  stormcaptain: ["count", "range"],     // 폭풍 소환
  powdermaster: ["range", "count"],     // 지뢰밭
  seaking: ["range", "duration"],       // 해일
  dreadnought: ["count", "range"],      // 전탄
};

/**
 * B 슬롯(4차) 진화 — `SKILL4_KIND` 10직업 전부.
 * 4차 궁극기는 이미 강력하므로 **범위·횟수·지속** 위주로만 올린다(피해는 rollDamage 담당).
 */
const B_EVOLVED: Record<string, string[]> = {
  warbringer: ["range", "duration"],    // 종말
  crusader: ["range", "count"],         // 심판
  deadeye: ["count", "range"],          // 신의 화살
  skylord: ["count", "range"],          // 천공 폭풍
  arclord: ["pierce", "count"],         // 마나 폭발
  eternal: ["duration", "range"],       // 영원 회귀
  shadowlord: ["count", "duration"],    // 그림자 분신
  blademaster: ["hits", "range"],       // 검무
  seaking: ["range", "duration"],       // 대소용돌이
  dreadnought: ["count", "range"],      // 갑판 쓸기
};

/** V/B 는 3·4차 전용 슬롯이라 3차 이상만 등록한다. */
function mkSlot(jobId: string, slot: "v" | "b"): SkillEvolution | null {
  const tier = TIER[jobId] ?? 1;
  if (slot === "v" && tier < 3) return null;
  if (slot === "b" && tier < 4) return null;
  const parent = PARENT[jobId] ?? null;
  /* V/B 는 3·4차에서 처음 생기는 슬롯 — 부모에 같은 슬롯이 없으면 evolvesFrom 도 없다. */
  const parentTier = parent ? (TIER[parent] ?? 1) : 0;
  const hasSameSlotInParent = slot === "v" ? parentTier >= 3 : parentTier >= 4;
  return {
    skillId: `${jobId}:${slot}`,
    jobId,
    tier,
    evolvesFrom: hasSameSlotInParent ? `${parent}:${slot}` : undefined,
    damageMultiplier: 1,
    cooldownMs: tierCooldownMs(slot === "v" ? 6000 : 12000, tier),
    effectAssetKey: slot === "v" ? "vfx_ring3" : "vfx_explosion",
    /* vc280 — 슬롯별 진화 축. 새 슬롯(V/B)은 그 자체가 진화지만(evolutionDelta 의
     *  newSlot), 차수 간 차이는 changes 로 명시해야 "이름만 바뀐 승계"를 면한다. */
    changes: (slot === "v" ? V_EVOLVED[jobId] : B_EVOLVED[jobId]) ?? [],
  };
}

const JOBS = Object.keys(TIER);

export const SKILL_EVOLUTIONS: SkillEvolution[] = [
  ...JOBS.map(mkZ),
  ...JOBS.map(mkC),
  ...JOBS.map((j) => mkSlot(j, "v")).filter((x): x is SkillEvolution => x !== null),
  ...JOBS.map((j) => mkSlot(j, "b")).filter((x): x is SkillEvolution => x !== null),
];

/* ─────────────────────────────────────────────────────────────────────────
 * 4) 조회 헬퍼
 * ───────────────────────────────────────────────────────────────────────── */

const BY_ID = new Map(SKILL_EVOLUTIONS.map((e) => [e.skillId, e]));

export function evolutionOf(jobId: string, slot: EvoSlot): SkillEvolution | undefined {
  return BY_ID.get(`${jobId}:${slot}`);
}

/**
 * 특정 직업·슬롯이 부모 대비 **실제로 무엇이 달라졌는지** 요약한다.
 *
 * `changed` 가 비어 있으면 "이름만 바뀐 승계" — 유저 요구를 충족하지 못한 상태다.
 * 거짓으로 채우지 않고 사실대로 보고한다.
 */
export function evolutionDelta(
  jobId: string,
  slot: EvoSlot,
): { changed: string[]; parentJob: string | null; upgraded: boolean } {
  const me = evolutionOf(jobId, slot);
  const parentJob = PARENT[jobId] ?? null;
  if (!me) return { changed: [], parentJob, upgraded: false };
  const parentEvo = parentJob ? evolutionOf(parentJob, slot) : undefined;
  const changed = [...me.changes];
  /* 부모에 없던 슬롯이면(V/B 신규) 그 자체가 진화다. */
  if (parentJob && !parentEvo) changed.push("newSlot");
  return { changed, parentJob, upgraded: changed.length > 0 };
}

/** 실제로 진화하는(변화가 1개 이상인) 슬롯 수 — 테스트·보고용. */
export function countUpgraded(slot?: EvoSlot): number {
  const list = slot ? SKILL_EVOLUTIONS.filter((e) => e.skillId.endsWith(`:${slot}`)) : SKILL_EVOLUTIONS;
  return list.filter((e) => e.changes.length > 0).length;
}

/** 3단계 실행부가 참조하는 목록 — Z 슬롯에서 실제로 분기할 직업. */
export const Z_EVOLVED_JOBS: ReadonlySet<string> = new Set(Z_EVOLVED.map((s) => s.jobId));

/** 이 직업의 Z 슬롯이 실제 진화 대상인가. */
export function isZEvolved(jobId?: string | null): boolean {
  return !!jobId && Z_EVOLVED_JOBS.has(jobId);
}

/** C 슬롯 실제 진화 대상 — `Player.evoCount/evoRange` 가 슬롯별로 다르게 봐야 한다. */
export const C_EVOLVED_JOBS: ReadonlySet<string> = new Set(Object.keys(C_EVOLVED_V2));

/** 이 직업의 C 슬롯이 실제 진화 대상인가. */
export function isCEvolved(jobId?: string | null): boolean {
  return !!jobId && C_EVOLVED_JOBS.has(jobId);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * vc280 — V/B 슬롯 진화 조회 (P5 확장)
 * ═══════════════════════════════════════════════════════════════════════════ */

/** V 슬롯 실제 진화 대상 — 3차 이상 직업 중 `V_EVOLVED` 에 등록된 것. */
export const V_EVOLVED_JOBS: ReadonlySet<string> = new Set(Object.keys(V_EVOLVED));

/** 이 직업의 V 슬롯이 실제 진화 대상인가. */
export function isVEvolved(jobId?: string | null): boolean {
  return !!jobId && V_EVOLVED_JOBS.has(jobId);
}

/** B 슬롯 실제 진화 대상 — 4차 직업 중 `B_EVOLVED` 에 등록된 것. */
export const B_EVOLVED_JOBS: ReadonlySet<string> = new Set(Object.keys(B_EVOLVED));

/** 이 직업의 B 슬롯이 실제 진화 대상인가. */
export function isBEvolved(jobId?: string | null): boolean {
  return !!jobId && B_EVOLVED_JOBS.has(jobId);
}
