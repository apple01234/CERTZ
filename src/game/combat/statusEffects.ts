/**
 * 상태이상 확장 코어 — 받는 피해/치명타/공격력 배율 + 순수 만료 처리
 *
 * 왜 뽑았나
 *   지금 적 상태이상은 `Enemy.ts` 의 slow / stun / dot 셋뿐이고, 각각이
 *   `applySlow` / `applyStun` / `applyDot` 로 흩어져 있다. 상태가 하나 늘 때마다
 *   엔티티에 필드를 하나 더 파야 하고, "받는 피해 증가" 처럼 **여러 상태가 곱해지는
 *   상호작용**은 아예 표현할 자리가 없다.
 *   (원본은 StatusCore + StatusBehaviour 파생 계층으로 해결했다 — 여기서는 그 계층을
 *   흉내내지 않고, 계산만 순수 함수로 떼어내 **경계값을 고정**한다.)
 *   Enemy/Player 는 이 함수의 결과만 받아 적용하고, 상태 만료는 tickStatuses 로 통일한다.
 *
 * 무엇
 *   · STATUS_DEFS   — 7종 정의 (이름/색/최대스택/지속시간/가중치)
 *   · stackEffect   — 각 상태의 **주 효과** 계수 (툴팁·HUD 표시용)
 *   · receivedDamageMult / critChanceBonus / atkMultFromStatuses — 전투 배율
 *   · applyStatus / tickStatuses — 중첩 병합과 만료 (입력 불변, 새 배열 반환)
 *
 * 이 파일이 지켜야 하는 계약
 *   · Phaser / DOM / Date / Math.random 의존 없음 — 시간과 난수는 전부 호출자가 준다.
 *   · 입력 배열을 **절대 변형하지 않는다.** 항상 새 배열을 돌려준다.
 *   · 스택은 maxStacks 에서 포화한다. 같은 key 가 여러 번 들어와도 합산한 뒤 포화 —
 *     중복 엔트리로 상한을 우회할 수 없다.
 *   · 배율 상한/하한: 받는 피해 ≤ 1.6, 치명타 가산 ≤ 0.25, 공격력 배수 ≥ 0.6.
 */

/** 적/플레이어에게 붙는 상태이상 키. 문자열 그대로 세이브·로그에 쓸 수 있다. */
export type StatusKey = "slow" | "stun" | "dot" | "chill" | "shock" | "mark" | "weaken";

export type StatusDef = {
  key: StatusKey;
  /** HUD 표시명 */
  name: string;
  /** 툴팁 1줄 설명 */
  desc: string;
  /** 상태 아이콘/틴트 색 (hex) */
  color: string;
  /** 포화 스택 수 */
  maxStacks: number;
  /** [최소, 최대] 지속시간(ms) */
  durationRange: [number, number];
  /** 무작위 부여 시 상대 가중치 */
  weight: number;
};

/** 배율 계산에 필요한 최소 뷰 — 실제 엔티티 상태 객체와 호환된다. */
export type StatusStack = { key: StatusKey; stacks: number };

/** 만료를 추적하는 실행 중 상태. remainingMs 가 0 이하가 되면 사라진다. */
export type ActiveStatus = StatusStack & { remainingMs: number };

/**
 * 상태 정의.
 *
 * maxStacks 근거 — 각 상태의 배율 기여도가 상한에 정확히 맞도록 스택 수를 골랐다:
 *   chill  0.06 × 3 = +0.18   (약한 대신 오래 간다)
 *   shock  0.10 × 2 = +0.20   (강한 대신 짧고 2스택까지)
 *   mark   0.06 × 4 = +0.24   (치명타 가산 상한 0.25 바로 아래)
 *   weaken 0.10 × 4 = -0.40   (공격력 하한 0.6 에 정확히 닿는다)
 *   slow   0.12 × 3 = ×0.64   (이속이 0 이 되지 않게)
 *   dot    0.08 × 5 = 0.40    (초당 피해 = 공격력 × 0.40)
 *   stun   이진 효과라 1스택 고정.
 * 가중치는 합 100 — stun 이 6 인 이유는 이진 효과라 겹치면 곧바로 무력화되기 때문.
 */
