/**
 * 2026-11-18 — 히트스톱 사건 프리셋 (레퍼런스: Endless Wander `FreezeFrameType` + `FreezeFrameTypeSetup`).
 *
 * 종전에는 호출 9곳이 26·45·55·60·70·100·120·140ms 를 직접 넘겨 "어떤 사건에 얼마"가 코드에
 * 흩어져 있었다. 값은 **종전 숫자 그대로** 옮겼다(체감 변화 0). 조정은 이 표 한 곳에서만 한다.
 * 자주 호출되는 지점(hit·kill)은 절제 규칙 때문에 늘리지 않는다.
 * Phaser 를 import 하지 않는 순수 모듈 — 노드 테스트에서 직접 검증한다.
 */
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
