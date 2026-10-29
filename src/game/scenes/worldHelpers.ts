/**
 * WorldScene 에서 분리한 순수 헬퍼 (v1.4.41 — 씬 분해 1단계)
 *
 *  이 파일은 **Phaser 씬 인스턴스에 의존하지 않는** 모듈 상수·함수만 담는다.
 *  WorldScene 이 14.8k 줄 단일 클래스라 어떤 변경도 전체 재컴파일·전체 리뷰를 요구했다.
 *  분해 원칙(phaser-2d-game): "씬은 얇게, 규칙·데이터는 밖으로". 여기서 옮기는 것은
 *  게임 규칙도 아니고 렌더 상태도 아닌, 양쪽에서 쓰는 순수 데이터/포맷터다.
 *
 *  동작 변경 0 — 값과 함수 본문을 그대로 옮겼다.
 */

import Phaser from "phaser";

/** 오라 애니메이션 설정 — sp: 위상 속도(초당) · s/l: HSL 채도/명도 · min/max: hue 범위 (0~1, rainbow=전체) */
export const AURA_ANIM: Record<string, { sp: number; s: number; l: number; min: number; max: number }> = {
  cos_rainbow: { sp: 0.10, s: 0.9, l: 0.62, min: 0, max: 1 },
  cos_aurora: { sp: 0.035, s: 0.75, l: 0.66, min: 0.33, max: 0.82 },
  cos_galaxy: { sp: 0.05, s: 0.6, l: 0.7, min: 0.55, max: 0.85 },
};

/* v1.4.3 (작업3 최적화) — 오라 색 LUT(64단계) 사전 계산:
 *  매 프레임 HSLToColor + Color 객체 할당(GC 압박)을 제거하고 테이블 조회로 대체.
 *  기존 hue 곡선(min/max 범위 + 코사인 왕복)을 그대로 재현 — 퀄리티 동일. */
export const AURA_LUT_STEPS = 64;
export const AURA_LUT: Record<string, number[]> = {};
for (const key of Object.keys(AURA_ANIM)) {
  const cfg = AURA_ANIM[key];
  const lut: number[] = [];
  for (let i = 0; i < AURA_LUT_STEPS; i++) {
    const phase = i / AURA_LUT_STEPS;
    const hue = cfg.min + (cfg.max - cfg.min) * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2));
    lut.push(Phaser.Display.Color.HSLToColor(hue, cfg.s, cfg.l).color);
  }
  AURA_LUT[key] = lut;
}

/** v1.0.16 — 보상형 광고 실패 사유 → 안내 문구 (호출부 3곳 공용).
 *  종전엔 세 곳이 동일한 2분기 삼항식을 복사해 쓰고 있었다. */
export function adFailText(reason?: string): string {
  if (reason === "web") return "광고 보상은 폰 버전(APK)에서 볼 수 있어";
  if (reason === "offline") return "인터넷이 끊겨 있어 — 연결한 뒤 다시 시도하자";
  if (reason === "no-reward") return "보상이 확인되지 않았다 — 다시 시도하자";
  return "광고를 못 봤다 — 다시 시도하자";
}

/** v1.0.16 — 타격 스파크 플립북 3종. 매 타격마다 배열 리터럴을 만들지 않도록 모듈 상수로 둔다. */
export const HIT_FLIPBOOK = ["fx2-hit1", "fx2-hit3", "fx2-hit5"];
