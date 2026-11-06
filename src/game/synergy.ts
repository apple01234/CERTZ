/**
 * 시너지 태그 — 같은 태그를 쌓으면 단계별 보너스가 켜지는 로그라이트 성장 코어
 *
 * 왜 뽑았나
 *   지금 CERTZ 의 성장은 전부 **평면**이다. 아이템이든 각인이든 공격력 +n% 를
 *   더할 뿐이라, "무엇을 모았는가"가 "얼마나 모았는가"와 구분되지 않는다.
 *   원본(RunBonuses)은 태그별 컨트롤러 6종으로 이걸 갈랐다.
 *   여기서는 그 컨트롤러들을 흉내내지 않고 **집계 규칙만** 순수 함수로 떼어낸다 —
 *   인벤토리/각인 쪽은 태그 개수만 세어 넘기면 된다.
 *
 * 무엇
 *   · SYNERGY_TAGS — 6태그 × 3단계 (need 2 / 4 / 6)
 *   · activeTier   — 개수 → 활성 단계 (0=없음, 1~3)
 *   · synergyTotals — 모든 태그의 **활성 단계까지** 보너스를 합산
 *   · describeSynergies — HUD 표시용 "화염 2/4 — 공격력 +2%" 문자열
 *
 * 이 파일이 지켜야 하는 계약
 *   · Phaser / DOM / Math.random 의존 없음. 같은 입력이면 언제나 같은 출력.
 *   · 입력 객체를 변형하지 않는다.
 *   · 보너스는 **합산**한다(곱하면 태그가 늘 때마다 지수로 뛴다 — damageModel 의 교훈).
 *   · 상한: atkPct ≤ 0.60, critAdd ≤ 0.20, cdrPct ≤ 0.20.
 *     설계값 자체가 상한 아래지만(0.41 / 0.18 / 0.19), 단계를 나중에 올리는 사람이
 *     밸런스를 깨지 않도록 런타임에서도 자른다.
 */

/** 시너지 태그 키. 문자열 그대로 세이브·로그에 쓸 수 있다. */
export type SynergyTag = "fire" | "frost" | "storm" | "blade" | "guard" | "vitality";

/**
 * 한 단계의 효과. 퍼센트 필드는 전부 **비율**(0.08 = 8%)이고, 표시 문자열은
 * 아래 tier() 팩토리가 숫자에서 직접 만든다 — 설명과 수치가 갈라질 수 없다.
 */
export type SynergyTier = {
  /** 발동에 필요한 태그 개수 */
  need: number;
  desc: string;
  atkPct?: number;
  critAdd?: number;
  defPct?: number;
  hpPct?: number;
  cdrPct?: number;
  elemDmgPct?: number;
};

export type SynergyDef = {
  /** HUD 표시명 */
  name: string;
  /** 태그 색 (hex) */
  color: string;
  tiers: SynergyTier[];
};

export type SynergyTotals = {
  atkPct: number;
  critAdd: number;
  defPct: number;
  hpPct: number;
  cdrPct: number;
  elemDmgPct: number;
};

/** 공격력 총합 상한. 6태그 전부 3단계(0.41)보다 위 — 설계 여유분. */
export const MAX_TOTAL_ATK_PCT = 0.6;
/** 치명타 총합 상한. 기본 크리 위에 더해지므로 20%p 를 넘기지 않는다. */
export const MAX_TOTAL_CRIT_ADD = 0.2;
/** 쿨타임 감소 총합 상한. 20% 를 넘으면 스킬 순환이 무너진다. */
export const MAX_TOTAL_CDR_PCT = 0.2;

/** 0.08 → "8", 0.025 → "2.5" (불필요한 소수점 제거) */
function pct(v: number): string {
  return String(Math.round(v * 1000) / 10);
}

/** 효과 객체 → 한국어 설명 1줄. 값이 0/없음인 항목은 아예 쓰지 않는다. */
function describeTier(t: Omit<SynergyTier, "desc">): string {
  const parts: string[] = [];
  if (t.atkPct) parts.push(`공격력 +${pct(t.atkPct)}%`);
  if (t.critAdd) parts.push(`치명타 +${pct(t.critAdd)}%p`);
  if (t.defPct) parts.push(`방어력 +${pct(t.defPct)}%`);
  if (t.hpPct) parts.push(`최대 체력 +${pct(t.hpPct)}%`);
  if (t.cdrPct) parts.push(`쿨타임 -${pct(t.cdrPct)}%`);
  if (t.elemDmgPct) parts.push(`원소 피해 +${pct(t.elemDmgPct)}%`);
  return parts.join(" · ");
}

