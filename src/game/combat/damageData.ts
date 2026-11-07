/**
 * damageData.ts — 피해 데이터 파이프라인 (JENNY `HealthTrait.DamageData` 이식)
 *
 * ═══ 어디서 왔나 ═══
 * JENNY(Godot 4.6.1) `system/traits/health_trait.gd` 의 내부 클래스 `DamageData` /
 * `HealData`, 그리고 `_damage()` / `process_resistances()` 파이프라인.
 *
 * 원본 설계의 핵심 (그대로 가져올 가치가 있는 부분):
 *   ① 피해를 **숫자 하나가 아니라 객체**로 다룬다 — 가해자·방향·원소·원본값·
 *      실제 감소량·치명 여부를 한 객체에 담아 신호로 넘긴다.
 *   ② **원본값(original_damage)을 보존**한다. 배율이 여러 번 곱해져도
 *      "원래 얼마였는지"를 잃지 않아 로그·표시·밸런스 계산이 정확해진다.
 *   ③ **가해자 방향을 자동 계산**한다. 호출부가 매번 `dir` 을 넘기다 틀리는 문제를 없앤다.
 *   ④ 파이프라인 순서가 고정돼 있다:
 *        pre(저항 전) → 저항/면역/친화 → 실제 적용 → damaged 신호 → 사망 판정
 *
 * ═══ SERTZ 현황 ═══
 * 지금은 `takeDamage(dmg, dir, knock, crit)` 로 숫자와 방향을 각각 넘긴다.
 * 원소 상성·방어력·디버프 배율이 `Enemy.takeDamage` 안에 인라인으로 얽혀 있어
 * **새 피해원(도트·반사·환경)을 추가할 때마다 그 계산을 복사해야 한다.**
 * 이 파일은 그 계산을 순수 함수로 분리해 한 곳에서만 정의한다.
 *
 * ═══ 주의 — 기존 동작 보존 ═══
 * 이 모듈은 **새 계산을 강요하지 않는다**. `fromLegacy()` 로 기존 호출을 그대로
 * 감싸고, `resolveDamage()` 는 넘어온 배율을 **곱해서 돌려주기만** 한다.
 * 기존 `takeDamage` 시그니처는 유지되므로 회귀 위험이 없다.
 */

/** 피해 유형 — JENNY 의 `DamageType` enum 과 동일. (enum 미사용 이유는 ModOp 주석 참조) */
export const DamageType = {
  NORMAL: 0,
  FIRE: 1,
  EXPLOSION: 2,
  ELECTRIC: 3,
  DOT: 4,
  MELEE: 5,
} as const;
export type DamageType = (typeof DamageType)[keyof typeof DamageType];

/** 피해 한 건의 전체 맥락. 원본 `DamageData` 필드를 그대로 옮겼다. */
export type DamageData = {
  /** 이번에 적용할 피해량(배율 적용 후 값이 들어온다). */
  damage: number;
  /** 최초 피해량. 파이프라인 어디서든 "원래 얼마였나"를 볼 수 있게 보존한다. */
  originalDamage: number;
  /** 가해자(플레이어/적/함정). 없으면 null. */
  perpetrator: object | null;
  /** 피해 발생 지점(폭발 중심 등). 방향 계산에 쓴다. */
  source?: { x: number; y: number } | null;
  /** 가해자→대상 방향(단위벡터). 비어 있으면 계산된다. */
  direction?: { x: number; y: number } | null;
  /** 대상의 현재 위치. 방향 자동 계산용. */
  targetPos?: { x: number; y: number } | null;
  damageType: DamageType;
  /** 즉사기 여부. */
  instakill: boolean;
  /** 방어/저항을 무시하는 순수 피해. */
  pure: boolean;
  /** 실제로 깎인 양. 파이프라인이 채운다. */
  hurtAmount: number;
  /** 이 피해로 죽는가. 파이프라인이 채운다. */
  dying: boolean;
  /** 방어 등으로 막힌 양. */
  prevented: boolean;
};

