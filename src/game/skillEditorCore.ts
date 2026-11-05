/**
 * 스킬 메이커 — 순수 로직 (지시: "스킬 메이커").
 *
 * [왜 별도 모듈인가]
 *  에디터는 게임이 **실제로 쓰는 값**을 보여줘야 한다. 쿨다운·MP·배율 공식을 UI 에
 *  복사하면 밸런스 수정 때마다 조용히 갈라진다(타일맵 에디터가 `tilemapEditorCore` 를
 *  만든 이유와 같다). 그래서 여기서는 ① 게임 테이블을 **그대로 import** 하고
 *  ② 계산은 게임의 순수함수(`calcDamage`·`damageMultiplier`·`signatureZoneContains`)를
 *  호출하며 ③ 게임에 그런 함수가 없는 곳(쿨다운 실효식)만식을 옮겨 적고 출처를 남긴다.
 *
 * [이 파일이 지어내지 않는 것]
 *  스킬 필드는 전부 원본 코드에서 확인한 것만 쓴다:
 *   · 이름          ← `SKILL_LABELS`(classes.ts:819) / `SKILL5_INFO`(classes.ts:1010)
 *   · 슬롯          ← `SkillId` "s1".."s5b"(scenes/input/skillBuffer.ts:29)
 *   · 메커니즘 키   ← `Skill1Kind`(classes.ts:651) … `Skill5Key`(classes.ts:986)
 *   · 원소          ← `ElemKey`/`ELEMENT_META`(data.ts:1294)
 *   · MP 소모       ← Player.useSkill1..5b 의 리터럴 15/20/25/40/100/150
 *   · 쿨다운(기본)  ← Player.skill1Max..skill5bMax 4000/6000/9000/14000/60000/120000
 *   · 배율          ← `rollDamage(mult)` 첫 인자 (0.35~6.5 실측)
 *   · 판정 형태     ← `SignatureZone`(weaponMasterProfiles.ts:49) circle/beam/sector/box
 *   · 선딜/후딜/타수 ← `WeaponMasterProfile.startup/recovery/pulses`(weaponMasterProfiles.ts:5)
 *  "이펙트 키" 같은 별도 필드는 게임에 없다 — 연출은 메커니즘 키 switch 와 원소로
 *  갈라지므로(`Player.useSkill1` 의 `switch (kind)`), 여기서도 그 둘만 둔다.
 *
 *  Phaser/DOM 의존이 없다 — node 테스트가 이 파일을 그대로 import 한다.
 */

import {
  CLASSES, FIFTH_CD_MULT, FIFTH_LEVEL, JOB_LEVELS,
  SKILL1_KIND, SKILL2_KIND, SKILL3_KIND, SKILL4_KIND,
  SKILL5B_INFO, SKILL5_INFO, SKILL_LABELS, ULT_CLASSES,
  bonusOf, resolveSkill5Of,
  type ClassKey, type Skill1Kind, type Skill2Kind, type Skill3Kind, type Skill4Kind, type Skill5Key,
} from "./classes";
import { ELEMENT_META, type ElemKey } from "./data";
import { calcDamage, damageMultiplier } from "./combat/damageModel";
import {
  STARTER_SIGNATURE, signatureZoneContains, signatureZones, weaponMasterProfileOf,
  type SignatureZone,
} from "./weaponMasterProfiles";

/* ─────────────────────────── 슬롯 ─────────────────────────── */

/** 스킬 슬롯 — 게임 입력 버퍼가 쓰는 식별자와 **같은 문자열**이어야 한다
 *  (skillBuffer.ts:29 `SkillId`). 저장 JSON 의 slot 값이 곧 입력 슬롯이 된다. */
export type SkillSlot = "s1" | "s2" | "s3" | "s4" | "s5" | "s5b";

export const SKILL_SLOTS: readonly SkillSlot[] = ["s1", "s2", "s3", "s4", "s5", "s5b"];

/**
 * 슬롯별 기본값 — **게임이 하드코딩한 값 그대로**다.
 *
 * [왜 슬롯이 MP/쿨다운을 정하는가]
 *  Player 는 스킬 정의가 아니라 슬롯마다 `this.mp < 15` / `this.skill1Max` 를 직접
 *  비교한다(Player.ts:1400·2262·2780·3350·3835·5628). 즉 같은 슬롯의 스킬은 모두
 *  같은 MP·쿨다운을 쓴다. 에디터가 다른 값을 보여주면 게임과 어긋난다.
 */
export const SLOT_RULES: Record<SkillSlot, {
  label: string;
  /** 시전 MP 소모 (Player.useSkill* 의 리터럴) */
  mp: number;
  /** 기본 쿨다운 ms (Player.skillNMax) */
  cooldownMs: number;
  /** 궁극기 슬롯 번호 — 0=일반, 1=제1궁극기(×3.0), 2=제2궁극기(×5.0) */
  ultSlot: 0 | 1 | 2;
  /** 이 슬롯이 열리는 레벨 — 3차 JOB_LEVELS.t3, 4차 t4, 궁극기 FIFTH_LEVEL */
  unlockLevel: number;
}> = {
  s1: { label: "S1 · 주력기", mp: 15, cooldownMs: 4000, ultSlot: 0, unlockLevel: 1 },
  s2: { label: "S2 · 기동기", mp: 20, cooldownMs: 6000, ultSlot: 0, unlockLevel: 1 },
  s3: { label: "S3 · 3차기", mp: 25, cooldownMs: 9000, ultSlot: 0, unlockLevel: JOB_LEVELS.t3 },
  s4: { label: "S4 · 4차기", mp: 40, cooldownMs: 14000, ultSlot: 0, unlockLevel: JOB_LEVELS.t4 },
  s5: { label: "S5 · 궁극기", mp: 100, cooldownMs: 60000, ultSlot: 1, unlockLevel: FIFTH_LEVEL },
  s5b: { label: "S5B · 제2궁극기", mp: 150, cooldownMs: 120000, ultSlot: 2, unlockLevel: FIFTH_LEVEL },
};

