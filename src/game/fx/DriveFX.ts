import Phaser from "phaser";

/**
 * v1.3.0 (#에셋통합) — 유저 Drive 팩(Unity VFX 3종, 총 307MB)에서 변환한 vfx2_* 텍스처의
 * 게임 통합 레이어. 전투 타격감(참격/크리/폭발)·오라 링·번개·마법진·불꽃놀이 연출.
 *
 *  출처 팩:
 *   - Matthew Guz Slash Effects FREE (참격 3종/크리/폭발/충격파)
 *   - GameVFX Buff Collection (번개/플레어/링/트윙클)
 *   - Vefects Anime Stylized VFX (임팩트 스타/파티클/구름)
 *   - Hovl Studio Magic effects (마법진/눈꽃/하트/크리스탈)
 *   - UNI VFX Missiles & Explosions (별하늘/화염 충격파/폭발 코어)
 *   - CartoonVFX9X FireworksEffect2D (네온 하트/달/별/미소/삼각형)
 *
 *  설계 원칙:
 *   - 전부 흑백/알파 텍스처 → setTint로 원소색 대응
 *   - 풀링 없는 fire-and-forget (tween onComplete destroy) — 호출 빈도 낮은 연출 전용
 *   - fxLevel 0(절전)에서는 파티클 폭발량 축소
 */

export class DriveFX {
  constructor(private scene: Phaser.Scene) {}

  private get lowFx(): boolean {
    try {
      return (this.scene.game as unknown as { __sertzFxLevel?: number }).__sertzFxLevel === 0;
    } catch {
      return false;
    }
  }

  /** 근접 참격 궤적 — Matthew Guz 5-Slash (방향 회전 + 스케일 펄스). angle: 라디안(진행 방향) */
  slashArc(x: number, y: number, angle: number, tint = 0xffffff, big = false) {
    const key = big ? "vfx_slash_m" : "vfx_slash";
    const im = this.scene.add
      .image(x, y, key)
      .setDepth(25)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setRotation(angle)
      .setScale(big ? 1.15 : 0.72)
      .setAlpha(0.95);
    this.scene.tweens.add({
      targets: im,
      scale: big ? 1.5 : 0.95,
      alpha: 0,
      duration: 200,
      ease: "Quad.out",
      onComplete: () => im.destroy(),
    });
  }

