/**
 * vc236 — 정예 어픽스(elite affix) 순수 코어
 *
 * 왜 뽑았나
 *   지금 정예는 `hp × 7.5 / atk × 1.5` + 이름 접두어뿐이라 **행동 변화가 전혀 없다**.
 *   그래서 "정예"는 그냥 "체력 많은 잡몹"이고, 어픽스가 붙어도 그 차이는 HUD 글자로만 존재한다.
 *   어픽스별 수치(반사 %, 폭발 %, 재생 %)를 스폰/전투 코드에 직접 박아 넣으면
 *   밸런스 상한을 아무도 검증할 수 없고, 한 곳만 고치면 조용히 갈라진다.
 *   계산 부분만 여기로 모아 **경계값과 상한을 고정**한다.
 *   WorldScene 은 이 함수를 호출하고, 파티클/연출/배너는 WorldScene 에 남긴다.
 *
 * 무엇
 *   정예 1기 = 어픽스 0~3개. 각 어픽스는 `{ key, magnitude }` 로 굴린다(magnitude 는 개체별 강도).
 *   여기서는 (1) 정의 테이블, (2) 시드 주입형 굴림, (3) 어픽스별 배율/피해 계산만 제공한다.
 *
 * 이 파일이 지켜야 하는 계약
 *   · 순수 함수만. Phaser/DOM import 금지, `Math.random` 직접 호출 금지 — rng 는 **주입**받는다.
 *     (같은 시드 → 같은 어픽스. 리플레이·버그재현·멀티 동기화가 이 성질에 기댄다.)
 *   · 기존 정예 배율(hp×7.5, atk×1.5)을 **대체하지 않는다**. affixHpMult/affixAtkMult 는
 *     그 위에 **추가로 곱하는** 값이다(0개면 정확히 1.0 → 어픽스 없는 정예는 종전과 동일).
 *   · 반사·폭발은 플레이어를 즉사시키지 않는다: 반사 ≤ 단일 피해의 8%, 폭발 ≤ 플레이어 최대HP의 12%.
 *   · 재생은 정예 자신의 최대HP 대비 초당 2% 를 넘지 않는다.
 *   · 모든 상한은 `Math.min` 클램프로 **구조적으로** 보장한다 — 굴림이 이상해도 상한을 넘을 수 없다.
 *
 * 좌표계(어떤 maxHp 를 넘기는가) — 여기서 헷갈리면 밸런스가 뒤집힌다
 *   · volatileDamage(..., maxHp)  → **피해를 받는 쪽(플레이어)의 최대HP**. 12% 캡의 기준이다.
 *   · regenPerTick(..., maxHp)    → **정예 자신의 최대HP**. 2%/s 캡의 기준이다.
 *   · wardedShield(..., maxHp)    → **정예 자신의 최대HP**. 실드는 자기 체력 기준이다.
 */

/** 정예가 가질 수 있는 어픽스 종류. */
export type EliteAffixKey =
  | "volatile" // 폭발: 사망 시 주변 폭발 피해
  | "warded" // 보호막: HP 50% 이하에서 1회 실드
  | "swift" // 가속: HP 낮을수록 이속 증가
  | "thorned" // 반사: 피격 시 공격자에게 소량 피해
  | "regenerating" // 재생: 초당 HP 회복
  | "splitting"; // 분열: 사망 시 하위 개체 2기

/** 어픽스 정의. 표시용 문자열은 HUD 가 그대로 쓴다(여기서 색/이름을 만들지 않는다). */
export type EliteAffixDef = {
  key: EliteAffixKey;
  /** 한국어 표시명 — HUD/배너 공용 */
  name: string;
  /** 한국어 한 줄 설명 */
  desc: string;
  /** 0xRRGGBB 문자열. 정예 오라/이름 색에 쓴다. */
  color: string;
  /** magnitude 균등분포 구간 [min, max]. 의미는 어픽스마다 다르다(아래 표 참조). */
  magnitudeRange: readonly [number, number];
  /** 가중치 있는 비복원 추출용. 0 이면 절대 뽑히지 않는다. */
  weight: number;
};

