import Phaser from "phaser";
import { STAGES, DIALOGUES, ITEMS, SHOP_STOCK, NEXT_STAGE, BOSS_DEFS, ENEMIES, type StageKey, type StageDef, type ItemKey, type EnemyDef, type EnemyKey, type BossDef, type QuestDef } from "../data";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { Boss } from "../entities/Boss";
import { Drop, type DropKind } from "../entities/Drop";
import { EventBus, type QuestState, type InteractState } from "../../components/game/EventBus";
import { writeSave, loadSave, type SaveData, setPlayerName, getPlayerName } from "../config";
import { classDef, JOB_LEVEL, type ClassKey } from "../classes";
import * as net from "../net";
import { viewZoom } from "../PhaserGame";
import { ImpactFX, type ImpactKind } from "../fx/ImpactFX";
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
  /** 히트스톱/카메라 셰이크 등급 프로파일 (기본공격 절제 / 크리·스킬 강조) */
  impactFX!: ImpactFX;
  // 스테이지별 누적 킬 (퀘스트 순서와 무관하게 토벌 진행 유지 — 소프트락 방지)
  private killTotals: Record<string, number> = {};
  // 리스폰: 원래 스폰 지점 기록 (파밍 루프 — 사냥→골드→상점 순환이 적 소진으로 끊기지 않게)
  private spawnRecords: { key: EnemyKey; x: number; y: number }[] = [];
  // 퀘스트 진행 세이브 — 스테이지별 questIdx (이어하기 무결성: 파편 ATK 중복/보상 중복/보스 소프트락 방지)
  private savedQuestIdx: Record<string, number> = {};
  // 마을 우물 샘물 회복 (비전투 회복 수단)
  private wellPos: Phaser.Math.Vector2 | null = null;
  private wellCd = 0;
  // 보스 격파 후 대사가 끝나면 열어줄 차원문 (스토리 진행 — 최종 스테이지 제외)
  private pendingPortal = false;
  // 현재 스테이지 보스 정의 (onBossDead에서 사용)
  private bossDef: BossDef | null = null;
  // 반복 토벌 의뢰 — 사이클별 목표 수 (완료할수록 +2)
  private repeatNeed = 0;

  /* ----- E키 상호작용 (NPC 대화/상점 — 접근 자동 트리거 제거) ----- */
  private interactables: { x: number; y: number; kind: "talk" | "shop"; dlg?: string; npcId?: string; label: string }[] = [];
  private nearInteract: (typeof this.interactables)[number] | null = null;
  private activeNpcId: string | null = null;
  private talkedNpcs = new Set<string>();

  /* ----- 인트로 플레이 시퀀스 (책장 넘기기 대신 직접 이동하며 진행) ----- */
  private introStep = -1; // -1=해당없음/완료, 0=이동 학습, 1=우물 이동, 2=이름 입력, 3=완료
  private introMoveDist = 0;
  private introMarker: Phaser.GameObjects.Image | null = null;
  private introGuide: Phaser.GameObjects.Image | null = null;
  private introGuideSpark: Phaser.GameObjects.Sprite | null = null;
  private playerNameTag: Phaser.GameObjects.Text | null = null;
  private queuedDialogue: string | null = null;

  /* ----- 2D MMORPG 기본 요소 ----- */
  private drops: Drop[] = [];
  private merchant: Phaser.GameObjects.Image | null = null;
  private merchantLabel: Phaser.GameObjects.Text | null = null;
  private nearShop = false;
  private minimap: Phaser.GameObjects.Graphics | null = null;
  private lastRpgSig = "";

  /* ----- 멀티플레이 (v1.7 — socket.io 동일 서버 접속자 동기화) ----- */
  private remotes = new Map<
    string,
    {
      sp: Phaser.GameObjects.Sprite;
      tag: Phaser.GameObjects.Text;
      tx: number;
      ty: number;
      flip: boolean;
      moving: boolean;
      cls: string | null;
      lv: number;
      name: string;
    }
  >();
  private netOffs: (() => void)[] = [];
  private chatFocused = false;
  private netAcc = 0;

  constructor() {
    super("world");
  }

  init(data: { stage?: StageKey; save?: SaveData; fresh?: boolean }) {
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
    this.killTotals = {};
    this.spawnRecords = [];
    this.savedQuestIdx = {};
    this.wellPos = null;
    this.wellCd = 0;
    this.pendingPortal = false;
    this.bossDef = null;
    this.drops = [];
    this.merchant = null;
    this.merchantLabel = null;
    this.nearShop = false;
    this.minimap = null;
    this.lastRpgSig = "";
    this.remotes.clear();
    this.netOffs = [];
    this.chatFocused = false;
    this.netAcc = 0;
    this.repeatNeed = 0;
    this.interactables = [];
    this.nearInteract = null;
    this.activeNpcId = null;
    this.talkedNpcs = new Set();
    this.introStep = -1;
    this.introMoveDist = 0;
    this.introMarker = null;
    this.introGuide = null;
    this.introGuideSpark = null;
    this.playerNameTag = null;
    this.queuedDialogue = null;
    // 런 통계(처치/플레이타임) — 씬 재시작(스테이지 전환)과 무관하게 유지
    // fresh=true는 타이틀에서 새 시작/이어하기일 때만 (사망화면 정확한 통계)
    if (data.fresh) {
      this.registry.set("runKills", 0);
      this.registry.set("runStart", Date.now());
    }
    this.totalKills = (this.registry.get("runKills") as number | undefined) ?? 0;
    const runStart = this.registry.get("runStart") as number | undefined;
    this.startTime = runStart ?? this.time.now;
    this.registry.set("initData", data);
  }

  create() {
    this.impactFX = new ImpactFX(this);
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
    const groundTex =
      stageKey === "alfheim" ? "tile_dark"
      : stageKey === "cave" ? "tile_cave"
      : stageKey === "abyss" ? "tile_abyss"
      : stageKey === "niflheim" ? "tile_snow"
      : "tile_grass";
    const pathTex =
      stageKey === "niflheim" ? "tile_ice"
      : stageKey === "cave" || stageKey === "abyss" ? "tile_path_dark"
      : "tile_path";
    this.add.tileSprite(0, 0, this.stageW, this.stageH, groundTex).setOrigin(0).setDepth(0);
    // 중앙 가로 길
    this.add
      .tileSprite(0, this.stageH / 2 - 52, this.stageW, 104, pathTex)
      .setOrigin(0)
      .setDepth(0)
      .setAlpha(0.9);
    if (stageKey === "forest") {
      this.add
        .tileSprite(this.stageW * 0.55 - 52, 0, 104, this.stageH, pathTex)
        .setOrigin(0)
        .setDepth(0)
        .setAlpha(0.85);
    }
    // 지형 전환 프린지 + 지면 변형 — 자로 잰 직선 경계/균일 반복 패턴을 자연스럽게 (타일맵 부자연 개선)
    this.buildGroundBlend(stageKey, groundTex, pathTex);

    this.physics.world.setBounds(0, 0, this.stageW, this.stageH);
    this.cameras.main.setBounds(0, 0, this.stageW, this.stageH);
    this.cameras.main.setBackgroundColor(STAGE_BG[stageKey]);

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
      // 강화/장신구 복원 (구 세이브는 loadSave()가 기본값 채움)
      this.player.upgrades.weapon = savedPlayer.upWea ?? 0;
      this.player.upgrades.armor = savedPlayer.upArm ?? 0;
      this.player.accessory = (savedPlayer.accessory ?? null) as ItemKey | null;
      // 퀘스트 진행 복원 (이어하기 — 파편/보상 중복 수령 방지)
      this.savedQuestIdx = { ...(savedPlayer.questIdx ?? {}) };
      this.questIdx = Phaser.Math.Clamp(this.savedQuestIdx[stageKey] ?? 0, 0, this.stageDef.quests.length);
      // 플레이어 이름 복원 (인트로에서 지정)
      if (savedPlayer.playerName) setPlayerName(savedPlayer.playerName);
      // 전직 클래스 복원 (v1.7 — 구 세이브 null 호환)
      this.player.applySavedClass(savedPlayer.cls);
    }
    this.repeatNeed = this.stageDef.repeat?.need ?? 0;
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
        this.spawnRecords.push({ key: group.key, x: ex, y: ey });
        this.physics.add.collider(e, this.solidGroup);
      }
    }

    /* ---------- 퀘스트 오브젝트 ---------- */
    if (stageKey === "village") {
      this.buildVillage();
      // 마을 차원문은 항상 열려 있음 (뿌리숲으로 출발)
      this.spawnPortal(this.stageW - 110, this.stageH * 0.52);
      this.activatePortal(true);
    } else {
      if (!this.stageDef.boss) this.spawnPortal(this.stageW - 130, this.stageH * 0.52);
      // 수확(collect) 퀘스트 진행 중 — 파편 스폰 (이어하기 무결: ATK 중복 수령 방지)
      if (this.currentQuest()?.type === "collect") this.spawnFragmentForQuest();
    }

    /* ---------- 퀘스트 진행 복구 (이어하기 — 진행 상태 정합, 오브젝트 생성 후) ---------- */
    const bossQuestIdx = this.stageDef.quests.findIndex((q) => q.type === "boss");
    if (this.stageDef.boss) {
      if (this.currentQuest()?.type === "boss") {
        // 보스전 진행 중 세이브 — 입장 직후 보스 등장 (복구 경로는 등장 대사 생략)
        this.time.delayedCall(900, () => {
          if (!this.boss) this.spawnBoss(false);
        });
      } else if (bossQuestIdx >= 0 && this.questIdx > bossQuestIdx && NEXT_STAGE[stageKey]) {
        // 보스 격파 후 세이브 — 차원문 개방 상태 복구 (구 v1.0 클리어 세이브도 이 경로로 계속)
        this.spawnPortal(this.stageW - 130, this.stageH * 0.52);
        this.activatePortal(true);
      }
    } else if (stageKey !== "village" && this.currentQuest()?.type === "reach") {
      // 수확 완료 후 세이브 — 차원문을 열어둔 채 시작 (소프트락 방지)
      this.activatePortal(true);
    }

    /* ---------- 이펙트 풀 ---------- */
    this.buildFxPools();

    /* ---------- 미니맵 (2D MMORPG 기본 요소) ---------- */
    this.minimap = this.add.graphics().setDepth(95).setScrollFactor(0).setAlpha(0.85);
    this.redrawMinimap();

    /* ---------- 입력 ---------- */
    this.setupInput();

    /* ---------- 사운드/BGM ---------- */
    audio.playBGM(stageKey === "alfheim" || stageKey === "abyss" ? "boss" : "field");

    /* ---------- 오프닝 대사 (인트로 시퀀스 중이면 인트로가 인계) ---------- */
    if (stageKey === "village" && !savedPlayer?.playerName) {
      // 신규 플레이어 — 책장 넘기기 대신 플레이형 인트로 (이동 → 우물 → 이름 짓기)
      this.startIntroSequence();
    } else {
      this.time.delayedCall(400, () => {
        this.showDialogue(STAGE_INTRO[stageKey]);
      });
    }

    EventBus.emit("ui:playing");
    this.emitHud();
    this.emitQuest();
    this.emitRpgState();

    /* ---------- 멀티플레이 (같은 서버 접속자 동기화 — v1.7) ---------- */
    this.initNet();

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

  /**
   * 지형 전환 프린지 + 지면 변형 타일 배치 (타일맵 부자연 개선).
   *  - 경계 프린지(edge_*): 길 텍스처가 지면 쪽으로 불규칙하게 뻗어나감
   *  - 침식(bite_*): 길 안쪽으로 지면이 파여드는 블롭
   *  - 변형(gvar/pvar): 같은 타일 반복의 단조로움을 명도 변형으로 분산
   * 배치는 스테이지 시드 결정적 RNG — 매 실행 동일한 지형.
   */
  private buildGroundBlend(stageKey: StageKey, groundTex: string, pathTex: string) {
    const set = GROUND_SET[stageKey] ?? "gp";
    const T = 64;
    const rng = new Phaser.Math.RandomDataGenerator([stageKey + "-blend"]);
    const y0 = this.stageH / 2 - 52; // 가로 길 상단
    const y1 = this.stageH / 2 + 52; // 가로 길 하단

    // 1) 지면 명도 변형 스캐터 — 길 영역 제외 (균일 반복 패턴 깨기)
    for (let gy = 0; gy < this.stageH; gy += T) {
      for (let gx = 0; gx < this.stageW; gx += T) {
        if (gy + T > y0 && gy < y1) continue; // 길 영역
        const r = rng.frac();
        if (r < 0.028) this.add.image(gx + T / 2, gy + T / 2, `tx_${set}_gvar1`).setDepth(0);
        else if (r < 0.056) this.add.image(gx + T / 2, gy + T / 2, `tx_${set}_gvar2`).setDepth(0);
      }
    }

    // 2) 가로 길 — 안 변형 + 경계 프린지 + 침식
    for (let gx = 0; gx < this.stageW; gx += T) {
      if (rng.frac() < 0.14) this.add.image(gx + T / 2, y0 + 32, `tx_${set}_pvar`).setDepth(0);
      if (rng.frac() < 0.14) this.add.image(gx + T / 2, y1 - 32, `tx_${set}_pvar`).setDepth(0);
      // 프린지 — 길(아래)에서 지면(위)으로/지면(아래)에서 길로 뻗은 블롭 (flipX로 2배 변형)
      if (rng.frac() < 0.45)
        this.add.image(gx + T / 2, y0 - 40, `tx_${set}_edge_dn`).setDepth(0).setFlipX(rng.frac() < 0.5);
      if (rng.frac() < 0.45)
        this.add.image(gx + T / 2, y1 + 40, `tx_${set}_edge_up`).setDepth(0).setFlipX(rng.frac() < 0.5);
      // 침식 — 지면이 길 안쪽으로 파여드는 블롭
      if (rng.frac() < 0.16) this.add.image(gx + T / 2, y0 + 20, `tx_${set}_bite_dn`).setDepth(0);
      if (rng.frac() < 0.16) this.add.image(gx + T / 2, y1 - 20, `tx_${set}_bite_up`).setDepth(0);
    }

    // 3) 숲 세로 길 — 좌우 경계 프린지 (flipY로 2배 변형)
    if (stageKey === "forest") {
      const vcx = this.stageW * 0.55;
      for (let gy = 0; gy < this.stageH; gy += T) {
        if (rng.frac() < 0.45)
          this.add.image(vcx - 52 - 40, gy + T / 2, `tx_${set}_edge_rt`).setDepth(0).setFlipY(rng.frac() < 0.5);
        if (rng.frac() < 0.45)
          this.add.image(vcx + 52 + 40, gy + T / 2, `tx_${set}_edge_lt`).setDepth(0).setFlipY(rng.frac() < 0.5);
      }
    }
  }

  private placeDecor(stageKey: StageKey) {
    const def = this.stageDef;
    const rng = new Phaser.Math.RandomDataGenerator([stageKey + "-decor"]);
    this.solidGroup = this.physics.add.staticGroup();

    // 마을 건물/우물/주민 영역 보호 — 장식이 집 위에 심기지 않게
    const vx = def.width / 2;
    const vy = def.height / 2;
    const reserved: [number, number][] =
      stageKey === "village"
        ? [
            [vx - 400, vy - 170],
            [vx + 90, vy - 200],
            [vx - 190, vy + 215],
            [vx, vy],
            [vx + 210, vy + 120],
            [vx - 90, vy - 90],
            [def.width - 110, vy], // 차원문
          ]
        : [];
    const blocked = (x: number, y: number) => reserved.some(([rx, ry]) => Phaser.Math.Distance.Between(x, y, rx, ry) < 170);

    // 나무 & 소나무 & 바위 (충돌 있음) — 실제 에셋, 스테이지 테마 변형
    const treeSet: string[] =
      stageKey === "niflheim" ? ["pine_snow"]
      : stageKey === "abyss" ? ["pine_dark"]
      : ["tree", "tree", "pine"];
    const rockTex = stageKey === "niflheim" ? "rock_snow" : stageKey === "abyss" ? "rock_dark" : "rock";
    for (let i = 0; i < def.treeCount; i++) {
      const x = rng.between(80, this.stageW - 80);
      const y = rng.between(90, this.stageH - 80);
      if (Math.abs(y - this.stageH / 2) < 90) continue; // 길 위엔 안 심음
      if (blocked(x, y)) continue;
      const tex = rng.pick(treeSet);
      const t = this.add.image(x, y, tex).setDepth(Math.floor(y / 10));
      this.solidGroup.add(t);
      // 64x64 캔버스 하단 줄기 부근만 충돌
      (t.body as Phaser.Physics.Arcade.StaticBody).setSize(20, 14).setOffset(22, 46);
    }
    for (let i = 0; i < def.rockCount; i++) {
      const x = rng.between(80, this.stageW - 80);
      const y = rng.between(90, this.stageH - 80);
      if (Math.abs(y - this.stageH / 2) < 90) continue;
      if (blocked(x, y)) continue;
      const r = this.add.image(x, y, rockTex).setDepth(Math.floor(y / 10));
      this.solidGroup.add(r);
      (r.body as Phaser.Physics.Arcade.StaticBody).setSize(44, 20).setOffset(10, 40);
    }

    // F1 핵심: 꽃은 def.flowerCount 송이만 (10 이하)
    const flowers = ["flower_r", "flower_y", "flower_w"];
    for (let i = 0; i < def.flowerCount; i++) {
      const x = rng.between(60, this.stageW - 60);
      const y = rng.between(60, this.stageH - 60);
      if (blocked(x, y)) continue;
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

    // 스바르트알프헤임 동굴 — 심연에 물든 수정 광맥 (세계수 파편 텍스처 보라 변형 + 글로우)
    if (stageKey === "cave") {
      const rng2 = new Phaser.Math.RandomDataGenerator(["cave-crystal"]);
      for (let i = 0; i < 7; i++) {
        const cx2 = rng2.between(140, this.stageW - 140);
        const cy2 = rng2.between(90, this.stageH - 90);
        if (Math.abs(cy2 - this.stageH / 2) < 80) continue;
        const c = this.add.image(cx2, cy2, "fragment").setDepth(1).setTint(0xc77aff).setScale(rng2.realInRange(0.7, 1.2));
        const g = this.add
          .image(cx2, cy2, "glow")
          .setDepth(0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0x9d5aff)
          .setScale(1.2)
          .setAlpha(0.18);
        this.tweens.add({ targets: g, alpha: 0.38, scale: 1.5, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        void c;
      }
    }

    // 심연의 왕좌 — 보라 화염 횃불 (심연의 표식)
    if (stageKey === "abyss") {
      for (let i = 0; i < 5; i++) {
        const tx = 220 + (i * (this.stageW - 440)) / 4;
        const ty = i % 2 === 0 ? this.stageH / 2 - 130 : this.stageH / 2 + 130;
        this.add.image(tx, ty, "torch").setDepth(2).setTint(0xb08aff);
        const g = this.add
          .image(tx, ty, "glow")
          .setDepth(1)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0x8a5aff)
          .setScale(1.2)
          .setAlpha(0.24);
        this.tweens.add({ targets: g, alpha: 0.45, scale: 1.4, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
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
    this.showDialogue(this.stageDef.key === "forest" ? "fragment" : "fragment2");
    this.advanceQuest();
    // 다음 목표 범용 배치 (파편 연속 수확/토벌/개방 등) — 대사 종료 후 자연스럽게 진행
    this.afterAdvance();
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

  private activatePortal(silent = false) {
    if (!this.portal) return;
    this.portalActive = true;
    this.portal.clearTint();
    this.portal.play("portal-spin");
    if (!silent) audio.sfx.portal();
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
    if (!silent) this.showBanner("차원문이 열렸다!");
  }

  private enterPortal() {
    this.portalActive = false;
    audio.sfx.portal();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.player.state = "idle";
    // 마을 → 뿌리숲 → 알프헤임 → 동굴 → 니플헤임 → 심연의 왕좌 순차 진행 (스토리 체인)
    const next: StageKey | null = NEXT_STAGE[this.stageDef.key];
    if (!next) return;
    this.time.delayedCall(520, () => {
      // ⚠️ 다음 스테이지에 현재 스탯/소지품을 그대로 넘긴다
      //   (restart에 save를 안 넘기면 기본값 플레이어로 시작 — 골드/레벨/장비 소실 버그)
      const carry = this.buildSave(next);
      writeSave(carry);
      this.scene.restart({ stage: next, save: carry });
    });
  }

  /* ================= 시작 마을 (인간들의 마을) ================= */

  private buildVillage() {
    const cx = this.stageW / 2;
    const cy = this.stageH / 2;

    // 광장 우물 (중앙 랜드마크, 충돌 있음) — 접근 시 샘물 회복
    const well = this.add.image(cx, cy, "well").setDepth(Math.floor(cy / 10));
    this.solidGroup.add(well);
    (well.body as Phaser.Physics.Arcade.StaticBody).setSize(56, 36).setOffset(20, 52);
    this.wellPos = new Phaser.Math.Vector2(cx, cy);
    this.add
      .text(cx, cy - 44, "샘물 우물", {
        fontFamily: "sans-serif",
        fontSize: "11px",
        color: "#bfe8ff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(Math.floor(cy / 10));

    // 집 3채 (실제 Zelda-like 타일셋 건물, 충돌은 벽 하단만)
    const houses: { x: number; y: number; tex: string; flip?: boolean }[] = [
      { x: cx - 400, y: cy - 170, tex: "house_a" },
      { x: cx + 90, y: cy - 200, tex: "house_b" },
      { x: cx - 190, y: cy + 215, tex: "house_a", flip: true },
    ];
    for (const h of houses) {
      const img = this.add.image(h.x, h.y, h.tex).setDepth(Math.floor(h.y / 10));
      if (h.flip) img.setFlipX(true);
      this.solidGroup.add(img);
      const bw = h.tex === "house_a" ? 110 : 100;
      (img.body as Phaser.Physics.Arcade.StaticBody)
        .setSize(bw, 56)
        .setOffset((img.width - bw) / 2, img.height - 66);
    }

    // 마을 주민 2인 — E키 상호작용 (접근 자동 트리거 제거, 바운스 애니 + 이름표 유지)
    const villagers: { x: number; y: number; tex: string; name: string; dlg: string }[] = [
      { x: cx + 210, y: cy + 120, tex: "npc_villager1", name: "주민", dlg: "villager1" },
      { x: cx - 90, y: cy - 90, tex: "npc_villager2", name: "마을 아이", dlg: "villager2" },
    ];
    for (const v of villagers) {
      const img = this.add.image(v.x, v.y, v.tex).setDepth(Math.floor(v.y / 10)).setScale(1.6);
      this.tweens.add({ targets: img, y: v.y - 3, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.add
        .text(v.x, v.y - 34, v.name, {
          fontFamily: "sans-serif",
          fontSize: "11px",
          color: "#ffe9b0",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(Math.floor(v.y / 10));
      this.interactables.push({ x: v.x, y: v.y, kind: "talk", dlg: v.dlg, npcId: v.dlg, label: `${v.name}와 대화` });
    }
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

  spawnDamageText(x: number, y: number, val: number, crit = false) {
    const t = this.dmgPool.find((d) => d.scene && !d.active);
    if (!t) return; // 풀 소진 시 조용히 포기 (프레임 보호)
    // 크리티컬: 금색 큰 글씨 + 느낌표 (타격감 강조)
    t.setText(crit ? `${val}!` : `${val}`).setColor(crit ? "#ffd76a" : "#ffffff");
    t.setPosition(x, y)
      .setActive(true)
      .setVisible(true)
      .setAlpha(1)
      .setScale(crit ? 1.45 : 1);
    this.tweens.add({
      targets: t,
      y: y - (crit ? 46 : 34),
      alpha: 0,
      duration: crit ? 700 : 550,
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
    // 상점도 E키 상호작용 대상 (F키 병행)
    this.interactables.push({ x: mx, y: my, kind: "shop", label: "라고스 상점" });
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

  /** F5: 명중 시 히트스톱 + 등급별 카메라 셰이크 — '베인' 느낌의 핵심.
   *  기본공격(basic)은 히트스톱 65ms 유지로 타격감을 살리고 흔들림은 최소로 절제,
   *  크리티컬(crit)/스킬(skill)만 더 강한 흔들림으로 대비를 만든다. (피드백: 기본공격 흔들림 과다) */
  onMeleeConnect(_hits: number, profile: ImpactKind = "basic") {
    audio.sfx.hit();
    this.impactFX.trigger(profile);
  }

  onEnemyKilled(key: EnemyKey, exp: number, spawnX: number, spawnY: number) {
    // alive 플래그 기준으로 정리 (죽은 개체 즉시 제외)
    this.enemies = this.enemies.filter((e) => e.alive);
    this.totalKills++;
    this.registry.set("runKills", this.totalKills);
    this.player.gainExp(exp);
    this.killTotals[key] = (this.killTotals[key] ?? 0) + 1;
    // 리스폰 예약 — 9~13초 후 원래 스폰 지점에서 재생성 (파밍 루프 유지)
    this.time.delayedCall(Phaser.Math.Between(9000, 13000), () =>
      this.respawnEnemy(key, spawnX, spawnY, 0)
    );
    const q = this.currentQuest();
    if (q && q.type === "hunt") {
      if (this.repeatActive()) {
        // 반복 토벌 의뢰 — 메인 체인 종료 후 무한 파밍 (사이클별 카운트)
        if (q.targetKey === key) {
          this.huntCount++;
          if (this.huntCount >= this.repeatNeed) this.completeRepeat();
          else this.emitQuest();
        }
      } else if (this.stageDef.enemies.some((g) => g.key === key)) {
        this.huntCount = Math.min(this.killTotals[key] ?? 0, q.need ?? 0);
        this.tryCompleteHunt(key);
      }
    }
    this.emitQuest();
  }

  /** 메인 체인 완료 후 반복 의뢰 활성 여부 */
  private repeatActive(): boolean {
    return this.questIdx >= this.stageDef.quests.length && !!this.stageDef.repeat;
  }

  /** 반복 토벌 완료 — 보상 지급 후 목표 +2 (무한 확장) */
  private completeRepeat() {
    const r = this.stageDef.repeat!;
    audio.sfx.questDone();
    this.player.addGold(r.gold);
    this.player.gainExp(r.exp);
    this.spawnPickupText(this.player.x, this.player.y - 44, `토벌 완료 +${r.gold}G`, "#ffd76a");
    this.huntCount = 0;
    this.repeatNeed += 2;
    this.save();
    this.emitQuest();
    this.emitRpgState();
  }

  /**
   * 몬스터 리스폰 — 원래 스폰 지점에서 페이드 인.
   * 플레이어가 스폰 지점 근처(140px)에 서 있으면 얼굴에 팝업하는 걸 막기 위해 2.5초씩 재시도.
   */
  private respawnEnemy(key: EnemyKey, x: number, y: number, tries: number) {
    if (!this.scene.isActive() || this.player.state === "dead") {
      return; // 씬 전환/사망 중은 스킵 (다음 킬에서 다시 예약됨)
    }
    const nearPlayer = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 140;
    if (nearPlayer && tries < 24) {
      this.time.delayedCall(2500, () => this.respawnEnemy(key, x, y, tries + 1));
      return;
    }
    const e = new Enemy(this, x, y, key);
    e.setAlpha(0);
    this.tweens.add({ targets: e, alpha: 1, duration: 420 });
    this.spawnBurstAt(x, y, 6, e.burstTint);
    this.enemies.push(e);
    this.physics.add.collider(e, this.solidGroup);
  }

  /** 현재 토벌 퀘스트의 대상 몬스터 키 (없으면 스테이지 첫 적 그룹) */
  private currentHuntKey(): EnemyKey | null {
    const q = this.currentQuest();
    if (q?.targetKey) return q.targetKey;
    return this.stageDef.enemies[0]?.key ?? null;
  }

  /**
   * 토벌 퀘스트 완료 시도.
   * 몬스터를 퀘스트 활성화 이전에 미리 다 잡아도 진행이 막히지 않도록
   * 누적 킬(killTotals) 기준으로 판정한다 (소프트락 방지).
   */
  private tryCompleteHunt(_key: EnemyKey) {
    const q = this.currentQuest();
    if (!q || q.type !== "hunt") return;
    const total = this.killTotals[_key] ?? 0;
    if (total < (q.need ?? 0)) return;
    this.huntCount = Math.min(total, q.need ?? 0);
    audio.sfx.questDone();
    this.advanceQuest();
    this.afterAdvance();
    this.save();
  }

  /**
   * 퀘스트 진행기 — 체인의 다음 목표를 범용으로 배치한다.
   *  reach → 안내 대사 후 차원문 개방 / collect → 파편 스폰 / boss → 보스 등장
   *  hunt → 이미 조건 충족이면 즉시 연쇄 완료 (미리 잡은 경우 소프트락 방지)
   */
  private afterAdvance() {
    const q = this.currentQuest();
    this.emitQuest();
    if (!q) return;
    if (q.type === "reach") {
      if (!this.portal) this.spawnPortal(this.stageW - 130, this.stageH * 0.52);
      if (!this.portalActive) {
        if (q.dialogue) {
          // 대사 중 포탈 위 즉시 전환 방지 — 대사 종료 후 개방 (resumeFromDialogue)
          this.pendingPortal = true;
          if (this.dialoguing) {
            // 이미 대사 진행 중 (파편 수집 직후 등) — 예약 후 순차 재생
            this.queuedDialogue = q.dialogue;
          } else {
            this.showDialogue(q.dialogue);
          }
        } else {
          this.activatePortal();
        }
      } else if (q.dialogue && !this.dialoguing) {
        this.showDialogue(q.dialogue);
      }
    } else if (q.type === "collect") {
      if (!this.fragment) this.spawnFragmentForQuest();
    } else if (q.type === "boss") {
      if (!this.boss) this.spawnBoss();
    } else if (q.type === "hunt") {
      const k = q.targetKey;
      if (k && (this.killTotals[k] ?? 0) >= (q.need ?? 0)) this.tryCompleteHunt(k);
    }
  }

  /* ================= 보스 ================= */

  private spawnBoss(intro = true) {
    const def = BOSS_DEFS[this.stageDef.bossKey ?? "guardian"];
    this.bossDef = def;
    const bx = this.stageW * 0.6;
    const by = this.stageH * 0.35;
    audio.sfx.roar();
    this.cameras.main.shake(260, 0.008);
    this.showBanner(`${def.name} 출현!`);
    this.boss = new Boss(this, bx, by, def);
    this.physics.add.collider(this.boss, this.solidGroup);
    EventBus.emit("boss:show", { name: def.name, hp: this.boss.hp, maxHp: this.boss.maxHp });
    // 등장 대사 — 이어하기 복구 경로는 생략 (오프닝 대사와 충돌 방지)
    if (intro) this.showDialogue(def.introDialogue);
  }

  onBossDead() {
    const def = this.bossDef;
    audio.sfx.bossDie();
    audio.stopBGM();
    this.cameras.main.shake(400, 0.01);
    this.spawnBurstAt(this.boss!.x, this.boss!.y, 30, def?.orbTint ?? 0x9d7aff);
    this.player.gainExp(def?.exp ?? 220);
    this.totalKills++;
    this.registry.set("runKills", this.totalKills);
    // 최종 보스(심연의 군주)만 클리어 — 이전 보스는 차원문으로 다음 지역 진행
    const final = NEXT_STAGE[this.stageDef.key] === null;
    this.cleared = final;
    this.advanceQuest(); // 보스 퀘스트 완료 — 골드/경험치 보상 포함
    this.save();
    if (final) {
      this.time.delayedCall(1200, () => {
        this.showDialogue("victory");
        this.time.delayedCall(400, () => {
          this.saveCleared();
        });
        this.time.delayedCall(4600, () => {
          // 엔드 화면이 최종 화면 — 타이틀 복귀는 EndScreen 버튼(reload)이 담당
          EventBus.emit("end", {
            victory: true,
            playTime: Math.floor((Date.now() - this.startTime) / 1000),
            kills: this.totalKills,
            lv: this.player.lv,
          });
        });
      });
    } else {
      // 다음 지역 안내 대사 + 차원문 개방은 afterAdvance가 일반 처리 (1200ms 유예)
      this.time.delayedCall(1200, () => this.afterAdvance());
    }
  }

  onPlayerDead() {
    audio.stopBGM();
    this.cameras.main.fadeOut(600, 20, 0, 0);
    this.time.delayedCall(700, () => {
      EventBus.emit("end", {
        victory: false,
        playTime: Math.floor((Date.now() - this.startTime) / 1000),
        kills: this.totalKills,
        lv: this.player.lv,
      });
    });
  }

  respawnPlayer() {
    this.cameras.main.fadeIn(400, 20, 0, 0);
    // 부활 캠핑 방지 — 몬스터를 원래 스폰 지점으로 되돌리고 어그로 해제
    for (const e of this.enemies) {
      if (e.active && e.alive) e.resetHome();
    }
    this.player.revive(180, this.stageH / 2);
    audio.playBGM(this.stageDef.key === "alfheim" || this.stageDef.key === "abyss" ? "boss" : "field");
  }

  /* ================= 입력 ================= */

  private setupInput() {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,X,Z,C,Q,E,F,I,R,K"
    ) as Record<string, Phaser.Input.Keyboard.Key>;

    const onMove = (v: { x: number; y: number }) => this.touchMove.set(v.x, v.y);
    const onAtk = () => (this.attackQueued = true);
    const onS1 = () => this.player?.useSkill1();
    const onS2 = () => this.player?.useSkill2();
    const onRespawn = () => this.respawnPlayer();
    const onDialogueDone = () => this.resumeFromDialogue();
    const onInteract = () => this.tryInteract();
    const onNameSet = (v: { name: string }) => {
      if (this.introStep === 2) this.finishIntro(v.name);
    };
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
    const onUpgrade = (v: { slot: "weapon" | "armor" }) => {
      if (!this.player || this.dialoguing) return;
      this.player.tryUpgrade(v.slot);
      this.save();
      this.emitRpgState();
      this.emitHud();
    };
    // 채팅 입력 포커스 — 게임 키 입력 완전 차단 (v1.7 멀티플레이 채팅)
    const onChatFocus = (v: { focus: boolean }) => {
      this.chatFocused = v.focus;
      if (v.focus) this.touchMove.set(0, 0);
    };
    const onChatSend = (v: { text: string }) => net.netSendChat(v.text);
    // 전직 선택 (JobPanel → v1.7)
    const onJobSelect = (v: { key: string }) => {
      if (!this.player || this.player.state === "dead") return;
      if (this.dialoguing) {
        EventBus.emit("banner:show", { text: "대화 중에는 전직할 수 없습니다" });
        return;
      }
      if (this.player.cls) return;
      if (this.player.lv < JOB_LEVEL) {
        EventBus.emit("banner:show", { text: `전직은 Lv ${JOB_LEVEL}부터 가능합니다` });
        return;
      }
      const def = classDef(v.key);
      if (!def || !this.player.applyClass(def.key)) return;
      audio.sfx.levelup();
      this.spawnLevelUpFx(this.player.x, this.player.y);
      EventBus.emit("banner:show", { text: `전직 완료! ${def.name} — ${def.title}` });
      this.refreshPlayerTag();
      this.save();
      this.emitHud();
      this.emitRpgState();
      net.netAnnounceJob(def.key);
    };

    EventBus.on("input:move", onMove);
    EventBus.on("input:attack", onAtk);
    EventBus.on("input:skill1", onS1);
    EventBus.on("input:skill2", onS2);
    EventBus.on("input:interact", onInteract);
    EventBus.on("name:set", onNameSet);
    EventBus.on("rpg:buy", onBuy);
    EventBus.on("rpg:equip", onEquip);
    EventBus.on("rpg:use", onUse);
    EventBus.on("rpg:upgrade", onUpgrade);
    EventBus.on("respawn", onRespawn);
    EventBus.on("dialogue:done", onDialogueDone);
    EventBus.on("chat:focus", onChatFocus);
    EventBus.on("chat:send", onChatSend);
    EventBus.on("job:select", onJobSelect);
    this.events.once("shutdown", () => {
      EventBus.off("input:move", onMove);
      EventBus.off("input:attack", onAtk);
      EventBus.off("input:skill1", onS1);
      EventBus.off("input:skill2", onS2);
      EventBus.off("input:interact", onInteract);
      EventBus.off("name:set", onNameSet);
      EventBus.off("rpg:buy", onBuy);
      EventBus.off("rpg:equip", onEquip);
      EventBus.off("rpg:use", onUse);
      EventBus.off("rpg:upgrade", onUpgrade);
      EventBus.off("respawn", onRespawn);
      EventBus.off("dialogue:done", onDialogueDone);
      EventBus.off("chat:focus", onChatFocus);
      EventBus.off("chat:send", onChatSend);
      EventBus.off("job:select", onJobSelect);
    });
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50);

    // 원격 플레이어 보간 — 대화/채팅/사망과 무관하게 항상 갱신 (v1.7 멀티플레이)
    const lerpK = Math.min(1, (dt / 1000) * 9);
    for (const r of this.remotes.values()) {
      r.sp.x += (r.tx - r.sp.x) * lerpK;
      r.sp.y += (r.ty - r.sp.y) * lerpK;
      r.sp.setFlipX(r.flip);
      r.tag.setPosition(r.sp.x, r.sp.y - 52);
      const want = r.moving ? "hero-walk-side" : "hero-idle";
      if (r.sp.anims.currentAnim?.key !== want) r.sp.play(want);
    }

    // 채팅 입력 중 — 게임 키/이동 완전 차단 (원격 보간은 위에서 계속)
    if (this.chatFocused || this.dialoguing || !this.player) return;
    if (this.player.state === "dead") return;

    this.wellCd = Math.max(0, this.wellCd - dt);

    // 마을 우물 샘물 — 근접 시 풀회복 (HP/MP가 꽉 차 있으면 미발동, 8초 쿨다운)
    if (this.wellPos && this.stageDef.key === "village" && this.wellCd <= 0) {
      const nearWell = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.wellPos.x, this.wellPos.y) < 86;
      if (nearWell && (this.player.hp < this.player.maxHp || this.player.mp < this.player.maxMp)) {
        this.wellCd = 8000;
        this.player.healFull();
        this.sfxPotion();
        this.spawnPickupText(this.player.x, this.player.y - 34, "샘물로 완전히 회복!", "#7dffa8");
        this.spawnBurstAt(this.player.x, this.player.y, 8, 0x7de8ff);
      }
    }

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

    // 키보드 공격/스킬 — 방향키 이동 + X 공격 + Z/C 스킬 (사용자 지정 왼손 배치)
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keys.X))
      this.attackQueued = true;
    if (Phaser.Input.Keyboard.JustDown(this.keys.Z)) this.player.useSkill1();
    if (Phaser.Input.Keyboard.JustDown(this.keys.C)) this.player.useSkill2();

    this.player.update(dt, move, this.attackQueued);
    this.attackQueued = false;

    // 물약 퀵슬롯 + 상점 열기 + E키 상호작용
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.player.usePotion("hp");
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.player.usePotion("mp");
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.tryInteract();
    if (Phaser.Input.Keyboard.JustDown(this.keys.F) && this.nearShop) EventBus.emit("ui:panel", { panel: "shop" });
    if (Phaser.Input.Keyboard.JustDown(this.keys.I)) EventBus.emit("ui:panel", { panel: "inv" });
    if (Phaser.Input.Keyboard.JustDown(this.keys.K)) EventBus.emit("ui:panel", { panel: "job" });

    // E키 상호작용 감지 — 가장 가까운 NPC/상점 프롬프트 갱신
    this.updateInteractPrompt();

    // 플레이어 이름표 추적 (인트로에서 지정 후)
    this.playerNameTag?.setPosition(this.player.x, this.player.y - 48);

    // 인트로 플레이 시퀀스 (이동 학습 → 우물 → 이름 짓기)
    if (this.introStep >= 0 && this.introStep < 2) this.tickIntro(dt, move);

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

    // 멀티플레이 상태 송신 (약 8Hz — v1.7)
    this.netAcc += dt;
    if (this.netAcc >= 120) {
      this.netAcc = 0;
      net.netState({
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        flip: this.player.flipX,
        moving: move.lengthSq() > 0.01 || this.player.state === "attack",
        lv: this.player.lv,
        cls: this.player.cls,
      });
    }
  }

  currentMoveVec() {
    return this.touchMove.lengthSq() > 0.01 ? this.touchMove.clone() : new Phaser.Math.Vector2();
  }

  /* ================= 멀티플레이 (v1.7) ================= */

  /** 같은 서버에 접속한 다른 플레이어 실시간 동기화 — 오프라인이면 조용히 생략 */
  private initNet() {
    try {
      const s = net.netConnect();
      if (!s) return;
      const offPlayers = net.netOnPlayers((list) => this.syncRemotes(list));
      const offChat = net.netOnChat((m) => EventBus.emit("chat:msg", m));
      this.netOffs = [offPlayers, offChat];
      this.events.once("shutdown", () => this.shutdownNet());
      // 소켓 연결 안정화 후 입장 방송
      this.time.delayedCall(650, () => {
        if (!this.player) return;
        net.netJoin({
          name: getPlayerName(),
          lv: this.player.lv,
          cls: this.player.cls,
          x: Math.round(this.player.x),
          y: Math.round(this.player.y),
        });
      });
    } catch {
      /* 오프라인/APK 단독 실행 — 멀티 없이 진행 */
    }
  }

  private shutdownNet() {
    for (const off of this.netOffs) off();
    this.netOffs = [];
    this.clearRemotes();
  }

  /** 서버 브로드캐스트 → 원격 플레이어 스프라이트/이름표 동기화 */
  private syncRemotes(list: net.NetPlayer[]) {
    const myId = net.netId();
    const seen = new Set<string>();
    for (const p of list) {
      if (!p || p.id === myId) continue;
      seen.add(p.id);
      let r = this.remotes.get(p.id);
      if (!r) {
        const sp = this.add.sprite(p.x, p.y, "hero_idle0").setDepth(9).setAlpha(0.96);
        sp.play("hero-idle");
        const d = classDef(p.cls);
        const tag = this.add
          .text(p.x, p.y - 52, `${p.name} Lv.${p.lv}`, {
            fontFamily: "sans-serif",
            fontSize: "11px",
            color: d ? d.color : "#ffe9b0",
            stroke: "#0a2030",
            strokeThickness: 4,
            fontStyle: "bold",
          })
          .setOrigin(0.5)
          .setDepth(60);
        r = { sp, tag, tx: p.x, ty: p.y, flip: p.flip, moving: p.moving, cls: p.cls, lv: p.lv, name: p.name };
        this.remotes.set(p.id, r);
      }
      r.tx = p.x;
      r.ty = p.y;
      r.flip = p.flip;
      r.moving = p.moving;
      if (r.cls !== p.cls || r.lv !== p.lv || r.name !== p.name) {
        r.cls = p.cls;
        r.lv = p.lv;
        r.name = p.name;
        const d = classDef(p.cls);
        r.tag.setText(`${p.name} Lv.${p.lv}${d ? ` · ${d.name}` : ""}`);
        r.tag.setColor(d ? d.color : "#ffe9b0");
      }
    }
    for (const [id, r] of this.remotes) {
      if (!seen.has(id)) {
        r.sp.destroy();
        r.tag.destroy();
        this.remotes.delete(id);
      }
    }
  }

  private clearRemotes() {
    for (const r of this.remotes.values()) {
      r.sp.destroy();
      r.tag.destroy();
    }
    this.remotes.clear();
  }

  /** 내 이름표에 클래스 반영 (인트로에서 이름표 생성된 뒤 유효) */
  private refreshPlayerTag() {
    if (!this.playerNameTag || !this.player) return;
    const d = classDef(this.player.cls);
    this.playerNameTag.setText(d ? `${getPlayerName()} · ${d.name}` : getPlayerName());
  }

  /* ================= E키 상호작용 ================= */

  /** 가장 가까운 상호작용 대상 탐색 → React 프롬프트 갱신 (변경 시만 emit) */
  private updateInteractPrompt() {
    let best: (typeof this.interactables)[number] | null = null;
    let bd = 130;
    for (const it of this.interactables) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    const prev = this.nearInteract;
    if (best === prev) return;
    this.nearInteract = best;
    const payload: InteractState = best
      ? { active: true, label: best.label, kind: best.kind }
      : { active: false, label: "", kind: null };
    EventBus.emit("ui:interact", payload);
  }

  /** E키/모바일 버튼 — 가까운 NPC 대화 시작 또는 상점 열기 */
  tryInteract() {
    if (this.dialoguing || !this.player || this.player.state === "dead") return;
    const it = this.nearInteract;
    if (!it) return;
    if (it.kind === "shop") {
      EventBus.emit("ui:panel", { panel: "shop" });
    } else if (it.kind === "talk" && it.dlg) {
      this.showDialogue(it.dlg, it.npcId ?? null);
    }
  }

  /** 주민 대화 종료 — talk 퀘스트 진행 (마을 첫 퀘스트) */
  private onNpcTalked(npcId: string) {
    if (this.talkedNpcs.has(npcId)) return;
    this.talkedNpcs.add(npcId);
    const q = this.currentQuest();
    if (!q || q.type !== "talk") return;
    this.huntCount = Math.min(this.talkedNpcs.size, q.need ?? 0);
    audio.sfx.questDone();
    this.spawnPickupText(this.player.x, this.player.y - 40, "대화 완료!", "#7dffa8");
    if (this.talkedNpcs.size >= (q.need ?? 0)) {
      this.advanceQuest();
      this.afterAdvance();
      this.save();
    } else {
      this.emitQuest();
    }
  }

  /** 보스 소환 패턴 — 권속 등장 (리스폰 대상 제외, 상한 방어) */
  requestSummon(key: EnemyKey, count: number, bx: number, by: number) {
    if (this.enemies.length >= 9) return;
    for (let i = 0; i < count; i++) {
      const ex = Phaser.Math.Clamp(bx + Phaser.Math.Between(-90, 90), 60, this.stageW - 60);
      const ey = Phaser.Math.Clamp(by + Phaser.Math.Between(-70, 70), 60, this.stageH - 60);
      const e = new Enemy(this, ex, ey, key);
      e.setAlpha(0);
      this.tweens.add({ targets: e, alpha: 1, duration: 380 });
      this.spawnBurstAt(ex, ey, 10, 0xc070ff);
      this.enemies.push(e);
      this.physics.add.collider(e, this.solidGroup);
    }
  }

  /* ================= 인트로 플레이 시퀀스 ================= */
  /**
   * 책장 넘기기 대신 직접 플레이하는 오프닝:
   *  0) 이동 학습 — 아리의 안내로 실제로 걸어보기
   *  1) 마을 우물로 이동 — 빛 기둥 마커 추적
   *  2) 우물 앞에서 이름 정하기 (인게임 패널)
   *  3) 이름 리액션 대사 → 마을 오프닝 → 퀘스트 시작
   */
  private startIntroSequence() {
    this.introStep = 0;
    this.introMoveDist = 0;
    this.introGuide = this.add
      .image(this.player.x + 26, this.player.y - 30, "glow")
      .setDepth(50)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x9df0ff)
      .setScale(0.55)
      .setAlpha(0.9);
    this.tweens.add({ targets: this.introGuide, scale: 0.75, alpha: 0.65, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.introGuideSpark = this.add
      .sprite(this.player.x + 26, this.player.y - 48, "sparkle0")
      .setDepth(51)
      .setBlendMode(Phaser.BlendModes.ADD)
      .play("sparkle");
    this.showBanner("방향키/WASD 또는 조이스틱으로 이동해 보자!");
  }

  private tickIntro(dt: number, move: Phaser.Math.Vector2) {
    const p = this.player;
    // 아리 가이드가 플레이어를 따라다님
    this.introGuide?.setPosition(p.x + 24, p.y - 30);
    this.introGuideSpark?.setPosition(p.x + 24, p.y - 48);

    if (this.introStep === 0) {
      // 이동 학습 — 실제로 움직인 거리 누적
      const spd = Math.hypot(move.x, move.y);
      if (spd > 0.1) this.introMoveDist += (spd * dt) / 10;
      if (this.introMoveDist > 240) {
        this.introStep = 1;
        const wp = this.wellPos;
        const wx = wp?.x ?? this.stageW * 0.5;
        const wy = wp?.y ?? this.stageH * 0.5;
        // 우물 위 빛 기둥 마커
        this.introMarker = this.add
          .image(wx, wy - 110, "beam")
          .setDepth(3)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0x9df0ff)
          .setAlpha(0.55);
        this.tweens.add({ targets: this.introMarker, alpha: { from: 0.4, to: 0.8 }, scaleX: { from: 1, to: 1.2 }, duration: 850, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        this.showBanner("요정 아리: 마을 우물로 와! 네 이름을 정해 주고 싶어!");
      }
    } else if (this.introStep === 1) {
      const wp = this.wellPos;
      if (wp) this.introMarker?.setPosition(wp.x, wp.y - 110);
      if (!wp || Phaser.Math.Distance.Between(p.x, p.y, wp.x, wp.y) < 120) {
        this.introStep = 2;
        this.introMarker?.destroy();
        this.introMarker = null;
        // 이름 입력 중 게임 일시 정지 (업데이트 루프 차단)
        this.dialoguing = true;
        this.player.setVelocity(0, 0);
        EventBus.emit("name:ask");
      }
    }
  }

  /** 이름 결정 — 저장 + 이름표 연출 + 오프닝 인계 */
  private finishIntro(name: string) {
    this.introStep = 3;
    this.dialoguing = false;
    setPlayerName(name);
    // 플레이어 이름표 (머리 위)
    this.playerNameTag = this.add
      .text(this.player.x, this.player.y - 48, name, {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#baf3ff",
        stroke: "#0a2030",
        strokeThickness: 4,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(60);
    // 축하 연출
    audio.sfx.levelup();
    this.spawnBurstAt(this.player.x, this.player.y, 26, 0x9df0ff);
    this.cameras.main.shake(140, 0.004);
    this.player.healFull();
    // 세이브에 이름 기록
    this.save();
    // 가이드 페이드아웃
    this.tweens.add({
      targets: [this.introGuide, this.introGuideSpark],
      alpha: 0,
      duration: 700,
      onComplete: () => {
        this.introGuide?.destroy();
        this.introGuideSpark?.destroy();
      },
    });
    this.introGuide = null;
    this.introGuideSpark = null;
    // 이름 리액션 → 마을 오프닝(아뜰란티스 세계관) 순차 재생
    this.queuedDialogue = "villageIntro";
    this.showDialogue("introNamed");
    this.emitQuest();
  }

  /** 수확(collect) 퀘스트용 파편 스폰 — 맵 우측 원영역 무작위 */
  private spawnFragmentForQuest() {
    const fx = Math.round(this.stageW * Phaser.Math.FloatBetween(0.55, 0.85));
    const fy = Math.round(this.stageH * Phaser.Math.FloatBetween(0.18, 0.42));
    this.spawnFragment(fx, fy);
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
      case "talk": {
        // 아직 대화하지 않은 주민 중 가장 가까운 곳
        let best: { x: number; y: number } | null = null;
        let bd = Infinity;
        for (const it of this.interactables) {
          if (it.kind !== "talk" || (it.npcId && this.talkedNpcs.has(it.npcId))) continue;
          const d = Phaser.Math.Distance.Between(it.x, it.y, this.player.x, this.player.y);
          if (d < bd) {
            bd = d;
            best = it;
          }
        }
        return best ? new Phaser.Math.Vector2(best.x, best.y) : null;
      }
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

  /** 현재 퀘스트 — 메인 체인 종료 후 반복 토벌 의뢰를 합성 퀘스트로 반환 */
  currentQuest(): QuestDef | null {
    if (this.repeatActive()) {
      const r = this.stageDef.repeat!;
      return {
        id: "repeat",
        type: "hunt",
        title: r.title,
        desc: r.desc,
        need: this.repeatNeed,
        targetKey: r.targetKey,
        targetLabel: ENEMIES[r.targetKey].name,
      };
    }
    return this.stageDef.quests[this.questIdx] ?? null;
  }

  private advanceQuest() {
    const done = this.stageDef.quests[this.questIdx];
    this.questIdx = Math.min(this.questIdx + 1, this.stageDef.quests.length);
    this.huntCount = 0;
    // 퀘스트 보상 — 골드 + 경험치 (2D MMORPG 기본 요소)
    if (done?.reward) {
      this.player.addGold(done.reward);
      this.spawnPickupText(this.player.x, this.player.y - 44, `퀘스트 보상 +${done.reward}G`, "#ffd76a");
    }
    if (done?.expReward) {
      this.player.gainExp(done.expReward);
      this.spawnPickupText(this.player.x, this.player.y - 62, `경험치 +${done.expReward}`, "#8fe84a");
    }
    this.emitQuest();
    this.emitRpgState();
  }

  emitQuest() {
    // 인트로 시퀀스 중 — 아리의 안내를 퀘스트 패널에 표시
    if (this.introStep >= 0 && this.introStep < 3) {
      EventBus.emit("quest", {
        title: "요정 아리의 안내",
        desc: "배너를 따라 마을을 돌아보자",
        current: 1,
        target: 1,
        distance: null,
      } satisfies QuestState);
      return;
    }
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
    } else if (q.type === "talk") {
      current = Math.min(this.talkedNpcs.size, q.need ?? 0);
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
      critRate: this.player.critRate,
      cls: this.player.cls,
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
      accessory: this.player.accessory,
      upWea: this.player.upgrades.weapon,
      upArm: this.player.upgrades.armor,
      nearShop: this.nearShop,
      shopStock: [...SHOP_STOCK],
      canJob: this.player.lv >= JOB_LEVEL && !this.player.cls,
    };
    const sig = JSON.stringify(st);
    if (sig === this.lastRpgSig) return;
    this.lastRpgSig = sig;
    EventBus.emit("rpg:state", st);
  }

  private save() {
    writeSave(this.buildSave());
  }

  /** 세이브 페이로드 생성 — stageOverride는 스테이지 전환 캐리용 */
  private buildSave(stageOverride?: StageKey): SaveData {
    return {
      stage: stageOverride ?? this.stageDef.key,
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
      upWea: this.player.upgrades.weapon,
      upArm: this.player.upgrades.armor,
      accessory: this.player.accessory,
      questIdx: { ...this.savedQuestIdx, [this.stageDef.key]: this.questIdx },
      cls: this.player.cls,
    };
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

  showDialogue(id: string, npcId: string | null = null) {
    const d = DIALOGUES[id];
    if (!d) return;
    this.activeNpcId = npcId;
    this.dialoguing = true;
    this.player.setVelocity(0, 0);
    this.physics.world.pause();
    EventBus.emit("dialogue:show", d);
  }

  resumeFromDialogue() {
    this.dialoguing = false;
    this.physics.world.resume();
    EventBus.emit("dialogue:hide");
    // 대화 닫기 키의 잔여 justDown 소비 — 스페이스로 대화 넘긴 직후 공격이 새어나가는 것 방지
    if (this.keys) {
      for (const k of [this.keys.SPACE, this.keys.X, this.keys.Z, this.keys.C, this.keys.E]) {
        Phaser.Input.Keyboard.JustDown(k);
      }
    }
    // 주민 대화 종료 → talk 퀘스트 진행
    if (this.activeNpcId) {
      const npc = this.activeNpcId;
      this.activeNpcId = null;
      this.onNpcTalked(npc);
    }
    // 예약 대사 (이름 리액션 → 마을 오프닝 등 순차 재생)
    if (this.queuedDialogue) {
      const next = this.queuedDialogue;
      this.queuedDialogue = null;
      this.time.delayedCall(60, () => this.showDialogue(next));
      return;
    }
    // 보스 격파 후 안내 대사 종료 시 차원문 개방 (플레이어가 포탈 위에 서 있어도
    // 대사 도중 즉시 전환되는 사고 방지 — 600ms 유예)
    if (this.pendingPortal) {
      this.pendingPortal = false;
      this.time.delayedCall(600, () => this.activatePortal());
    }
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
  /** 크리티컬 명중 — metal_02 고피치 샤프 음 */
  sfxCrit() {
    audio.sfx.crit();
  }
  /** 강화 성공 — 퀘스트 차임 저피치 (무게감) */
  sfxUpgradeOk() {
    audio.sfx.upgradeOk();
  }
  /** 강화 실패 — hurt 저피치 (둔탁한 낙방음) */
  sfxUpgradeFail() {
    audio.sfx.upgradeFail();
  }

  /* ================= 정리 ================= */

  private cleanup() {
    this.questTimer?.remove();
    this.scale.off("resize", this.applyCameraZoom, this);
    EventBus.emit("dialogue:hide");
  }
}

/* 스테이지 배경색 (카메라 클리어 컬러) */
const STAGE_BG: Record<StageKey, string> = {
  village: "#15270f",
  forest: "#0a1408",
  alfheim: "#0d0a1e",
  cave: "#100a08",
  niflheim: "#0c1826",
  abyss: "#0d0616",
};

/* 스테이지별 지형 전환 타일 세트 (build_tile_transitions.py 생성물) */
const GROUND_SET: Record<StageKey, string> = {
  village: "gp",
  forest: "gp",
  alfheim: "dp",
  cave: "cp",
  niflheim: "si",
  abyss: "ap",
};

/* 스테이지 오프닝 대사 */
const STAGE_INTRO: Record<StageKey, string> = {
  village: "villageIntro",
  forest: "intro",
  alfheim: "alfheimIntro",
  cave: "caveIntro",
  niflheim: "niflIntro",
  abyss: "abyssIntro",
};