/* ─────────────────────────── 메커니즘 키 ─────────────────────────── */

/** 게임이 실제로 배정한 메커니즘 키의 합집합 — `Player.useSkill1` 의 switch 가
 *  이 문자열들로 분기한다. 여기 없는 키는 실행부가 없어 `default` 로 떨어진다. */
export type SkillKind = Skill1Kind | Skill2Kind | Skill3Kind | Skill4Kind | Skill5Key;

/** Partial<Record<ClassKey, T>> 에서 실제 사용된 값만 뽑는다 —
 *  타입 선언에는 있으나 어떤 직업에도 배정되지 않은 키(예: `skyrend`)는
 *  게임에서 도달 불가능하므로 팔레트에 넣지 않는다(`GROUND_PALETTE` 와 같은 원칙). */
function usedKinds<T extends string>(table: Partial<Record<ClassKey, T>>): T[] {
  const out: T[] = [];
  for (const v of Object.values(table)) if (typeof v === "string" && !out.includes(v)) out.push(v);
  return out.sort();
}

/** 슬롯별 무난한 기본 메커니즘 — 각 슬롯 switch 의 **첫 분기**를 고른다
 *  (`Player.useSkill1` 은 `spin` 부터, 궁극기 폴백은 계열 키 `warrior` 부터).
 *  정렬된 목록의 [0] 을 쓰면 알파벳 순서가 기본값이 되어(예: arcbolt) 의미가 없다. */
const DEFAULT_KIND: Record<SkillSlot, SkillKind> = {
  s1: "spin",
  s2: "dash",
  s3: "warcry",
  s4: "doomsday",
  s5: "warrior",
  s5b: "warrior",
};

/** 슬롯별로 고를 수 있는 메커니즘 키 — 슬롯이 다르면 실행부도 다르다.
 *  (s1 은 Skill1Kind, s5 는 궁극기 키 — 섞이면 switch 가 못 찾는다) */
export const SLOT_KINDS: Record<SkillSlot, readonly SkillKind[]> = {
  s1: usedKinds(SKILL1_KIND),
  s2: usedKinds(SKILL2_KIND),
  s3: usedKinds(SKILL3_KIND),
  s4: usedKinds(SKILL4_KIND),
  /* Object.keys 는 string[] 이라 Skill5Key[] 로 좁힌다 — 런타임 키는 Record 의 키이므로 안전하다. */
  s5: (Object.keys(SKILL5_INFO) as Skill5Key[]).sort(),
  s5b: (Object.keys(SKILL5B_INFO) as Skill5Key[]).sort(),
};

/* ─────────────────────────── 판정 형태 ─────────────────────────── */

/** `SignatureZone["kind"]` 와 동일한 4형태 — 게임 판정 함수가 이 이름으로 분기한다. */
export type SkillZoneShape = SignatureZone["kind"];

export const ZONE_SHAPES: readonly SkillZoneShape[] = ["circle", "beam", "sector", "box"];

/**
 * 판정 파라미터를 **평평하게** 저장한다(JSON 사람이 읽기 + 폼이 단순해진다).
 *  · circle / box : radius
 *  · sector       : radius, halfAngle(rad)
 *  · beam         : length, width
 * 쓰지 않는 칸은 0 으로 두고, `zoneFor` 가 형태에 맞는 것만 읽는다.
 */
export type SkillHit = {
  shape: SkillZoneShape;
  radius: number;
  length: number;
  width: number;
  halfAngle: number;
};

/** 게임 판정 반경 실측 범위 — `signatureZones` 를 11스타일 × 1~5차로 전수 계산한 값
 *  (weaponMasterProfiles.ts:61-73). 이 밖은 화면 밖까지 닿거나 점 판정이 된다. */
export const GAME_ZONE_RANGE = { min: 62, max: 450 } as const;

/* ─────────────────────────── 스킬 정의 ─────────────────────────── */