/** 굴림 결과 1건. 어픽스 정의는 ELITE_AFFIXES[key] 로 찾는다. */
export type EliteAffixRoll = { key: EliteAffixKey; magnitude: number };

/* ────────────────────────── 상한/고정 계수 ────────────────────────── */

/** 반사 상한 — 단일 피해의 8% 를 넘길 수 없다. (플레이어 즉사 방지) */
export const THORN_MAX_PCT = 0.08;
/** 폭발 상한 — 플레이어 최대HP의 12% 를 넘길 수 없다. (플레이어 즉사 방지) */
export const VOLATILE_MAX_PCT = 0.12;
/** 재생 상한 — 정예 최대HP의 초당 2%. */
export const REGEN_MAX_PCT_PER_SEC = 0.02;
/** 보호막 실드량 — 정예 최대HP의 30%. 굴림과 무관한 고정값. */
export const WARDED_SHIELD_PCT = 0.3;
/** 보호막 발동 임계 — HP 가 이 비율 이하가 되면 1회 발동. */
export const WARDED_TRIGGER_HP01 = 0.5;
/** 가속 상한 — HP 0 일 때의 최대 이속 가산(0.40 = 1.4배). */
export const SWIFT_MAX_BONUS = 0.4;
/** 분열 시 생성되는 하위 개체 수 — 0 또는 이 값. */
export const SPLIT_SPAWN = 2;

/**
 * 어픽스 개수별 HP 배수. **기존 정예 배율 위에 곱하는 추가 부담**이다(대체 아님).
 *  1개 1.15 / 2개 1.35 / 3개 1.58 — 개수만 늘고 각 어픽스가 약해지지 않게 완만한 지수.
 *  인덱스를 넘는 개수(최대 6)는 마지막 값으로 클램프한다.
 */
export const AFFIX_HP_MULT: readonly number[] = [1.0, 1.15, 1.35, 1.58];
/** 어픽스 개수별 공격력 배수. HP 보다 완만하게 — 어픽스는 "행동 변화"가 본체다. */
export const AFFIX_ATK_MULT: readonly number[] = [1.0, 1.1, 1.22, 1.36];

/** 뽑을 수 있는 어픽스 종류의 고정 순서 — 굴림 결정론의 기준열. */
export const ELITE_AFFIX_KEYS: readonly EliteAffixKey[] = [
  "volatile",
  "warded",
  "swift",
  "thorned",
  "regenerating",
  "splitting",
];

/**
 * 정예 어픽스 정의 테이블.
 *
 * magnitude 의미(함수마다 다르다 — 위 좌표계 주석과 함께 읽어라)
 *   volatile      폭발 피해 = 대상 최대HP × magnitude          [0.06, 0.12]
 *   warded        실드량   = 자신 최대HP × magnitude(고정 0.30)  [0.30, 0.30]
 *   swift         HP 0 일 때 이속 가산 = magnitude               [0.15, 0.40]
 *   thorned       반사율   = 단일 피해 × magnitude               [0.03, 0.08]
 *   regenerating  초당 회복률 = magnitude                        [0.008, 0.020]
 *   splitting     자식 계승 비율(HP/ATK) = magnitude             [0.35, 0.55]
 *
 * warded 의 범위가 0 폭인 이유
 *   실드량이 굴림으로 흔들리면 "운 좋은 정예가 40% 실드" 같은 스파이크가 생긴다.
 *   보호막은 문턱(언제 발동하는가)만 개체차를 두고, **량은 고정**한다.
 *   그래서 wardedShield() 가 magnitude 인자를 받지 않아도 정의와 어긋나지 않는다.
 */
