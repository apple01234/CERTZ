import Phaser from "phaser";

/**
 * 타격감 통합 모듈 (Hit Stop + Camera Shake)
 *
 * Hit Stop  : 명중 순간 게임 월드(물리)를 아주 짧게 정지시켜 "단단히 맞고 멈춘" 느낌을 준다.
 *             (세르츠 프로젝트 기본 65ms — 프레임 감소 없이 체감 타격감을 만드는 핵심 장치)
 * Camera Shake : 흔들림 강도(intensity)는 게임 크기(960x540) 대비 비율.
 *             0.002 ≈ 약 2px — "느껴지지만 눈에 거슬리지 않는" 절제선.
 *             기본공격은 절제하고, 크리티컬/스킬처럼 강한 순간만 강조해 대비를 만든다.
 */
export const IMPACT_PROFILES = {
  /** 기본 공격 — 히트스톱으로 타격감 유지, 셰이크는 최소로 절제 (기존 0.006 → 과다 피드백 반영)
   *  v2.2: 65→55ms — 이동 중 공격 시 세계 정지 체감을 줄여 스터터 완화 */
  basic: { hitStopMs: 55, shakeMs: 45, shakeInt: 0.0018 },
  /** 크리티컬 — 기본보다 확실히 강조 (히트스톱 연장 + 더 큰 흔들림) */
  crit: { hitStopMs: 90, shakeMs: 110, shakeInt: 0.0035 },
  /** 스킬(회전베기/돌진베기) — 중간 강도 */
  skill: { hitStopMs: 70, shakeMs: 110, shakeInt: 0.003 },
} as const;

export type ImpactKind = keyof typeof IMPACT_PROFILES;

export class ImpactFX {
  private frozen = false;

  constructor(private scene: Phaser.Scene) {}

  /**
   * Hit Stop — 월드 물리를 ms 동안 정지.
   * 연타로 여러 번 걸려도 한 번만 정지(frozen 가드), 정지 중 새 요청은 무시된다.
   */
  hitStop(ms: number) {
    if (this.frozen || ms <= 0) return;
    const world = this.scene.physics.world;
    this.frozen = true;
    world.pause();
    this.scene.time.delayedCall(ms, () => {
      this.frozen = false;
      world.resume();
    });
  }

  /** Camera Shake — 진행 중인 셰이크는 새 파라미터로 대체됨(Phaser 카메라 이펙트 특성) */
  shake(ms: number, intensity: number) {
    if (ms <= 0 || intensity <= 0) return;
    this.scene.cameras.main.shake(ms, intensity);
  }

  /** 등급 프로파일로 히트스톱 + 셰이크를 한 번에 적용 */
  trigger(kind: ImpactKind) {
    const p = IMPACT_PROFILES[kind];
    this.hitStop(p.hitStopMs);
    this.shake(p.shakeMs, p.shakeInt);
  }
}