export type SkillDef = {
  /** 저장 키. 게임의 메커니즘 키처럼 소문자 슬러그를 쓴다(`spin`, `warcry`). */
  id: string;
  /** 표시 이름 — `SKILL_LABELS`/`SKILL5_INFO.name` 자리 */
  name: string;
  /** 이 스킬을 쓰는 직업. "base" = 미전직(SKILL_ICONS 의 base 키와 동일) */
  cls: ClassKey | "base";
  slot: SkillSlot;
  kind: SkillKind;
  element: ElemKey;
  /** 시전 MP — Player.useSkill* 리터럴과 같은 단위 */
  mp: number;
  /** 기본 쿨다운 ms — Player.skillNMax 와 같은 단위(ms) */
  cooldownMs: number;
  /** `rollDamage(mult)` 첫 인자 — 1.0 = 100% */
  mult: number;
  /** 스킬 차수(1~5) — rollDamage 의 사다리 `1 + 0.22*(sTier-1)` 에 들어간다 */
  sTier: number;
  /** 0=일반, 1·2=궁극기 — damageModel 이 ×3.0 / ×5.0 을 적용하는 스위치 */
  ultSlot: 0 | 1 | 2;
  hit: SkillHit;
  /** 선딜(ms) — WeaponMasterProfile.startup */
  startupMs: number;
  /** 후딜(ms) — WeaponMasterProfile.recovery */
  recoveryMs: number;
  /** 타격 시각(ms, 선딜 기준 상대) — WeaponMasterProfile.pulses. 길이 = 타수 */
  pulsesMs: number[];
};

const DEFAULT_HIT: SkillHit = { shape: "circle", radius: 120, length: 260, width: 60, halfAngle: 0.6 };

/** 기본 스킬 1개 — 슬롯 기본값만 채우고 나머지는 중립값으로 둔다.
 *  [왜 mult 1.0 인가] 스킬마다 배율이 구현 안에 흩어져 있어(`rollDamage(1.0 + 0.07*t)`)
 *  테이블로 복원할 수 없다. 1.0(=100%)에서 시작해 사용자가 올리는 편이,
 *  근거 없는 평균값을 넣는 것보다 정직하다. */
export function createSkill(seed: Partial<SkillDef> = {}): SkillDef {
  const slot = seed.slot ?? "s1";
  const rule = SLOT_RULES[slot];
  return {
    id: seed.id ?? "new_skill",
    name: seed.name ?? "새 스킬",
    cls: seed.cls ?? "base",
    slot,
    kind: seed.kind ?? DEFAULT_KIND[slot],
    element: seed.element ?? "none",
    mp: seed.mp ?? rule.mp,
    cooldownMs: seed.cooldownMs ?? rule.cooldownMs,
    mult: seed.mult ?? 1,
    sTier: seed.sTier ?? 1,
    ultSlot: seed.ultSlot ?? rule.ultSlot,
    hit: seed.hit ? { ...seed.hit } : { ...DEFAULT_HIT },
    startupMs: seed.startupMs ?? 140,
    recoveryMs: seed.recoveryMs ?? 130,
    pulsesMs: seed.pulsesMs ? [...seed.pulsesMs] : [0],
  };
}

/** 슬롯을 바꾸면 MP·쿨다운·궁극기 슬롯도 함께 옮긴다 — 게임에서 그 값들은
 *  스킬이 아니라 **슬롯**의 속성이기 때문(Player.ts 의 `this.mp < 15` 리터럴). */
export function retargetSlot(skill: SkillDef, slot: SkillSlot): SkillDef {
  const rule = SLOT_RULES[slot];
  return {
    ...skill,
    slot,
    kind: (SLOT_KINDS[slot] as readonly string[]).includes(skill.kind) ? skill.kind : DEFAULT_KIND[slot],
    mp: rule.mp,
    cooldownMs: rule.cooldownMs,
    ultSlot: rule.ultSlot,
  };
}

/* ─────────────────────────── 판정 ─────────────────────────── */

/** 정의 → 게임 판정 도형. 좌표계는 게임과 같다(원점=시전자, angle=조준 방향 라디안). */
export function zoneFor(skill: SkillDef, origin: { x: number; y: number }, angle: number): SignatureZone {
  const { shape, radius, length, width, halfAngle } = skill.hit;
  switch (shape) {
    case "circle": return { kind: "circle", ...origin, radius };
    case "box": return { kind: "box", ...origin, radius };
    case "sector": return { kind: "sector", ...origin, angle, radius, halfAngle };
    case "beam": return { kind: "beam", ...origin, angle, length, width };
  }
}

/** 명중 판정 — 게임의 `signatureZoneContains` 를 **그대로** 호출한다.
 *  에디터 미리보기가 게임과 픽셀 단위로 같은 이유가 여기다(복사본이 아니다). */
export function hitTest(
  skill: SkillDef,
  origin: { x: number; y: number },
  angle: number,
  point: { x: number; y: number },
  targetRadius = 0,
): boolean {
  return signatureZoneContains(zoneFor(skill, origin, angle), point, targetRadius);
}

/* ─────────────────────────── 계산 미리보기 ─────────────────────────── */

/** 레벨별 최대 MP — data.ts:355 주석의 공식(`maxMp = 60 + 6*(lv-1)`).
 *  MP 소모가 이보다 크면 그 레벨에서는 스킬을 쓸 수 없다. */
export function maxMpAt(lv: number): number {
  return 60 + 6 * (Math.max(1, Math.floor(lv)) - 1);
}

/** 실효 쿨다운 — Player.skill1MaxEff(Player.ts:349) 의 식을 그대로 옮겼다.
 *  [왜 여기 있는가] Player 는 Phaser 엔티티라 node 테스트가 만들 수 없다.
 *  식이 바뀌면 이 함수와 테스트가 함께 깨져야 하므로 상수(0.08·0.68)를 노출한다. */