export const ELITE_AFFIXES: Record<EliteAffixKey, EliteAffixDef> = {
  volatile: {
    key: "volatile",
    name: "폭발",
    desc: "죽을 때 주변에 폭발을 일으킨다",
    color: "#ff7a3c",
    magnitudeRange: [0.06, 0.12],
    weight: 1.0,
  },
  warded: {
    key: "warded",
    name: "보호막",
    desc: "HP 50% 이하가 되면 한 번 보호막을 두른다",
    color: "#6fd3ff",
    magnitudeRange: [0.3, 0.3],
    weight: 1.1,
  },
  swift: {
    key: "swift",
    name: "가속",
    desc: "체력이 낮을수록 빠르게 움직인다",
    color: "#b8ff6a",
    magnitudeRange: [0.15, 0.4],
    weight: 0.9,
  },
  thorned: {
    key: "thorned",
    name: "반사",
    desc: "맞을 때 공격자에게 피해를 되돌려준다",
    color: "#e0559a",
    magnitudeRange: [0.03, 0.08],
    weight: 1.0,
  },
  regenerating: {
    key: "regenerating",
    name: "재생",
    desc: "매초 체력을 회복한다",
    color: "#6cf0a8",
    magnitudeRange: [0.008, 0.02],
    weight: 1.0,
  },
  splitting: {
    key: "splitting",
    name: "분열",
    desc: "죽을 때 작은 개체 두 마리로 갈라진다",
    color: "#c9a6ff",
    magnitudeRange: [0.35, 0.55],
    // ponytail: 분열은 강력해서 가장 낮은 가중치. 2기 동시 스폰은 스폰 상한(20)을
    //  순간적으로 넘길 수 있으니 WorldScene 이 개체 수를 확인하고 부른다.
    weight: 0.7,
  },
};

/* ────────────────────────── 내부 헬퍼 ────────────────────────── */

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : Number.isFinite(v) ? v : lo;

const clamp01 = (v: number): number => clamp(v, 0, 1);

/* ────────────────────────── 굴림 ────────────────────────── */

/**
 * 어픽스를 중복 없이 가중치 추출한다.
 *
 * @param rng        [0,1) 을 돌려주는 시드 함수. `DeterministicRandom#next` 를 그대로 넣는다.
 *                   **`Math.random` 을 직접 쓰지 않는다** — 시드가 같으면 결과가 비트 단위로 같아야 한다.
 * @param maxCount   뽑는 개수(기본 2). 챕터가 난이도 곡선으로 1~3 을 넘긴다.
 *                   0 이면 빈 배열, 6(전체 종류 수)을 넘으면 6 으로 클램프한다.
 *
 * 계약
 *   · 반환 배열은 **중복 키가 없다**(비복원 추출). 길이는 클램프된 maxCount 와 정확히 같다.
 *   · 뽑히는 순서는 "뽑힌 순서"다 — describeAffixes/HUD 는 이 순서를 그대로 쓴다.
 *   · 각 원소의 magnitude 는 magnitudeRange 안의 균등분포다(범위가 0 폭이면 고정값).
 *   · rng 가 NaN/음수/1 이상을 돌려줘도 던지지 않는다(방어적으로 0/끝으로 스냅).
 */
export function rollEliteAffixes(rng: () => number, maxCount: number = 2): EliteAffixRoll[] {
  const want = Math.max(0, Math.min(Math.floor(maxCount) || 0, ELITE_AFFIX_KEYS.length));
  if (want === 0) return [];

  /* 후보 풀 — 무게 0 은 뽑히지 않는다. splice 로 비복원 추출한다. */
  const pool = ELITE_AFFIX_KEYS.map((key) => ({
    key,
    weight: Math.max(0, ELITE_AFFIXES[key].weight),
  }));

  const out: EliteAffixRoll[] = [];
  for (let n = 0; n < want; n++) {
    let total = 0;
    for (const p of pool) total += p.weight;
    if (total <= 0) break; // 무게가 전부 0 이면 더 뽑을 수 없다

    let r = rng() * total;
    if (!(r >= 0)) r = 0; // NaN / 음수 방어

    /* 누적 무게 구간 탐색. r 이 끝까지 안 걸리면 마지막 후보로 떨어진다. */
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].weight;
      if (r < 0) {
        idx = i;
        break;
      }
    }

    const picked = pool.splice(idx, 1)[0];
    const [lo, hi] = ELITE_AFFIXES[picked.key].magnitudeRange;
    out.push({ key: picked.key, magnitude: lo + rng() * (hi - lo) });
  }
  return out;
}

