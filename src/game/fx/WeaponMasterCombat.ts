import Phaser from "phaser";
import { playFx } from "./pixelfxBridge";
import { signatureZones, type SignatureZone, type SkillPoint, type WeaponMasterProfile } from "../weaponMasterProfiles";

type ActorLook = { texture: string; frame: string | number; flip: boolean; scaleX: number; scaleY: number };

/** Cast-owned native assets: shutdown/cancel removes previews, sprites and their tweens together. */
export class WeaponMasterCombat {
  private objects = new Set<Phaser.GameObjects.GameObject>();
  private preview: Phaser.GameObjects.Graphics | null = null;
  private readonly angle: number;
  private readonly lite: boolean;

  constructor(
    private scene: Phaser.Scene,
    private profile: WeaponMasterProfile,
    private origin: SkillPoint,
    private aim: SkillPoint,
    private tier: number,
    private look: ActorLook,
  ) {
    this.angle = Math.atan2(aim.y, aim.x);
    this.lite = (scene as Phaser.Scene & { fxLevel?: number }).fxLevel === 0;
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T, phase = "release"): T {
    this.objects.add(object);
    object.setData("rea:skill", this.profile.style);
    object.setData("rea:phase", phase);
    object.once(Phaser.GameObjects.Events.DESTROY, () => this.objects.delete(object));
    return object;
  }

  private fade(object: Phaser.GameObjects.GameObject, duration = 260) {
    this.scene.tweens.add({ targets: object, alpha: 0, duration, onComplete: () => object.destroy() });
  }

