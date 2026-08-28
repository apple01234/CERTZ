import Phaser from "phaser";
import { STAGES, DIALOGUES, ITEMS, SHOP_STOCK, type StageKey, type StageDef, type ItemKey, type EnemyDef } from "../data";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { Boss } from "../entities/Boss";
import { Drop, type DropKind } from "../entities/Drop";
import { EventBus, type QuestState } from "../../components/game/EventBus";
import { writeSave, loadSave, type SaveData } from "../config";
import { viewZoom } from "../PhaserGame";
import * as audio from "../audio";

/**
 * 메인 플레이 씬.
 *  F1: 꽃/장식 배치를 정의된 소수로만 배치
 *  F2: 목표물 빛기둥 비컨 + 화면 가장자리 화살표 + 실시간 거리 표시
 *  F4: 데미지텍스트·참격·파티클 모두 풀링/공유 이미터 → 보스전 프레임 안정
 */
export class WorldScene extends Phaser.Scene {
  stageDef!: StageDef;
  stageW = 0;
  stageH = 0;

  player!: Player;
  enemies: Enemy[] = [];
  boss: Boss | null = null;
  playerRef: Player | null = null;

  questIdx = 0;
  huntCount = 0;
  totalKills = 0;
  startTime = 0;
  cleared = false;

  private fragment: Phaser.Physics.Arcade.Sprite | null = null;
  private portal: Phaser.Physics.Arcade.Sprite | null = null;
  private portalActive = false;
  private beacon: Phaser.GameObjects.Image | null = null;
  private portalBeacon: Phaser.GameObjects.Image | null = null;
  private edgeArrow: Phaser.GameObjects.Image | null = null;
  private questMark: Phaser.GameObjects.Image | null = null;

  private moveVec = new Phaser.Math.Vector2();
  private touchMove = new Phaser.Math.Vector2();
  private attackQueued = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private dialoguing = false;

  // F4: 공유 파티클 이미터 (생성 1회)
  private hitEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private burstEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  // F4: 데미지 텍스트 풀
  private dmgPool: Phaser.GameObjects.Text[] = [];
  // F4: 참격 이펙트 풀 (외부 에셋 애니 스프라이트)
  private slashPool: Phaser.GameObjects.Sprite[] = [];
  private slashIdx = 0;
  // 실제 에셋 기반 타격 스타 풀
  private starPool: Phaser.GameObjects.Image[] = [];
  private starIdx = 0;
  private fragSparkle: Phaser.GameObjects.Sprite | null = null;

  private questTimer: Phaser.Time.TimerEvent | null = null;
  private hitStopActive = false;
  // 스테이지별 누적 킬 (퀘스트 순서와 무관하게 토벌 진행 유지 — 소프트락 방지)
  private killTotals: Record<string, number> = {};

  /* ----- 2D MMORPG 기본 요소 ----- */
  private drops: Drop[] = [];
  private merchant: Phaser.GameObjects.Image | null = null;
  private merchantLabel: Phaser.GameObjects.Text | null = null;
  private nearShop = false;
  private minimap: Phaser.GameObjects.Graphics | null = null;
  private lastRpgSig = "";

  constructor() {
    super("world");
  }

  init(data: { stage?: StageKey; save?: SaveData }) {
    this.questIdx = 0;
    this.huntCount = 0;
    this.totalKills = 0;
    this.startTime = this.time.now;
    this.cleared = false;
    this.enemies = [];
    this.boss = null;
    this.fragment = null;
    this.portal = null;
    this.beacon = null;
    this.portalBeacon = null;
    this.questMark = null;
    this.fragSparkle = null;
    this.dialoguing = false;
    this.attackQueued = false;
    this.hitStopActive = false;
    this.killTotals = {};
    this.drops = [];
    this.merchant = null;
    this.merchantLabel = null;
    this.nearShop = false;
    this.minimap = null;
    this.lastRpgSig = "";
    this.registry.set("initData", data);
  }

