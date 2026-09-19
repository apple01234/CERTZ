import Phaser from "phaser";

/**
 * v1.3.0 (#8 에셋 활용 강화) — 유저 지시 "에셋 ㅈㄴㅈㄴㅈㄴ 많이 추가했으니 최대한 활용해서
 * 게임 디자인 및 기능 강화해": 구글드라이브 3대 VFX 팩(Vefects Anime·Hovl Studio·
 * GameVFX·PixelFX·Cainos·Petal Particles)에서 선별한 텍스처를 타격/회복/레벨업/
 * 환경 연출에 결합하는 헬퍼 레이어.
 *
 * 텍스처 공급원 (scripts/conv_v130_vfx.py 변환):
 *  vfx3_impact  — Vefects Anime Stylized VFX T_VFX_Impact_01 (크리티컬 별burst)
 *  vfx3_ring    — Vefects T_VFX_Ring_02 (레벨업/보상 링)
 *  vfx3_slash   — Vefects T_VFX_Slash_01 (참격 플래시)
 *  vfx3_heart   — Hovl Studio Magic Effects Heart (회복 하트)
 *  vfx3_flower  — Vefects T_VFX_Flower_01 (버프/수집 꽃)
 *  px_fire0..4  — PixelFX Vol1 Sprite Fire Idle (모닥불 화염 애니)
 *  cainos_water0..3 — Cainos Interactive Pixel Water (분수 물 튀김 애니)
 *  petal0       — Petal Particles Cherry Petals (마을 벚꽃 파티클)
 */

/** 크리티컬 임팩트 — Vefects 별burst + 참격 플래시 2겹 (기존 wx_splat 위에 얹힘) */
export function spawnCritStar(scene: Phaser.Scene, x: number, y: number, tint = 0xffe08a): void {
  if (!scene.textures.exists("vfx3_impact")) return;
  const star = scene.add
    .image(x, y - 8, "vfx3_impact")
    .setDepth(23)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setTint(tint)
    .setScale(0.3)
    .setRotation(Math.random() * Math.PI);
  scene.tweens.add({
    targets: star,
    scale: 0.72,
    alpha: 0,
    angle: star.angle + 40,
    duration: 260,
    ease: "Cubic.out",
    onComplete: () => star.destroy(),
  });
  if (scene.textures.exists("vfx3_slash")) {
    const slash = scene.add
      .image(x, y - 10, "vfx3_slash")
      .setDepth(23)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffffff)
      .setScale(0.5)
      .setRotation(Math.random() > 0.5 ? 0.5 : -0.5)
      .setAlpha(0.9);
    scene.tweens.add({
      targets: slash,
      alpha: 0,
      scaleX: 0.85,
      duration: 200,
      ease: "Cubic.out",
      onComplete: () => slash.destroy(),
    });
  }
}

/** 회복 하트 — 물약/엘릭서 사용 시 캐릭터 위로 떠오르는 하트 */
export function spawnHealHeart(scene: Phaser.Scene, x: number, y: number, tint = 0x7dffa8): void {
  if (!scene.textures.exists("vfx3_heart")) return;
  const heart = scene.add
    .image(x + Phaser.Math.Between(-8, 8), y - 20, "vfx3_heart")
    .setDepth(22)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setTint(tint)
    .setScale(0.28)
    .setAlpha(0.95);
  scene.tweens.add({
    targets: heart,
    y: heart.y - 26,
    alpha: 0,
    scale: 0.42,
    duration: 640,
    ease: "Sine.out",
    onComplete: () => heart.destroy(),
  });
}

/** 레벨업 링 — Vefects 링이 발밑에서 퍼지며 소멸 */
export function spawnLevelRing(scene: Phaser.Scene, x: number, y: number, tint = 0xffd76a): void {
  if (!scene.textures.exists("vfx3_ring")) return;
  const ring = scene.add
    .image(x, y + 14, "vfx3_ring")
    .setDepth(21)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setTint(tint)
    .setScale(0.25)
    .setAlpha(0.95);
  scene.tweens.add({
    targets: ring,
    scale: 1.5,
    alpha: 0,
    duration: 520,
    ease: "Cubic.out",
    onComplete: () => ring.destroy(),
  });
}

/** 마을 벚꽃 이미터 — Petal Particles 잎이 흩날리며 떨어진다 (fxLevel 게이트는 호출부) */
export function spawnPetalRain(scene: Phaser.Scene, w: number, h: number): Phaser.GameObjects.Particles.ParticleEmitter | null {
  if (!scene.textures.exists("petal0")) return null;
  const em = scene.add.particles(0, 0, "petal0", {
    x: { min: 0, max: w },
    y: -20,
    lifespan: { min: 7000, max: 11000 },
    speedY: { min: 26, max: 52 },
    speedX: { min: -34, max: 10 },
    rotate: { start: 0, end: 360 },
    scale: { min: 0.1, max: 0.2 },
    alpha: { start: 0.9, end: 0.15 },
    quantity: 1,
    frequency: 420,
  });
  em.setDepth(14);
  return em;
}
