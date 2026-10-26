/**
 * scene/fxAtoms.ts — FX 원자 연산 (vc189, WorldScene 분할 3차)
 *
 * 왜 분리하나
 *   파티클 버스트 / 빛기둥 / 픽업 텍스트는 "좌표 + 색 + 개수"만 받아
 *   스스로 정리(tween onComplete → destroy)되는 말단 연산이다.
 *   게임 상태를 읽지도 쓰지도 않아 가장 안전하게 떼어낼 수 있다.
 *
 * 동작 보존
 *   원본 WorldScene 의 본문을 한 줄도 바꾸지 않고 옮겼다.
 *   v4.1.0 적응형 품질(fxScale 배율, 최소 3개), v1.4.3 풀 미준비 방어,
 *   ADD 블렌드 depth 24~26, tween 시간·이징 전부 그대로.
 *
 * 제외한 것
 *   spawnHitSpark 는 hitEmitter/hitFxPool/shockRingPool/starPool/HIT_FLIPBOOK 등
 *   6개 풀에 결합돼 있어 이번 분리에서 제외했다(부분 이관은 오히려 위험).
 */
import Phaser from "phaser";

/** 파티클 이미터의 최소 표면 — Phaser 타입 의존을 줄인다 */
export interface BurstEmitter {
  setParticleTint: (tint: number) => void;
  explode: (count: number, x: number, y: number) => void;
}

export interface FxAtomHost {
  add: Phaser.GameObjects.GameObjectFactory;
  tweens: Phaser.Tweens.TweenManager;
  /** 적응형 품질 배율 (저사양 0.45 / 기본 1) */
  fxScale: number;
  burstEmitter: BurstEmitter | null;
  /** 픽업 텍스트 풀 — 비활성 개체를 재사용한다 */
  pickPool: Phaser.GameObjects.Text[];
}

/** 파티클 버스트 — 풀 빌드 전 호출은 조용히 무시(v1.4.3) */
export function spawnBurstAt(host: FxAtomHost, x: number, y: number, n: number, tint: number): void {
  if (!host.burstEmitter) return;
  const count = Math.max(3, Math.round(n * host.fxScale));
  host.burstEmitter.setParticleTint(tint);
  host.burstEmitter.explode(count, x, y);
}

/** 빛기둥 — ADD 블렌드 사각형 2겹 + 글로우 2겹을 위로 뽑아 올린 뒤 소멸 */
export function spawnPillar(
  host: FxAtomHost,
  x: number,
  y: number,
  tint = 0xffe9a0,
  height = 120,
): void {
  const { add, tweens } = host;
  const pillar = add
    .rectangle(x, y - height / 2 + 14, 22, height, tint, 0.75)
    .setDepth(25)
    .setBlendMode(Phaser.BlendModes.ADD);
  const core = add
    .rectangle(x, y - height / 2 + 14, 8, height * 0.92, 0xffffff, 0.9)
    .setDepth(26)
    .setBlendMode(Phaser.BlendModes.ADD);
  const glow = add
    .image(x, y, "glow")
    .setDepth(24)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setTint(tint)
    .setScale(1.2)
    .setAlpha(0.8);
  const flash = add
    .image(x, y, "glow")
    .setDepth(24)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setTint(0xffffff)
    .setScale(0.9)
    .setAlpha(0.95);

  tweens.add({ targets: pillar, alpha: 0, scaleY: 0.2, duration: 320, ease: "Quad.in", onComplete: () => pillar.destroy() });
  tweens.add({ targets: core, alpha: 0, scaleY: 0.12, duration: 260, ease: "Quad.in", onComplete: () => core.destroy() });
  tweens.add({ targets: glow, alpha: 0, scale: 0.4, duration: 380, onComplete: () => glow.destroy() });
  tweens.add({ targets: flash, alpha: 0, scale: 1.7, duration: 180, onComplete: () => flash.destroy() });
  spawnBurstAt(host, x, y, 14, tint);
}

/** 픽업 텍스트 — 풀에서 하나 꺼내 위로 띄우고 반납 */
export function spawnPickupText(
  host: FxAtomHost,
  x: number,
  y: number,
  msg: string,
  color: string,
): void {
  const t = host.pickPool.find((d) => d.scene && !d.active);
  if (!t) return;
  t.setText(msg).setColor(color);
  t.setPosition(x, y).setActive(true).setVisible(true).setAlpha(1).setScale(1);
  host.tweens.add({
    targets: t,
    y: y - 40,
    alpha: 0,
    duration: 750,
    ease: "Quad.out",
    onComplete: () => {
      t.setColor("#ffffff");
      t.setActive(false).setVisible(false);
    },
  });
}