  private image(key: string, x: number, y: number, size: number, color = this.profile.color) {
    if (!this.scene.textures.exists(key)) return null;
    const image = this.track(this.scene.add.image(x, y, key)).setDepth(23).setTint(color)
      .setDisplaySize(size, size).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.88);
    return image;
  }

  private native(key: string, x: number, y: number, scale = 0.8) {
    if (!this.scene.textures.exists(key)) return null;
    const sprite = playFx(this.scene, key, x, y, { scale, depth: 25 });
    if (sprite) this.track(sprite).setTint(this.profile.color);
    return sprite;
  }

  private drawZone(graphics: Phaser.GameObjects.Graphics, zone: SignatureZone, fill: number) {
    graphics.fillStyle(this.profile.color, fill).lineStyle(2, this.profile.color, 0.78);
    if (zone.kind === "circle") {
      graphics.fillCircle(zone.x, zone.y, zone.radius).strokeCircle(zone.x, zone.y, zone.radius);
    } else if (zone.kind === "box") {
      graphics.fillRect(zone.x - zone.radius, zone.y - zone.radius, zone.radius * 2, zone.radius * 2)
        .strokeRect(zone.x - zone.radius, zone.y - zone.radius, zone.radius * 2, zone.radius * 2);
    } else if (zone.kind === "sector") {
      const points: Phaser.Types.Math.Vector2Like[] = [{ x: zone.x, y: zone.y }];
      for (let i = 0; i <= 20; i++) {
        const a = zone.angle - zone.halfAngle + zone.halfAngle * 2 * i / 20;
        points.push({ x: zone.x + Math.cos(a) * zone.radius, y: zone.y + Math.sin(a) * zone.radius });
      }
      graphics.beginPath().moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
      graphics.closePath().fillPath().strokePath();
    } else {
      const c = Math.cos(zone.angle), s = Math.sin(zone.angle), w = zone.width / 2;
      const points = [
        { x: zone.x - s * w, y: zone.y + c * w },
        { x: zone.x + c * zone.length - s * w, y: zone.y + s * zone.length + c * w },
        { x: zone.x + c * zone.length + s * w, y: zone.y + s * zone.length - c * w },
        { x: zone.x + s * w, y: zone.y - c * w },
      ];
      graphics.beginPath().moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
      graphics.closePath().fillPath().strokePath();
    }
  }

  startup() {
    const graphics = this.track(this.scene.add.graphics(), "startup").setDepth(7);
    for (const zone of signatureZones(this.profile.style, this.origin, this.aim, this.tier)) this.drawZone(graphics, zone, 0.07);
    this.preview = graphics;
    // The actual damage footprint brightens until release; no extra particles.
    graphics.setAlpha(0.3);
    this.scene.tweens.add({ targets: graphics, alpha: 1, duration: this.profile.startup });
    const focus = this.image(this.profile.style === "book" || this.profile.style === "art" ? "vfx_magic2" : "vfx_ring", this.origin.x, this.origin.y, 48);
    if (focus) {
      focus.setData("rea:phase", "startup");
      this.scene.tweens.add({ targets: focus, angle: 70, displayWidth: 78, displayHeight: 78, duration: this.profile.startup });
      this.fade(focus, this.profile.startup);
    }
  }

  private slash(x: number, y: number, angle: number, size: number) {
    if (!this.scene.textures.exists("slash0") || !this.scene.anims.exists("fx-slash")) return;
    const slash = this.track(this.scene.add.sprite(x, y, "slash0")).setDepth(25)
      .setTint(this.profile.color).setRotation(angle).setDisplaySize(size, size)
      .setBlendMode(Phaser.BlendModes.ADD).play("fx-slash");
    slash.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => slash.destroy());
    this.fade(slash, 230);
  }

  private ghost(x: number, y: number) {
    if (this.lite || !this.scene.textures.exists(this.look.texture)) return;
    const ghost = this.track(this.scene.add.image(x, y, this.look.texture, this.look.frame)).setDepth(12)
      .setFlipX(this.look.flip).setScale(this.look.scaleX, this.look.scaleY).setTint(this.profile.color).setAlpha(0.48);
    this.fade(ghost, 290);
  }

  release(pulse: number) {
    if (this.preview) this.scene.tweens.killTweensOf(this.preview);
    this.preview?.destroy();
    this.preview = null;
    const { x, y } = this.origin;
    const forward = (distance: number, side = 0) => ({ x: x + Math.cos(this.angle) * distance - Math.sin(this.angle) * side, y: y + Math.sin(this.angle) * distance + Math.cos(this.angle) * side });
    const zones = signatureZones(this.profile.style, this.origin, this.aim, this.tier, pulse);
    const imprint = this.track(this.scene.add.graphics()).setDepth(8);
    for (const zone of zones) this.drawZone(imprint, zone, 0.12);
    this.fade(imprint, 190);
    switch (this.profile.style) {
      case "starter":
        this.slash(x, y - 5, this.angle, 190 + this.tier * 16);
        break;
      case "solar": {
        const p = forward(70);
        this.slash(p.x, p.y - 5, this.angle, 240 + this.tier * 14);
        this.native("sunburst", p.x, p.y, 0.65);
        const blade = this.image("vfx_slash_m", p.x, p.y, 175);
        if (blade) { blade.setRotation(this.angle); this.fade(blade, 230); }
        break;
      }
      case "life":
        this.native("healing-bloom", x, y, 1.15);
        for (let i = 0; i < (this.lite ? 1 : 3); i++) {
          const ring = this.image("vfx_ring", x, y, 75 + i * 30);
          if (ring) { this.scene.tweens.add({ targets: ring, displayWidth: 260, displayHeight: 260, duration: 250 }); this.fade(ring, 270); }
          const heart = this.image("vfx_heal_heart", x - 20 + i * 20, y - 18, 24);
          if (heart) { this.scene.tweens.add({ targets: heart, y: y - 70, duration: 300 }); this.fade(heart, 300); }
        }
        break;
      case "lightning": {
        const zone = zones[0];
        if (zone.kind !== "beam") break;
        const lightning = this.track(this.scene.add.graphics()).setDepth(26).lineStyle(4, 0xd5f7ff, 0.98);
        lightning.beginPath().moveTo(x, y);
        for (let i = 1; i <= 12; i++) { const p = forward(zone.length * i / 12, i % 2 ? 11 : -11); lightning.lineTo(p.x, p.y); }
        lightning.strokePath(); this.fade(lightning, 210);
        const p = forward(zone.length);
        this.native("zap-hit", p.x, p.y, 0.8);
        const arrow = this.image("hv2_arrow", x, y, 78);
        if (arrow) { arrow.setRotation(this.angle); this.scene.tweens.add({ targets: arrow, x: p.x, y: p.y, duration: 150 }); this.fade(arrow, 200); }
        break;
      }
      case "chakram": {
        if (pulse > 0) break; // the same ring physically returns; its second pulse catches new targets only
        const p = forward(250 + this.tier * 16);
        const ring = this.image("vfx_slash_turn", x, y, 112);
        if (ring) {
          this.scene.tweens.add({ targets: ring, x: p.x, y: p.y, duration: 195, yoyo: true });
          this.scene.tweens.add({ targets: ring, angle: 720, duration: 390 });
          this.fade(ring, 410);
        }
        if (!this.lite) for (const d of [65, 130, 195]) {
          const f = forward(d, Math.sin(d) * 16);
          const petal = this.image("vfx_flower", f.x, f.y, 28);
          if (petal) this.fade(petal, 380);
        }
        break;
      }
      case "book":
        for (const zone of zones) {
          this.native("arcane-orb", zone.x, zone.y, 0.8);
          const seal = this.image("vfx_magic2", zone.x, zone.y, 122);
          if (seal) { this.scene.tweens.add({ targets: seal, angle: 100, duration: 300 }); this.fade(seal, 300); }
        }
        break;
      case "art": {
        this.native("divine-shield", x, y, 1.1);
        this.native("heal", x, y - 20, 0.7);
        const barrier = this.track(this.scene.add.graphics()).setDepth(22).lineStyle(3, this.profile.color, 0.9);
        const r = 110 + 10 * this.tier;
        barrier.strokeRect(x - r, y - r, r * 2, r * 2).lineBetween(x - r, y - r, x + r, y + r).lineBetween(x + r, y - r, x - r, y + r);
        this.fade(barrier, 350);
        break;
      }
      case "shadow": {
        const p = forward(pulse === 0 ? 42 : 145);
        this.ghost(p.x - Math.sin(this.angle) * 28, p.y + Math.cos(this.angle) * 28);
        this.slash(p.x, p.y, this.angle + (pulse ? -0.45 : 0.45), 210);
        this.native("shadow-flames", p.x, p.y, 0.65);
        break;
      }
      case "copy": {
        const p = forward(110);
        for (let i = 0; i < (this.lite ? 2 : 4); i++) {
          const a = i * Math.PI / 2;
          const seal = this.image(["vfx_fire", "vfx_snow", "vfx_bolt2", "vfx_flower"][i], p.x + Math.cos(a) * 68, p.y + Math.sin(a) * 68, 44);
          if (seal) { this.scene.tweens.add({ targets: seal, x: p.x, y: p.y, angle: 90, duration: 250 }); this.fade(seal, 280); }
        }
        this.native("arcane-orb", p.x, p.y, 1.0);
        break;
      }
      case "water":
        for (const zone of zones) {
          if (zone.kind !== "beam") continue;
          const p = { x: x + Math.cos(zone.angle) * zone.length, y: y + Math.sin(zone.angle) * zone.length };
          const wave = this.image("vfx_snow", x, y, 85);
          if (wave) { wave.setRotation(zone.angle); this.scene.tweens.add({ targets: wave, x: p.x, y: p.y, duration: 210 }); this.fade(wave, 260); }
          this.native("splash", p.x, p.y, 0.75);
        }
        break;
      case "hammer": {
        const p = zones[0];
        this.ghost(p.x - 20, p.y - 25);
        this.native("hammer-smash", p.x, p.y, 1.0);
        const shock = this.image("vfx_shock", p.x, p.y, 65);
        if (shock) { this.scene.tweens.add({ targets: shock, displayWidth: 210, displayHeight: 210, duration: 240 }); this.fade(shock, 260); }
        break;
      }
    }
  }

  clear() {
    for (const object of this.objects) {
      this.scene.tweens.killTweensOf(object);
      object.destroy();
    }
    this.objects.clear();
    this.preview = null;
  }
}