export const STATUS_DEFS: Record<StatusKey, StatusDef> = {
  slow: {
    key: "slow",
    name: "둔화",
    desc: "이동 속도 감소",
    color: "#7fb3d5",
    maxStacks: 3,
    durationRange: [1500, 3500],
    weight: 22,
  },
  stun: {
    key: "stun",
    name: "경직",
    desc: "행동 불가",
    color: "#f5d76e",
    maxStacks: 1,
    durationRange: [300, 900],
    weight: 6,
  },
  dot: {
    key: "dot",
    name: "출혈",
    desc: "초당 지속 피해",
    color: "#e05252",
    maxStacks: 5,
    durationRange: [3000, 6000],
    weight: 20,
  },
  chill: {
    key: "chill",
    name: "냉기",
    desc: "이동 속도 감소 + 받는 피해 증가",
    color: "#5bc8ff",
    maxStacks: 3,
    durationRange: [2000, 4000],
    weight: 16,
  },
  shock: {
    key: "shock",
    name: "감전",
    desc: "받는 피해 증가 + 짧은 경직",
    color: "#c084fc",
    maxStacks: 2,
    durationRange: [1200, 2400],
    weight: 14,
  },
  mark: {
    key: "mark",
    name: "표식",
    desc: "받는 치명타 확률 증가",
    color: "#ff9f1c",
    maxStacks: 4,
    durationRange: [4000, 8000],
    weight: 12,
  },
  weaken: {
    key: "weaken",
    name: "쇠약",
    desc: "공격력 감소",
    color: "#9aa5b1",
    maxStacks: 4,
    durationRange: [2500, 5000],
    weight: 10,
  },
};

/** 받는 피해 배수 상한. chill+shock+mark 만렙 합(1.58)보다 살짝 위 — 안전 여유. */
export const MAX_RECEIVED_MULT = 1.6;
/** 표식 치명타 가산 상한. 기본 크리 위에 더해지므로 25%p 를 넘기지 않는다. */
export const MAX_CRIT_BONUS = 0.25;
/** 쇠약 공격력 배수 하한. 4스택에서 정확히 닿는다. */
export const MIN_ATK_MULT = 0.6;

/**
 * 각 상태의 **주 효과** 계수 (스택 1당).
 *
 * "주 효과" 인 이유: mark 는 치명타와 받는 피해 양쪽에 걸치는데, 한 함수가
 * 두 값을 돌려줄 수는 없다. 그래서 여기서는 표시·툴팁의 기준이 되는 대표값만
 * 돌려주고, 받는 피해 쪽 기여는 아래 RECEIVED_PER_STACK 이 따로 갖는다.
 */
const PRIMARY_PER_STACK: Record<StatusKey, number> = {
  slow: 0.12, // 이속 감소 비율
  stun: 1, // 이진 효과 (있으면 1)
  dot: 0.08, // 초당 피해 = 공격력 × 이 값
  chill: 0.06, // 받는 피해 증가
  shock: 0.1, // 받는 피해 증가
  mark: 0.06, // 치명타 확률 증가
  weaken: 0.1, // 공격력 감소
};

/** 받는 피해 배수에 실제로 기여하는 스택당 계수. mark 는 주 효과가 크리라 더 작다. */
const RECEIVED_PER_STACK: Partial<Record<StatusKey, number>> = {
  chill: 0.06,
  shock: 0.1,
  mark: 0.05,
};

/** key 별 스택 합산 (중복 엔트리 병합 후 maxStacks 포화). 입력은 건드리지 않는다. */
function aggregate(statuses: readonly StatusStack[] | null | undefined): Map<StatusKey, number> {
  const merged = new Map<StatusKey, number>();
  for (const s of statuses ?? []) {
    if (!s || !(s.key in STATUS_DEFS)) continue;
    const add = Math.max(0, Math.floor(Number.isFinite(s.stacks) ? s.stacks : 0));
    merged.set(s.key, (merged.get(s.key) ?? 0) + add);
  }
  for (const [key, stacks] of merged) merged.set(key, Math.min(stacks, STATUS_DEFS[key].maxStacks));
  return merged;
}

/**
 * 부동소수 잔차 제거 — 0.06*3 이 0.18000000000000002 로 나와 배수가 1.3800000000000001 이
 * 되는 것을 막는다. 이런 값이 곱해지면 최종 피해가 1 차이로 어긋나고, 테스트가 아니라
 * **전투 로그**에서 먼저 티가 난다. 6자리면 이 파일의 모든 계수의 배수를 정확히 표현한다.
 */
