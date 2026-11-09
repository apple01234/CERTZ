import Phaser from "phaser";
import type { Boss, PlayerLike2 } from "./Boss";
import { BOSS_RECORD_ALIASES } from "./bossDesign";
import { hazardContains, storyPattern, type Hazard, type StoryAttack } from "./storyBossPatterns";
import { telegraphMs } from "./bossPhases";

/** Owns timed hazards and companions; phase changes, death and shutdown cancel all hits. */
export class StoryBossMechanics {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];
  private ring: Phaser.GameObjects.Graphics | null = null;
  private dean: Phaser.GameObjects.Sprite | null = null;
  private core: Phaser.GameObjects.Image | null = null;
  private coreLabel: Phaser.GameObjects.Text | null = null;
  private coreHp = 0;
  private origin: { x: number; y: number };
  private readonly key: string;
  constructor(private boss: Boss) {
    this.origin = { x: boss.x, y: boss.y };
    this.key = BOSS_RECORD_ALIASES[boss.def.key] ?? boss.def.key;
    const scene = boss.scene;
    if (this.key === "fabian") this.ring = scene.add.graphics().lineStyle(5, 0xe6b573, .85).strokeCircle(boss.x, boss.y, 235).setDepth(4).setName("story-boss:sparring-ring");
    if (this.key === "verodin") this.dean = scene.add.sprite(boss.x - 105, boss.y, "cast_dean", "ready").setScale(.95).setDepth(11).setName("story-boss:dean");
    if (this.key === "littlestar") this.exposeCore();
    scene.events.once("shutdown", () => this.destroy());
  }
  private later(ms: number, callback: () => void): void {
    this.timers.push(this.boss.scene.time.delayedCall(ms, () => { if (this.boss.active && this.boss.alive) callback(); }));
  }
  private draw(g: Phaser.GameObjects.Graphics, h: Hazard): void {
    if (h.radius !== undefined) { g.fillCircle(h.x, h.y, h.radius); g.strokeCircle(h.x, h.y, h.radius); }
    else { g.fillRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h); g.strokeRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h); }
  }
  start(kind: StoryAttack, player: PlayerLike2): void {
    const b = this.boss, scene = b.scene;
    this.clearAttack();
    const pattern = storyPattern(kind, { x: b.x, y: b.y, phase: b.phase, key: b.def.key }, player);
    const warning = scene.add.graphics().setDepth(5).setName(`story-boss:warning:${kind}`);
    warning.fillStyle(pattern.color, .16).lineStyle(3, pattern.color, .9);
    for (const h of pattern.hazards) this.draw(warning, h);
    if (pattern.safe) { warning.fillStyle(0x8debc7, .07).lineStyle(2, 0x8debc7, .6); this.draw(warning, pattern.safe); }
    this.objects.push(warning);
    const label = scene.add.text(b.x, b.y - 95, pattern.title, { fontSize: "16px", color: "#fff2dc", stroke: "#1c1729", strokeThickness: 4 }).setOrigin(.5).setDepth(22).setName(`story-boss:label:${kind}`);
    this.objects.push(label);
    if (pattern.clones) for (const h of pattern.hazards) {
      const tex = scene.textures.exists(`story_${pattern.clones}`) ? `story_${pattern.clones}` : `cast_${pattern.clones}`;
      const clone = scene.add.sprite(h.x, h.y - h.h / 2 + 30, tex, tex.startsWith("story_") ? "cast-1" : "ready")
        .setScale(tex.startsWith("story_") ? .52 : .95).setTint(pattern.color).setAlpha(.6).setDepth(11).setName(`story-boss:clone:${pattern.clones}`);
      if (scene.anims.exists(`${tex}-sp1`)) clone.play(`${tex}-sp1`);
      this.objects.push(clone);
    }
    if (kind === "cursefield" && this.dean?.active) this.dean.play("cast_dean-reach");
    this.later(telegraphMs(kind), () => {
      warning.clear().fillStyle(pattern.color, .38).lineStyle(4, pattern.color, 1);
      for (const h of pattern.hazards) this.draw(warning, h);
      const effects: Record<StoryAttack, string> = { tentacleslam: "hv2_splat", inkflood: "mg_smoke", shadowcopies: "mg_slash2", cursefield: this.key === "reversecore" ? "hv2_techcircle" : "hv2_magiccircle2", bloodseal: "hv2_splat", corruption: "hv2_smoke26", rosecore: "flower_r", jadeclones: "hv2_crystal", ringpush: "mg_shock0" };
      for (const h of pattern.hazards) {
        const key = effects[kind];
        if (!scene.textures.exists(key)) continue;
        const image = scene.add.image(h.x, h.y, key).setTint(pattern.color).setAlpha(.8).setDepth(12).setName(`story-boss:effect:${kind}`);
        image.setDisplaySize(kind === "rosecore" ? 42 : Math.min(h.w, 150), kind === "shadowcopies" ? 70 : Math.min(h.h, 150));
        this.objects.push(image);
        scene.tweens.add({ targets: image, alpha: 0, angle: kind === "jadeclones" ? 90 : 0, duration: Math.min(1000, pattern.duration + 300) });
      }
      if (kind === "ringpush") { const p = pattern.hazards[0]; b.setPosition(p.x, p.y); }
      const hit = () => {
        if (player.hp <= 0 || scene.dialoguing || scene.camCinema) return;
        const h = pattern.hazards.find((h) => hazardContains(h, player));
        if (!h) return;
        const dir = new Phaser.Math.Vector2(player.x - b.x, player.y - b.y).normalize();
        player.takeDamage(Math.round(b.def.atk * (kind === "ringpush" ? .8 : 1.15)), dir, .2);
        if (kind === "ringpush") {
          const body = (player as unknown as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body | null;
          body?.setVelocity(dir.x * 650, dir.y * 650);
          scene.showBanner("측면 회피 후 반격해 링 밖으로 밀어내세요");
        }
        if (kind === "bloodseal") b.hp = Math.min(b.maxHp, b.hp + b.maxHp * .015);
      };
      hit();
      if (pattern.duration > 1000) for (let ms = 650; ms < pattern.duration; ms += 650) this.later(ms, hit);
      scene.spawnShockwave(pattern.hazards[0].x, pattern.hazards[0].y, pattern.color, .65, 320);
      this.later(pattern.duration, () => this.clearAttack());
    });
  }
  private exposeCore(): void {
    if (this.coreHp > 0) return;
    const b = this.boss;
    this.coreHp = Math.round(b.maxHp * .12);
    this.core = b.scene.add.image(b.x, b.y - 20, "flower_r").setScale(1.7).setDepth(14).setName("story-boss:rose-core");
    this.coreLabel = b.scene.add.text(b.x, b.y - 65, "장미 동력핵", { fontSize: "14px", color: "#ffd9eb", stroke: "#271a30", strokeThickness: 3 }).setOrigin(.5).setDepth(15);
  }
  interceptDamage(damage: number): boolean {
    if (this.coreHp <= 0) return false;
    this.coreHp = Math.max(0, this.coreHp - damage);
    this.coreLabel?.setText(`장미 동력핵 ${this.coreHp}`);
    if (!this.coreHp) { this.core?.destroy(); this.coreLabel?.destroy(); this.core = null; this.coreLabel = null; this.boss.scene.showBanner("장미의 동력핵 파괴 — 본체 노출!"); }
    return true;
  }
  tick(): boolean {
    const b = this.boss;
    if (this.dean?.active) this.dean.setPosition(b.x - 105, b.y);
    this.core?.setPosition(b.x, b.y - 20); this.coreLabel?.setPosition(b.x, b.y - 65);
    return this.key === "fabian" && Phaser.Math.Distance.Between(b.x, b.y, this.origin.x, this.origin.y) > 235;
  }
  phaseChanged(): void { this.clearAttack(); if (this.key === "littlestar") this.exposeCore(); }
  clearAttack(): void {
    for (const t of this.timers) t.remove(); this.timers = [];
    for (const o of this.objects) o.destroy(); this.objects = [];
  }
  destroy(): void {
    this.clearAttack(); this.ring?.destroy(); this.dean?.destroy(); this.core?.destroy(); this.coreLabel?.destroy();
    this.ring = null; this.dean = null; this.core = null; this.coreLabel = null;
  }
}