/** 단계 정의 — desc 를 수치에서 생성해 둘이 어긋나지 않게 한다. */
function tier(t: Omit<SynergyTier, "desc">): SynergyTier {
  return { ...t, desc: describeTier(t) };
}

/**
 * 태그 정의 (6종 × 3단계, need 2 / 4 / 6).
 *
 * 밸런스 근거 — 6태그를 **전부 6개씩** 모은 극단(모든 3단계 활성)에서:
 *   atkPct 0.12+0.10+0.19            = 0.41  (상한 0.60)
 *   critAdd 0.15+0.03                = 0.18  (상한 0.20)
 *   cdrPct 0.14+0.05                 = 0.19  (상한 0.20)
 *   elemDmgPct 0.33+0.19+0.06        = 0.58
 *   defPct / hpPct 는 상한 없음 — 방어·체력은 죽지 않게 해줄 뿐 템포를 죽이지 않는다.
 *
 * 3단계(need 6)는 각 태그의 **정체성**이 드러나게 짰다:
 *   fire → elemDmgPct, frost → cdrPct, storm → critAdd,
 *   blade → atkPct,   guard → defPct,  vitality → hpPct
 * 즉 6개를 모으면 그 태그의 주력 스탯이 한 번 더 크게 뛴다. 2·4단계는 그 예고편이다.
 */
export const SYNERGY_TAGS: Record<SynergyTag, SynergyDef> = {
  fire: {
    name: "화염",
    color: "#ff6b35",
    tiers: [
      tier({ need: 2, atkPct: 0.02, elemDmgPct: 0.05 }),
      tier({ need: 4, atkPct: 0.04, elemDmgPct: 0.1 }),
      tier({ need: 6, atkPct: 0.06, elemDmgPct: 0.18 }),
    ],
  },
  frost: {
    name: "서리",
    color: "#5bc8ff",
    tiers: [
      tier({ need: 2, cdrPct: 0.03, elemDmgPct: 0.03 }),
      tier({ need: 4, cdrPct: 0.05, elemDmgPct: 0.06 }),
      tier({ need: 6, cdrPct: 0.06, elemDmgPct: 0.1 }),
    ],
  },
  storm: {
    name: "폭풍",
    color: "#c084fc",
    tiers: [
      tier({ need: 2, atkPct: 0.02, critAdd: 0.03 }),
      tier({ need: 4, atkPct: 0.03, critAdd: 0.05, cdrPct: 0.02 }),
      tier({ need: 6, atkPct: 0.05, critAdd: 0.07, cdrPct: 0.03, elemDmgPct: 0.06 }),
    ],
  },
  blade: {
    name: "검격",
    color: "#e8e8e8",
    tiers: [
      tier({ need: 2, atkPct: 0.03 }),
      tier({ need: 4, atkPct: 0.06 }),
      tier({ need: 6, atkPct: 0.1, critAdd: 0.03 }),
    ],
  },
  guard: {
    name: "수호",
    color: "#f5d76e",
    tiers: [
      tier({ need: 2, defPct: 0.04, hpPct: 0.02 }),
      tier({ need: 4, defPct: 0.07, hpPct: 0.03 }),
      tier({ need: 6, defPct: 0.12, hpPct: 0.04 }),
    ],
  },
  vitality: {
    name: "생명",
    color: "#7ee787",
    tiers: [
      tier({ need: 2, hpPct: 0.03, defPct: 0.02 }),
      tier({ need: 4, hpPct: 0.06, defPct: 0.03 }),
      tier({ need: 6, hpPct: 0.1, defPct: 0.04 }),
    ],
  },
};

/** 표시 순서 고정 — Object.keys 순서에 기대지 않고 항상 이 순서로 집계한다. */
const TAG_ORDER: readonly SynergyTag[] = ["fire", "frost", "storm", "blade", "guard", "vitality"];

