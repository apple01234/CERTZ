/** 히트스톱 길이(ms). 자주 불리는 hit·kill 은 늘리지 않는다. Phaser 없이 테스트하려고 분리했다. */
export const HITSTOP = {
  /** 일반 타격 (Enemy.takeHit) */
  hit: 26,
  /** 원소 반응 폭발 */
  reaction: 45,
  /** 치명타 */
  crit: 55,
  /** 다단 스킬의 한 타 */
  skillTick: 60,
  /** 적 처치 */
  kill: 70,
  /** 돌진·순간이동 강타 */
  skillHeavy: 100,
  /** 지연 폭발 마무리 */
  skillFinisher: 120,
  /** 궁극기급 마무리 */
  ultFinisher: 140,
} as const;

export type HitStopKind = keyof typeof HITSTOP;

/** 프리셋 이름 또는 ms 를 ms 로 바꾼다. 알 수 없는 이름은 일반 타격으로 본다. */
export function hitStopMs(v: HitStopKind | number | undefined): number {
  if (typeof v === "number") return v;
  return HITSTOP[v ?? "hit"] ?? HITSTOP.hit;
}