/* ────────────────────────── 배율 ────────────────────────── */

/**
 * 어픽스 개수에 따른 HP 배수(추가 곱).
 * 기존 정예 배율을 **대체하지 않는다** — 최종 HP = 기본 × 7.5 × affixHpMult(affixes).
 * 중복 키는 세지 않는다(방어적): 잘못 들어와도 배수가 부풀지 않는다.
 */
export function affixHpMult(affixes: readonly EliteAffixRoll[]): number {
  const n = new Set(affixes.map((a) => a.key)).size;
  return AFFIX_HP_MULT[Math.min(n, AFFIX_HP_MULT.length - 1)];
}

/** 어픽스 개수에 따른 공격력 배수(추가 곱). affixHpMult 와 동일 규칙. */
export function affixAtkMult(affixes: readonly EliteAffixRoll[]): number {
  const n = new Set(affixes.map((a) => a.key)).size;
  return AFFIX_ATK_MULT[Math.min(n, AFFIX_ATK_MULT.length - 1)];
}

/**
 * 가속 이속 배율. swift 가 없으면 1(종전과 동일).
 *
 * @param hp01      현재 HP 비율 0~1. 낮을수록 빠르다.
 * @param magnitude 개체 굴림값(최대 가산). 상한 SWIFT_MAX_BONUS 로 클램프한다.
 *
 * 결과: 1 + magnitude × (1 - hp01) → HP 만땅 1.0, HP 0 에서 최대 1.4.
 * 긴장 구간을 "도망칠 수 없게" 만들지 않으려고 상한을 1.4 로 잡았다.
 */
export function swiftSpeedMult(
  affixes: readonly EliteAffixRoll[],
  hp01: number,
  magnitude: number,
): number {
  if (!hasAffix(affixes, "swift")) return 1;
  const m = clamp(magnitude, 0, SWIFT_MAX_BONUS);
  return 1 + m * (1 - clamp01(hp01));
}

/**
 * 반사 피해량(정수, 최소 0). thorned 가 없으면 0.
 *
 * @param magnitude   개체 굴림값(반사율). THORN_MAX_PCT 로 클램프.
 * @param damageDealt 플레이어가 정예에게 **실제로 넣은** 피해(방어 감산 후).
 *
 * 계약: 결과 ≤ floor(damageDealt × 0.08). 굴림이 범위를 벗어나도 8% 를 넘지 못한다.
 * 한 방에 많이 넣을수록 반사도 커지지만 비율이라 고티어 스킬 한 방으로 죽지는 않는다.
 */
export function thornReflect(
  affixes: readonly EliteAffixRoll[],
  magnitude: number,
  damageDealt: number,
): number {
  if (!hasAffix(affixes, "thorned")) return 0;
  const dmg = Math.max(0, damageDealt);
  const rate = clamp(magnitude, 0, THORN_MAX_PCT);
  const cap = Math.floor(dmg * THORN_MAX_PCT);
  return Math.max(0, Math.min(Math.round(dmg * rate), cap));
}

/**
 * 재생량(HP, 소수). regenerating 이 없으면 0.
 *
 * @param maxHp 정예 **자신의** 최대HP (2%/s 캡의 기준).
 * @param dtMs  틱 간격(ms). 1000 을 넣으면 초당 회복량이 나온다.
 *
 * 계약: 결과 ≤ maxHp × 0.02 × (dtMs/1000).
 * 반올림하지 않는다 — 16ms 틱에서 1 미만이 0 으로 깎이면 재생이 아예 사라진다.
 * 누적은 호출자(Enemy.hp)가 실수로 들고 있다가 표시할 때만 round 한다.
 */
