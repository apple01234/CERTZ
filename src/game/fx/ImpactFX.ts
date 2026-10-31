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
  /** 크리티컬 — 기본보다 확실히 강조 (히트스톱 연장 + 더 큰 흔들림)
   *  v1.0.7 — 셰이크 0.0035/110ms → 0.0027/90ms (유저 지시: 이펙트 가림 축소 — 타격감은 히트스톱이 담당) */
  crit: { hitStopMs: 90, shakeMs: 90, shakeInt: 0.0027 },
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
   * v1.3.1 (#8 게임 멈춤 수정) — 재개 시 대사/전환/부활이 물리를 정지 중이면 건너뛴다.
   *  기존엔 무조건 resume() → 대사 중 히트스톱이 물리를 깨워 정지 규약을 깨고,
   *  씬 전환 경합 시 정지/재개 순서가 어긋나면 "조작 죽은 멈춤"으로 이어졌다.
   */
  hitStop(ms: number) {
    if (this.frozen || ms <= 0) return;
    const world = this.scene.physics.world;
    this.frozen = true;
    world.pause();
    this.scene.time.delayedCall(ms, () => {
      this.frozen = false;
      const s = this.scene as unknown as { dialoguing?: boolean; transitioning?: boolean };
      if (s.dialoguing || s.transitioning) return; // 정지한 주인(대사/전환)이 회수 — 무단 재개 금지
      if (this.scene.scene.isActive() && this.scene.physics.world === world) world.resume();
    });
  }

  /** Camera Shake — 진행 중인 흔들림을 **약화시키지 않으면서** 약한 요청도 반영한다.
   *
   *  vc209 (#game-feel) — Phaser `Shake.start()` 는 `if (!force && this.isRunning) return`
   *  이라, 진행 중인 셰이크가 있으면 새 요청을 **통째로 버린다**.
   *  SERTZ 는 스킬 시전 연출에 420~700ms 셰이크를 47곳(전체 123회 중 38%)에서 걸고 있어,
   *  그 시간창 안에 들어온 크리티컬/스킬 명중의 셰이크(90~110ms)가 전부 무시됐다.
   *  → "때리는데 손맛이 없다"의 실제 원인.
   *
   *  단 `force = true` 는 답이 아니다 — `update()` 가 `duration` 을 새 값으로 덮어쓰므로
   *  700ms 궁극기 연출이 90ms 크리티컬에 **잘려나간다**(반대 방향 버그).
   *
   *  그래서 남은 시간과 강도를 **비교해서 더 강한 쪽만** 채택한다:
   *   · 더 센 타격이 오면 → 새로 시작(연출보다 명중이 우선)
   *   · 더 약한 타격이 오면 → 진행 중인 연출을 건드리지 않는다(손실 없음)
   *  진행 중인지 판정은 카메라 effect 의 `isRunning` 을 쓴다. */
  shake(ms: number, intensity: number) {
    if (ms <= 0 || intensity <= 0) return;
    const s = this.scene as unknown as { fxLevel?: number };
    if (s.fxLevel === 0) return;

    const fx = this.scene.cameras.main.shakeEffect as
      | { isRunning?: boolean; intensity?: { x: number }; duration?: number; _elapsed?: number }
      | undefined;

    if (fx?.isRunning && typeof fx.duration === "number" && typeof fx._elapsed === "number") {
      const remain = fx.duration - fx._elapsed;
      const curInt = fx.intensity?.x ?? 0;
      /* 현재 연출이 더 세고 더 오래 남으면 그대로 둔다 — 약한 요청이 강한 연출을 깎지 않게 */
      if (curInt >= intensity && remain >= ms) return;
    }
    this.scene.cameras.main.shake(ms, intensity, true);
  }

  /** 등급 프로파일로 히트스톱 + 셰이크를 한 번에 적용 */
  trigger(kind: ImpactKind) {
    const p = IMPACT_PROFILES[kind];
    this.hitStop(p.hitStopMs);
    this.shake(p.shakeMs, p.shakeInt);
  }

  /**
   * 매 프레임 호출 — 현재는 트라우마를 쓰지 않는다.
   *
   * vc209 설계 노트: 순수 트라우마 기반 셰이크(카메라 scroll 오프셋 직접 제어)는
   * 이 프로젝트에서 **쓸 수 없다**. `WorldScene.applyManualCameraFollow()` 가
   * 매 프레임 `setScroll()` 로 카메라 절대 위치를 확정하고(setScroll 호출 35곳),
   * 내가 오프셋을 더해도 다음 프레임에 덮어써진다.
   * 따라서 셰이크는 Phaser 내장 effect(카메라 내부 _offsetX/_offsetY 사용)에 맡기고,
   * 이 모듈은 **우선순위(force)** 와 **저사양 게이트**만 책임진다.
   *
   * 훅은 남겨 둔다 — 나중에 applyManualCameraFollow 쪽으로 오프셋을 주입하면
   * 여기서 감쇠를 담당하게 된다.
   */
  update(deltaMs: number) {
    void deltaMs;
  }
}
