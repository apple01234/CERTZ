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

  /* ============ v1.4.11 — Drive 신규 팩 2차 통합 (hv2_·mg_·tn_·cp_·pk_ 시리즈) ============ */

  /** 지균 데칼 — Hovl CraterFree (강타/낙뢰 착지). vc142 (#7): 원본이 가산 블렌드용 순흑 텍스처라
   *  NORMAL로 그리면 검은 사각형이 된다(유저 신고 "검은 네모") → ADD 블렌드로 강제해 검정=투명 처리 */
  crater(x: number, y: number, tint = 0x181008, scale = 1, dur = 2400) {
    if (!this.scene.textures.exists("hv2_crater")) return;
    const c = this.scene.add
      .image(x, y + 2, "hv2_crater")
      .setDepth(4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(0.5 * scale)
      .setAlpha(0);
    this.scene.tweens.add({ targets: c, alpha: 0.5, scaleX: scale, scaleY: scale, duration: 130, ease: "Quad.out" });
    this.scene.tweens.add({ targets: c, alpha: 0, duration: 400, delay: Math.max(0, dur - 400), onComplete: () => c.destroy() });
  }

  /** 중형 충격파 — Matthew Guz 5-Shockwave (기존 vfx_shock보다 두꺼운 임팩트 링) */
  shockHeavy(x: number, y: number, tint = 0xffd0a0, target = 1.35) {
    if (!this.scene.textures.exists("mg_shock0")) return;
    const r = this.scene.add
      .image(x, y - 4, "mg_shock0")
      .setDepth(24)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(0.3)
      .setAlpha(0.9);
    this.scene.tweens.add({ targets: r, scale: target, alpha: 0, duration: 460, ease: "Quad.out", onComplete: () => r.destroy() });
  }

  /** 번개 낙하 — Hovl Electro (보스 지진/폭풍 패턴 전용 섬광) */
  electroStrike(x: number, y: number, tint = 0xffd28a) {
    if (!this.scene.textures.exists("hv2_electro")) return;
    const b = this.scene.add
      .image(x, y - 52, "hv2_electro")
      .setDepth(27)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(1.3)
      .setAlpha(0);
    this.scene.tweens.add({ targets: b, alpha: 0.95, duration: 60, yoyo: true, hold: 60, onComplete: () => b.destroy() });
  }

  /** 결정 파편 팝 — Hovl CrystalFree (장판 폭발/소환 파편 산개) */
  crystalPop(x: number, y: number, tint = 0x8ad4ff, n = 3) {
    if (!this.scene.textures.exists("hv2_crystal")) return;
    const k = this.lowFx ? 1 : n;
    for (let i = 0; i < k; i++) {
      const a = (Math.PI * 2 * i) / Math.max(1, n) + Math.random() * 0.6;
      const c = this.scene.add
        .image(x, y, "hv2_crystal")
        .setDepth(26)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(tint)
        .setScale(0.4)
        .setRotation(a);
      this.scene.tweens.add({
        targets: c,
        x: x + Math.cos(a) * 46,
        y: y + Math.sin(a) * 30 - 18,
        alpha: 0,
        scale: 0.18,
        rotation: c.rotation + 0.9,
        duration: 420 + i * 60,
        ease: "Quad.out",
        onComplete: () => c.destroy(),
      });
    }
  }

  /** 참격 헤비 — Matthew Guz 6종 참격 중 지정 변형 (2차 극기/회전베기 오버레이) */
  slashHeavy(x: number, y: number, angle: number, variant = 0, tint = 0xfff0d0, big = false) {
    const key = `mg_slash${Math.max(0, Math.min(5, Math.round(variant)))}`;
    if (!this.scene.textures.exists(key)) return;
    const im = this.scene.add
      .image(x, y, key)
      .setDepth(25)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setRotation(angle)
      .setScale(big ? 1.3 : 0.95)
      .setAlpha(0.95);
    this.scene.tweens.add({ targets: im, scale: big ? 1.85 : 1.3, alpha: 0, duration: 240, ease: "Quad.out", onComplete: () => im.destroy() });
  }

  /** 먼지 — Toon dirt 2종 (강타/낙뢰 착지 충격 먼지) */
  dustPuff(x: number, y: number, scale = 1) {
    const keys = ["tn_dirt0", "tn_dirt1"];
    const n = this.lowFx ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const d = this.scene.add
        .image(x + Phaser.Math.Between(-16, 16), y + Phaser.Math.Between(-4, 4), keys[i % 2])
        .setDepth(9)
        .setTint(0xcab99a)
        .setScale(0.22 * scale)
        .setAlpha(0.75);
      this.scene.tweens.add({
        targets: d,
        x: d.x + Phaser.Math.Between(-34, 34),
        y: d.y - Phaser.Math.Between(4, 14),
        alpha: 0,
        scale: 0.4 * scale,
        duration: 480 + i * 90,
        ease: "Quad.out",
        onComplete: () => d.destroy(),
      });
    }
  }

  /** 타격 스파크 팝 — pk_spark (Particle Kit, 미사용 에셋 활성화) */
  sparkPop(x: number, y: number, tint = 0xfff0a0) {
    const key = this.scene.textures.exists("pk_spark_02") ? "pk_spark_02" : "pk_spark_04";
    if (!this.scene.textures.exists(key)) return;
    const s = this.scene.add
      .image(x, y, key)
      .setDepth(26)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(0.3)
      .setRotation(Math.random() * Math.PI)
      .setAlpha(0.9);
    this.scene.tweens.add({ targets: s, scale: 0.72, alpha: 0, rotation: s.rotation + 0.5, duration: 200, onComplete: () => s.destroy() });
  }

  /** 별 폭발 — pk_star (레벨업/보상 축하 보조) */
  starBurst(x: number, y: number, tint = 0xffe66a) {
    if (!this.scene.textures.exists("pk_star_01")) return;
    const n = this.lowFx ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const s = this.scene.add
        .image(x, y, "pk_star_01")
        .setDepth(30)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(tint)
        .setScale(0.34);
      this.scene.tweens.add({
        targets: s,
        x: x + Math.cos(a) * 54,
        y: y + Math.sin(a) * 40,
        alpha: 0,
        scale: 0.1,
        rotation: 1.2,
        duration: 520,
        ease: "Quad.out",
        onComplete: () => s.destroy(),
      });
    }
  }

  /** 사망 잔연기 — pk_smoke (몬스터 소멸 후 은은한 잔상) */
  deathPuff(x: number, y: number, tint = 0xcfc6de) {
    const key = this.scene.textures.exists("pk_smoke_01") ? "pk_smoke_01" : "cfxr_smoke";
    const s = this.scene.add
      .image(x, y - 8, key)
      .setDepth(11)
      .setTint(tint)
      .setScale(0.4)
      .setAlpha(0.8);
    this.scene.tweens.add({ targets: s, y: s.y - 26, scale: 0.85, alpha: 0, duration: 620, ease: "Quad.out", onComplete: () => s.destroy() });
  }

  /** 에메랄드 픽업 팝 — item_emerald (광고 보상/BM 지급 시계열 연출, 미사용 에셋 활성화) */
  emeraldPop(x: number, y: number, n = 1) {
    if (!this.scene.textures.exists("item_emerald")) return;
    const k = Phaser.Math.Clamp(n, 1, 8);
    for (let i = 0; i < k; i++) {
      const e = this.scene.add
        .image(x + Phaser.Math.Between(-18, 18), y, "item_emerald")
        .setDepth(30)
        .setScale(0.9)
        .setAlpha(0);
      this.scene.tweens.add({ targets: e, alpha: 1, y: y - 34 - i * 8, duration: 260, delay: i * 70, ease: "Quad.out" });
      this.scene.tweens.add({ targets: e, alpha: 0, y: e.y - 54, duration: 340, delay: 280 + i * 70, onComplete: () => e.destroy() });
    }
  }

  /** 벚꽃 잎 — CherryPetal 16프레임 시트 (타이틀/사쿠라 코스튬 착용자 전용 떨어짐) */
  petal(x: number, y: number, drift = 26) {
    if (!this.scene.textures.exists("cp_petal")) return;
    const fr = Phaser.Math.Between(0, 15);
    const p = this.scene.add
      .image(x, y, "cp_petal", fr)
      .setDepth(58)
      .setAlpha(0.92)
      .setScale(0.4)
      .setRotation(Math.random() * Math.PI);
    this.scene.tweens.add({
      targets: p,
      y: y + 70 + Math.random() * 30,
      x: x + Phaser.Math.FloatBetween(-drift, drift),
      rotation: p.rotation + Phaser.Math.FloatBetween(-1.4, 1.4),
      alpha: 0,
      duration: 1500 + Math.random() * 700,
      ease: "Sine.inOut",
      onComplete: () => p.destroy(),
    });
  }

  /* ==================== vc149 — 유저 제공 GameVFX 3D 팩 (gv_*) ====================
   *  Unity GameVFX Buff Collection + UNI VFX + Cartoon FX Remaster 원본 PNG에서
   *  추출한 고급 파티클 텍스처 81종 (scripts/vc149_gvfx_convert.py → assets/vfx3/).
   *  텍스처 부재 안전 (textures.exists 가드) · fxLevel 0에서 수량 절반. */

  private gvTex(key: string): boolean {
    return this.scene.textures.exists(key);
  }

  /** gv 확장 링 — fiery shockwave가 커지며 사라진다 (종결 연출 공용) */
  gvShock(x: number, y: number, tint = 0xffb070, scale = 1.4, dur = 700) {
    if (!this.gvTex("gv_uni_shockwave_fiery")) return;
    const im = this.scene.add.image(x, y, "gv_uni_shockwave_fiery")
      .setDepth(30).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.2 * scale).setAlpha(0.95);
    this.scene.tweens.add({ targets: im, scale: 1.35 * scale, alpha: 0, duration: dur, ease: "Cubic.out", onComplete: () => im.destroy() });
  }

  /** gv 코어 플래시 — 폭발 심장 (gv_uni_exp_core) */
  gvCore(x: number, y: number, tint = 0xffe0b0, scale = 1) {
    if (!this.gvTex("gv_uni_exp_core")) return;
    const im = this.scene.add.image(x, y, "gv_uni_exp_core")
      .setDepth(29).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.2 * scale).setAlpha(1);
    this.scene.tweens.add({ targets: im, scale: 1.1 * scale, alpha: 0, duration: 420, ease: "Quad.out", onComplete: () => im.destroy() });
  }

  /** gv 화이트 플래시 — FlashFree 즉발 섬광 */
  gvFlash(x: number, y: number, tint = 0xffffff, scale = 1) {
    const k = this.gvTex("gv_flashfree2") ? "gv_flashfree2" : this.gvTex("gv_flashfree1") ? "gv_flashfree1" : "";
    if (!k) return;
    const im = this.scene.add.image(x, y, k)
      .setDepth(31).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.3 * scale).setAlpha(1);
    this.scene.tweens.add({ targets: im, scale: 1.2 * scale, alpha: 0, duration: 300, ease: "Quad.out", onComplete: () => im.destroy() });
  }

  /** gv 에너지 웹 — 마법 소용돌이 오버레이 (이터널/마나 계열 상징) */
  gvEnergyWeb(x: number, y: number, tint = 0xb0a0ff, scale = 1, dur = 1400) {
    if (!this.gvTex("gv_uni_energyweb")) return;
    const im = this.scene.add.image(x, y, "gv_uni_energyweb")
      .setDepth(28).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.3 * scale).setAlpha(0.9);
    this.scene.tweens.add({ targets: im, scale: 1.15 * scale, angle: 180, alpha: 0, duration: dur, ease: "Sine.inOut", onComplete: () => im.destroy() });
  }

  /** gv 별하늘 오버레이 — 시간 정지/영겁 연출 (이터널 전용 분위기) */
  gvStarry(x: number, y: number, scale = 1, dur = 2000) {
    if (!this.gvTex("gv_uni_tile_starry")) return;
    const im = this.scene.add.image(x, y, "gv_uni_tile_starry")
      .setDepth(27).setBlendMode(Phaser.BlendModes.ADD).setTint(0xd8ccff).setScale(0.4 * scale).setAlpha(0);
    this.scene.tweens.add({ targets: im, alpha: 0.85, scale: 0.75 * scale, duration: dur * 0.4, yoyo: true, hold: dur * 0.2, ease: "Sine.inOut", onComplete: () => im.destroy() });
  }

  /** gv 에너지 볼트 — 무작위 방향 번개 편향 */
  gvBolts(x: number, y: number, tint = 0x9ad8ff, n = 4, spread = 90) {
    if (!this.gvTex("gv_uni_energybolts")) return;
    const N = this.lowFx ? Math.ceil(n / 2) : n;
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = spread * (0.4 + Math.random() * 0.6);
      const im = this.scene.add.image(x + Math.cos(a) * d * 0.3, y + Math.sin(a) * d * 0.3, "gv_uni_energybolts")
        .setDepth(28).setBlendMode(Phaser.BlendModes.ADD).setTint(tint)
        .setRotation(a).setScale(0.5 + Math.random() * 0.5).setAlpha(1);
      this.scene.tweens.add({ targets: im, x: im.x + Math.cos(a) * d, y: im.y + Math.sin(a) * d, alpha: 0, duration: 320 + Math.random() * 220, ease: "Quad.out", onComplete: () => im.destroy() });
    }
  }

  /** gv 스펙스 분산 — 반짝이 입자 산개 (종결 화면 채움) */
  gvSpecks(x: number, y: number, tint = 0xffe9a0, n = 10, spread = 150) {
    if (!this.gvTex("gv_uni_specks")) return;
    const N = this.lowFx ? Math.ceil(n / 2) : n;
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = spread * (0.3 + Math.random() * 0.7);
      const im = this.scene.add.image(x, y, "gv_uni_specks")
        .setDepth(27).setBlendMode(Phaser.BlendModes.ADD).setTint(tint)
        .setScale(0.12 + Math.random() * 0.16).setAlpha(0.95);
      this.scene.tweens.add({ targets: im, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 30, alpha: 0, duration: 700 + Math.random() * 600, ease: "Cubic.out", onComplete: () => im.destroy() });
    }
  }

  /** gv 스테이크 버스트 — 방사형 광선 (종결기 마무리) */
  gvStreaks(x: number, y: number, tint = 0xfff0c0, scale = 1) {
    if (!this.gvTex("gv_uni_streaks_horizontal")) return;
    const im = this.scene.add.image(x, y, "gv_uni_streaks_horizontal")
      .setDepth(30).setBlendMode(Phaser.BlendModes.ADD).setTint(tint)
      .setScale(0.2 * scale).setAlpha(0.95).setRotation(Math.random() * Math.PI);
    this.scene.tweens.add({ targets: im, scale: 1.2 * scale, alpha: 0, angle: im.angle + 30, duration: 520, ease: "Cubic.out", onComplete: () => im.destroy() });
  }

  /** gv 근접 참격 — cfxr sword trail (경사 아크) */
  gvSwordTrail(x: number, y: number, angle: number, tint = 0xdfe8ff, big = false) {
    if (!this.gvTex("gv_cfxr_sword_trail_mask_light")) return;
    const im = this.scene.add.image(x, y, "gv_cfxr_sword_trail_mask_light")
      .setDepth(26).setBlendMode(Phaser.BlendModes.ADD).setTint(tint)
      .setRotation(angle).setScale(big ? 1.3 : 0.8).setAlpha(0.95);
    this.scene.tweens.add({ targets: im, scale: big ? 1.7 : 1.05, alpha: 0, duration: 260, ease: "Quad.out", onComplete: () => im.destroy() });
  }

  /** gv 타격 삼각 — cfxr hit triangle 임팩트 */
  gvHitTri(x: number, y: number, angle: number, tint = 0xffe0a0, scale = 1) {
    if (!this.gvTex("gv_cfxr_hit_triangle")) return;
    const im = this.scene.add.image(x, y, "gv_cfxr_hit_triangle")
      .setDepth(27).setBlendMode(Phaser.BlendModes.ADD).setTint(tint)
      .setRotation(angle).setScale(0.35 * scale).setAlpha(1);
    this.scene.tweens.add({ targets: im, scale: 0.75 * scale, alpha: 0, duration: 240, ease: "Quad.out", onComplete: () => im.destroy() });
  }

  /** gv 해골 — 저주/사망 연출 (섀도우 계열) */
  gvSkull(x: number, y: number, tint = 0xc090ff, scale = 1) {
    if (!this.gvTex("gv_cfxr_skull_2")) return;
    const im = this.scene.add.image(x, y - 20, "gv_cfxr_skull_2")
      .setDepth(28).setBlendMode(Phaser.BlendModes.ADD).setTint(tint)
      .setScale(0.25 * scale).setAlpha(0.95);
    this.scene.tweens.add({ targets: im, y: y - 70, scale: 0.55 * scale, alpha: 0, duration: 700, ease: "Quad.out", onComplete: () => im.destroy() });
  }

  /** gv 원소 링 — ice/elec 확장 링 (계열 지면 연출 대체) */
  gvRing(x: number, y: number, kind: "ice" | "elec", tint = 0xffffff, scale = 1) {
    const k = kind === "ice" ? "gv_cfxr_ring_ice" : "gv_cfxr_ring_electric";
    if (!this.gvTex(k)) return;
    const im = this.scene.add.image(x, y, k)
      .setDepth(24).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.25 * scale).setAlpha(0.95);
    this.scene.tweens.add({ targets: im, scale: 1.1 * scale, alpha: 0, duration: 560, ease: "Cubic.out", onComplete: () => im.destroy() });
  }

  /** gv 불 서클 지면 연출 — 전사/성기사 계열 (마법진 대체) */
  gvFireCircle(x: number, y: number, tint = 0xffb070, dur = 900, scale = 1) {
    if (!this.gvTex("gv_cfxr_fire_circle_drawn")) return;
    const im = this.scene.add.image(x, y, "gv_cfxr_fire_circle_drawn")
      .setDepth(12).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.5 * scale).setAlpha(0.9);
    this.scene.tweens.add({ targets: im, scale: 1.0 * scale, alpha: 0, duration: dur, ease: "Quad.out", onComplete: () => im.destroy() });
  }

  /** gv 바람 부채꼴 — 궁수 계열 (마법진 대체) */
  gvCone(x: number, y: number, angle: number, tint = 0xaef0c0, scale = 1) {
    if (!this.gvTex("gv_uni_cone_long")) return;
    const im = this.scene.add.image(x, y, "gv_uni_cone_long")
      .setDepth(24).setBlendMode(Phaser.BlendModes.ADD).setTint(tint)
      .setRotation(angle).setScale(0.6 * scale, 0.8 * scale).setAlpha(0.9);
    this.scene.tweens.add({ targets: im, scaleX: 1.3 * scale, alpha: 0, duration: 380, ease: "Quad.out", onComplete: () => im.destroy() });
  }

  /** gv 그림자 균열 — 도적 계열 (마법진 대체) */
  gvVoidSpike(x: number, y: number, tint = 0xb08aff, scale = 1) {
    const k = this.gvTex("gv_cfxr_ring_spikes_revert") ? "gv_cfxr_ring_spikes_revert" : "";
    if (!k) return;
    const im = this.scene.add.image(x, y, k)
      .setDepth(24).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.3 * scale).setAlpha(0.95);
    this.scene.tweens.add({ targets: im, scale: 1.0 * scale, alpha: 0, duration: 520, ease: "Cubic.out", onComplete: () => im.destroy() });
  }

  /** gv 마법사 전용 룬 — gv_rune_big(+글로우). 마법 계열만 호출할 것 */
  gvMageRune(x: number, y: number, tint = 0xb08aff, dur = 1000, scale = 1) {
    if (!this.gvTex("gv_rune_big")) return;
    const im = this.scene.add.image(x, y, "gv_rune_big")
      .setDepth(12).setBlendMode(Phaser.BlendModes.ADD).setTint(tint)
      .setScale(0.4 * scale).setAlpha(0.95);
    if (this.gvTex("gv_rune_glow")) {
      const g = this.scene.add.image(x, y, "gv_rune_glow")
        .setDepth(11).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.5 * scale).setAlpha(0.7);
      this.scene.tweens.add({ targets: g, scale: 1.1 * scale, alpha: 0, duration: dur, onComplete: () => g.destroy() });
    }
    this.scene.tweens.add({ targets: im, angle: 90, scale: 0.9 * scale, alpha: 0, duration: dur, ease: "Sine.in", onComplete: () => im.destroy() });
  }

  /** gv 크리스탈 파편 팝 — 얼음/보석 계열 */
  gvCrystal(x: number, y: number, tint = 0x8ad4ff, n = 3) {
    if (!this.gvTex("gv_crystalfree1")) return;
    const N = this.lowFx ? 1 : n;
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + Phaser.Math.FloatBetween(-0.9, 0.9);
      const im = this.scene.add.image(x, y, "gv_crystalfree1")
        .setDepth(27).setBlendMode(Phaser.BlendModes.ADD).setTint(tint)
        .setScale(0.22 + Math.random() * 0.14).setAlpha(1).setRotation(Math.random() * Math.PI);
      this.scene.tweens.add({ targets: im, x: x + Math.cos(a) * 90, y: y + Math.sin(a) * 90 + 40, alpha: 0, rotation: im.rotation + 1.6, duration: 520 + Math.random() * 220, ease: "Quad.out", onComplete: () => im.destroy() });
    }
  }

  /** gv 물 튀김 — 물/정화 계열 */
  gvSplash(x: number, y: number, tint = 0x9ad8ff, scale = 1) {
    if (!this.gvTex("gv_cfxr_water_small_splash_stretch")) return;
    const im = this.scene.add.image(x, y, "gv_cfxr_water_small_splash_stretch")
      .setDepth(27).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.4 * scale).setAlpha(0.95);
    this.scene.tweens.add({ targets: im, y: y - 26, scale: 0.7 * scale, alpha: 0, duration: 420, ease: "Quad.out", onComplete: () => im.destroy() });
  }

  /** gv 오라 레이 — 버프/각성 순간 (플레이어 주위 회전 광선) */
  gvAura(x: number, y: number, tint = 0xffe9a0, dur = 1600, scale = 1) {
    if (!this.gvTex("gv_cfxr_aura_rays")) return;
    const im = this.scene.add.image(x, y, "gv_cfxr_aura_rays")
      .setDepth(26).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.3 * scale).setAlpha(0);
    this.scene.tweens.add({ targets: im, alpha: 0.9, scale: 0.55 * scale, duration: dur * 0.35, yoyo: true, hold: dur * 0.15, ease: "Sine.inOut", onComplete: () => im.destroy() });
    this.scene.tweens.add({ targets: im, angle: 60, duration: dur, ease: "Linear" });
  }
}
