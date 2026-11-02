import Phaser from "phaser";
import { EventBus } from "@/components/game/EventBus";
import {
  currentChapter,
  currentObjective,
  type CampaignProgress,
} from "./progress";
import { CAMPAIGN_ASSETS, FAMILY_FRAMES, WORLD_PALETTES } from "./assets";
import {
  FAMILIES,
  COSMETICS,
  CHAPTER_BY_ID,
  type ChapterDefinition,
} from "./catalog";
import { createDefense, stepDefense, type Defense } from "./defense";
import {
  createBattle,
  stepBattle,
  STEP,
  type Battle,
  type BattleInput,
} from "./battle";
export type CampaignViewState = {
  nearby: string | null;
  battle: Battle | null;
  hint: string;
  bearing?: { label: string; direction: string; distance: number };
  defense?: { remaining: number; integrity: number };
};
export type SceneCommand = {
  progress?: CampaignProgress;
  paused?: boolean;
  retry?: boolean;
  onlineBattle?: Battle | null;
  onlinePlayerId?: string;
  online?: boolean;
  reducedMotion?: boolean;
};
const TARGET_SPOTS = [
  { x: 310, y: 330 },
  { x: 700, y: 250 },
  { x: 765, y: 470 },
  { x: 400, y: 510 },
];
export class CampaignScene extends Phaser.Scene {
  private defense: Defense | null = null;
  private defenseSprites: Phaser.GameObjects.Sprite[] = [];
  private progress!: CampaignProgress;
  private player!: Phaser.GameObjects.Sprite;
  private dynamicLayer!: Phaser.GameObjects.Container;
  private worldLayer!: Phaser.GameObjects.Container;
  private effects!: Phaser.GameObjects.Graphics;
  private controls!: Record<string, Phaser.Input.Keyboard.Key>;
  private targetNodes: { label: string; x: number; y: number }[] = [];
  private pauseInput = false;
  private requestedPause = false;
  private reducedMotion = false;
  private battle: Battle | null = null;
  private online = false;
  private onlinePlayerId = "";
  private accumulator = 0;
  private emitAt = 0;
  private held: Partial<BattleInput> = {};
  private nearby: string | null = null;
  private lastHit = 0;
  private battleVisualId = "";
  private bossSprite?: Phaser.GameObjects.Sprite;
  private battleLabel?: Phaser.GameObjects.Text;
  private sealLabel?: Phaser.GameObjects.Text;
  private remoteSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private walkGoal: { x: number; y: number } | null = null;
  private skillFx!: Phaser.GameObjects.Sprite;
  constructor(progress: CampaignProgress) {
    super("MemoryOath");
    this.progress = progress;
  }
  preload() {
    for (const a of Object.values(CAMPAIGN_ASSETS))
      this.load.spritesheet(a.key, a.url, { frameWidth: 16, frameHeight: 16 });
    this.load.atlas(
      "oath-skill",
      "/assets/campaign/skill-sunburst.png",
      "/assets/campaign/skill-sunburst.json",
    );
    this.load.on("loaderror", () =>
      EventBus.emit(
        "campaign:error",
        "에셋을 불러오지 못했습니다. 네트워크를 확인하고 새로고침하세요.",
      ),
    );
  }
  create() {
    this.worldLayer = this.add.container(0, 0);
    this.dynamicLayer = this.add.container(0, 0);
    this.effects = this.add.graphics().setDepth(1000);
    this.skillFx = this.add
      .sprite(512, 230, "oath-skill", "sunburst 0")
      .setVisible(false)
      .setDepth(900)
      .setScale(1);
    if (!this.anims.exists("oath-skill"))
      this.anims.create({
        key: "oath-skill",
        frames: this.anims.generateFrameNames("oath-skill", {
          prefix: "sunburst ",
          start: 0,
          end: 119,
        }),
        frameRate: 60,
        repeat: 0,
      });
    this.skillFx.on("animationcomplete", () => this.skillFx.setVisible(false));
    this.player = this.add
      .sprite(512, 485, "oath-dungeon", FAMILY_FRAMES[this.progress.family])
      .setScale(3)
      .setDepth(800);
    const keyboard = this.input.keyboard!;
    this.controls = keyboard.addKeys({
      up: "W",
      down: "S",
      left: "A",
      right: "D",
      arrowUp: "UP",
      arrowDown: "DOWN",
      arrowLeft: "LEFT",
      arrowRight: "RIGHT",
      interact: "E",
      attack: "SPACE",
      skill: "K",
      dodge: "SHIFT",
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    keyboard.addCapture(["SPACE", "UP", "DOWN", "LEFT", "RIGHT"]);
    const command = (c: SceneCommand) => {
      if (c.paused !== undefined) {
        this.pauseInput = c.paused;
        this.requestedPause = c.paused;
        if (c.paused) this.input.keyboard?.disableGlobalCapture();
        else this.input.keyboard?.enableGlobalCapture();
        if (c.paused) {
          this.held = {};
          this.input.keyboard?.resetKeys();
          this.walkGoal = null;
        }
      }
      if (c.reducedMotion !== undefined) this.reducedMotion = c.reducedMotion;
      if (c.progress) {
        const changed =
          c.progress.chapterId !== this.progress.chapterId ||
          c.progress.characterId !== this.progress.characterId;
        const targetsChanged =
          c.progress.targets.join("|") !== this.progress.targets.join("|");
        const objectiveChanged =
          c.progress.objective !== this.progress.objective;
        this.progress = c.progress;
        if (changed) this.startTransition();
        else if (objectiveChanged || targetsChanged) {
          this.battle = null;
          this.rebuildTargets();
        }
        this.tintPlayer();
      }
      if (c.retry && this.battle && !this.online) this.beginBoss();
      if (c.online !== undefined) {
        this.online = c.online;
        if (!c.online) {
          this.battle = null;
          this.battleVisualId = "";
          this.drawWorld();
          this.rebuildTargets();
          this.player.setPosition(512, 485).setAlpha(1);
        }
      }
      if (c.onlinePlayerId) this.onlinePlayerId = c.onlinePlayerId;
      if (c.onlineBattle) {
        const first = this.battle?.id !== c.onlineBattle.id;
        this.battle = c.onlineBattle;
        if (first) this.drawWorld(CHAPTER_BY_ID[c.onlineBattle.chapterId]);
      }
    };
    const touch = (input: Partial<BattleInput> & { interact?: boolean }) => {
      if (input.interact) this.interact();
      this.held = { ...this.held, ...input };
    };
    const begin = () => {
      if (
        !this.pauseInput &&
        !this.online &&
        currentObjective(this.progress)?.kind === "boss"
      )
        this.beginBoss();
    };
    EventBus.on("campaign:command", command);
    EventBus.on("campaign:touch", touch);
    EventBus.on("campaign:begin-boss", begin);
    this.events.once("shutdown", () => {
      EventBus.off("campaign:command", command);
      EventBus.off("campaign:touch", touch);
      EventBus.off("campaign:begin-boss", begin);
      if (this.controls)
        Object.values(this.controls).forEach((k) => k.destroy());
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.pauseInput && !this.battle)
        this.walkGoal = {
          x: Phaser.Math.Clamp(pointer.worldX, 60, 964),
          y: Phaser.Math.Clamp(pointer.worldY, 170, 550),
        };
    });
    const resize = () => {
      const camera = this.cameras.main;
      const width = this.scale.width,
        height = this.scale.height;
      camera.setSize(width, height);
      camera.setZoom(
        width < 640 ? height / 640 : Math.min(width / 1024, height / 640),
      );
      camera.setBounds(0, 0, 1024, 640);
      camera.startFollow(this.player, true, 0.15, 0.15);
    };
    resize();
    this.scale.on("resize", resize);
    this.events.once("shutdown", () => this.scale.off("resize", resize));
    this.drawWorld();
    this.rebuildTargets();
    this.tintPlayer();
    EventBus.emit("campaign:ready");
  }
  private tintPlayer() {
    this.player.setFrame(FAMILY_FRAMES[this.progress.family]);
    const cosmetic = COSMETICS.find((c) => c.id === this.progress.equipped);
    this.player.setTint(cosmetic?.color ?? 0xffffff);
  }
  /** The sole campaign scene-transition path: fade out, replace, always fade back in. */
  startTransition() {
    this.pauseInput = true;
    this.battle = null;
    const cam = this.cameras.main;
    if (!this.reducedMotion) cam.fadeOut(180, 8, 10, 23);
    this.time.delayedCall(this.reducedMotion ? 0 : 185, () => {
      this.drawWorld();
      this.rebuildTargets();
      this.player.setPosition(512, 485);
      if (!this.reducedMotion) cam.fadeIn(250, 8, 10, 23);
      this.pauseInput = this.requestedPause;
    });
  }
  private drawWorld(override?: ChapterDefinition) {
    this.worldLayer.removeAll(true);
    const chapter = override ?? currentChapter(this.progress),
      palette = WORLD_PALETTES[chapter.theme],
      outdoor = ["garden", "forest", "snow", "desert"].includes(chapter.theme);
    const ground = this.add.graphics();
    ground.fillStyle(palette[0]);
    ground.fillRect(0, 0, 1024, 640);
    ground.fillStyle(palette[1], 0.38);
    for (let y = 32; y < 608; y += 16)
      for (let x = 32; x < 992; x += 16)
        if ((x / 16 + y / 16) % 2 === 0) ground.fillRect(x, y, 16, 16);
    ground.fillStyle(0x202535, 0.25);
    ground.fillRect(80, 112, 864, 440);
    ground.lineStyle(2, palette[2], 0.24);
    ground.strokeRect(80, 112, 864, 440);
    ground.fillStyle(palette[2], 0.12);
    ground.fillRect(486, 180, 52, 390);
    ground.fillRect(180, 374, 660, 38);
    this.worldLayer.add(ground);
    if (outdoor) {
      for (let i = 0; i < 30; i++) {
        const x = 40 + (i % 15) * 67,
          y = i < 15 ? 88 : 583;
        const tree = this.add
          .image(x, y, "oath-town", [5, 6, 7, 8][i % 4])
          .setScale(3);
        this.worldLayer.add(tree);
      }
    } else {
      for (let i = 0; i < 22; i++) {
        const x = 65 + i * 43;
        this.worldLayer.add(
          this.add
            .image(x, 95, "oath-dungeon", chapter.theme === "machine" ? 17 : 65)
            .setScale(3),
        );
        this.worldLayer.add(
          this.add.image(x, 580, "oath-dungeon", 72).setScale(3),
        );
      }
    }
    // Architectural silhouettes stay on the same 16px grid as the character tiles.
    for (let i = 0; i < 6; i++) {
      const x = 120 + (i % 3) * 390,
        y = i < 3 ? 195 : 495;
      const prop = this.add
        .image(
          x,
          y,
          outdoor ? "oath-town" : "oath-dungeon",
          outdoor ? 65 : chapter.theme === "castle" ? 63 : 66,
        )
        .setScale(3);
      this.worldLayer.add(prop);
    }
    const title = this.add
      .text(512, 120, chapter.location, {
        fontFamily: "Galmuri11, monospace",
        fontSize: "16px",
        color: "#e7d5a4",
        stroke: "#1c2236",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.worldLayer.add(title);
    for (let i = 0; i < 18; i++) {
      const x = 100 + ((i * 149) % 830),
        y = 180 + ((i * 97) % 330);
      const s = this.add.rectangle(x, y, 2, 2, palette[2], 0.4);
      this.worldLayer.add(s);
    }
  }
  private rebuildTargets() {
    this.defense = null;
    this.defenseSprites.forEach((s) => s.destroy());
    this.defenseSprites = [];
    this.effects.clear();
    this.dynamicLayer.removeAll(true);
    this.targetNodes = [];
    const objective = currentObjective(this.progress);
    if (!objective) return;
    if (objective.kind === "boss") {
      const point = { x: 512, y: 240 };
      this.targetNodes = [{ label: "전투 시작", ...point }];
      this.dynamicLayer.add(
        this.add
          .sprite(
            point.x,
            point.y,
            "oath-dungeon",
            108 + (currentChapter(this.progress).episode % 8),
          )
          .setScale(5),
      );
      this.dynamicLayer.add(
        this.add
          .text(
            point.x,
            point.y + 60,
            currentChapter(this.progress).boss?.name ?? "보스",
            {
              fontFamily: "Galmuri11",
              fontSize: "14px",
              color: "#f1b8be",
              stroke: "#171e30",
              strokeThickness: 4,
            },
          )
          .setOrigin(0.5),
      );
      return;
    }
    objective.targets.forEach((label, i) => {
      if (this.progress.targets.includes(label)) return;
      const spot =
        objective.kind === "talk" && objective.targets.length === 1
          ? { x: 512, y: 300 }
          : TARGET_SPOTS[i % TARGET_SPOTS.length];
      this.targetNodes.push({ label, ...spot });
      const ring = this.add.graphics();
      ring.lineStyle(2, 0xf0ce85, 0.8);
      ring.strokeEllipse(spot.x, spot.y + 20, 48, 18);
      this.dynamicLayer.add(ring);
      const sprite = this.add
        .image(
          spot.x,
          spot.y,
          objective.kind === "talk" ? "oath-dungeon" : "oath-town",
          objective.kind === "talk"
            ? 85 + i
            : objective.kind === "puzzle"
              ? 121
              : objective.kind === "collect"
                ? 118
                : 101,
        )
        .setScale(3);
      this.dynamicLayer.add(sprite);
      this.dynamicLayer.add(
        this.add
          .text(spot.x, spot.y + 43, `${i + 1}. ${label}`, {
            fontFamily: "Galmuri11",
            fontSize: "13px",
            color: "#eee0b4",
            backgroundColor: "#22283c",
            padding: { x: 7, y: 4 },
          })
          .setOrigin(0.5),
      );
    });
  }
  private beginBoss() {
    const chapter = currentChapter(this.progress);
    if (!chapter.boss) return;
    this.dynamicLayer.removeAll(true);
    this.battle = createBattle(
      crypto.randomUUID(),
      chapter.id,
      "story",
      [
        {
          id: this.progress.characterId,
          name: this.progress.name,
          family: this.progress.family,
        },
      ],
      chapter.boss.pattern,
    );
    this.player.setPosition(512, 470);
    this.accumulator = 0;
  }
  private interact() {
    if (this.pauseInput || this.battle) return;
    const nearest = this.targetNodes.find(
      (t) => Math.hypot(t.x - this.player.x, t.y - this.player.y) < 92,
    );
    if (!nearest) return;
    if (currentObjective(this.progress)?.kind === "boss") this.beginBoss();
    else if (currentObjective(this.progress)?.kind === "defend") {
      if (!this.defense) this.defense = createDefense(nearest.label, nearest);
    } else EventBus.emit("campaign:interact", nearest.label);
  }
  update(_time: number, delta: number) {
    if (!this.player) return;
    const c = this.controls;
    const vector: BattleInput = {
      x:
        (c.right.isDown || c.arrowRight.isDown ? 1 : 0) -
        (c.left.isDown || c.arrowLeft.isDown ? 1 : 0) +
        (this.held.x ?? 0),
      y:
        (c.down.isDown || c.arrowDown.isDown ? 1 : 0) -
        (c.up.isDown || c.arrowUp.isDown ? 1 : 0) +
        (this.held.y ?? 0),
      attack: c.attack.isDown || this.held.attack,
      skill: c.skill.isDown || this.held.skill,
      dodge: c.dodge.isDown || this.held.dodge,
      revive: c.interact.isDown || this.held.revive,
    };
    if (!this.pauseInput && Phaser.Input.Keyboard.JustDown(c.interact))
      this.interact();
    if (this.battle) {
      if (this.online) {
        EventBus.emit(
          "campaign:input",
          this.pauseInput ? { x: 0, y: 0 } : vector,
        );
      } else if (!this.pauseInput) {
        this.accumulator += Math.min(delta, 100);
        while (this.accumulator >= STEP) {
          stepBattle(this.battle, { [this.progress.characterId]: vector });
          this.accumulator -= STEP;
        }
      }
      this.drawBattle();
      const me = this.battle.players.find(
        (p) =>
          p.id ===
          (this.online ? this.onlinePlayerId : this.progress.characterId),
      );
      if (me)
        this.player
          .setPosition(me.x, me.y)
          .setAlpha(
            me.hp <= 0 ? 0.3 : this.battle.time < me.invulnerable ? 0.6 : 1,
          );
      if (!this.online && this.battle.status === "won") {
        this.battle = null;
        this.effects.clear();
        this.player.setAlpha(1);
        EventBus.emit("campaign:boss-won");
      }
    } else if (!this.pauseInput) {
      if (this.walkGoal && Math.abs(vector.x) + Math.abs(vector.y) < 0.1) {
        const dx = this.walkGoal.x - this.player.x,
          dy = this.walkGoal.y - this.player.y,
          d = Math.hypot(dx, dy);
        if (d < 8) {
          this.walkGoal = null;
          this.interact();
        } else {
          vector.x = dx / d;
          vector.y = dy / d;
        }
      } else if (Math.abs(vector.x) + Math.abs(vector.y) > 0.1)
        this.walkGoal = null;
      const length = Math.hypot(vector.x, vector.y) || 1,
        scale = Math.min(delta, 50) * 0.2;
      this.player.x = Phaser.Math.Clamp(
        this.player.x + (vector.x / Math.max(1, length)) * scale,
        60,
        964,
      );
      this.player.y = Phaser.Math.Clamp(
        this.player.y + (vector.y / Math.max(1, length)) * scale,
        170,
        550,
      );
      if (vector.x) this.player.setFlipX(vector.x < 0);
    }
    if (this.defense && !this.pauseInput) {
      const d = this.defense;
      stepDefense(d, this.player, !!(vector.attack || vector.skill), delta);
      this.effects.clear();
      this.effects.lineStyle(3, 0x9fd4bb, 0.7);
      this.effects.strokeCircle(d.anchor.x, d.anchor.y, 75);
      this.defenseSprites.forEach((sprite) => sprite.setVisible(false));
      d.enemies.forEach((enemy, i) => {
        let sprite = this.defenseSprites[i];
        if (!sprite) {
          sprite = this.add
            .sprite(enemy.x, enemy.y, "oath-dungeon", 109)
            .setScale(3)
            .setDepth(780);
          this.defenseSprites.push(sprite);
        }
        sprite.setPosition(enemy.x, enemy.y).setVisible(true);
      });
      if (d.status !== "defending") {
        this.defense = null;
        this.defenseSprites.forEach((sprite) => sprite.destroy());
        this.defenseSprites = [];
        this.effects.clear();
        if (d.status === "won") EventBus.emit("campaign:interact", d.target);
        else
          EventBus.emit(
            "campaign:error",
            "방어선을 재정비했습니다. 손실 없이 다시 시도할 수 있습니다.",
          );
      }
    }
    const nearest = !this.battle
      ? this.targetNodes.find(
          (t) => Math.hypot(t.x - this.player.x, t.y - this.player.y) < 92,
        )
      : null;
    this.nearby = nearest?.label ?? null;
    if (_time - this.emitAt > 80) {
      this.emitAt = _time;
      EventBus.emit("campaign:view", {
        nearby: this.nearby,
        battle: this.battle ? structuredClone(this.battle) : null,
        ...(this.targetNodes[0] && !this.battle
          ? {
              bearing: {
                label: this.targetNodes[0].label,
                direction:
                  Math.abs(this.targetNodes[0].x - this.player.x) >
                  Math.abs(this.targetNodes[0].y - this.player.y)
                    ? this.targetNodes[0].x > this.player.x
                      ? "→"
                      : "←"
                    : this.targetNodes[0].y > this.player.y
                      ? "↓"
                      : "↑",
                distance: Math.round(
                  Math.hypot(
                    this.targetNodes[0].x - this.player.x,
                    this.targetNodes[0].y - this.player.y,
                  ) / 10,
                ),
              },
            }
          : {}),
        hint:
          currentObjective(this.progress)?.hint ??
          "다음 장으로 떠날 준비가 되었습니다.",
        ...(this.defense
          ? {
              defense: {
                remaining: Math.max(0, 8 - this.defense.time / 1000),
                integrity: this.defense.integrity,
              },
            }
          : {}),
      } satisfies CampaignViewState);
    }
  }
  private drawBattle() {
    const b = this.battle!;
    this.effects.clear();
    if (this.battleVisualId !== b.id) {
      this.battleVisualId = b.id;
      this.dynamicLayer.removeAll(true);
      this.remoteSprites.clear();
      this.lastHit = 0;
      this.bossSprite = this.add
        .sprite(
          b.boss.x,
          b.boss.y,
          "oath-dungeon",
          108 + (currentChapter(this.progress).episode % 8),
        )
        .setScale(5);
      this.dynamicLayer.add(this.bossSprite);
      this.battleLabel = this.add
        .text(512, 165, "", {
          fontFamily: "Galmuri11",
          fontSize: "16px",
          backgroundColor: "#23283c",
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5);
      this.dynamicLayer.add(this.battleLabel);
      this.sealLabel = this.add
        .text(512, 340, "각자 하나씩 · 세 봉인 위에 서세요", {
          fontFamily: "Galmuri11",
          fontSize: "18px",
          color: "#b6eed4",
          backgroundColor: "#1c263c",
        })
        .setOrigin(0.5)
        .setVisible(false);
      this.dynamicLayer.add(this.sealLabel);
    }
    this.sealLabel?.setVisible(b.hazards.some((h) => h.kind === "seals"));
    for (const h of b.hazards) {
      const active = b.time >= h.at,
        alpha = active ? 0.6 : 0.16;
      this.effects.fillStyle(active ? 0xe87575 : 0xe7a17c, alpha);
      this.effects.lineStyle(3, active ? 0xffceaa : 0xe3ad7b, 0.85);
      if (h.kind === "cross") {
        this.effects.fillRect(h.x - 42, 70, 84, 520);
        this.effects.fillRect(40, h.y - 42, 944, 84);
        this.effects.strokeRect(h.x - 42, 70, 84, 520);
        this.effects.strokeRect(40, h.y - 42, 944, 84);
      } else if (h.kind === "ring") {
        this.effects.lineStyle(85, 0xc86f88, alpha);
        this.effects.strokeCircle(h.x, h.y, h.radius);
        this.effects.lineStyle(2, 0xeeb29d, 0.9);
        this.effects.strokeCircle(h.x, h.y, h.radius - 45);
        this.effects.strokeCircle(h.x, h.y, h.radius + 45);
      } else if (h.kind === "seals") {
        for (const s of [
          { x: 280, y: 420 },
          { x: 512, y: 485 },
          { x: 744, y: 420 },
        ]) {
          this.effects.lineStyle(4, 0x91e2be, 1);
          this.effects.strokeCircle(s.x, s.y, 65);
        }
      } else {
        this.effects.fillCircle(h.x, h.y, h.radius);
        this.effects.strokeCircle(h.x, h.y, h.radius);
      }
    }
    const weak = b.time >= b.boss.weakFrom && b.time < b.boss.weakUntil;
    this.bossSprite
      ?.setPosition(b.boss.x, b.boss.y)
      .setTint(
        weak ? 0xe9cb89 : (CHAPTER_BY_ID[b.chapterId].boss?.color ?? 0xffffff),
      );
    this.battleLabel
      ?.setText(weak ? "빈틈! 지금 공격하세요" : "공격 예고를 확인하세요")
      .setColor(weak ? "#efdba7" : "#e5b6be");
    for (const p of b.players) {
      if (
        p.id !== (this.online ? this.onlinePlayerId : this.progress.characterId)
      ) {
        let sprite = this.remoteSprites.get(p.id);
        if (!sprite) {
          sprite = this.add
            .sprite(p.x, p.y, "oath-dungeon", FAMILY_FRAMES[p.family])
            .setScale(3);
          this.remoteSprites.set(p.id, sprite);
          this.dynamicLayer.add(sprite);
        }
        sprite.setPosition(p.x, p.y).setAlpha(p.hp <= 0 ? 0.3 : 1);
      }
      this.effects.fillStyle(0x182438);
      this.effects.fillRect(p.x - 21, p.y + 29, 42, 5);
      this.effects.fillStyle(0xa4d2a2);
      this.effects.fillRect(p.x - 21, p.y + 29, (42 * p.hp) / p.maxHp, 5);
      if (p.lastHit > b.time - 130) {
        this.effects.lineStyle(3, FAMILIES[p.family].color, 1);
        this.effects.lineBetween(p.x, p.y, b.boss.x, b.boss.y);
      }
      if (
        p.id ===
          (this.online ? this.onlinePlayerId : this.progress.characterId) &&
        p.skillAt > this.lastHit
      ) {
        if (p.skillAt > 0 && !this.reducedMotion) {
          this.skillFx
            .setPosition(b.boss.x, b.boss.y)
            .setVisible(true)
            .play("oath-skill");
        }
        this.lastHit = p.skillAt;
      }
    }
  }
}
export function mountCampaign(parent: HTMLElement, progress: CampaignProgress) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1024,
    height: 640,
    backgroundColor: "#171d2d",
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new CampaignScene(progress)],
    audio: { noAudio: true },
    fps: { target: 60 },
  });
}