export const COOLDOWN_TIER_STEP = 0.08;
export const COOLDOWN_TIER_FLOOR = 0.68;

export function previewCooldownMs(
  skill: SkillDef,
  opts: { cdMult?: number; isFifth?: boolean } = {},
): number {
  const { cdMult = 1, isFifth = false } = opts;
  const tierCd = Math.max(COOLDOWN_TIER_FLOOR, 1 - COOLDOWN_TIER_STEP * Math.max(0, skill.sTier - 1));
  return Math.round(skill.cooldownMs * cdMult * tierCd * (isFifth ? FIFTH_CD_MULT : 1));
}

export type DamagePreviewInput = {
  /** 누적 공격력 — Player.atkTotal */
  atkTotal: number;
  /** 직업 보정 — 비우면 `bonusOf(cls).skillMult` 를 그대로 쓴다 */
  clsSkillMult?: number;
  isFifth?: boolean;
  /** 분노/자기공격력 버프 배율 (1=없음) */
  rage?: number;
  /** 환생 데미지 배율 (1=없음) */
  rebirthDmgMult?: number;
  /** 인런 카드 스킬 피해 % */
  runSkillPct?: number;
  crit?: boolean;
  /** 크리 피해 배율 — Player.CRIT_MULT = 1.7 */
  critDmg?: number;
};

export type DamagePreview = {
  /** 1회 타격 피해 */
  perHit: number;
  /** 이 시전에서 기대하는 타수(pulses 개수) */
  hits: number;
  /** 전타 명중 시 총 피해 */
  total: number;
  /** rollDamage 가 곱하는 최종 배율(반올림 전) — 밸런스 확인용 */
  multiplier: number;
  crit: boolean;
};

/** 데미지 미리보기 — 게임의 `calcDamage`/`damageMultiplier` 를 직접 호출한다.
 *  공식을 여기 적지 않는 이유: damageModel.ts 가 단일 출처이고 테스트 25케이스가
 *  그 경계를 고정하고 있다. 에디터가 따로 계산하면 반드시 갈라진다. */
export function previewDamage(skill: SkillDef, input: DamagePreviewInput): DamagePreview {
  const clsSkillMult = input.clsSkillMult ?? bonusOf(skill.cls).skillMult;
  const common = {
    mult: skill.mult,
    isSkill: true,
    clsSkillMult,
    isFifth: input.isFifth ?? false,
    sTier: skill.sTier,
    ultSlot: skill.ultSlot,
    rage: input.rage ?? 1,
    rebirthDmgMult: input.rebirthDmgMult ?? 1,
    runSkillPct: input.runSkillPct ?? 0,
  };
  const perHit = calcDamage({
    ...common,
    atkTotal: input.atkTotal,
    crit: input.crit ?? false,
    critDmg: input.critDmg ?? 1.7,
  });
  const hits = Math.max(1, skill.pulsesMs.length);
  return {
    perHit,
    hits,
    total: perHit * hits,
    multiplier: damageMultiplier(common),
    crit: input.crit ?? false,
  };
}

/* ─────────────────────────── 검증 ─────────────────────────── */

export type SkillValidation = { ok: boolean; errors: string[]; warnings: string[] };

const ID_RE = /^[a-z][a-z0-9_]{1,40}$/;
/** 이름 길이 한계 — HUD 버튼은 2줄 클램프라 18자부터 잘린다
 *  (SkillButton.tsx:152-166 의 line-clamp:2 + 8.5px). */
const NAME_SOFT_MAX = 18;
/** rollDamage(mult) 실측 최대 — Player 전수 grep 결과 6.5 (그 외는 0.35~4.8). */
const MULT_SOFT_MAX = 6.5;
/** 에디터 자체 상한 — 게임 근거가 아니라 **오타 방지**용이다(반지름 12000 같은 값). */
const ZONE_HARD_MAX = 900;

/**
 * 스킬 1개 검증 — 게임이 실제로 요구하는 조건만 본다.
 *
 * [errors vs warnings]
 *  errors  = 게임이 그대로 실행하면 깨지는 것 (switch 가 못 찾는 키, 음수 MP,
 *            중복 키, 판정 없는 스킬). 저장 자체는 막지 않지만 UI 가 빨갛게 표시한다.
 *  warnings= 실행은 되지만 의도와 다를 수 있는 것 (화면 밖 판정, 쿨다운 0,
 *            HUD 에서 잘리는 이름). 타일맵 `validateLayout` 과 같은 구분이다.
 */