  /** 크리티컬 버스트 — 5-Crit 별 + 플래시 + 트윙클 파편 */
  critBurst(x: number, y: number, tint = 0xffd76a) {
    const star = this.scene.add
      .image(x, y - 8, "vfx_crit")
      .setDepth(26)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(0.3)
      .setRotation(Phaser.Math.FloatBetween(0, Math.PI));
    const flash = this.scene.add
      .image(x, y - 8, "vfx_flash")
      .setDepth(27)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffffff)
      .setScale(0.35)
      .setAlpha(0.9);
    this.scene.tweens.add({ targets: star, scale: 1.05, alpha: 0, rotation: star.rotation + 0.6, duration: 300, ease: "Quad.out", onComplete: () => star.destroy() });
    this.scene.tweens.add({ targets: flash, scale: 1.1, alpha: 0, duration: 160, onComplete: () => flash.destroy() });
    /* 트윙클 4~6개 사방 산개 (절전 모드 2개) */
    const n = this.lowFx ? 2 : 5;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const d = 20 + Math.random() * 22;
      const tw = this.scene.add
        .image(x + Math.cos(a) * d, y - 8 + Math.sin(a) * d * 0.7, "vfx_twinkle")
        .setDepth(26)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(tint)
        .setScale(0.4 + Math.random() * 0.3)
        .setAlpha(0.95);
      this.scene.tweens.add({ targets: tw, alpha: 0, scale: 0, duration: 340 + Math.random() * 160, onComplete: () => tw.destroy() });
    }
  }

  /** 폭발 — 5-explosion 퍼프 + UNI 폭발 코어 + 충격파 링 */
  explosion(x: number, y: number, tint = 0xff9a5a) {
    const boom = this.scene.add
      .image(x, y - 6, "vfx_explosion")
      .setDepth(25)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(0.35)
      .setRotation(Math.random() * Math.PI * 2);
    const core = this.scene.add
      .image(x, y - 6, "vfx_expc")
      .setDepth(26)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xfff2d0)
      .setScale(0.25)
      .setAlpha(0.95);
    const ring = this.scene.add
      .image(x, y - 6, "vfx_shock")
      .setDepth(24)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(0.3)
      .setAlpha(0.9);
    this.scene.tweens.add({ targets: boom, scale: 1.0, alpha: 0, duration: 340, onComplete: () => boom.destroy() });
    this.scene.tweens.add({ targets: core, scale: 0.9, alpha: 0, duration: 220, onComplete: () => core.destroy() });
    this.scene.tweens.add({ targets: ring, scale: 1.35, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
  }

  /** 확장 충격파 링 — vfx_ring (기존 shock_ring 대비 선명한 림) */
  shockRing(x: number, y: number, tint = 0xffffff, target = 1.2) {
    const ring = this.scene.add
      .image(x, y - 6, "vfx_ring")
      .setDepth(24)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(0.22)
      .setAlpha(0.92);
    this.scene.tweens.add({ targets: ring, scale: target, alpha: 0, duration: 430, ease: "Quad.out", onComplete: () => ring.destroy() });
  }

  /** 낙뢰 — GameVFX Electro 볼트 하강 + 착지 플래시 (스톰브링어/아크메이지 강화) */
  bolt(x: number, y: number, tint = 0x9ad8ff) {
    const b = this.scene.add
      .image(x, y - 46, "vfx_bolt")
      .setDepth(27)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(1.1)
      .setAlpha(0.95);
    const flash = this.scene.add
      .image(x, y - 4, "vfx_flash")
      .setDepth(27)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffffff)
      .setScale(0.5);
    this.scene.tweens.add({ targets: b, alpha: 0, scaleY: 0.6, duration: 240, onComplete: () => b.destroy() });
    this.scene.tweens.add({ targets: flash, alpha: 0, scale: 1.0, duration: 180, onComplete: () => flash.destroy() });
  }

  /** 마법진 — Hovl MagicCircle 회전 소환 (보스 등장/마법 스킬 지면 표시) */
  magicCircle(x: number, y: number, tint = 0xb08aff, durMs = 900, big = false) {
    const c = this.scene.add
      .image(x, y, big ? "vfx_magic" : "vfx_magic2")
      .setDepth(8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(big ? 0.5 : 0.3)
      .setAlpha(0.85);
    this.scene.tweens.add({ targets: c, rotation: Math.PI * 2, duration: durMs * 2, repeat: -1 });
    this.scene.tweens.add({ targets: c, alpha: 0, duration: durMs, delay: durMs * 0.45, onComplete: () => c.destroy() });
  }

  /** 불꽃놀이 폭발 — 네온 도형(하트/별/달/삼각형) 산개 (레벨업·랭킹 축하) */
  fireworks(x: number, y: number, tints = [0xff6a8a, 0xffd76a, 0x7de8ff, 0xb08aff]) {
    const keys = ["vfx_fw_heart", "vfx_fw_star_b", "vfx_fw_star_y", "vfx_fw_moon", "vfx_fw_tri", "vfx_fw_smile"];
    const n = this.lowFx ? 8 : 16;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const d = 46 + Math.random() * 58;
      const im = this.scene.add
        .image(x, y, keys[i % keys.length])
        .setDepth(31)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(tints[i % tints.length])
        .setScale(0.32)
        .setRotation(Math.random() * Math.PI * 2);
      this.scene.tweens.add({
        targets: im,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d * 0.75,
        scale: 0.52,
        alpha: 0,
        rotation: im.rotation + Phaser.Math.FloatBetween(-1.2, 1.2),
        duration: 620 + Math.random() * 320,
        ease: "Quad.out",
        onComplete: () => im.destroy(),
      });
    }
  }

  /** 치유 하트 상승 — 회복 스킬/물약 보조 연출 */
  healPuff(x: number, y: number) {
    for (let i = 0; i < 3; i++) {
      const h = this.scene.add
        .image(x + Phaser.Math.Between(-14, 14), y - Phaser.Math.Between(0, 12), "vfx_heal_heart")
        .setDepth(26)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0x9affb0)
        .setScale(0.4)
        .setAlpha(0.9);
      this.scene.tweens.add({ targets: h, y: h.y - 30, alpha: 0, duration: 620 + i * 120, onComplete: () => h.destroy() });
    }
  }

  /** 원소 버스트 — 원소 키에 따라 텍스처/소리를 바꿔 산개. 스킬 AoE 착지 공용 */
  elementBurst(x: number, y: number, elem: string) {
    const e = (elem ?? "").toLowerCase();
    let tex = "vfx_ist";
    let tint = 0xffffff;
    if (e === "fire" || e === "flame" || e === "magma") { tex = "vfx_fire"; tint = 0xff9a5a; }
    else if (e === "ice" || e === "frost" || e === "water") { tex = "vfx_snow"; tint = 0x9ad8ff; }
    else if (e === "dark" || e === "void" || e === "shadow") { tex = "vfx_cl1"; tint = 0xb08aff; }
    else if (e === "light" || e === "holy") { tex = "vfx_flare"; tint = 0xffe9a0; }
    else if (e === "elec" || e === "storm" || e === "thunder") { tex = "vfx_bolt2"; tint = 0x9ad8ff; }
    else if (e === "poison" || e === "toxic") { tex = "vfx_splat"; tint = 0x8aff5a; }
    else if (e === "nature") { tex = "vfx_flower"; tint = 0x9affb0; }
    else if (e === "earth") { tex = "vfx_cl2"; tint = 0xd8b08a; }
    const main = this.scene.add
      .image(x, y - 6, tex)
      .setDepth(25)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(0.3);
    this.scene.tweens.add({ targets: main, scale: 1.1, alpha: 0, duration: 380, ease: "Quad.out", onComplete: () => main.destroy() });
    this.shockRing(x, y, tint, 0.9);
  }

  /** 수집 반짝임 — 드롭 픽업/보상 수령 보조 (트윙클 1장) */
  twinkle(x: number, y: number, tint = 0xffe9a0) {
    const tw = this.scene.add
      .image(x, y, "vfx_twinkle")
      .setDepth(27)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(0.5)
      .setAlpha(0.95);
    this.scene.tweens.add({ targets: tw, scale: 0.1, alpha: 0, duration: 300, onComplete: () => tw.destroy() });
  }
}
