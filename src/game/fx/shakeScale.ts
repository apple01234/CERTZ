/**
 * vc222 — 화면 흔들림 강도 배율 (접근성 설정).
 *
 * `agd-game-feel` 스킬이 권고한 "reduce screen shake" 옵션.
 * 멀미·전정기관 민감 사용자를 위해 흔들림만 줄이고, **히트스톱·사운드·파티클은
 * 그대로 둔다**(타격감의 다른 축은 유지 — 스킬: "Keep the audio and the particles").
 *
 * 게임플레이 영향은 없다. 판정·데미지·쿨다운 어디에도 쓰이지 않고
 * 카메라 오프셋 크기에만 곱해진다.
 *
 * 두 모듈이 같은 값을 읽어야 한다:
 *  · `ImpactFX.shake`      — Phaser 내장 셰이크(일반 타격)
 *  · `TraumaShake.update`  — 궁극기 시네마틱 오프셋
 * 그래서 모듈 스코프에 둔다(씬 인스턴스마다 복제되면 설정이 갈라진다).
 */

export type ShakeScale = "off" | "low" | "normal" | "strong";

/** 배율값 — 0 이면 흔들림 없음 */
export const SHAKE_FACTORS: Record<ShakeScale, number> = {
  off: 0,
  low: 0.45,
  normal: 1,
  strong: 1.45,
};

export const DEFAULT_SHAKE_SCALE: ShakeScale = "normal";
export const SHAKE_STORAGE_KEY = "sertz_shake_scale";

let current: ShakeScale = DEFAULT_SHAKE_SCALE;

/** 저장값을 읽어 초기 배율을 복원한다. 잘못된 값은 기본값으로 되돌린다. */
export function loadShakeScale(): ShakeScale {
  try {
    const raw = window.localStorage.getItem(SHAKE_STORAGE_KEY);
    if (raw === "off" || raw === "low" || raw === "normal" || raw === "strong") {
      current = raw;
    } else {
      current = DEFAULT_SHAKE_SCALE;
    }
  } catch {
    current = DEFAULT_SHAKE_SCALE;
  }
  return current;
}

export function getShakeScale(): ShakeScale {
  return current;
}

/** 현재 배율 계수(0~1.45). 흔들림 계산에 곱한다. */
export function shakeFactor(): number {
  return SHAKE_FACTORS[current] ?? 1;
}

export function setShakeScale(next: ShakeScale): void {
  current = next;
  try {
    window.localStorage.setItem(SHAKE_STORAGE_KEY, next);
  } catch {
    /* 저장 실패는 무시 — 이번 세션에는 적용된다 */
  }
}

/** 흔들림을 실제로 낼지. off 면 0 이므로 연출 자체를 건너뛴다. */
export function shakeEnabled(): boolean {
  return shakeFactor() > 0;
}