export function regenPerTick(
  affixes: readonly EliteAffixRoll[],
  magnitude: number,
  maxHp: number,
  dtMs: number,
): number {
  if (!hasAffix(affixes, "regenerating")) return 0;
  const hp = Math.max(0, maxHp);
  const dt = Math.max(0, dtMs) / 1000;
  const perSec = clamp(magnitude, 0, REGEN_MAX_PCT_PER_SEC);
  /* 상한을 한 번 더 명시 — perSec 클램프와 무관하게 2%/s 를 넘지 못한다. */
  return Math.min(hp * perSec * dt, hp * REGEN_MAX_PCT_PER_SEC * dt);
}

/**
 * 보호막 실드량(HP). warded 가 없으면 0 (= 실드 없음).
 *
 * magnitude 인자를 받지 않는 이유: 실드량은 WARDED_SHIELD_PCT(0.30) **고정**이다
 * (ELITE_AFFIXES.warded.magnitudeRange 가 0 폭인 것과 같은 이유).
 * 개체차는 "언제 발동하는가"(WARDED_TRIGGER_HP01)로만 준다.
 */
export function wardedShield(affixes: readonly EliteAffixRoll[], maxHp: number): number {
  if (!hasAffix(affixes, "warded")) return 0;
  return Math.max(0, maxHp) * WARDED_SHIELD_PCT;
}

/**
 * 사망 폭발 피해량(정수). volatile 이 없으면 0.
 *
 * @param maxHp **피해를 받는 쪽(플레이어)의** 최대HP — 12% 캡의 기준이다.
 *              정예 자신의 HP 를 넣으면 안 된다(정예 HP 는 7.5배라 캡이 무의미해진다).
 *
 * 계약: 결과 ≤ floor(플레이어 최대HP × 0.12).
 */
export function volatileDamage(
  affixes: readonly EliteAffixRoll[],
  magnitude: number,
  maxHp: number,
): number {
  if (!hasAffix(affixes, "volatile")) return 0;
  const hp = Math.max(0, maxHp);
  const pct = clamp(magnitude, 0, VOLATILE_MAX_PCT);
  const cap = Math.floor(hp * VOLATILE_MAX_PCT);
  return Math.max(0, Math.min(Math.round(hp * pct), cap));
}

/**
 * 분열로 생성할 하위 개체 수 — 0 또는 2.
 *
 * ponytail: 자식은 어픽스를 물려받지 않는다(무한 분열 방지). 자식 스케일은
 *  splitted 개체의 magnitude(ELITE_AFFIXES.splitting.magnitudeRange)를 그대로 쓴다.
 */
export function splitSpawnCount(affixes: readonly EliteAffixRoll[]): number {
  return hasAffix(affixes, "splitting") ? SPLIT_SPAWN : 0;
}

/* ────────────────────────── 표시 ────────────────────────── */

/** 해당 어픽스를 갖고 있는가. 모든 계산 함수의 유일한 게이트. */
export function hasAffix(affixes: readonly EliteAffixRoll[], key: EliteAffixKey): boolean {
  for (const a of affixes) if (a.key === key) return true;
  return false;
}

/**
 * HUD 표시용 문자열 — "폭발 · 재생". 어픽스가 없으면 빈 문자열(빈 배지를 그리지 않게).
 * 순서는 굴린 순서를 유지하고, 중복 키는 한 번만 적는다.
 */
export function describeAffixes(affixes: readonly EliteAffixRoll[]): string {
  const seen = new Set<EliteAffixKey>();
  const names: string[] = [];
  for (const a of affixes) {
    if (seen.has(a.key)) continue;
    seen.add(a.key);
    const def = ELITE_AFFIXES[a.key];
    if (def) names.push(def.name);
  }
  return names.join(" · ");
}