/** 피해 데이터 생성 — 기본값을 한 곳에서 정한다. */
export function makeDamage(damage: number, perpetrator: object | null = null): DamageData {
  return {
    damage,
    originalDamage: damage,
    perpetrator,
    source: null,
    direction: null,
    targetPos: null,
    damageType: DamageType.NORMAL,
    instakill: false,
    pure: false,
    hurtAmount: 0,
    dying: false,
    prevented: false,
  };
}

/**
 * 가해자 좌표 → 대상 좌표 방향을 계산해 채운다.
 * 원본 `update_direction()` 과 동일: 이미 방향이 있으면 덮어쓰지 않는다.
 */
export function ensureDirection(d: DamageData): void {
  if (d.direction) return;
  const from = d.source
    ?? (d.perpetrator as { x?: number; y?: number } | null);
  const tx = d.targetPos?.x;
  const ty = d.targetPos?.y;
  if (from == null || tx == null || ty == null) return;
  const fx = (from as { x?: number }).x;
  const fy = (from as { y?: number }).y;
  if (fx == null || fy == null) return;
  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;
  d.direction = { x: dx / len, y: dy / len };
}

/** 피해 배율 묶음 — 호출부가 이미 알고 있는 배율을 그대로 전달한다. */
export type DamageMultipliers = {
  /** 원소 상성 (0.85 / 1 / 1.25 등) */
  element?: number;
  /** 적 방어력에 의한 비율 감소 (0.8 = 20% 감소) */
  defense?: number;
  /** 상태이상(빙결·감전 등) 받는 피해 배율 */
  received?: number;
  /** 직업 특화(사냥 특화 등) */
  spec?: number;
};

/**
 * 배율을 순서대로 적용한 최종 피해를 계산한다.
 *
 * [순서가 중요한 이유] 원본 JENNY 도 `process_resistances()` 에서
 * 원소 → 친화(그룹) → 자기피해 순으로 곱한다. 순서를 바꾸면 반올림 지점이
 * 달라져 소수 피해에서 1 이 어긋난다(SERTZ vc236 주석의 실제 관측).
 *
 * 각 단계 뒤에 **최소 1** 을 보장한다 — 방어력이 공격력을 넘어 0 피해(무적 벽)가
 * 되는 것을 막는다. 원본의 `Math.max(1, ...)` 정책과 동일.
 */
export function resolveDamage(d: DamageData, m: DamageMultipliers = {}): number {
  d.originalDamage = d.originalDamage || d.damage;
  if (d.pure) {
    d.hurtAmount = d.damage;
    return d.damage;
  }
  let out = d.damage;
  if (m.element != null && m.element !== 1) out = Math.max(1, Math.round(out * m.element));
  if (m.spec != null && m.spec > 0) out = Math.max(1, Math.round(out * (1 + m.spec / 100)));
  if (m.defense != null && m.defense !== 1) out = Math.max(1, Math.round(out * m.defense));
  if (m.received != null && m.received !== 1) out = Math.max(1, Math.round(out * m.received));
  if (d.instakill) out = Number.MAX_SAFE_INTEGER;
  d.damage = out;
  return out;
}

/**
 * 실제 체력에 적용하고 결과를 채운다.
 * @returns 적용 후 남은 체력
 */
export function applyDamage(
  d: DamageData,
  health: number,
  maxHealth: number,
  opts: { invulnerable?: boolean; immortal?: boolean; noKill?: boolean } = {},
): { health: number; died: boolean } {
  if (opts.invulnerable) {
    d.prevented = true;
    d.hurtAmount = 0;
    return { health, died: false };
  }
  const dealt = Math.min(d.damage, health);
  d.hurtAmount = dealt;
  const next = health - dealt;
  /* 원본 JENNY: no_kill_groups 에 속하면 체력을 1 로 붙잡는다(연출상 죽이면 안 되는 대상). */
  if (opts.noKill && next <= 0) {
    d.dying = false;
    return { health: 1, died: false };
  }
  const died = next <= 0 && !opts.immortal;
  d.dying = died;
  void maxHealth;
  return { health: Math.max(0, next), died };
}
