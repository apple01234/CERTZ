/**
 * awareness.ts — 적 시야/인지 시스템 (JENNY `AwarenessTrait` 이식)
 *
 * ═══ 어디서 왔나 ═══
 * JENNY(Godot 4.6.1) `system/traits/awareness/awareness_trait.gd` (540줄).
 * 런앤건 게임에서 적 AI 가 "플레이어를 어디까지 아는가"를 관리하는 시스템이다.
 *
 * ═══ 원본의 핵심 설계 3가지 ═══
 *   ① **visible 과 true_visible 을 구분**한다.
 *      · true_visible : 지금 실제로 보인다(시야선 통과 + 거리 이내)
 *      · visible      : "안다". 시야에서 사라져도 `vision_omniscient_time`(기본 1초)
 *                       동안은 계속 안다 — 그래야 벽 뒤로 숨는 순간 즉시 잊지 않고
 *                       **마지막 목격 지점으로 이동**한다(자연스러운 추격).
 *   ② **last_known_position / last_known_visible_position** 을 따로 저장한다.
 *      전자는 마지막으로 "안다고 판단한" 위치(추적 목표),
 *      후자는 마지막으로 "실제로 본" 위치(정확한 조준).
 *   ③ **active_enemy 선택에 확률을 둔다.** 매번 최근접을 고르면 적이 우르르 몰려
 *      한 점에 뭉친다. 원본은 `active_enemy_closest_chance = 0.75` 로
 *      대부분 최근접을 고르되 25% 는 다른 적을 골라 분산시킨다.
 *
 * ═══ SERTZ 현황 ═══
 * 지금은 `c.dist < e.def.aggro` 하나만 본다. 그래서
 *   · 벽 뒤에 있어도 거리만 가까우면 추격한다(시야 개념 없음)
 *   · 플레이어가 시야에서 사라져도 즉시 배회로 돌아간다(추격 지속성 없음)
 * 이 모듈은 그 두 가지를 고친다. **기존 aggro 거리 판정을 대체하지 않고 보강**한다.
 *
 * ═══ 주의 ═══
 * 순수 함수 + 상태 객체로 만든다. Phaser 의존이 없어 테스트가 쉽고,
 * Enemy 가 자기 인스턴스에 상태를 들고 다니게 한다.
 */

/** 시야 판정에 필요한 최소 정보만 받는다(Phaser 비의존). */
export type VisionQuery = {
  /** 관찰자(적) 좌표 */
  x: number;
  y: number;
  /** 대상(플레이어) 좌표 */
  tx: number;
  ty: number;
  /** 관찰자 시야 반경(px) */
  range: number;
  /** 시야선 차단 검사 — true 면 "가려짐". 미지정이면 항상 보인다고 본다. */
  blocked?: (fromX: number, fromY: number, toX: number, toY: number) => boolean;
};

/** 한 대상에 대한 인지 상태 — JENNY 의 awareness_data[enemy] 에 대응. */
export type AwarenessEntry = {
  /** 지금 안다(추적 대상으로 삼을 수 있다) */
  visible: boolean;
  /** 지금 실제로 보인다(시야선 통과) */
  trueVisible: boolean;
  /** 추적 목표 — 마지막으로 "안다고 판단한" 위치 */
  lastKnownPosition: { x: number; y: number } | null;
  /** 마지막으로 "실제로 본" 위치 */
  lastKnownVisiblePosition: { x: number; y: number } | null;
  /** 마지막 목격 시각(ms) */
  lastKnownAt: number;
  /** 시야 반경 이내인가 */
  inRange: boolean;
};

export function makeEntry(): AwarenessEntry {
  return {
    visible: false,
    trueVisible: false,
    lastKnownPosition: null,
    lastKnownVisiblePosition: null,
    lastKnownAt: -Infinity,
    inRange: false,
  };
}

/**
 * 한 대상의 인지 상태를 갱신한다. JENNY `update_awareness()` 의 1인 대응.
 *
 * @param now 현재 시각(ms)
 * @param omniscientTime 시야에서 사라진 뒤에도 "안다"를 유지하는 시간(ms). 원본 1.0초.
 * @param alwaysChase 거리/시야 무시하고 항상 추적(보스 등)
 */
export function updateEntry(
  entry: AwarenessEntry,
  q: VisionQuery,
  now: number,
  omniscientTime: number,
  alwaysChase = false,
): AwarenessEntry {
  const dx = q.tx - q.x;
  const dy = q.ty - q.y;
  const dist2 = dx * dx + dy * dy;
  entry.inRange = alwaysChase || dist2 <= q.range * q.range;

  let seen = false;
  if (entry.inRange) {
    seen = !(q.blocked?.(q.x, q.y, q.tx, q.ty) ?? false);
  }

  if (seen) {
    /* 실제로 보이는 중 — 두 위치를 모두 갱신 */
    entry.lastKnownPosition = { x: q.tx, y: q.ty };
    entry.lastKnownVisiblePosition = { x: q.tx, y: q.ty };
    entry.lastKnownAt = now;
    entry.visible = true;
    entry.trueVisible = true;
    return entry;
  }

  /* 안 보인다 — 유예 시간 안이면 "위치는 안다"(추격 지속).
   * 이 부분이 JENNY 의 핵심이다. 없으면 벽 하나로 즉시 추격이 끊긴다. */
  const fresh = alwaysChase || now - entry.lastKnownAt <= omniscientTime;
  if (fresh) {
    entry.lastKnownPosition = { x: q.tx, y: q.ty };
    entry.visible = true;
    entry.trueVisible = false;
    return entry;
  }

  entry.visible = false;
  entry.trueVisible = false;
  return entry;
}

/** 추격 목표 좌표 — 실제로 보이면 대상 위치, 아니면 마지막 목격 지점. */
export function chaseTarget(entry: AwarenessEntry, q: VisionQuery): { x: number; y: number } | null {
  if (entry.trueVisible) return { x: q.tx, y: q.ty };
  return entry.lastKnownPosition;
}

/**
 * 추격을 포기해야 하는가.
 * JENNY 는 `disengagement_range` 를 별도로 두어, 유예 시간이 지나고
 * 그 거리 밖이면 놓아준다. 원본은 aggro(인지 시작)보다 넓은 값을 쓴다.
 */
export function shouldDisengage(
  entry: AwarenessEntry,
  q: VisionQuery,
  disengageRange: number,
): boolean {
  if (entry.visible) return false;
  const dx = q.tx - q.x;
  const dy = q.ty - q.y;
  return dx * dx + dy * dy > disengageRange * disengageRange;
}

/**
 * 여러 후보 중 추격 대상을 고른다 — JENNY `active_enemy` 선택 이식.
 *
 * 원본의 `active_enemy_closest_chance = 0.75` 를 그대로 가져온다:
 * 대부분 가장 가까운 적을 고르되, 25% 확률로 무작위 다른 적을 골라
 * 적들이 한 점에 뭉치는 것을 막는다.
 *
 * @param candidates 살아있는 후보 (가까운 순으로 정렬하지 않아도 된다)
 * @param rnd 0~1 난수 생성기
 * @param closestChance 최근접 선택 확률(기본 0.75)
 */
export function pickActive<T extends { x: number; y: number }>(
  candidates: readonly T[],
  from: { x: number; y: number },
  rnd: () => number,
  closestChance = 0.75,
): T | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  if (rnd() < closestChance) {
    let best = candidates[0];
    let bestD = Infinity;
    for (const c of candidates) {
      const d = (c.x - from.x) ** 2 + (c.y - from.y) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }
  return candidates[Math.floor(rnd() * candidates.length) % candidates.length];
}