function clean(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

/**
 * 해당 스택 수에서의 주 효과 계수(총량). maxStacks 를 넘는 스택은 버린다.
 * 예: stackEffect("mark", 4) === 0.24, stackEffect("mark", 99) === 0.24
 */
export function stackEffect(key: StatusKey, stacks: number): number {
  const def = STATUS_DEFS[key];
  if (!def) return 0;
  const n = Math.max(0, Math.min(Math.floor(Number.isFinite(stacks) ? stacks : 0), def.maxStacks));
  return PRIMARY_PER_STACK[key] * n;
}

/**
 * chill / shock / mark 를 종합한 **받는 피해 배수**. 상태가 없으면 정확히 1.
 * 합산식으로 더한다(곱하면 상태가 늘 때마다 지수로 뛴다 — damageModel 의 교훈).
 */
export function receivedDamageMult(statuses: readonly StatusStack[]): number {
  let add = 0;
  for (const [key, stacks] of aggregate(statuses)) {
    const per = RECEIVED_PER_STACK[key];
    if (per) add += per * stacks;
  }
  return Math.min(MAX_RECEIVED_MULT, clean(1 + Math.max(0, add)));
}

/** 표식(mark)이 더하는 치명타 확률. 상한 0.25. */
export function critChanceBonus(statuses: readonly StatusStack[]): number {
  const mark = aggregate(statuses).get("mark") ?? 0;
  return Math.min(MAX_CRIT_BONUS, clean(PRIMARY_PER_STACK.mark * mark));
}

/** 쇠약(weaken)을 반영한 공격력 배수. 하한 0.6 — 0 이 되면 적이 무해해진다. */
export function atkMultFromStatuses(statuses: readonly StatusStack[]): number {
  const weaken = aggregate(statuses).get("weaken") ?? 0;
  return Math.max(MIN_ATK_MULT, clean(1 - PRIMARY_PER_STACK.weaken * weaken));
}

/**
 * 상태를 부여/갱신한다 (순수). 이미 있으면 스택을 더하고 지속시간은 **갱신**한다
 * (짧은 재적용이 긴 지속시간을 깎지 않도록 max). 스택은 maxStacks 에서 포화.
 */
export function applyStatus(
  statuses: readonly ActiveStatus[],
  key: StatusKey,
  stacks = 1,
  durMs?: number,
): ActiveStatus[] {
  const def = STATUS_DEFS[key];
  if (!def) return statuses.map((s) => ({ ...s }));
  const dur = durMs ?? def.durationRange[1];
  const add = Math.max(1, Math.floor(Number.isFinite(stacks) ? stacks : 1));

  const out: ActiveStatus[] = [];
  let found = false;
  for (const s of statuses) {
    if (s.key !== key) {
      out.push({ ...s });
      continue;
    }
    if (found) continue; // 같은 key 중복 엔트리는 하나로 합친다
    found = true;
    out.push({
      key,
      stacks: Math.min(def.maxStacks, Math.max(0, Math.floor(s.stacks)) + add),
      remainingMs: Math.max(s.remainingMs, dur),
    });
  }
  if (!found) out.push({ key, stacks: Math.min(def.maxStacks, add), remainingMs: Math.max(0, dur) });
  return out;
}

/**
 * 시간을 흘려 만료된 상태를 걷어낸다 (순수). 입력 배열은 그대로 두고 새 배열을 준다.
 * 남은 상태는 원본 객체를 복사해 remainingMs 만 줄인다 — 호출자 쪽 참조를 오염시키지 않게.
 */
export function tickStatuses(
  statuses: readonly ActiveStatus[],
  dtMs: number,
): { statuses: ActiveStatus[]; expired: StatusKey[] } {
  const dt = Math.max(0, Number.isFinite(dtMs) ? dtMs : 0);
  const alive: ActiveStatus[] = [];
  const expired: StatusKey[] = [];
  for (const s of statuses) {
    const remainingMs = s.remainingMs - dt;
    if (remainingMs > 0) alive.push({ ...s, remainingMs });
    else expired.push(s.key);
  }
  return { statuses: alive, expired };
}
