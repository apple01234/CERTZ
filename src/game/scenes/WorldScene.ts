import Phaser from "phaser";
import { STAGES, DIALOGUES, type StageKey, type StageDef } from "../data";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { Boss } from "../entities/Boss";
import { EventBus, type QuestState } from "../../components/game/EventBus";
import { writeSave, type SaveData } from "../config";
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
  // F4: 참격 이펙트 풀
  private slashPool: Phaser.GameObjects.Image[] = [];
  private slashIdx = 0;

  private questTimer: Phaser.Time.TimerEvent | null = null;
  private hitStopActive = false;

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
    this.dialoguing = false;
    this.attackQueued = false;
    this.hitStopActive = false;
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

    /* ---------- 장식 (F1: 정의된 소수만) ---------- */
    this.placeDecor(stageKey);

    /* ---------- 플레이어 ---------- */
    const savedPlayer = save;
    this.player = new Player(this, 180, this.stageH / 2);
    if (savedPlayer) {
      this.player.lv = savedPlayer.lv;
      this.player.atk = savedPlayer.atk;
      this.player.maxHp = savedPlayer.maxHp;
      this.player.hp = this.player.maxHp;
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

    // F2: 거리 실시간 갱신 (300ms 주기 — 프레임 부담 없음)
    this.questTimer = this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        this.emitQuest();
        this.emitSkills();
      },
    });

    this.events.once("shutdown", () => this.cleanup());
  }

  private solidGroup!: Phaser.Physics.Arcade.StaticGroup;

  /* ================= 배치 ================= */

  private placeDecor(stageKey: StageKey) {
    const def = this.stageDef;
    const rng = new Phaser.Math.RandomDataGenerator([stageKey + "-decor"]);
    this.solidGroup = this.physics.add.staticGroup();

    // 나무 & 바위 (충돌 있음)
    for (let i = 0; i < def.treeCount; i++) {
      const x = rng.between(80, this.stageW - 80);
      const y = rng.between(90, this.stageH - 80);
      if (Math.abs(y - this.stageH / 2) < 90) continue; // 길 위엔 안 심음
      const t = this.add.image(x, y, "tree").setDepth(Math.floor(y / 10));
      this.solidGroup.add(t);
      (t.body as Phaser.Physics.Arcade.StaticBody).setSize(24, 16).setOffset(16, 66);
    }
    for (let i = 0; i < def.rockCount; i++) {
      const x = rng.between(80, this.stageW - 80);
      const y = rng.between(90, this.stageH - 80);
      if (Math.abs(y - this.stageH / 2) < 90) continue;
      const r = this.add.image(x, y, "rock").setDepth(Math.floor(y / 10));
      this.solidGroup.add(r);
      (r.body as Phaser.Physics.Arcade.StaticBody).setSize(30, 14).setOffset(3, 10);
    }

    // F1 핵심: 꽃은 def.flowerCount 송이만 (10 이하)
    const flowers = ["flower_r", "flower_y", "flower_w"];
    for (let i = 0; i < def.flowerCount; i++) {
      const x = rng.between(60, this.stageW - 60);
      const y = rng.between(60, this.stageH - 60);
      this.add.image(x, y, rng.pick(flowers)).setDepth(1).setAlpha(0.95);
    }
  }

  private spawnFragment(x: number, y: number) {
    this.fragment = this.physics.add.sprite(x, y, "fragment").setDepth(4);
    (this.fragment.body as Phaser.Physics.Arcade.Body).setCircle(12, -3, -2);

    // F2 핵심 1: 하늘까지 닿는 빛 기둥 비컨 — 멀리서도 확실히 보임
    this.beacon = this.add
      .image(x, y - 240, "beacon")
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
    // 뜨는 모션
    this.tweens.add({ targets: this.fragment, y: y - 8, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.inOut" });

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
    this.save();
  }

  private spawnPortal(x: number, y: number) {
    this.portal = this.physics.add.sprite(x, y, "portal0").setDepth(3).setTint(0x777777);
    (this.portal.body as Phaser.Physics.Arcade.Body).setSize(30, 40).setOffset(13, 20);
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
      .image(this.portal.x, this.portal.y - 230, "beacon")
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

    // 참격 스프라이트 5장 고정 풀
    for (let i = 0; i < 5; i++) {
      const s = this.add
        .image(0, 0, "slash_arc")
        .setDepth(25)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setActive(false)
        .setVisible(false);
      this.slashPool.push(s);
    }
  }

  spawnDamageText(x: number, y: number, val: number) {
    const t = this.dmgPool.find((d) => d.scene && !d.active);
    if (!t) return; // 풀 소진 시 조용히 포기 (프레임 보호)
    t.setText(`${val}`);
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
    const ring = this.add.image(x, y, "slash_ring").setDepth(26).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2);
    this.tweens.add({
      targets: ring,
      scale: 1.3,
      alpha: 0,
      duration: 500,
      onComplete: () => ring.destroy(),
    });
  }

  spawnCrack(x: number, y: number) {
    const c = this.add.image(x, y + 20, "crack").setDepth(1).setAlpha(0.9);
    this.tweens.add({ targets: c, alpha: 0, delay: 3500, duration: 800, onComplete: () => c.destroy() });
  }

  spawnSpinRing(x: number, y: number) {
    return this.add
      .image(x, y, "slash_ring")
      .setDepth(26)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.3);
  }

  /** F5: 참격 초승달 이펙트 — 풀에서 꺼내 170ms 재생 */
  spawnSlash(x: number, y: number, dir: Phaser.Math.Vector2, alt: boolean, scale = 1) {
    const s = this.slashPool[this.slashIdx];
    this.slashIdx = (this.slashIdx + 1) % this.slashPool.length;
    if (!s || !s.scene) return;
    const rot = dir.x > 0 ? 0 : dir.x < 0 ? Math.PI : dir.y > 0 ? Math.PI / 2 : -Math.PI / 2;
    s.setPosition(x + dir.x * 34, y + dir.y * 34 - 6)
      .setRotation(rot)
      .setFlipY(alt)
      .setActive(true)
      .setVisible(true)
      .setAlpha(1)
      .setScale(0.55 * scale);
    this.tweens.add({
      targets: s,
      scale: 1.15 * scale,
      alpha: 0.15,
      duration: 170,
      ease: "Quad.out",
      onComplete: () => s.setActive(false).setVisible(false),
    });
  }

  /* ================= 히트스톱 / 타격감 ================= */

  /** F5: 명중 시 45ms 전체 정지 + 미세 흔들림 — '베인' 느낌의 핵심 */
  onMeleeConnect(_hits: number) {
    audio.sfx.hit();
    if (!this.hitStopActive) {
      this.hitStopActive = true;
      this.physics.world.pause();
      this.time.delayedCall(45, () => {
        this.physics.world.resume();
        this.hitStopActive = false;
      });
    }
    this.cameras.main.shake(50, 0.003);
  }

  onEnemyKilled(key: "wolf" | "minion", exp: number) {
    // alive 플래그 기준으로 정리 (죽은 개체 즉시 제외)
    this.enemies = this.enemies.filter((e) => e.alive);
    this.totalKills++;
    this.player.gainExp(exp);
    const q = this.currentQuest();
    if (q && q.type === "hunt" && this.stageDef.key === (key === "wolf" ? "forest" : "alfheim")) {
      this.huntCount++;
      if (this.huntCount >= (q.need ?? 0)) {
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
    }
    this.emitQuest();
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
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,K,L"
    ) as Record<string, Phaser.Input.Keyboard.Key>;

    const onMove = (v: { x: number; y: number }) => this.touchMove.set(v.x, v.y);
    const onAtk = () => (this.attackQueued = true);
    const onS1 = () => this.player?.useSkill1();
    const onS2 = () => this.player?.useSkill2();
    const onRespawn = () => this.respawnPlayer();
    const onDialogueDone = () => this.resumeFromDialogue();

    EventBus.on("input:move", onMove);
    EventBus.on("input:attack", onAtk);
    EventBus.on("input:skill1", onS1);
    EventBus.on("input:skill2", onS2);
    EventBus.on("respawn", onRespawn);
    EventBus.on("dialogue:done", onDialogueDone);
    this.events.once("shutdown", () => {
      EventBus.off("input:move", onMove);
      EventBus.off("input:attack", onAtk);
      EventBus.off("input:skill1", onS1);
      EventBus.off("input:skill2", onS2);
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

    // 적 AI
    for (const e of this.enemies) {
      if (e.active && e.alive) e.tick(dt, this.player);
    }
    // 보스 AI
    this.boss?.tick(dt, this.player);

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

    // 목표물 바로 위 퀘스트 마커(!)
    if (!this.questMark) {
      this.questMark = this.add.image(target.x, target.y - 34, "quest_mark").setDepth(22);
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
    this.questIdx = Math.min(this.questIdx + 1, this.stageDef.quests.length);
    this.huntCount = 0;
    this.emitQuest();
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
    });
  }

  private save() {
    writeSave({
      stage: this.stageDef.key,
      lv: this.player.lv,
      exp: this.player.exp,
      maxHp: this.player.maxHp,
      atk: this.player.atk,
      cleared: this.cleared,
    });
  }

  private saveStage(stage: StageKey) {
    this.save();
    void stage;
  }

  private saveCleared() {
    writeSave({
      stage: this.stageDef.key,
      lv: this.player.lv,
      exp: this.player.exp,
      maxHp: this.player.maxHp,
      atk: this.player.atk,
      cleared: true,
    });
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

  /* ================= 정리 ================= */

  private cleanup() {
    this.questTimer?.remove();
    EventBus.emit("dialogue:hide");
  }
}

const BOSS_EXP = 220;

function DIALOGUE_GET(id: string) {
  return DIALOGUES[id];
}