  create() {
    const data = this.registry.get("initData") as {
      stage?: StageKey;
      save?: SaveData;
    };
    const save = data.save;
    const stageKey: StageKey = save ? (save.stage as StageKey) : data.stage ?? "forest";
    this.stageDef = STAGES[stageKey];
    this.stageW = this.stageDef.width;
    this.stageH = this.stageDef.height;

    /* ---------- 바닥 ---------- */
    const groundTex = stageKey === "forest" ? "tile_grass" : "tile_dark";
    this.add.tileSprite(0, 0, this.stageW, this.stageH, groundTex).setOrigin(0).setDepth(0);
    // 중앙 가로 길
    this.add
      .tileSprite(0, this.stageH / 2 - 52, this.stageW, 104, "tile_path")
      .setOrigin(0)
      .setDepth(0)
      .setAlpha(0.9);
    if (stageKey === "forest") {
      this.add
        .tileSprite(this.stageW * 0.55 - 52, 0, 104, this.stageH, "tile_path")
        .setOrigin(0)
        .setDepth(0)
        .setAlpha(0.85);
    }

    this.physics.world.setBounds(0, 0, this.stageW, this.stageH);
    this.cameras.main.setBounds(0, 0, this.stageW, this.stageH);
    this.cameras.main.setBackgroundColor(stageKey === "forest" ? "#0a1408" : "#0d0a1e");

    // 반응형: 화면 밀도 유지용 카메라 줌 (RESIZE 캔버스 1:1 + 카메라 확대)
    this.applyCameraZoom();
    this.scale.on("resize", this.applyCameraZoom, this);

    /* ---------- 장식 (F1: 정의된 소수만) ---------- */
    this.placeDecor(stageKey);

    /* ---------- 상점 NPC (2D MMORPG 기본 요소) ---------- */
    this.spawnMerchant();

    /* ---------- 플레이어 ---------- */
    const savedPlayer = save;
    this.player = new Player(this, 180, this.stageH / 2);
    if (savedPlayer) {
      this.player.lv = savedPlayer.lv;
      this.player.atk = savedPlayer.atk;
      this.player.maxHp = savedPlayer.maxHp;
      this.player.hp = this.player.maxHp;
      // RPG 자원 복원 (구 세이브는 loadSave()가 기본값 채움)
      this.player.gold = savedPlayer.gold ?? 30;
      this.player.potions = { hp: savedPlayer.potions?.hp ?? 2, mp: savedPlayer.potions?.mp ?? 1 };
      this.player.weapon = (savedPlayer.weapon ?? "weapon_1") as ItemKey;
      this.player.armor = (savedPlayer.armor ?? "armor_1") as ItemKey;
      this.player.owned = (savedPlayer.owned ?? ["weapon_1", "armor_1"]) as ItemKey[];
    }
    this.playerRef = this.player;
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.physics.add.collider(this.player, this.solidGroup);

    /* ---------- 적 배치 ---------- */
    const rng = new Phaser.Math.RandomDataGenerator([stageKey]);
    for (const group of this.stageDef.enemies) {
      for (let i = 0; i < group.count; i++) {
        let ex = 0;
        let ey = 0;
        let tries = 0;
        do {
          ex = stageKey === "forest" ? rng.between(this.stageW * 0.42, this.stageW - 140) : rng.between(240, this.stageW - 160);
          ey = rng.between(120, this.stageH - 120);
          tries++;
        } while (Phaser.Math.Distance.Between(ex, ey, this.player.x, this.player.y) < 380 && tries < 30);
        const e = new Enemy(this, ex, ey, group.key);
        this.enemies.push(e);
        this.physics.add.collider(e, this.solidGroup);
      }
    }

    /* ---------- 퀘스트 오브젝트 ---------- */
    if (stageKey === "forest") {
      this.spawnFragment(this.stageW * 0.78, this.stageH * 0.26);
      this.spawnPortal(this.stageW - 130, this.stageH * 0.52);
    } else {
      this.spawnPortalBossArena();
    }

    /* ---------- 이펙트 풀 ---------- */
    this.buildFxPools();

    /* ---------- 미니맵 (2D MMORPG 기본 요소) ---------- */
    this.minimap = this.add.graphics().setDepth(95).setScrollFactor(0).setAlpha(0.85);
    this.redrawMinimap();

    /* ---------- 입력 ---------- */
    this.setupInput();

    /* ---------- 사운드/BGM ---------- */
    audio.playBGM(stageKey === "forest" ? "field" : "boss");

    /* ---------- 오프닝 대사 ---------- */
    this.time.delayedCall(400, () => {
      this.showDialogue(stageKey === "forest" ? "intro" : "alfheimIntro");
    });

    EventBus.emit("ui:playing");
    this.emitHud();
    this.emitQuest();
    this.emitRpgState();

    // F2: 거리 실시간 갱신 (300ms 주기 — 프레임 부담 없음) + 미니맵/RPG 상태
    this.questTimer = this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        this.emitQuest();
        this.emitSkills();
        this.emitRpgState();
        this.redrawMinimap();
      },
    });

    this.events.once("shutdown", () => this.cleanup());
  }

  private solidGroup!: Phaser.Physics.Arcade.StaticGroup;

  private applyCameraZoom() {
    this.cameras.main.setZoom(viewZoom());
    this.redrawMinimap();
  }

  /* ================= 배치 ================= */

  private placeDecor(stageKey: StageKey) {
    const def = this.stageDef;
    const rng = new Phaser.Math.RandomDataGenerator([stageKey + "-decor"]);
    this.solidGroup = this.physics.add.staticGroup();

    // 나무 & 소나무 & 바위 (충돌 있음) — 실제 에셋
    for (let i = 0; i < def.treeCount; i++) {
      const x = rng.between(80, this.stageW - 80);
      const y = rng.between(90, this.stageH - 80);
      if (Math.abs(y - this.stageH / 2) < 90) continue; // 길 위엔 안 심음
      const tex = rng.pick(["tree", "tree", "pine"] as string[]);
      const t = this.add.image(x, y, tex).setDepth(Math.floor(y / 10));
      this.solidGroup.add(t);
      // 64x64 캔버스 하단 줄기 부근만 충돌
      (t.body as Phaser.Physics.Arcade.StaticBody).setSize(20, 14).setOffset(22, 46);
    }
    for (let i = 0; i < def.rockCount; i++) {
      const x = rng.between(80, this.stageW - 80);
      const y = rng.between(90, this.stageH - 80);
      if (Math.abs(y - this.stageH / 2) < 90) continue;
      const r = this.add.image(x, y, "rock").setDepth(Math.floor(y / 10));
      this.solidGroup.add(r);
      (r.body as Phaser.Physics.Arcade.StaticBody).setSize(44, 20).setOffset(10, 40);
    }

    // F1 핵심: 꽃은 def.flowerCount 송이만 (10 이하)
    const flowers = ["flower_r", "flower_y", "flower_w"];
    for (let i = 0; i < def.flowerCount; i++) {
      const x = rng.between(60, this.stageW - 60);
      const y = rng.between(60, this.stageH - 60);
      this.add.image(x, y, rng.pick(flowers)).setDepth(1).setAlpha(0.95);
    }

    // 심연 구역(알프헤임) 횃불 — 실제 Kenney 횃불 + 온기 글로우
    if (stageKey === "alfheim") {
      for (let i = 0; i < 6; i++) {
        const tx = 200 + (i * (this.stageW - 400)) / 5;
        const ty = i % 2 === 0 ? this.stageH / 2 - 140 : this.stageH / 2 + 140;
        this.add.image(tx, ty, "torch").setDepth(2);
        const g = this.add
          .image(tx, ty, "glow")
          .setDepth(1)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xffa040)
          .setScale(1.1)
          .setAlpha(0.22);
        this.tweens.add({ targets: g, alpha: 0.42, scale: 1.35, duration: 650, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      }
    }
  }

  private spawnFragment(x: number, y: number) {
    this.fragment = this.physics.add.sprite(x, y, "fragment").setDepth(4);
    (this.fragment.body as Phaser.Physics.Arcade.Body).setCircle(13, 3, 3);

    // 실제 에셋 수정 위 반짝임 (objects.png 별/다이아 프레임)
    this.fragSparkle = this.add
      .sprite(x, y - 14, "sparkle0")
      .setDepth(5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .play("sparkle");

    // F2 핵심 1: 하늘까지 닿는 빛 기둥 비컨 — 외부 에셋(Kenney Light Masks CC0)
    this.beacon = this.add
      .image(x, y - 128, "beam")
      .setDepth(3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.55);
    this.tweens.add({
      targets: this.beacon,
      alpha: { from: 0.4, to: 0.75 },
      scaleX: { from: 1, to: 1.25 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    // 바닥 글로우
    const glow = this.add.image(x, y + 8, "glow").setDepth(2).setBlendMode(Phaser.BlendModes.ADD).setScale(1.4);
    this.tweens.add({ targets: glow, scale: 1.7, alpha: 0.7, duration: 800, yoyo: true, repeat: -1 });
    // 뜨는 모션 + 반짝임 동기화
    this.tweens.add({ targets: this.fragment, y: y - 8, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    if (this.fragSparkle) {
      this.tweens.add({ targets: this.fragSparkle, y: y - 22, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    }

    this.physics.add.overlap(this.player, this.fragment, () => {
      if (!this.fragment || !this.fragment.active) return;
      this.collectFragment(glow);
    });
  }

  private collectFragment(glow: Phaser.GameObjects.Image) {
    audio.sfx.pickup();
    audio.sfx.questDone();
    this.player.atk += 5; // 파편 보너스
    this.player.healFull();
    glow.destroy();
    this.tweens.add({ targets: this.beacon, alpha: 0, duration: 400, onComplete: () => this.beacon?.destroy() });
    this.beacon = null;
    this.fragSparkle?.destroy();
    this.fragSparkle = null;
    const f = this.fragment!;
    this.tweens.add({
      targets: f,
      y: f.y - 60,
      alpha: 0,
      scale: 1.6,
      duration: 500,
      onComplete: () => f.destroy(),
    });
    this.fragment = null;
    this.spawnBurstAt(f.x, f.y, 14, 0x9df0ff);
    this.showDialogue("fragment");
    this.advanceQuest();
    // 늑대를 먼저 다 잡아둔 경우 — 토벌 퀘스트가 이미 충족됐으면 즉시 완료 처리
    this.time.delayedCall(100, () => {
      if (this.stageDef.key === "forest") this.tryCompleteHunt("wolf");
      else this.tryCompleteHunt("minion");
    });
    this.save();
  }

  private spawnPortal(x: number, y: number) {
    // 외부 에셋 차원문(varkalandar CC-BY, 8프레임 소용돌이) — 비활성 시 회색 틴트
    this.portal = this.physics.add.sprite(x, y, "portal0").setDepth(3).setTint(0x777777);
    (this.portal.body as Phaser.Physics.Arcade.Body).setSize(34, 44).setOffset(15, 10);
    this.physics.add.overlap(this.player, this.portal, () => {
      if (!this.portalActive || !this.portal?.active) return;
      this.enterPortal();
    });
  }

  private activatePortal() {
    if (!this.portal) return;
    this.portalActive = true;
    this.portal.clearTint();
    this.portal.play("portal-spin");
    audio.sfx.portal();
    // F2: 차원문에도 작은 비컨
    this.portalBeacon = this.add
      .image(this.portal.x, this.portal.y - 120, "beam")
      .setDepth(2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.4)
      .setTint(0x9d7aff);
    this.tweens.add({
      targets: this.portalBeacon,
      alpha: { from: 0.28, to: 0.5 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
    this.showBanner("차원문이 열렸다!");
  }

  private enterPortal() {
    this.portalActive = false;
    audio.sfx.portal();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.player.state = "idle";
    this.time.delayedCall(520, () => {
      this.saveStage("alfheim");
      this.scene.restart({ stage: "alfheim" });
    });
  }

  private spawnPortalBossArena() {
    // 보스전 스테이지는 차원문 없음 — 하수인 소탕 후 보스 등장
  }

  /* ================= 이펙트 풀 (F4) ================= */

  private buildFxPools() {
    // ⚠️ 씬 재시작(스테이지 전환) 시 풀이 누적되지 않도록 리셋
    //   (파괴된 텍스트 재사용 → setText 크래시 원인)
    for (const d of this.dmgPool) d.destroy();
    this.dmgPool = [];
    for (const s of this.slashPool) s.destroy();
    this.slashPool = [];
    for (const s of this.starPool) s.destroy();
    this.starPool = [];

    // 공유 파티클 이미터 2종
    this.hitEmitter = this.add.particles(0, 0, "spark", {
      lifespan: 260,
      speed: { min: 60, max: 190 },
      scale: { start: 1, end: 0 },
      emitting: false,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(30);
    this.burstEmitter = this.add.particles(0, 0, "spark", {
      lifespan: 480,
      speed: { min: 90, max: 300 },
      scale: { start: 1.4, end: 0 },
      emitting: false,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(30);

    // 데미지 텍스트 12장 고정 풀
    for (let i = 0; i < 12; i++) {
      const t = this.add
        .text(0, 0, "", {
          fontFamily: "sans-serif",
          fontSize: "17px",
          color: "#ffffff",
          stroke: "#1a1020",
          strokeThickness: 4,
          fontStyle: "bold",
        })
        .setDepth(40)
        .setActive(false)
        .setVisible(false);
      this.dmgPool.push(t);
    }

    // 참격(초승달 애니) 스프라이트 5장 고정 풀 — 외부 에셋(Cethiel CC0)
    for (let i = 0; i < 5; i++) {
      const s = this.add
        .sprite(0, 0, "slash0")
        .setDepth(25)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setActive(false)
        .setVisible(false);
      this.slashPool.push(s);
    }

    // 타격 스타 4장 고정 풀 (실제 에셋: objects.png 폭발 프레임)
    for (let i = 0; i < 4; i++) {
      const s = this.add
        .image(0, 0, "impact_star")
        .setDepth(29)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setActive(false)
        .setVisible(false);
      this.starPool.push(s);
    }
  }

  spawnDamageText(x: number, y: number, val: number) {
    const t = this.dmgPool.find((d) => d.scene && !d.active);
    if (!t) return; // 풀 소진 시 조용히 포기 (프레임 보호)
    t.setText(`${val}`).setColor("#ffffff");
    t.setPosition(x, y)
      .setActive(true)
      .setVisible(true)
      .setAlpha(1)
      .setScale(1);
    this.tweens.add({
      targets: t,
      y: y - 34,
      alpha: 0,
      duration: 550,
      ease: "Quad.out",
      onComplete: () => t.setActive(false).setVisible(false),
    });
  }

  spawnHitSpark(x: number, y: number) {
    this.hitEmitter.setParticleTint(0xfff0a0);
    this.hitEmitter.explode(5, x, y);

    // 실제 에셋 타격 스타 팝 (풀 재사용 — F4 규칙 준수)
    const s = this.starPool[this.starIdx];
    this.starIdx = (this.starIdx + 1) % this.starPool.length;
    if (s && s.scene) {
      s.setPosition(x, y - 8)
        .setRotation(Phaser.Math.FloatBetween(0, Math.PI))
        .setActive(true)
        .setVisible(true)
        .setAlpha(1)
        .setScale(0.32);
      this.tweens.add({
        targets: s,
        scale: 0.68,
        alpha: 0,
        duration: 140,
        ease: "Quad.out",
        onComplete: () => s.setActive(false).setVisible(false),
      });
    }
  }

  spawnBurstAt(x: number, y: number, n: number, tint: number) {
    this.burstEmitter.setParticleTint(tint);
    this.burstEmitter.explode(n, x, y);
  }

  spawnDeathBurst(x: number, y: number) {
    this.spawnBurstAt(x, y, 10, 0xff9a8a);
  }

  spawnSlamBurst(x: number, y: number) {
    this.spawnBurstAt(x, y, 16, 0xffb090);
  }

  spawnEnrageBurst(x: number, y: number) {
    this.spawnBurstAt(x, y, 22, 0xff7080);
  }

  spawnLevelUpFx(x: number, y: number) {
    const ring = this.add.image(x, y, "shock_ring").setDepth(26).setBlendMode(Phaser.BlendModes.ADD).setTint(0x86d9ff).setScale(0.2);
    this.tweens.add({
      targets: ring,
      scale: 1.3,
      alpha: 0,
      duration: 500,
      onComplete: () => ring.destroy(),
    });
  }

  spawnCrack(x: number, y: number) {
    // 외부 에셋 스코치(그을음) 마크 — 보스 강타 지면 표시
    const c = this.add.image(x, y + 20, "scorch").setDepth(1).setAlpha(0.75).setTint(0x8a7a66).setScale(1.4);
    this.tweens.add({ targets: c, alpha: 0, delay: 3500, duration: 800, onComplete: () => c.destroy() });
  }

  /* ================= 2D MMORPG 기본 요소 (골드/물약/장비/상점/미니맵) ================= */

  /** 상점 NPC — 스폰 근처 대기 (스테이지 공통) */
  private spawnMerchant() {
    const mx = 340;
    const my = this.stageH / 2 - 60;
    const glow = this.add.image(mx, my + 14, "glow").setDepth(1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd76a).setScale(0.9).setAlpha(0.25);
    this.tweens.add({ targets: glow, alpha: 0.42, scale: 1.15, duration: 850, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.merchant = this.add.image(mx, my, "npc_merchant").setDepth(Math.floor(my / 10)).setScale(1.7);
    this.tweens.add({ targets: this.merchant, y: my - 3, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.merchantLabel = this.add
      .text(mx, my - 36, "상인 라고스", {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#ffd76a",
        stroke: "#1a1020",
        strokeThickness: 4,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(21);
  }

  private acquireDrop(): Drop | null {
    const free = this.drops.find((d) => d.scene && !d.active);
    if (free) return free;
    if (this.drops.length < 24) {
      const d = new Drop(this, 0, -9999);
      this.drops.push(d);
      return d;
    }
    return null;
  }

  /** 몬스터 사망 드롭 — 골드 코인 + 물약 확률 */
  dropLoot(x: number, y: number, def: EnemyDef) {
    const total = Phaser.Math.Between(def.gold[0], def.gold[1]);
    this.dropLootGold(x, y, total);
    const r = Math.random();
    if (r < (def.dropHp ?? 0)) this.dropLootItem(x, y, "potion_hp");
    else if (r < (def.dropHp ?? 0) + (def.dropMp ?? 0)) this.dropLootItem(x, y, "potion_mp");
  }

  /** 골드를 코인 여러 개로 분산 드롭 */
  dropLootGold(x: number, y: number, total: number) {
    const n = total >= 150 ? 5 : total >= 40 ? 3 : 2;
    const per = Math.max(1, Math.round(total / n));
    for (let i = 0; i < n; i++) {
      const d = this.acquireDrop();
      if (!d) break;
      d.spawn("gold", x, y, i === n - 1 ? total - per * (n - 1) : per);
    }
  }

  dropLootItem(x: number, y: number, key: DropKind) {
    const d = this.acquireDrop();
    d?.spawn(key, x, y, 1);
  }

  /** 픽업 처리 (Drop가 접촉 시 호출) */
  collectDrop(kind: DropKind, amount: number, x: number, y: number) {
    if (kind === "gold") {
      this.player.addGold(amount);
      audio.sfx.coin();
      this.spawnPickupText(x, y - 14, `+${amount}G`, "#ffd76a");
    } else if (kind === "potion_hp") {
      this.player.addPotion("hp");
      audio.sfx.pickup();
      this.spawnPickupText(x, y - 14, "+HP 물약", "#ff8a8a");
    } else if (kind === "potion_mp") {
      this.player.addPotion("mp");
      audio.sfx.pickup();
      this.spawnPickupText(x, y - 14, "+MP 물약", "#7dc0ff");
    }
  }

  /** 획득/보상 안내 텍스트 — 데미지 텍스트 풀 재사용 (F4 규칙) */
  spawnPickupText(x: number, y: number, msg: string, color: string) {
    const t = this.dmgPool.find((d) => d.scene && !d.active);
    if (!t) return;
    t.setText(msg).setColor(color);
    t.setPosition(x, y)
      .setActive(true)
      .setVisible(true)
      .setAlpha(1)
      .setScale(1);
    this.tweens.add({
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

  /* ---------- 미니맵 (하단 중앙, 줌 보정) ---------- */

  private redrawMinimap() {
    const mm = this.minimap;
    if (!mm || !mm.scene || !this.player) return;
    const cam = this.cameras.main;
    const z = cam.zoom || 1;
    const gw = 156 / z;
    const gh = 88 / z;
    const cx = cam.width / 2;
    const cy = cam.height / 2 + (cam.height - 12 - gh * z * 0.5 - cam.height / 2) / z;
    mm.clear();
    mm.fillStyle(0x0a0e18, 0.78).fillRoundedRect(cx - gw / 2, cy - gh / 2, gw, gh, 8 / z);
    mm.lineStyle(1.5 / z, 0xffd76a, 0.5).strokeRoundedRect(cx - gw / 2, cy - gh / 2, gw, gh, 8 / z);
    const mx = (wx: number) => cx - gw / 2 + (wx / this.stageW) * gw;
    const my = (wy: number) => cy - gh / 2 + (wy / this.stageH) * gh;
    // 적 (빨강) / 보스 (크게)
    mm.fillStyle(0xff5a5a, 0.95);
    for (const e of this.enemies) if (e.active && e.alive) mm.fillCircle(mx(e.x), my(e.y), 2.2 / z);
    if (this.boss?.active && this.boss.alive) mm.fillCircle(mx(this.boss.x), my(this.boss.y), 3.4 / z);
    // 상인 (녹색)
    if (this.merchant) {
      mm.fillStyle(0x7dffa8, 0.95);
      mm.fillCircle(mx(this.merchant.x), my(this.merchant.y), 2.4 / z);
    }
    // 퀘스트 목표 (금색)
    const t = this.questTargetPos();
    if (t) {
      mm.fillStyle(0xffd76a, 1);
      mm.fillCircle(mx(t.x), my(t.y), 2.8 / z);
    }
    // 차원문 (활성 보라 / 비활성 회색)
    if (this.portal?.active) {
      mm.fillStyle(this.portalActive ? 0x9d7aff : 0x8a8a8a, 0.9);
      mm.fillCircle(mx(this.portal.x), my(this.portal.y), 2.8 / z);
    }
    // 플레이어 (흰 점 + 링)
    const px = mx(this.player.x);
    const py = my(this.player.y);
    mm.fillStyle(0xffffff, 1).fillCircle(px, py, 2.6 / z);
    mm.lineStyle(1 / z, 0xffffff, 0.45).strokeCircle(px, py, 4.6 / z);
  }

  /**
   * 회전베기(Skill 1) 이펙트 — 검이 몸 주위를 360° 한 바퀴 돌며 베는 연출
   *  1) 반달 참격 2장이 플레이어 중심을 축으로 360° 궤도 회전 (트레일 1장 추가)
   *  2) 회전이 끝나는 시점에 확장 충격파 링
   *  3) 청백 스파크 버스트 + 미세 카메라 킥
   *  몸통 회전 자체는 Player.useSkill1에서 스프라이트 rotation 트윈으로 처리
   */
  spawnSpinSlash(x: number, y: number, spin: number) {
    for (let i = 0; i < 2; i++) {
      const s = this.slashPool[this.slashIdx];
      this.slashIdx = (this.slashIdx + 1) % this.slashPool.length;
      if (!s || !s.scene) continue;
      this.tweens.killTweensOf(s);
      s.off("animationcomplete");
      const trail = i === 1;
      s.setPosition(x, y - 4)
        .setRotation(-0.5 * spin - (trail ? 0.55 * spin : 0))
        .setActive(true)
        .setVisible(true)
        .setAlpha(trail ? 0.6 : 1)
        .setScale(trail ? 0.82 : 0.98)
        .play("fx-slash");
      this.tweens.add({
        targets: s,
        rotation: Math.PI * 2 * spin + (trail ? -0.55 * spin : 0),
        scale: trail ? 1.02 : 1.18,
        alpha: 0,
        delay: trail ? 70 : 0,
        duration: trail ? 210 : 260,
        ease: "Cubic.inOut",
        onComplete: () => s.setActive(false).setVisible(false),
      });
    }

    // 확장 충격파 — 외부 에셋 링(Kenney CC0)
    const ring = this.add
      .image(x, y - 4, "shock_ring")
      .setDepth(24)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xa8ecff)
      .setScale(0.28)
      .setAlpha(0.95);
    this.tweens.add({
      targets: ring,
      scale: 1.45,
      alpha: 0,
      delay: 90,
      duration: 310,
      ease: "Cubic.out",
      onComplete: () => ring.destroy(),
    });

    // 스파크 + 카메라 킥
    this.burstEmitter.setParticleTint(0xa8ecff);
    this.burstEmitter.explode(10, x, y);
    this.cameras.main.shake(80, 0.0035);
  }

  /**
   * F5+α: 참격 — 캐릭터가 바라보는 방향에 초승달 검기 애니(외부 에셋 6프레임 스윕)를
   *  배치하고 교차 베기(alt)로 미세 회전을 바꿔 휘두르는 느낌을 강화한다.
   */
  spawnSlash(x: number, y: number, dir: Phaser.Math.Vector2, alt: boolean, scale = 1) {
    const s = this.slashPool[this.slashIdx];
    this.slashIdx = (this.slashIdx + 1) % this.slashPool.length;
    if (!s || !s.scene) return;
    this.tweens.killTweensOf(s);
    s.off("animationcomplete"); // 재사용 시 지연된 완료 콜백 제거
    const base = Math.atan2(dir.y, dir.x);
    s.setPosition(x + dir.x * 30, y - 6 + dir.y * 16)
      .setRotation(base + (alt ? -0.28 : 0.28))
      .setActive(true)
      .setVisible(true)
      .setAlpha(1)
      .setScale(1.35 * scale) // 사용자 지시: 검 이펙트 크게 (원본 64x76 → 실제 표시 ~86x103)
      .play("fx-slash");
    s.once("animationcomplete", () => {
      s.setActive(false).setVisible(false);
    });
  }

  /* ================= 히트스톱 / 타격감 ================= */

  /** F5: 명중 시 65ms 전체 정지 + 흔들림 강화 — '베인' 느낌의 핵심 */
  onMeleeConnect(_hits: number) {
    audio.sfx.hit();
    if (!this.hitStopActive) {
      this.hitStopActive = true;
      this.physics.world.pause();
      this.time.delayedCall(65, () => {
        this.physics.world.resume();
        this.hitStopActive = false;
      });
    }
    this.cameras.main.shake(70, 0.006);
  }

  onEnemyKilled(key: "wolf" | "minion", exp: number) {
    // alive 플래그 기준으로 정리 (죽은 개체 즉시 제외)
    this.enemies = this.enemies.filter((e) => e.alive);
    this.totalKills++;
    this.player.gainExp(exp);
    this.killTotals[key] = (this.killTotals[key] ?? 0) + 1;
    const q = this.currentQuest();
    if (q && q.type === "hunt" && this.stageDef.key === (key === "wolf" ? "forest" : "alfheim")) {
      this.huntCount = Math.min(this.killTotals[key] ?? 0, q.need ?? 0);
      this.tryCompleteHunt(key);
    }
    this.emitQuest();
  }

  /**
   * 토벌 퀘스트 완료 시도.
   * 늑대/하수인을 퀘스트 활성화 이전에 미리 다 잡아도 진행이 막히지 않도록
   * 누적 킬(killTotals) 기준으로 판정한다 (소프트락 방지).
   */
  private tryCompleteHunt(_key: "wolf" | "minion") {
    const q = this.currentQuest();
    if (!q || q.type !== "hunt") return;
    const total = this.killTotals[_key] ?? 0;
    if (total < (q.need ?? 0)) return;
    this.huntCount = Math.min(total, q.need ?? 0);
    audio.sfx.questDone();
    if (this.stageDef.key === "forest") {
      this.showDialogue("wolvesDone");
      this.advanceQuest(); // → 차원문 퀘스트
      this.activatePortal();
    } else {
      this.advanceQuest(); // → 보스 퀘스트
      this.spawnBoss();
    }
    this.save();
  }

  /* ================= 보스 ================= */

  private spawnBoss() {
    const bx = this.stageW * 0.6;
    const by = this.stageH * 0.35;
    audio.sfx.roar();
    this.cameras.main.shake(260, 0.008);
    this.showBanner("심연의 수호자가 나타났다!");
    this.boss = new Boss(this, bx, by);
    this.physics.add.collider(this.boss, this.solidGroup);
    EventBus.emit("boss:show", { name: "심연의 수호자", hp: this.boss.hp, maxHp: this.boss.maxHp });
  }

  onBossDead() {
    audio.sfx.bossDie();
    audio.stopBGM();
    this.cameras.main.shake(400, 0.01);
    this.spawnBurstAt(this.boss!.x, this.boss!.y, 30, 0x9d7aff);
    this.player.gainExp(BOSS_EXP);
    this.totalKills++;
    this.cleared = true;
    this.advanceQuest(); // 보스 퀘스트 완료 — 골드 보상 포함
    this.save();
    this.time.delayedCall(1200, () => {
      this.showDialogue("victory");
      this.time.delayedCall(400, () => {
        this.saveCleared();
      });
      this.time.delayedCall(4600, () => {
        // 엔드 화면이 최종 화면 — 타이틀 복귀는 EndScreen 버튼(reload)이 담당
        EventBus.emit("end", {
          victory: true,
          playTime: Math.floor((this.time.now - this.startTime) / 1000),
          kills: this.totalKills,
          lv: this.player.lv,
        });
      });
    });
  }

  onPlayerDead() {
    audio.stopBGM();
    this.cameras.main.fadeOut(600, 20, 0, 0);
    this.time.delayedCall(700, () => {
      EventBus.emit("end", {
        victory: false,
        playTime: Math.floor((this.time.now - this.startTime) / 1000),
        kills: this.totalKills,
        lv: this.player.lv,
      });
    });
  }

  respawnPlayer() {
    this.cameras.main.fadeIn(400, 20, 0, 0);
    this.player.revive(180, this.stageH / 2);
    audio.playBGM(this.stageDef.key === "forest" ? "field" : "boss");
  }

  /* ================= 입력 ================= */

  private setupInput() {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,K,L,Q,E,F,I"
    ) as Record<string, Phaser.Input.Keyboard.Key>;

    const onMove = (v: { x: number; y: number }) => this.touchMove.set(v.x, v.y);
    const onAtk = () => (this.attackQueued = true);
    const onS1 = () => this.player?.useSkill1();
    const onS2 = () => this.player?.useSkill2();
    const onRespawn = () => this.respawnPlayer();
    const onDialogueDone = () => this.resumeFromDialogue();
    const onBuy = (v: { key: ItemKey }) => {
      if (!this.player || this.dialoguing) return;
      if (this.player.buy(v.key)) {
        audio.sfx.questDone();
        this.save();
      }
      this.emitRpgState();
      this.emitHud();
    };
    const onEquip = (v: { key: ItemKey }) => {
      if (!this.player || this.dialoguing) return;
      this.player.equip(v.key);
      this.emitRpgState();
      this.save();
    };
    const onUse = (v: { kind: "hp" | "mp" }) => {
      this.player?.usePotion(v.kind);
    };

    EventBus.on("input:move", onMove);
    EventBus.on("input:attack", onAtk);
    EventBus.on("input:skill1", onS1);
    EventBus.on("input:skill2", onS2);
    EventBus.on("rpg:buy", onBuy);
    EventBus.on("rpg:equip", onEquip);
    EventBus.on("rpg:use", onUse);
    EventBus.on("respawn", onRespawn);
    EventBus.on("dialogue:done", onDialogueDone);
    this.events.once("shutdown", () => {
      EventBus.off("input:move", onMove);
      EventBus.off("input:attack", onAtk);
      EventBus.off("input:skill1", onS1);
      EventBus.off("input:skill2", onS2);
      EventBus.off("rpg:buy", onBuy);
      EventBus.off("rpg:equip", onEquip);
      EventBus.off("rpg:use", onUse);
      EventBus.off("respawn", onRespawn);
      EventBus.off("dialogue:done", onDialogueDone);
    });
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50);
    if (this.dialoguing || !this.player) return;
    if (this.player.state === "dead") return;

    // 키보드 이동
    const mv = new Phaser.Math.Vector2(0, 0);
    if (this.keys.A.isDown || this.keys.LEFT.isDown) mv.x -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) mv.x += 1;
    if (this.keys.W.isDown || this.keys.UP.isDown) mv.y -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) mv.y += 1;
    if (mv.lengthSq() > 0) mv.normalize();

    // 터치 우선
    const useTouch = this.touchMove.lengthSq() > 0.01;
    const move = useTouch ? this.touchMove : mv;

    // 키보드 공격/스킬
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keys.J))
      this.attackQueued = true;
    if (Phaser.Input.Keyboard.JustDown(this.keys.K)) this.player.useSkill1();
    if (Phaser.Input.Keyboard.JustDown(this.keys.L)) this.player.useSkill2();

    this.player.update(dt, move, this.attackQueued);
    this.attackQueued = false;

    // 물약 퀵슬롯 + 상점 열기
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.player.usePotion("hp");
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.player.usePotion("mp");
    if (Phaser.Input.Keyboard.JustDown(this.keys.F) && this.nearShop) EventBus.emit("ui:panel", { panel: "shop" });
    if (Phaser.Input.Keyboard.JustDown(this.keys.I)) EventBus.emit("ui:panel", { panel: "inv" });

    // 적 AI
    for (const e of this.enemies) {
      if (e.active && e.alive) e.tick(dt, this.player);
    }
    // 보스 AI
    this.boss?.tick(dt, this.player);

    // 드롭 아이템 (자석/픽업)
    for (const d of this.drops) {
      if (d.active) d.tick(dt, this.player.x, this.player.y);
    }

    // 상점 NPC 접근 감지
    if (this.merchant) {
      const near = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.merchant.x, this.merchant.y) < 92;
      if (near !== this.nearShop) {
        this.nearShop = near;
        this.emitRpgState();
      }
    }

    // F2 핵심 2: 화면 가장자리 화살표 — 목표물이 안 보일 때 방향 안내
    this.updateEdgeArrow();
  }

  currentMoveVec() {
    return this.touchMove.lengthSq() > 0.01 ? this.touchMove.clone() : new Phaser.Math.Vector2();
  }

  getAllTargets(): (Enemy | Boss)[] {
    const list: (Enemy | Boss)[] = [];
    for (const e of this.enemies) if (e.active && e.alive) list.push(e);
    if (this.boss && this.boss.active && this.boss.alive) list.push(this.boss);
    return list;
  }

  /* ================= 가독성 (F2) ================= */

  private questTargetPos(): Phaser.Math.Vector2 | null {
    const q = this.currentQuest();
    if (!q) return null;
    switch (q.type) {
      case "collect":
        return this.fragment && this.fragment.active ? new Phaser.Math.Vector2(this.fragment.x, this.fragment.y) : null;
      case "hunt": {
        let best: Enemy | null = null;
        let bd = Infinity;
        for (const e of this.enemies) {
          if (!e.active || !e.alive) continue;
          const d = Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);
          if (d < bd) {
            bd = d;
            best = e;
          }
        }
        return best ? new Phaser.Math.Vector2(best.x, best.y) : null;
      }
      case "reach":
        return this.portal && this.portal.active ? new Phaser.Math.Vector2(this.portal.x, this.portal.y) : null;
      case "boss":
        return this.boss && this.boss.active && this.boss.alive
          ? new Phaser.Math.Vector2(this.boss.x, this.boss.y)
          : null;
      default:
        return null;
    }
  }

  private updateEdgeArrow() {
    const target = this.questTargetPos();
    if (!target) {
      if (this.edgeArrow) {
        this.edgeArrow.destroy();
        this.edgeArrow = null;
      }
      if (this.questMark) {
        this.questMark.destroy();
        this.questMark = null;
      }
      return;
    }

    // 목표물 바로 위 퀘스트 마커(?) — 외부 에셋(Zelda-like CC0 말풍선)
    if (!this.questMark) {
      this.questMark = this.add.image(target.x, target.y - 34, "quest_mark").setDepth(22).setScale(1.3);
    }
    this.questMark.setPosition(target.x, target.y - 34 + Math.sin(this.time.now / 200) * 3);

    // 카메라 뷰 밖이면 가장자리 화살표 표시
    const view = this.cameras.main.worldView;
    const margin = 40;
    const inside =
      target.x > view.x + margin &&
      target.x < view.right - margin &&
      target.y > view.y + margin &&
      target.y < view.bottom - margin;

    if (!inside) {
      if (!this.edgeArrow)
        this.edgeArrow = this.add
          .image(0, 0, "edge_arrow")
          .setDepth(50)
          .setScrollFactor(0)
          .setTint(0xffd76a)
          .setBlendMode(Phaser.BlendModes.ADD);
      const cx = this.cameras.main.width / 2;
      const cy = this.cameras.main.height / 2;
      const angle = Phaser.Math.Angle.Between(cx, cy, target.x - view.x, target.y - view.y);
      // 화면 중심에서 끝까지 레이캐스트하여 클램프
      const halfW = this.cameras.main.width / 2 - 46;
      const halfH = this.cameras.main.height / 2 - 46;
      const t = Math.min(
        Math.abs(halfW / Math.cos(angle)) || Infinity,
        Math.abs(halfH / Math.sin(angle)) || Infinity
      );
      this.edgeArrow.setPosition(cx + Math.cos(angle) * t, cy + Math.sin(angle) * t);
      this.edgeArrow.setRotation(angle);
      this.edgeArrow.setAlpha(0.65 + Math.sin(this.time.now / 150) * 0.3);
    } else if (this.edgeArrow) {
      this.edgeArrow.destroy();
      this.edgeArrow = null;
    }
  }

  /* ================= 퀘스트/세이브 ================= */

  currentQuest() {
    return this.stageDef.quests[this.questIdx] ?? null;
  }

  private advanceQuest() {
    const done = this.stageDef.quests[this.questIdx];
    this.questIdx = Math.min(this.questIdx + 1, this.stageDef.quests.length);
    this.huntCount = 0;
    // 퀘스트 골드 보상 (2D MMORPG 기본 요소)
    if (done?.reward) {
      this.player.addGold(done.reward);
      this.spawnPickupText(this.player.x, this.player.y - 44, `퀘스트 보상 +${done.reward}G`, "#ffd76a");
    }
    this.emitQuest();
    this.emitRpgState();
  }

  emitQuest() {
    const q = this.currentQuest();
    if (!q) {
      EventBus.emit("quest", {
        title: "지역 클리어!",
        desc: "",
        current: 1,
        target: 1,
        distance: null,
      } satisfies QuestState);
      return;
    }
    let current = 0;
    let target = 1;
    if (q.type === "hunt") {
      current = Math.min(this.huntCount, q.need ?? 0);
      target = q.need ?? 0;
    }
    let distance: number | null = null;
    const t = this.questTargetPos();
    if (t) distance = Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y) / 32);
    EventBus.emit("quest", {
      title: q.title,
      desc: q.desc,
      current,
      target,
      distance,
    } satisfies QuestState);
  }

  emitSkills() {
    if (!this.player) return;
    EventBus.emit("skills", {
      mp: Math.round(this.player.mp),
      s1Cd: Math.round(this.player.skill1Cd),
      s1Max: this.player.skill1Max,
      s2Cd: Math.round(this.player.skill2Cd),
      s2Max: this.player.skill2Max,
    });
  }

  emitHud() {
    if (!this.player) return;
    EventBus.emit("hud", {
      hp: Math.max(0, Math.round(this.player.hp)),
      maxHp: this.player.maxHp,
      mp: Math.round(this.player.mp),
      maxMp: this.player.maxMp,
      lv: this.player.lv,
      exp: this.player.exp,
      expNext: this.player.expNext(),
      gold: this.player.gold,
      atkTotal: this.player.atkTotal,
      defTotal: this.player.defTotal,
    });
    this.emitRpgState();
  }

  /** 인벤토리/상점 패널 상태 브로드캐스트 (변경 시만) */
  emitRpgState() {
    if (!this.player) return;
    const st = {
      gold: this.player.gold,
      hpPot: this.player.potions.hp,
      mpPot: this.player.potions.mp,
      owned: [...this.player.owned],
      weapon: this.player.weapon,
      armor: this.player.armor,
      nearShop: this.nearShop,
      shopStock: [...SHOP_STOCK],
    };
    const sig = JSON.stringify(st);
    if (sig === this.lastRpgSig) return;
    this.lastRpgSig = sig;
    EventBus.emit("rpg:state", st);
  }

  private save() {
    writeSave({
      stage: this.stageDef.key,
      lv: this.player.lv,
      exp: this.player.exp,
      maxHp: this.player.maxHp,
      atk: this.player.atk,
      cleared: this.cleared,
      gold: this.player.gold,
      potions: { ...this.player.potions },
      weapon: this.player.weapon,
      armor: this.player.armor,
      owned: [...this.player.owned],
    });
  }

  private saveStage(stage: StageKey) {
    this.save();
    void stage;
  }

  private saveCleared() {
    this.save();
    const d = loadSave();
    if (d) {
      d.cleared = true;
      writeSave(d);
    }
  }

  /* ================= 대사/배너/사운드 브릿지 ================= */

  showDialogue(id: string) {
    const d = DIALOGUE_GET(id);
    if (!d) return;
    this.dialoguing = true;
    this.player.setVelocity(0, 0);
    this.physics.world.pause();
    EventBus.emit("dialogue:show", d);
  }

  resumeFromDialogue() {
    this.dialoguing = false;
    this.physics.world.resume();
    EventBus.emit("dialogue:hide");
  }

  showBanner(text: string) {
    EventBus.emit("banner:show", { text });
  }

  sfxSwing() {
    audio.sfx.swing();
  }
  sfxSpin() {
    audio.sfx.spin();
  }
  sfxDash() {
    audio.sfx.dash();
  }
  sfxHurt() {
    audio.sfx.hurt();
  }
  sfxLevelUp() {
    audio.sfx.levelup();
  }
  sfxRoar() {
    audio.sfx.roar();
  }
  sfxEnemyDie() {
    audio.sfx.enemyDie();
  }
  sfxPotion() {
    audio.sfx.potion();
  }
  sfxEquip() {
    audio.sfx.equip();
  }

  /* ================= 정리 ================= */

  private cleanup() {
    this.questTimer?.remove();
    this.scale.off("resize", this.applyCameraZoom, this);
    EventBus.emit("dialogue:hide");
  }
}

const BOSS_EXP = 220;

function DIALOGUE_GET(id: string) {
  return DIALOGUES[id];
}
