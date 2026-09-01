// 아뜰란티스 — 성물 상성 시스템 (클래스)
// ─────────────────────────────────────────────────────────────────────────────
// 캐릭터가 성물(렐릭)을 장착하면 특정 속성 몬스터에게 주는 데미지 배율이 바뀐다.
//   · 성물의 counters 속성 == 몬스터 attr  → ×2.2 (상성 카운터)
//   · 라그나로크의 그림자(최종 보스)      → ×0.6 (단, 카운터 성물이면 ×2.2 우선)
//   · 그 외                                → ×1.0
// WorldScene.elementMult() 가 이 클래스를 위임 호출하며,
// React UI(가방/도움말)도 describe() 로 같은 규칙을 문구로 쓴다.
import { relicOf, ELEMENTS, type RelicId, type RelicDef, type MonsterDef, type ElementId } from './data';

export type AffinityKind = 'counter' | 'boss_shield' | 'neutral';

export interface AffinityResult {
  /** 데미지 배율 (2.2 | 0.6 | 1) */
  mult: number;
  /** 판정 종류 — UI 색/문구 분기용 */
  kind: AffinityKind;
  /** 몬스터 속성 (없으면 null) */
  targetAttr: ElementId | null;
}

export class RelicAffinitySystem {
  private relic: RelicDef;

  constructor(relicId: RelicId | null) {
    this.relic = relicOf(relicId ?? 'rust');
  }

  /** 성물 장착 상태 갱신 */
  equip(relicId: RelicId | null): this {
    this.relic = relicOf(relicId ?? 'rust');
    return this;
  }

  /** 현재 장착 성물 */
  get equipped(): RelicDef {
    return this.relic;
  }

  /** 이 성물이 카운터하는 속성 (없으면 null) */
  get counters(): ElementId | null {
    return this.relic.counters;
  }

  /**
   * 몬스터에 대한 데미지 배율 판정.
   * 판정 순서가 게임 밸런스의 핵심 — 카운터 판정이 라그나로크 방어보다 항상 우선한다.
   */
  check(target: Pick<MonsterDef, 'attr' | 'key'>): AffinityResult {
    if (this.relic.counters && target.attr === this.relic.counters)
      return { mult: 2.2, kind: 'counter', targetAttr: target.attr };
    if (target.key === 'ragnarok')
      return { mult: 0.6, kind: 'boss_shield', targetAttr: target.attr };
    return { mult: 1, kind: 'neutral', targetAttr: target.attr };
  }

  /** 배율 숫자만 필요할 때 */
  multiplierFor(target: Pick<MonsterDef, 'attr' | 'key'>): number {
    return this.check(target).mult;
  }

  /** 속성 색상 (몬스터 머리 위 칩/투사체 틴트 공용) */
  static elementColor(attr: ElementId | null): string | null {
    return attr ? ELEMENTS[attr].color : null;
  }

  /** UI 문구 — "절제의 검 → 탐식 속성 ×2.2" */
  static describe(relicId: RelicId): string {
    const r = relicOf(relicId);
    return r.counters ? `${r.name} → ${ELEMENTS[r.counters].name} 속성 ×2.2` : `${r.name} (상성 없음)`;
  }

  // ── 전역 싱글턴: 씬/엔티티 어디서든 동일 판정을 쓰도록 ──
  private static shared = new RelicAffinitySystem(null);
  private static sharedId: RelicId | null = null;

  /**
   * 장착 중인 성물에 대응하는 공유 인스턴스를 반환 (매 히트마다 재할당 없음).
   * G.eq 가 바뀌면 그 즉시 새 판정기로 교체된다.
   */
  static forEquipped(relicId: RelicId | null): RelicAffinitySystem {
    if (RelicAffinitySystem.sharedId !== relicId) {
      RelicAffinitySystem.shared = new RelicAffinitySystem(relicId);
      RelicAffinitySystem.sharedId = relicId;
    }
    return RelicAffinitySystem.shared;
  }
}