export function validateSkill(skill: SkillDef, ctx: { otherIds?: readonly string[] } = {}): SkillValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rule = SLOT_RULES[skill.slot];

  /* ── 식별자 ── */
  if (!skill.id || !ID_RE.test(skill.id)) {
    errors.push("ID 는 소문자로 시작하는 슬러그여야 합니다 (a-z, 0-9, _ · 2자 이상)");
  }
  /* [왜 otherIds 인가] `others` 배열에 자기 자신이 들어 있으면 항상 중복으로 잡힌다.
   *  호출자가 "나를 뺀 목록"을 넘기게 해서 그 함정을 없앤다. */
  if (ctx.otherIds?.includes(skill.id)) {
    errors.push(`ID "${skill.id}" 가 다른 스킬과 겹칩니다 — 저장 키가 충돌합니다`);
  }

  /* ── 이름 ── */
  if (!skill.name.trim()) {
    /* 게임은 SKILL_LABELS 의 빈 문자열을 "미해금"으로 본다(classes.ts:816 주석).
     *  이름 없는 스킬은 HUD 에서 사라진다. */
    errors.push("이름이 비었습니다 — 빈 라벨은 게임에서 미해금 슬롯으로 처리됩니다");
  } else if (skill.name.length > NAME_SOFT_MAX) {
    warnings.push(`이름이 ${skill.name.length}자 — HUD 버튼은 ${NAME_SOFT_MAX}자부터 잘립니다`);
  }

  /* ── 슬롯 / 메커니즘 ── */
  if (!SKILL_SLOTS.includes(skill.slot)) {
    errors.push(`알 수 없는 슬롯 "${skill.slot}"`);
  } else {
    const allowed = SLOT_KINDS[skill.slot] as readonly string[];
    if (!allowed.includes(skill.kind)) {
      /* 실행부는 슬롯별 switch 다 — s3 슬롯에 s1 키를 넣으면 default 로 떨어진다. */
      errors.push(`"${skill.kind}" 는 ${skill.slot} 슬롯의 메커니즘이 아닙니다 (실행부 switch 불일치)`);
    }
  }

  /* ── 직업 ── */
  if (skill.cls !== "base" && !CLASSES[skill.cls]) {
    errors.push(`알 수 없는 직업 "${skill.cls}"`);
  }
  if ((skill.slot === "s5" || skill.slot === "s5b") && skill.cls !== "base" && !ULT_CLASSES.has(skill.cls)) {
    /* Player.skill5Unlocked 는 ULT_CLASSES(4차 10직업)만 통과시킨다(Player.ts:290). */
    warnings.push(`${skill.cls} 는 궁극기 보유 직업이 아닙니다 — 4차 10직업 전용입니다`);
  }

  /* ── 원소 ── */
  if (!ELEMENT_META[skill.element]) {
    errors.push(`알 수 없는 원소 "${skill.element}"`);
  }

  /* ── MP ── */
  if (!Number.isFinite(skill.mp) || !Number.isInteger(skill.mp)) {
    errors.push("MP 는 정수여야 합니다");
  } else if (skill.mp < 0) {
    /* `this.mp -= mp` 이므로 음수는 시전할 때 MP 가 **늘어난다**. */
    errors.push("MP 가 음수입니다 — 시전할 때 MP 가 오히려 회복됩니다");
  } else if (skill.mp > maxMpAt(200)) {
    errors.push(`MP ${skill.mp} 는 Lv200 최대 MP(${maxMpAt(200)})보다 큽니다 — 영구 시전 불가`);
  } else if (skill.mp > maxMpAt(rule.unlockLevel)) {
    warnings.push(`MP ${skill.mp} > 해금 레벨(${rule.unlockLevel}) 최대 MP ${maxMpAt(rule.unlockLevel)} — 해금 직후엔 쓸 수 없습니다`);
  }

  /* ── 쿨다운 ── */
  if (!Number.isFinite(skill.cooldownMs) || !Number.isInteger(skill.cooldownMs)) {
    errors.push("쿨다운은 정수(ms)여야 합니다");
  } else if (skill.cooldownMs < 0) {
    errors.push("쿨다운이 음수입니다");
  } else if (skill.cooldownMs === 0) {
    warnings.push("쿨다운 0 — 게임은 `cd > 0` 만 막으므로 매 프레임 시전됩니다");
  } else if (skill.cooldownMs > SLOT_RULES.s5b.cooldownMs) {
    warnings.push(`쿨다운 ${skill.cooldownMs}ms 는 게임 최대치(제2궁극기 120000ms)를 넘습니다`);
  }

  /* ── 배율 ── */
  if (!Number.isFinite(skill.mult) || skill.mult <= 0) {
    errors.push("데미지 계수는 0보다 큰 수여야 합니다");
  } else if (skill.mult > MULT_SOFT_MAX) {
    warnings.push(`배율 ${skill.mult} 는 게임 실측 최대(${MULT_SOFT_MAX})를 넘습니다`);
  }

  /* ── 차수 / 궁극기 슬롯 ── */
  if (!Number.isInteger(skill.sTier) || skill.sTier < 1 || skill.sTier > 5) {
    errors.push("차수는 1~5 사이 정수여야 합니다 (Player.sTier 의 사다리 범위)");
  }
  if (skill.ultSlot !== 0 && skill.ultSlot !== 1 && skill.ultSlot !== 2) {
    /* 미정의 슬롯은 사다리·궁극기 배율을 모두 끈다 — damageModel.ts:97 주석의 함정. */
    errors.push("궁극기 슬롯은 0·1·2 중 하나여야 합니다 (그 외 값은 배율이 전부 꺼집니다)");
  } else if (skill.ultSlot !== rule.ultSlot) {
    warnings.push(`궁극기 슬롯 ${skill.ultSlot} — ${skill.slot} 슬롯의 게임 기본값은 ${rule.ultSlot} 입니다`);
  }

  /* ── 판정 ── */
  if (!ZONE_SHAPES.includes(skill.hit.shape)) {
    errors.push(`알 수 없는 판정 형태 "${skill.hit.shape}"`);
  } else {
    const { shape, radius, length, width, halfAngle } = skill.hit;
    const need: [string, number][] =
      shape === "beam" ? [["길이", length], ["폭", width]] : [["반지름", radius]];
    for (const [label, v] of need) {
      if (!Number.isFinite(v) || v <= 0) errors.push(`판정 ${label}이 0 이하입니다 — 아무것도 맞지 않습니다`);
      else if (v > ZONE_HARD_MAX) errors.push(`판정 ${label} ${v}px 는 상한(${ZONE_HARD_MAX}px)을 넘습니다`);
    }
    if (shape === "sector") {
      if (!Number.isFinite(halfAngle) || halfAngle <= 0 || halfAngle > Math.PI / 2) {
        errors.push("부채꼴 반각은 0~90°(π/2 rad) 사이여야 합니다");
      }
    }
    const reach = shape === "beam" ? Math.max(length, width) : radius;
    if (reach > 0 && (reach < GAME_ZONE_RANGE.min || reach > GAME_ZONE_RANGE.max)) {
      warnings.push(`판정 ${Math.round(reach)}px 는 게임 실측 범위(${GAME_ZONE_RANGE.min}~${GAME_ZONE_RANGE.max}px) 밖입니다`);
    }
  }

  /* ── 타이밍 ── */
  for (const [label, v] of [["선딜", skill.startupMs], ["후딜", skill.recoveryMs]] as [string, number][]) {
    if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0) errors.push(`${label}은 0 이상 정수(ms)여야 합니다`);
    else if (v > 1000) warnings.push(`${label} ${v}ms 는 게임 최대(320ms)의 3배를 넘습니다`);
  }
  if (!Array.isArray(skill.pulsesMs) || skill.pulsesMs.length === 0) {
    errors.push("타격 시각이 없습니다 — 맞는 순간이 없는 스킬입니다");
  } else {
    if (skill.pulsesMs.length > 8) warnings.push(`타수 ${skill.pulsesMs.length} — 게임 최대는 2타입니다`);
    if (skill.pulsesMs.some((v) => !Number.isFinite(v) || v < 0)) {
      errors.push("타격 시각은 0 이상의 ms 여야 합니다");
    } else if (skill.pulsesMs.some((v, i) => i > 0 && v <= skill.pulsesMs[i - 1])) {
      warnings.push("타격 시각이 오름차순이 아닙니다 — 동시 타격으로 처리됩니다");
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * 스킬 묶음 검증 — 개별 검증으로는 못 잡는 충돌을 본다.
 *
 * [왜 (직업, 슬롯) 중복이 치명적인가]
 *  게임은 스킬을 ID 로 찾지 않는다. `SKILL1_KIND[cls]` / `Player.cls` 로 찾는다
 *  (classes.ts:748, Player.ts:1440). 같은 직업·같은 슬롯에 두 개를 넣으면
 *  나중 것이 조용히 이기고 앞의 것은 영원히 실행되지 않는다.
 */
export function validateSkillSet(skills: readonly SkillDef[]): SkillValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (skills.length === 0) errors.push("스킬이 하나도 없습니다");

  /* ID 중복은 **전체 목록 기준**으로 한 번만 본다 — 스킬마다 자기 자신을 빼는
   *  인덱스 계산을 반복하면 O(n²) 이고 실수하기 쉽다. */
  const idCount = new Map<string, number>();
  for (const s of skills) idCount.set(s.id, (idCount.get(s.id) ?? 0) + 1);
  for (const [id, n] of idCount) {
    if (n > 1) errors.push(`ID "${id}" 가 ${n}번 쓰였습니다 — 저장 키가 충돌합니다`);
  }

  for (const s of skills) {
    const v = validateSkill(s);
    for (const e of v.errors) errors.push(`[${s.id || "?"}] ${e}`);
    for (const w of v.warnings) warnings.push(`[${s.id || "?"}] ${w}`);
  }

  const seenKey = new Map<string, string>();
  for (const s of skills) {
    const key = `${s.cls}:${s.slot}`;
    const prev = seenKey.get(key);
    if (prev) errors.push(`[${s.id}] ${s.cls} · ${s.slot} 슬롯에 이미 "${prev}" 가 있습니다 — 게임은 하나만 실행합니다`);
    else seenKey.set(key, s.id);
  }
  return { ok: errors.length === 0, errors, warnings };
}

/* ─────────────────────────── 저장 / 불러오기 ─────────────────────────── */

const round = (v: number, digits: number) => {
  const p = 10 ** digits;
  return Math.round(v * p) / p;
};

/**
 * 저장 형식 — 사람이 읽는 JSON. 스킬 하나가 객체 하나로 그대로 보이게 두고
 * (압축하지 않는다) 숫자만 자리를 줄인다. diff 로 밸런스 변경을 읽을 수 있어야 한다.
 */
export function serializeSkills(doc: { name?: string; skills: readonly SkillDef[] }) {
  return {
    version: 1 as const,
    name: doc.name ?? "untitled",
    skills: doc.skills.map((s) => ({
      id: s.id,
      name: s.name,
      cls: s.cls,
      slot: s.slot,
      kind: s.kind,
      element: s.element,
      mp: Math.round(s.mp),
      cooldownMs: Math.round(s.cooldownMs),
      mult: round(s.mult, 3),
      sTier: Math.round(s.sTier),
      ultSlot: s.ultSlot,
      hit: {
        shape: s.hit.shape,
        radius: round(s.hit.radius, 1),
        length: round(s.hit.length, 1),
        width: round(s.hit.width, 1),
        halfAngle: round(s.hit.halfAngle, 4),
      },
      startupMs: Math.round(s.startupMs),
      recoveryMs: Math.round(s.recoveryMs),
      pulsesMs: s.pulsesMs.map((v) => Math.round(v)),
    })),
  };
}

export type SavedSkills = ReturnType<typeof serializeSkills>;

/**
 * JSON → 스킬 묶음. 손상 입력은 null.
 *
 * [범위 검사는 일부러 하지 않는다]
 *  음수 MP 같은 값은 **거부하지 않고** 통과시킨다. 에디터가 그 값을 보여주고
 *  validateSkill 이 빨갛게 표시해야 사용자가 고칠 수 있다. 여기서 막으면
 *  "불러오기 실패"만 남고 어디가 틀렸는지 알 수 없다.
 *  반면 **구조**(타입·enum·필수 키)는 거부한다 — 폼이 표현할 수 없는 값이라
 *  불러와도 편집이 불가능하다.
 */
export function deserializeSkills(d: unknown): { name: string; skills: SkillDef[] } | null {
  const o = d as Partial<SavedSkills> | null;
  if (!o || typeof o !== "object") return null;
  if (o.version !== 1) return null;
  if (!Array.isArray(o.skills) || o.skills.length === 0) return null;

  const skills: SkillDef[] = [];
  for (const raw of o.skills) {
    const s = raw as Record<string, unknown> | null;
    if (!s || typeof s !== "object") return null;
    if (typeof s.id !== "string" || typeof s.name !== "string") return null;
    if (typeof s.cls !== "string" || !(s.cls === "base" || CLASSES[s.cls as ClassKey])) return null;
    if (!SKILL_SLOTS.includes(s.slot as SkillSlot)) return null;
    if (!(SLOT_KINDS[s.slot as SkillSlot] as readonly string[]).includes(String(s.kind))) return null;
    if (typeof s.element !== "string" || !ELEMENT_META[s.element as ElemKey]) return null;
    const hit = s.hit as Record<string, unknown> | null;
    if (!hit || typeof hit !== "object" || !ZONE_SHAPES.includes(hit.shape as SkillZoneShape)) return null;

    const nums = [s.mp, s.cooldownMs, s.mult, s.sTier, hit.radius, hit.length, hit.width, hit.halfAngle, s.startupMs, s.recoveryMs];
    if (nums.some((v) => typeof v !== "number" || !Number.isFinite(v))) return null;
    if (!Array.isArray(s.pulsesMs) || s.pulsesMs.length === 0) return null;
    if (s.pulsesMs.some((v) => typeof v !== "number" || !Number.isFinite(v))) return null;

    skills.push({
      id: s.id,
      name: s.name,
      cls: s.cls as ClassKey | "base",
      slot: s.slot as SkillSlot,
      kind: s.kind as SkillKind,
      element: s.element as ElemKey,
      mp: s.mp as number,
      cooldownMs: s.cooldownMs as number,
      mult: s.mult as number,
      sTier: s.sTier as number,
      ultSlot: (s.ultSlot === 1 || s.ultSlot === 2 ? s.ultSlot : 0) as 0 | 1 | 2,
      hit: {
        shape: hit.shape as SkillZoneShape,
        radius: hit.radius as number,
        length: hit.length as number,
        width: hit.width as number,
        halfAngle: hit.halfAngle as number,
      },
      startupMs: s.startupMs as number,
      recoveryMs: s.recoveryMs as number,
      pulsesMs: (s.pulsesMs as number[]).map((v) => Math.round(v)),
    });
  }
  return { name: typeof o.name === "string" ? o.name : "untitled", skills };
}

/* ─────────────────────────── 게임 데이터에서 가져오기 ─────────────────────────── */

/**
 * 1차 4계열의 스킬 이름 — `SKILL_LABELS` 에 **없다**(classes.ts:819 는 2차 이상만 등재).
 *  게임은 Player 의 getter 가 하드코딩 폴백으로 채운다(Player.ts:1333-1350).
 *  여기서 새로 짓지 않고 그 문자열을 그대로 옮긴다 — 표에 없는 이름을 만들면
 *  에디터가 게임에 없는 스킬명을 보여주게 된다.
 */
const TIER1_S1_NAME: Partial<Record<string, string>> = {
  warrior: "회전베기",
  ranger: "관통 화살",
  mage: "매직 볼트",
  thief: "그림자 회전베기",
};
const TIER1_S2_NAME: Partial<Record<string, string>> = {
  warrior: "돌진베기",
  ranger: "질풍 차지",
  mage: "점멸",
  thief: "돌진베기",
};

/**
 * 게임 테이블을 스킬 정의로 되돌린다 — "지금 게임에 있는 것"을 출발점으로 편집한다.
 *
 * [복원 가능한 필드만 채운다]
 *  · 이름·슬롯·메커니즘·직업·MP·쿨다운: 테이블/리터럴에 있으므로 **정확히** 복원된다
 *  · S1 의 판정·선딜·후딜·타수: `weaponMasterProfileOf` → `signatureZones` 로 복원된다
 *    (Player.useSkill1 이 쓰는 것과 같은 함수 — Player.ts:1401)
 *  · S2~S5 의 판정과 배율: 각 구현 함수 안에 하드코딩돼 있어 테이블이 없다.
 *  · 1차 ranger/mage/thief 의 S1 판정: 무기 멘토 프로필이 없어(2차 전용) 마찬가지로 없다.
 *    그래서 중립 기본값을 쓰고, 그 사실은 UI 힌트로 알린다. 지어내지 않는다.
 */
export function skillsFromGame(): SkillDef[] {
  const out: SkillDef[] = [];
  const labelOf = (key: ClassKey): string[] => SKILL_LABELS[key] ?? [];

  for (const c of Object.values(CLASSES)) {
    const labels = labelOf(c.key);
    /* SKILL_LABELS 순서 = [기본공격, S1, S2, S3, S4] (classes.ts:816 주석).
     *  빈 문자열은 미해금 슬롯이므로 건너뛴다.
     *  1차 4계열은 표에 없으므로 Player 의 폴백 문자열을 쓴다. */
    const s1Name = labels[1] || TIER1_S1_NAME[c.key] || "";
    const s2Name = labels[2] || TIER1_S2_NAME[c.key] || "";
    const s1Kind = SKILL1_KIND[c.key];
    const s2Kind = SKILL2_KIND[c.key];
    const s3Kind = SKILL3_KIND[c.key];
    const s4Kind = SKILL4_KIND[c.key];

    if (s1Kind && s1Name) {
      /* S1 은 무기 멘토 프로필이 실제 실행부다 — 판정과 타이밍을 그대로 가져온다. */
      const profile = weaponMasterProfileOf(c.key) ?? (c.key === "warrior" ? STARTER_SIGNATURE : null);
      const zone = profile ? signatureZones(profile.style, { x: 0, y: 0 }, { x: 1, y: 0 }, c.tier)[0] : null;
      out.push(createSkill({
        id: `game_${c.key}_s1`,
        name: s1Name,
        cls: c.key,
        slot: "s1",
        kind: s1Kind,
        element: profile?.element ?? "none",
        sTier: c.tier,
        ...(zone
          ? {
            hit: {
              shape: zone.kind,
              radius: "radius" in zone ? zone.radius : 0,
              length: zone.kind === "beam" ? zone.length : 0,
              width: zone.kind === "beam" ? zone.width : 0,
              halfAngle: zone.kind === "sector" ? zone.halfAngle : 0,
            },
            startupMs: profile!.startup,
            recoveryMs: profile!.recovery,
            pulsesMs: [...profile!.pulses],
          }
          : {}),
      }));
    }

    if (s2Kind && s2Name) {
      out.push(createSkill({ id: `game_${c.key}_s2`, name: s2Name, cls: c.key, slot: "s2", kind: s2Kind, sTier: c.tier }));
    }
    if (s3Kind && labels[3]) {
      out.push(createSkill({ id: `game_${c.key}_s3`, name: labels[3], cls: c.key, slot: "s3", kind: s3Kind, sTier: c.tier }));
    }
    if (s4Kind && labels[4]) {
      out.push(createSkill({ id: `game_${c.key}_s4`, name: labels[4], cls: c.key, slot: "s4", kind: s4Kind, sTier: c.tier }));
    }

    /* 궁극기는 4차 10직업만 보유한다(ULT_CLASSES · Player.ts:290). */
    if (ULT_CLASSES.has(c.key)) {
      const ultKey = resolveSkill5Of(c.key);
      out.push(createSkill({
        id: `game_${c.key}_s5`,
        name: SKILL5_INFO[ultKey].name,
        cls: c.key,
        slot: "s5",
        kind: ultKey,
        sTier: 5,
      }));
      out.push(createSkill({
        id: `game_${c.key}_s5b`,
        name: SKILL5B_INFO[ultKey].name,
        cls: c.key,
        slot: "s5b",
        kind: ultKey,
        sTier: 5,
      }));
    }
  }
  return out;
}

/* ─────────────────────────── 팔레트 ─────────────────────────── */

/** 폼 드롭다운용 직업 목록 — 실제 `CLASSES` 순서/이름을 그대로 노출한다. */
export const CLASS_OPTIONS: readonly { key: ClassKey | "base"; name: string; tier: number }[] = [
  { key: "base", name: "미전직", tier: 0 },
  ...Object.values(CLASSES).map((c) => ({ key: c.key, name: `${c.name} · ${c.title}`, tier: c.tier })),
];

/** 폼 드롭다운용 원소 목록 — 이름/색은 `ELEMENT_META` 단일 출처. */
export const ELEMENT_OPTIONS = Object.entries(ELEMENT_META).map(([key, meta]) => ({
  key: key as ElemKey,
  name: meta.name,
  color: meta.color,
}));

/** 새 스킬 ID 만들기 — 기존 ID 와 겹치지 않는 `skill_N`. */
export function nextSkillId(existing: readonly SkillDef[]): string {
  const used = new Set(existing.map((s) => s.id));
  for (let i = 1; i < 1000; i++) {
    const id = `skill_${i}`;
    if (!used.has(id)) return id;
  }
  return `skill_${Date.now()}`;
}
