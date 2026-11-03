import Phaser from "phaser";
import { EventBus } from "@/components/game/EventBus";
import {
  currentChapter,
  currentObjective,
  type CampaignProgress,
} from "./progress";
import {
  CAMPAIGN_ASSETS,
  FAMILY_ART,
  WORLD_PALETTES,
  guideArt,
  bossArt,
} from "./assets";
import {
  FAMILIES,
  COSMETICS,
  CHAPTER_BY_ID,
  type ChapterDefinition,
} from "./catalog";
import { createDefense, stepDefense, type Defense } from "./defense";
import { DECOR_BUDGET, DECOR_SETS, type ObjTag } from "@/game/decorObjects";
import {
  buildCampaignMap,
  canWalkAt,
  walkingRoute,
  TILE_SIZE,
  MAP_COLS,
  type CampaignMap,
} from "./world";
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
const DECOR_BY_KEY = new Map(
  Object.values(DECOR_SETS)
    .flat()
    .map((item) => [item.key, item]),
);
const ART_BY_KEY = new Map(CAMPAIGN_ASSETS.map((item) => [item.key, item]));
export class CampaignScene extends Phaser.Scene {
  private defense: Defense | null = null;
  private defenseSprites: Phaser.GameObjects.Sprite[] = [];
  private progress!: CampaignProgress;
  private player!: Phaser.GameObjects.Sprite;
  private dynamicLayer!: Phaser.GameObjects.Group;
  private scenery!: Phaser.GameObjects.Group;
  private map!: CampaignMap;
  private route: { x: number; y: number }[] = [];
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
  private damageLabel?: Phaser.GameObjects.Text;
  private lastBossHp = 0;
  private damageUntil = 0;
  constructor(progress: CampaignProgress) {
    super("MemoryOath");
    this.progress = progress;
  }
  preload() {
    for (const a of CAMPAIGN_ASSETS) {
      if (a.frameWidth && a.frameHeight)
        this.load.spritesheet(a.key, a.url, {
          frameWidth: a.frameWidth,
          frameHeight: a.frameHeight,
          endFrame: 0,
        });
      else this.load.image(a.key, a.url);
    }
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
    this.dynamicLayer = this.add.group();
    this.scenery = this.add.group();
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
      .sprite(512, 485, `oath-${FAMILY_ART[this.progress.family]}`)
      .setScale(0.8)
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
          this.route = [];
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
      if (!this.pauseInput && !this.battle) {
        const goal = {
          x: Phaser.Math.Clamp(pointer.worldX, 60, 964),
          y: Phaser.Math.Clamp(pointer.worldY, 142, 550),
        };
        this.route = walkingRoute(this.map, this.player, goal);
        this.walkGoal = this.route.shift() ?? null;
        if (!this.walkGoal)
          EventBus.emit(
            "campaign:error",
            "벽이나 물은 건널 수 없습니다. 열린 길을 선택하세요.",
          );
      }
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
    this.player.setTexture(`oath-${FAMILY_ART[this.progress.family]}`);
    const cosmetic = COSMETICS.find((c) => c.id === this.progress.equipped);
    this.player.setTint(cosmetic?.color ?? 0xffffff);
  }
  /** The sole campaign scene-transition path: fade out, replace, always fade back in. */
  startTransition() {
    this.pauseInput = true;
    this.battle = null;
    this.walkGoal = null;
    this.route = [];
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
    this.scenery.clear(true, true);
    const chapter = override ?? currentChapter(this.progress),
      palette = WORLD_PALETTES[chapter.theme],
      outdoor = ["garden", "forest", "snow", "desert"].includes(chapter.theme),
      harbor = chapter.theme === "harbor";
    const budget =
      DECOR_BUDGET[harbor ? "town" : outdoor ? "forest" : "dungeon"];
    const placed: Record<ObjTag, number> = {
      big: 0,
      wall: 0,
      floor: 0,
      small: 0,
    };
    const prop = (key: string, x: number, y: number, scale = 2) => {
      const object = this.add.image(x, y, `oath-${key}`).setScale(scale);
      const sourceKey = ART_BY_KEY.get(`oath-${key}`)
        ?.url.split("/")
        .pop()
        ?.replace(/\.(png|webp)$/, "");
      const decor = sourceKey ? DECOR_BY_KEY.get(sourceKey) : undefined;
      if (decor) {
        // Reuse WorldScene.placeDecor's budget and reserved-route rules on the smaller story map.
        const blocked = [
          ...TARGET_SPOTS,
          { x: 512, y: 300 },
          { x: 512, y: 485 },
        ].some(
          (p) =>
            Math.hypot(p.x - x, p.y - y) <
            Math.min(object.displayWidth, object.displayHeight) / 2 + 38,
        );
        if (blocked || placed[decor.tag] >= budget[decor.tag])
          object.setVisible(false);
        else placed[decor.tag]++;
      }
      const terrain =
        key.startsWith("floor-") ||
        key.startsWith("wall-") ||
        ["path", "water", "lava"].includes(key);
      if (terrain) this.worldLayer.add(object);
      else {
        object.setDepth(y + object.displayHeight / 2);
        this.scenery.add(object);
      }
      return object;
    };
    // Real floor tiles and material transitions replace the old checkerboard room.
    this.map = buildCampaignMap(chapter.theme, chapter.episode, !!chapter.boss);
    this.map.ground.forEach((key, index) =>
      prop(
        key,
        (index % MAP_COLS) * TILE_SIZE,
        Math.floor(index / MAP_COLS) * TILE_SIZE,
        2,
      )
        .setOrigin(0)
        .setTint(0xc8c2be),
    );
    this.map.structures.forEach((key, index) => {
      if (key)
        prop(
          key,
          (index % MAP_COLS) * TILE_SIZE,
          Math.floor(index / MAP_COLS) * TILE_SIZE,
          2,
        ).setOrigin(0);
    });
    const trim = this.add.graphics();
    trim.fillStyle(0x101420, 0.25);
    trim.fillRect(0, 0, 1024, 112);
    trim.fillRect(0, 568, 1024, 72);
    this.worldLayer.add(trim);
    if (outdoor) {
      for (let i = 0; i < 18; i++) {
        const x = 36 + i * 58;
        if (i % 2 === 0)
          prop(
            i % 3 ? "garden-tree" : "garden-tree-gold",
            x,
            90 - (i % 2) * 18,
            1.1,
          );
        if ((i < 7 || i > 10) && i % 2)
          prop(i % 3 ? "garden-tree-gold" : "garden-tree", x, 585, 1);
      }
      prop("fountain", 512, 195, 2.7);
      prop("town-house", 220, 170, 1.2);
      prop("town-stall", 805, 180, 1.1);
      for (const [x, y] of [
        [130, 280],
        [870, 330],
        [200, 490],
        [900, 505],
      ])
        prop("garden-tree", x, y, 1.3);
      for (const x of [365, 655]) prop("garden-bush", x, 565, 1.4);
      for (const x of [115, 910]) {
        prop("statue", x, 345, 2.5);
        prop("tree-gold", x, 455, 2.8);
      }
    } else if (harbor) {
      prop("town-house", 265, 110, 1.3);
      prop("town-stall", 790, 125, 1.3);
      for (const x of [195, 825]) {
        prop("town-barrel", x, 340, 1.4);
        prop("town-barrel", x + 42, 520, 1);
        prop("town-bench", x, 220, 1.1);
      }
    } else {
      const wall =
        chapter.theme === "machine"
          ? "wall-machine"
          : chapter.theme === "desert"
            ? "wall-desert"
            : chapter.theme === "ruin"
              ? "wall-ruin"
              : "wall-castle";
      for (let x = 0; x < 1024; x += 48) {
        prop(wall, x, 24, 1.5).setOrigin(0);
        prop(wall, x, 72, 1.5).setOrigin(0).setTint(0xc5bdab);
        prop(wall, x, 590, 1.5).setOrigin(0).setTint(0x777584);
      }
      for (const x of [24, 976])
        for (let y = 120; y < 590; y += 48) prop(wall, x, y, 1.5).setOrigin(0);
      if (chapter.theme === "castle") {
        const carpet = this.add.graphics();
        carpet.fillStyle(0x4a263a, 0.92);
        carpet.fillRect(447, 127, 130, 420);
        carpet.lineStyle(2, 0xc19c63, 0.8);
        carpet.strokeRect(453, 133, 118, 408);
        this.worldLayer.add(carpet);
        for (const x of [172, 292, 732, 852]) {
          prop("library-shelf", x, 175, 1.6);
          prop("library-shelf", x, 535, 1.4);
        }
        for (const x of [190, 835]) {
          prop("library-table", x, 365, 1);
          prop("book", x - 25, 345, 0.7);
          prop("library-candle", x + 22, 342, 0.6);
        }
      }
      for (const x of [100, 920]) {
        prop("pillar", x, 200, 2.7);
        prop(chapter.theme === "ruin" ? "column" : "statue", x, 440, 2.5);
      }
      prop("door", 512, 90, 2.4);
      if (chapter.theme === "machine") {
        for (const x of [180, 840])
          for (const y of [215, 485]) prop("armory", x, y, 3);
      } else if (chapter.theme !== "castle") {
        prop("altar", 512, 195, 2.5);
      }
    }
    const light = this.add.graphics();
    for (const x of [144, 880]) {
      for (const [radius, alpha] of [
        [100, 0.025],
        [65, 0.045],
        [28, 0.08],
      ]) {
        light.fillStyle(palette[2], alpha);
        light.fillCircle(x, 265, radius);
      }
    }
    light.fillStyle(0x080e1c, 0.22);
    light.fillRect(0, 0, 65, 640);
    light.fillRect(960, 0, 64, 640);
    this.worldLayer.add(light);
  }
  private rebuildTargets() {
    this.defense = null;
    this.defenseSprites.forEach((s) => s.destroy());
    this.defenseSprites = [];
    this.effects.clear();
    this.dynamicLayer.clear(true, true);
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
            `oath-${bossArt(currentChapter(this.progress))}`,
          )
          .setScale(3.8)
          .setDepth(point.y + 60),
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
          .setOrigin(0.5)
          .setDepth(900),
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
      ring.setDepth(spot.y);
      this.dynamicLayer.add(ring);
      const sprite = this.add
        .image(
          spot.x,
          spot.y,
          `oath-${objective.kind === "talk" ? guideArt(label) : objective.kind === "puzzle" ? "rune" : objective.kind === "defend" ? "altar" : objective.kind === "collect" ? "potion" : i % 2 ? "scroll" : "book"}`,
        )
        .setScale(objective.kind === "talk" ? 0.85 : 1.2)
        .setDepth(spot.y + 32);
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
          .setOrigin(0.5)
          .setDepth(900),
      );
    });
  }
  private beginBoss() {
    const chapter = currentChapter(this.progress);
    if (!chapter.boss) return;
    this.dynamicLayer.clear(true, true);
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
        this.startTransition();
      }
    } else if (!this.pauseInput) {
      if (this.walkGoal && Math.abs(vector.x) + Math.abs(vector.y) < 0.1) {
        const dx = this.walkGoal.x - this.player.x,
          dy = this.walkGoal.y - this.player.y,
          d = Math.hypot(dx, dy);
        if (d < 8) {
          this.walkGoal = this.route.shift() ?? null;
          if (!this.walkGoal) this.interact();
        } else {
          vector.x = dx / d;
          vector.y = dy / d;
        }
      } else if (Math.abs(vector.x) + Math.abs(vector.y) > 0.1) {
        this.walkGoal = null;
        this.route = [];
      }
      const length = Math.hypot(vector.x, vector.y) || 1,
        scale = Math.min(delta, 50) * 0.2;
      const nextX = Phaser.Math.Clamp(
        this.player.x + (vector.x / Math.max(1, length)) * scale,
        60,
        964,
      );
      const nextY = Phaser.Math.Clamp(
        this.player.y + (vector.y / Math.max(1, length)) * scale,
        142,
        550,
      );
      if (canWalkAt(this.map, { x: nextX, y: this.player.y }))
        this.player.x = nextX;
      if (canWalkAt(this.map, { x: this.player.x, y: nextY }))
        this.player.y = nextY;
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
            .sprite(enemy.x, enemy.y, "oath-minion")
            .setScale(2)
            .setDepth(780);
          this.defenseSprites.push(sprite);
        }
        sprite
          .setPosition(enemy.x, enemy.y)
          .setDepth(enemy.y + 32)
          .setVisible(true);
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
    this.player.setDepth(this.player.y + 32);
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
      this.dynamicLayer.clear(true, true);
      this.remoteSprites.clear();
      this.lastHit = 0;
      this.lastBossHp = b.boss.hp;
      this.bossSprite = this.add
        .sprite(
          b.boss.x,
          b.boss.y,
          `oath-${bossArt(CHAPTER_BY_ID[b.chapterId])}`,
        )
        .setScale(3.8)
        .setDepth(b.boss.y + 60);
      this.dynamicLayer.add(this.bossSprite);
      this.damageLabel = this.add
        .text(b.boss.x, b.boss.y - 70, "", {
          fontFamily: "Galmuri11",
          fontSize: "22px",
          color: "#f5d79c",
          stroke: "#201a28",
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(950);
      this.dynamicLayer.add(this.damageLabel);
      this.battleLabel = this.add
        .text(512, 165, "", {
          fontFamily: "Galmuri11",
          fontSize: "16px",
          backgroundColor: "#23283c",
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(900);
      this.dynamicLayer.add(this.battleLabel);
      this.sealLabel = this.add
        .text(512, 340, "각자 하나씩 · 세 봉인 위에 서세요", {
          fontFamily: "Galmuri11",
          fontSize: "18px",
          color: "#b6eed4",
          backgroundColor: "#1c263c",
        })
        .setOrigin(0.5)
        .setVisible(false)
        .setDepth(900);
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
    if (b.boss.hp < this.lastBossHp) {
      this.damageLabel?.setText(
        `${weak ? "빈틈! " : ""}${Math.round(this.lastBossHp - b.boss.hp)}`,
      );
      this.damageUntil = b.time + 420;
    }
    this.lastBossHp = b.boss.hp;
    this.damageLabel
      ?.setVisible(b.time < this.damageUntil)
      .setPosition(
        b.boss.x,
        b.boss.y -
          75 -
          (this.reducedMotion
            ? 0
            : Math.max(0, 420 - (this.damageUntil - b.time)) / 24),
      );
    this.bossSprite
      ?.setPosition(b.boss.x, b.boss.y)
      .setTint(weak ? 0xffdf9b : 0xffffff);
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
            .sprite(p.x, p.y, `oath-${FAMILY_ART[p.family]}`)
            .setScale(0.8);
          this.remoteSprites.set(p.id, sprite);
          this.dynamicLayer.add(sprite);
        }
        sprite
          .setPosition(p.x, p.y)
          .setDepth(p.y + 32)
          .setAlpha(p.hp <= 0 ? 0.3 : 1);
      }
      this.effects.fillStyle(0x182438);
      this.effects.fillRect(p.x - 21, p.y + 29, 42, 5);
      this.effects.fillStyle(0xa4d2a2);
      this.effects.fillRect(p.x - 21, p.y + 29, (42 * p.hp) / p.maxHp, 5);
      if (p.dodgeAt > b.time + 930) {
        this.effects.lineStyle(2, 0x9bd9df, 0.8);
        this.effects.strokeEllipse(p.x, p.y + 25, 58, 22);
      }
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