/**
 * 쌓인 개수 → 활성 단계. 0 = 없음, 1~3 = 해당 단계까지.
 * 음수/NaN/소수는 방어적으로 정리한다(1.9 는 1개로 센다 — 남는 것은 버린다).
 */
export function activeTier(tag: SynergyTag, count: number): number {
  const def = SYNERGY_TAGS[tag];
  if (!def) return 0;
  const n = Math.floor(Number.isFinite(count) ? count : 0);
  let tierIdx = 0;
  for (let i = 0; i < def.tiers.length; i++) if (n >= def.tiers[i].need) tierIdx = i + 1;
  return tierIdx;
}

/** 카운트 맵에서 태그 개수를 읽는다(음수/비정수 방어). */
function countOf(counts: Partial<Record<SynergyTag, number>>, tag: SynergyTag): number {
  const n = counts?.[tag];
  return Math.max(0, Math.floor(Number.isFinite(n) ? (n as number) : 0));
}

/**
 * 모든 태그의 **활성 단계까지** 보너스를 합산한다.
 * 예: fire 4개면 fire 의 1·2단계가 모두 더해진다(누적형이지 2단계만이 아니다).
 * 태그가 하나도 없으면 전부 정확히 0.
 */
export function synergyTotals(counts: Partial<Record<SynergyTag, number>>): SynergyTotals {
  const total: SynergyTotals = {
    atkPct: 0,
    critAdd: 0,
    defPct: 0,
    hpPct: 0,
    cdrPct: 0,
    elemDmgPct: 0,
  };
  for (const tag of TAG_ORDER) {
    const active = activeTier(tag, countOf(counts, tag));
    for (let i = 0; i < active; i++) {
      const t = SYNERGY_TAGS[tag].tiers[i];
      total.atkPct += t.atkPct ?? 0;
      total.critAdd += t.critAdd ?? 0;
      total.defPct += t.defPct ?? 0;
      total.hpPct += t.hpPct ?? 0;
      total.cdrPct += t.cdrPct ?? 0;
      total.elemDmgPct += t.elemDmgPct ?? 0;
    }
  }
  /* 부동소수 잔차(0.30000000000000004)를 없애고 상한을 건다. */
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  total.atkPct = Math.min(MAX_TOTAL_ATK_PCT, round(total.atkPct));
  total.critAdd = Math.min(MAX_TOTAL_CRIT_ADD, round(total.critAdd));
  total.cdrPct = Math.min(MAX_TOTAL_CDR_PCT, round(total.cdrPct));
  total.defPct = round(total.defPct);
  total.hpPct = round(total.hpPct);
  total.elemDmgPct = round(total.elemDmgPct);
  return total;
}

/**
 * HUD 표시용 문자열 배열. 개수가 0 인 태그는 넣지 않는다.
 *
 * 형식: `화염 2/4 — 공격력 +2%`  (현재 개수 / 다음 단계 임계값 — 현재 활성 효과)
 *   · 1단계 미만(개수 1)이면 `화염 1/2 — 다음 단계까지 1` 로 남은 개수를 보여준다.
 *   · 3단계를 채웠으면 `화염 6/6 — 원소 피해 +18%` 로 임계값을 그대로 반복한다.
 * 순서는 TAG_ORDER 고정 — 같은 입력이면 항상 같은 배열이 나온다.
 */
export function describeSynergies(counts: Partial<Record<SynergyTag, number>>): string[] {
  const lines: string[] = [];
  for (const tag of TAG_ORDER) {
    const def = SYNERGY_TAGS[tag];
    const n = countOf(counts, tag);
    if (n <= 0) continue;
    const active = activeTier(tag, n);
    if (active <= 0) {
      const need = def.tiers[0].need;
      lines.push(`${def.name} ${n}/${need} — 다음 단계까지 ${need - n}`);
      continue;
    }
    const maxed = active >= def.tiers.length;
    const nextNeed = maxed ? def.tiers[def.tiers.length - 1].need : def.tiers[active].need;
    const shown = Math.min(n, nextNeed);
    lines.push(`${def.name} ${shown}/${nextNeed} — ${def.tiers[active - 1].desc}`);
  }
  return lines;
}
