import Phaser from "phaser";
import { STAGES, DIALOGUES, ITEMS, SHOP_STOCK, NEXT_STAGE, PREV_STAGE, STAGE_SHORT, STAGE_THEME, BOSS_DEFS, ENEMIES, BUFF_DEFS, PET_DEFS, COSMETIC_DEFS, GOLD_DROP_SCALE, stageScale, stageIntro, resolveStage, chapterSpec, parseStage, JOBSTORY, type StageKey, type StageDef, type ItemKey, type EnemyDef, type EnemyKey, type BossDef, type QuestDef, type BuffKey, type PetKey, type CosmeticKey, type JobStoryDef } from "../data";
import { familyOf } from "../classes";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { Boss } from "../entities/Boss";
import { Drop, type DropKind } from "../entities/Drop";
import { Pet } from "../entities/Pet";
import { EventBus, type QuestState, type InteractState, type QuestLogState } from "../../components/game/EventBus";
import { writeSave, loadSave, getFcode, type SaveData, setPlayerName, getPlayerName } from "../config";
import { loadKeyMap, type KeyMap, type GameAction } from "../keymap";
import {
  classDef, canJobNow, nextJobLevel, freeJobOption, FREE_JOB_COST, chainOf,
  type ClassKey,
} from "../classes";
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

  /* ----- v2.0: 복귀 차원문 (메이플식 자유 왕복 — 사용자 지시 #8) ----- */
  private returnPortal: Phaser.Physics.Arcade.Sprite | null = null;
  private returnBeacon: Phaser.GameObjects.Image | null = null;
  private returnActive = false;
  /* ----- v2.0: 정예 몬스터 (구역 5 미드보스급 — 사용자 지시 #5) ----- */
  private eliteEnemy: Enemy | null = null;
  /* ----- v2.0: 프롤로그 보호 — 입장 직후 몬스터 즉시 공격 방지 ----- */
  private agroHoldUntil = 0;
  /** 지금 프롤로그 보호 상태인지 (인트로 시퀀스 또는 어그로 유예 중) — Enemy/Boss AI가 참조 */
  get isPrologueSafe(): boolean {
    return (this.introStep >= 0 && this.introStep < 2) || this.time.now < this.agroHoldUntil;
  }
  /** 인트로/대사 유예 부여 — Enemy/Boss AI가 대사 종료 후 호출 */
  grantPrologueGrace(ms = 2600) {
    this.agroHoldUntil = Math.max(this.agroHoldUntil, this.time.now + ms);
  }
  /* ----- v2.0: 토벌 퀘스트 기준선 (퀘스트 시작 이후 킬만 카운트 — 지시 #17) ----- */
  private huntBaseline: Record<string, number> = {};
  /* ----- v2.0: E 상호작용 말풍선 (이름 위 배치 — 지시 #14) ----- */
  private eBubble: Phaser.GameObjects.Arc | null = null;
  private eBubbleText: Phaser.GameObjects.Text | null = null;
  /* ----- v2.0: 방향키 입력 순서 (마지막 누른 키 우선 — 지시 #16) ----- */
  private dirOrder: { x: string[]; y: string[] } = { x: [], y: [] };
  /* ----- v2.0: 전직 스토리 진행 (지시 #13) ----- */
  jobStory: { tier: 2 | 3; step: number; hunt: number } | null = null;
  private jobStoryDone: number[] = []; // 완료한 티어 기록 [2, 3]
  private jobEliteSummoned = false; // 시험 상대 소환 여부 (소환 전 완료 판정 방지)
  /* ----- v2.0: 여관/집 상호작용 쿨다운 ----- */
  private restCd = 0;

  /* ----- E키 상호작용 (NPC 대화/상점/전직 교관 — 접근 자동 트리거 제거) ----- */
  private interactables: { x: number; y: number; kind: "talk" | "shop" | "job" | "inn" | "house"; dlg?: string; npcId?: string; label: string }[] = [];
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

  /* ----- 플레이어 투사체 (v1.8 — 궁수 관통 화살 / 마법사 매직 볼트) ----- */
  private pProjPool: Phaser.Physics.Arcade.Image[] = [];
  private pProjIdx = 0;

  /* ----- v1.9: 키 매핑 / 펫 / 치장 오라 / 강화 오라 ----- */
  private keymap: KeyMap = loadKeyMap();
  private keyObjs: Record<string, Phaser.Input.Keyboard.Key> = {};
  private pet: Pet | null = null;
  /** 플레이어 추적 오브젝트 (치장 오라/강화 오라/날개 입자) */
  private cosmeticAura: Phaser.GameObjects.Image | null = null;
  private cosmeticEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private upgradeGlow: Phaser.GameObjects.Image | null = null;
  private jobNpc: Phaser.GameObjects.Image | null = null;

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
    this.pProjPool = []; // 씬 소유 오브젝트는 씬 종료와 함께 정리 — 인덱스만 초기화
    this.pProjIdx = 0;
    this.repeatNeed = 0;
    this.keymap = loadKeyMap();
    this.keyObjs = {};
    this.pet = null;
    this.cosmeticAura = null;
    this.cosmeticEmitter = null;
    this.upgradeGlow = null;
    this.jobNpc = null;
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
    this.returnPortal = null;
    this.returnBeacon = null;
    this.returnActive = false;
    this.eliteEnemy = null;
    this.agroHoldUntil = 0;
    this.huntBaseline = {};
    this.eBubble = null;
    this.eBubbleText = null;
    this.dirOrder = { x: [], y: [] };
    this.jobStory = null;
    this.jobStoryDone = [];
    this.restCd = 0;
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
      fresh?: boolean;
    };
    const save = data.save;
    const rawStage = save ? (save.stage as StageKey) : data.stage ?? "village";
    /* 유효하지 않은 스테이지 키(구 세이브/수정 세이브) 방어 — 체인 시작점으로 안전 폴백 (v2.0 구세이브 폴백 내장) */
    const stageKey: StageKey = resolveStage(rawStage);
    this.stageDef = STAGES[stageKey];
    this.stageW = this.stageDef.width;
    this.stageH = this.stageDef.height;

    /* ---------- 바닥 (v2.0 — 10챕터 테마 테이블) ---------- */
    const theme = STAGE_THEME[stageKey] ?? STAGE_THEME.village;
    const groundTex = theme.ground;
    const pathTex = theme.path;
    this.add.tileSprite(0, 0, this.stageW, this.stageH, groundTex).setOrigin(0).setDepth(0);
    // 중앙 가로 길
    this.add
      .tileSprite(0, this.stageH / 2 - 52, this.stageW, 104, pathTex)
      .setOrigin(0)
      .setDepth(0)
      .setAlpha(0.9);
    if (stageKey === "forest1") {
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
    this.cameras.main.setBackgroundColor(theme.bg);

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
      // 레벨업 MP 성장 복원 (v1.9 — 구 세이브는 60 유지)
      if (typeof savedPlayer.maxMp === "number") {
        this.player.maxMp = Math.max(60, savedPlayer.maxMp);
        this.player.mp = this.player.maxMp;
      }
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
      // AP 스탯 복원 (v1.9 — 구 세이브는 loadSave()가 5/5/5/5 + 소급 AP 채움)
      // 지력/행운의 maxMp/maxHp 가산은 세이브 maxHp에 이미 포함 — 여기선 수치만 복원
      const st = savedPlayer.stats ?? { str: 5, dex: 5, int: 5, luk: 5 };
      this.player.stats = { ...st };
      this.player.ap = savedPlayer.ap ?? 0;
      // BM 복원 (v1.9)
      this.player.buffItems = { ...(savedPlayer.buffItems ?? {}) } as Partial<Record<BuffKey, number>>;
      this.player.buffs = (savedPlayer.buffs ?? [])
        .filter((b) => b.key in BUFF_DEFS)
        .map((b) => ({ key: b.key as BuffKey, remain: b.remain, total: b.total }));
      this.player.pets = (savedPlayer.pets ?? []).filter((k) => k in PET_DEFS) as PetKey[];
      this.player.pet = (savedPlayer.pet && savedPlayer.pet in PET_DEFS ? (savedPlayer.pet as PetKey) : null);
      this.player.cosmetics = (savedPlayer.cosmetics ?? []).filter((k) => k in COSMETIC_DEFS) as CosmeticKey[];
      this.player.cosmetic = (savedPlayer.cosmetic && savedPlayer.cosmetic in COSMETIC_DEFS ? (savedPlayer.cosmetic as CosmeticKey) : null);
      // 전직 스토리 복원 (v2.0)
      if (savedPlayer.jobStory && typeof savedPlayer.jobStory.tier === "number") {
        this.jobStory = { tier: savedPlayer.jobStory.tier, step: savedPlayer.jobStory.step, hunt: savedPlayer.jobStory.hunt };
      }
      this.jobStoryDone = [...(savedPlayer.jobStoryDone ?? [])];
      this.player.recalcSpeedForLoad();
    }
    this.repeatNeed = this.stageDef.repeat?.need ?? 0;
    this.playerRef = this.player;
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.physics.add.collider(this.player, this.solidGroup);

    /* ---------- BM 복원 (v1.9 — 펫 소환/치장 오라/강화 오라) ---------- */
    this.syncPet();
    this.syncCosmeticAura();
    this.syncUpgradeGlow();

    /* ---------- 적 배치 (v2.0 — 챕터/구역 난이도 배율 적용) ---------- */
    const sc = stageScale(stageKey);
    const rng = new Phaser.Math.RandomDataGenerator([stageKey]);
    for (const group of this.stageDef.enemies) {
      for (let i = 0; i < group.count; i++) {
        let ex = 0;
        let ey = 0;
        let tries = 0;
        do {
          ex = stageKey === "forest1" ? rng.between(this.stageW * 0.42, this.stageW - 140) : rng.between(240, this.stageW - 160);
          ey = rng.between(120, this.stageH - 120);
          tries++;
        } while (Phaser.Math.Distance.Between(ex, ey, this.player.x, this.player.y) < 380 && tries < 30);
        const e = new Enemy(this, ex, ey, group.key, { hp: sc.hp, atk: sc.atk, exp: sc.exp, gold: sc.gold });
        this.enemies.push(e);
        this.spawnRecords.push({ key: group.key, x: ex, y: ey });
        this.physics.add.collider(e, this.solidGroup);
      }
    }
    /* ---------- 정예 몬스터 (구역 5 — 미드보스급 단일 스폰, 지시 #5) ---------- */
    if (this.stageDef.elite) {
      const el = this.stageDef.elite;
      const ex = this.stageW * 0.62;
      const ey = this.stageH * 0.34;
      const e = new Enemy(this, ex, ey, el.key, {
        hp: el.hpMult * sc.hp,
        atk: el.atkMult * sc.atk,
        exp: 8 * sc.exp,
        gold: 9 * sc.gold,
        scale: 1.55,
        tint: 0xff9090,
        displayName: el.name,
      });
      this.eliteEnemy = e;
      this.enemies.push(e);
      this.spawnRecords.push({ key: el.key, x: ex, y: ey });
      this.physics.add.collider(e, this.solidGroup);
      this.showBanner(`${el.name} 출현!`);
      audio.sfx.roar();
      this.cameras.main.shake(240, 0.007);
    }

    /* ---------- 퀘스트 오브젝트 ---------- */
    if (stageKey === "village") {
      this.buildVillage();
      // 마을 차원문은 항상 열려 있음 (숲 1구역으로 출발)
      this.spawnPortal(this.stageW - 110, this.stageH * 0.52);
      this.activatePortal(true);
    } else {
      if (!this.stageDef.boss) this.spawnPortal(this.stageW - 130, this.stageH * 0.52);
      // 수확(collect) 퀘스트 진행 중 — 파편 스폰 (이어하기 무결: ATK 중복 수령 방지)
      if (this.currentQuest()?.type === "collect") this.spawnFragmentForQuest();
    }
    /* ---------- 복귀 차원문 (v2.0 — 이전 구역 자유 왕복, 지시 #8) ---------- */
    this.spawnReturnPortal();

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

    /* ---------- 사운드/BGM (v2.0 — 챕터별 전용 테마 8트랙) ---------- */
    audio.playBGM(audio.stageBgm(stageKey));

    /* ---------- 오프닝 대사 (인트로 시퀀스 중이면 인트로가 인계) ---------- */
    if (stageKey === "village" && !savedPlayer?.playerName) {
      // 신규 플레이어 — 책장 넘기기 대신 플레이형 인트로 (이동 → 우물 → 이름 짓기)
      this.startIntroSequence();
    } else {
      this.time.delayedCall(400, () => {
        this.showDialogue(stageIntro(stageKey));
      });
    }

    EventBus.emit("ui:playing");
    this.emitHud();
    this.emitQuest();
    this.emitRpgState();

    /* ---------- 멀티플레이 (같은 서버 접속자 동기화 — v1.7) ---------- */
    this.initNet();

    // 프롤로그 유예 — 입장 대사 종료 후 몬스터 즉시 공격 방지 (v2.0)
    this.agroHoldUntil = this.time.now + 2600;

    // F2: 거리 실시간 갱신 (300ms 주기 — 프레임 부담 없음) + 미니맵/RPG 상태/퀘스트 로그
    this.questTimer = this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        this.emitQuest();
        this.emitSkills();
        this.emitRpgState();
        this.emitQuestLog();
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
    const { ch } = parseStage(stageKey);
    const set = ch === "village" || ch === "forest" || ch === "kingdom" ? "gp"
      : ch === "alfheim" ? "dp"
      : ch === "cave" || ch === "nidavellir" ? "cp"
      : ch === "niflheim" ? "si"
      : ch === "muspelheim" || ch === "abyss" ? "ap"
      : ch === "hel" ? "dp"
      : "gp";
    const T = 64;
    const rng = new Phaser.Math.RandomDataGenerator([stageKey + "-blend"]);
    const yc = this.stageH / 2;
    const half = 52;

    /* v2.1 타일맵 자연화 — v2.0의 격자 프린지(자로 잰 직선 경계)를 개선:
     *  ① 도로 경계를 두 개 사인파 합성으로 물결치게 (구역별 고정 위상 → 재방문 시 동일 지형)
     *  ② 지면 변형 타일을 격자 중심이 아닌 지터 위치에 배치
     *  ③ 프린지/침식 밀도와 뒤집기 다양화 */
    const wobTop = (x: number) => Math.sin(x * 0.008) * 13 + Math.sin(x * 0.021 + 2.1) * 7;
    const wobBot = (x: number) => Math.sin(x * 0.009 + 1.3) * 12 + Math.sin(x * 0.023 + 0.6) * 7;

    // 1) 지면 명도 변형 스캐터 — 지터 위치 (도로 근처 제외)
    for (let gy = 0; gy < this.stageH; gy += T) {
      for (let gx = 0; gx < this.stageW; gx += T) {
        const jx = gx + T / 2 + rng.between(-20, 20);
        const jy = gy + T / 2 + rng.between(-20, 20);
        if (jy > yc - half + wobTop(jx) - 24 && jy < yc + half + wobBot(jx) + 24) continue;
        const r = rng.frac();
        const tex = r < 0.032 ? `tx_${set}_gvar1` : r < 0.064 ? `tx_${set}_gvar2` : null;
        if (tex) this.add.image(jx, jy, tex).setDepth(0).setFlipX(rng.frac() < 0.5).setAlpha(0.88 + rng.frac() * 0.12);
      }
    }

    // 2) 도로 경계 — 물결을 따라가는 프린지 + 침식 + 도로 내부 미세 변형
    for (let x = 0; x <= this.stageW; x += 46) {
      const yT = yc - half + wobTop(x);
      const yB = yc + half + wobBot(x);
      if (rng.frac() < 0.6) this.add.image(x, yT - rng.between(2, 10), `tx_${set}_edge_dn`).setDepth(0).setFlipX(rng.frac() < 0.5);
      if (rng.frac() < 0.6) this.add.image(x, yB + rng.between(2, 10), `tx_${set}_edge_up`).setDepth(0).setFlipX(rng.frac() < 0.5);
      if (rng.frac() < 0.24) this.add.image(x, yT + rng.between(8, 26), `tx_${set}_bite_dn`).setDepth(0).setFlipX(rng.frac() < 0.5);
      if (rng.frac() < 0.24) this.add.image(x, yB - rng.between(8, 26), `tx_${set}_bite_up`).setDepth(0).setFlipX(rng.frac() < 0.5);
      if (rng.frac() < 0.14)
        this.add.image(x + rng.between(-18, 18), rng.between(Math.round(yT) + 16, Math.round(yB) - 16), `tx_${set}_pvar`)
          .setDepth(0).setFlipX(rng.frac() < 0.5).setAlpha(0.82);
    }

    // 3) 숲 세로 길 — 좌우 경계 프린지 (요철 + flipY 변형)
    if (ch === "forest") {
      const vcx = this.stageW * 0.55;
      const wobL = (y: number) => Math.sin(y * 0.01 + 0.7) * 12 + Math.sin(y * 0.027 + 1.9) * 5;
      for (let y = 0; y <= this.stageH; y += 46) {
        if (rng.frac() < 0.6) this.add.image(vcx - 92 + wobL(y), y, `tx_${set}_edge_rt`).setDepth(0).setFlipY(rng.frac() < 0.5);
        if (rng.frac() < 0.6) this.add.image(vcx + 92 + wobL(y + 1.7), y, `tx_${set}_edge_lt`).setDepth(0).setFlipY(rng.frac() < 0.5);
      }
    }
  }

  private placeDecor(stageKey: StageKey) {
    const def = this.stageDef;
    const ch = parseStage(stageKey).ch;
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

    // 나무 & 소나무 & 바위 (충돌 있음) — 실제 에셋, 챕터 테마 변형 (v2.0: 구역 키 대응)
    const treeSet: string[] =
      ch === "niflheim" ? ["pine_snow"]
      : ch === "abyss" || ch === "hel" ? ["pine_dark"]
      : ch === "muspelheim" ? ["pine_dark", "tree"]
      : ch === "cave" || ch === "nidavellir" ? ["pine"]
      : ["tree", "tree", "pine"];
    const rockTex = ch === "niflheim" ? "rock_snow" : ch === "abyss" || ch === "hel" ? "rock_dark" : ch === "muspelheim" || ch === "nidavellir" ? "rock_stone" : "rock";

    /* v2.1 자연 배치 — 균일 산포 대신 2~3개 군집 중심 + 의사-가우시안 산포 (자연 숲 패턴) */
    const clusterN = ch === "village" ? 2 : 3;
    const clusters: [number, number][] = [];
    for (let i = 0; i < clusterN; i++)
      clusters.push([rng.between(200, this.stageW - 200), rng.between(140, this.stageH - 140)]);
    const natPoint = (): [number, number] => {
      if (rng.frac() < 0.62) {
        const [kx, ky] = rng.pick(clusters);
        return [
          Phaser.Math.Clamp(kx + (rng.frac() + rng.frac() - 1) * 210, 80, this.stageW - 80),
          Phaser.Math.Clamp(ky + (rng.frac() + rng.frac() - 1) * 150, 90, this.stageH - 80),
        ];
      }
      return [rng.between(80, this.stageW - 80), rng.between(90, this.stageH - 80)];
    };
    for (let i = 0; i < def.treeCount; i++) {
      const [x, y] = natPoint();
      if (Math.abs(y - this.stageH / 2) < 90) continue; // 길 위엔 안 심음
      if (blocked(x, y)) continue;
      const tex = rng.pick(treeSet);
      const t = this.add.image(x, y, tex).setDepth(Math.floor(y / 10));
      this.solidGroup.add(t);
      // 64x64 캔버스 하단 줄기 부근만 충돌
      (t.body as Phaser.Physics.Arcade.StaticBody).setSize(20, 14).setOffset(22, 46);
    }
    for (let i = 0; i < def.rockCount; i++) {
      const [x, y] = natPoint();
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
    if (ch === "alfheim") {
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

    // 스바르트알프헤임 동굴/광산 — 심연에 물든 수정 광맥 (세계수 파편 텍스처 보라 변형 + 글로우)
    if (ch === "cave" || ch === "nidavellir") {
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
    if (ch === "abyss") {
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

    // 무스펠헤임 — 용암 균열(마그마 타일 변형) + 화염 글로우 (v2.0 신규 테마)
    if (ch === "muspelheim") {
      const rng3 = new Phaser.Math.RandomDataGenerator(["muspel-embers"]);
      for (let i = 0; i < 8; i++) {
        const ex3 = rng3.between(140, this.stageW - 140);
        const ey3 = rng3.between(90, this.stageH - 90);
        if (Math.abs(ey3 - this.stageH / 2) < 80) continue;
        this.add.image(ex3, ey3, "tile_magma").setDepth(0).setScale(0.5).setTint(0xffb070);
        const g = this.add
          .image(ex3, ey3, "glow")
          .setDepth(0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xff8a4a)
          .setScale(1.0)
          .setAlpha(0.16);
        this.tweens.add({ targets: g, alpha: 0.34, scale: 1.35, duration: 950, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      }
    }

    // 헬 — 무덤·고목·해골 (무료 에셋 Undead Pack, CC0 — v1.5 배치1 이관)
    if (ch === "hel") {
      const rng4 = new Phaser.Math.RandomDataGenerator(["hel-graves"]);
      const graves = ["ud_grave1", "ud_grave2", "ud_grave3"];
      for (let i = 0; i < 6; i++) {
        const gx4 = rng4.between(140, this.stageW - 140);
        const gy4 = rng4.between(90, this.stageH - 90);
        if (Math.abs(gy4 - this.stageH / 2) < 90) continue;
        const g4 = this.add.image(gx4, gy4, rng4.pick(graves)).setDepth(Math.floor(gy4 / 10));
        this.solidGroup.add(g4);
        (g4.body as Phaser.Physics.Arcade.StaticBody).setSize(26, 30).setOffset(12, 16);
      }
      for (let i = 0; i < 4; i++) {
        const dx4 = rng4.between(140, this.stageW - 140);
        const dy4 = rng4.between(90, this.stageH - 90);
        if (Math.abs(dy4 - this.stageH / 2) < 90) continue;
        this.add.image(dx4, dy4, rng4.pick(["ud_deadtree1", "ud_deadtree2", "ud_deadtree3"])).setDepth(Math.floor(dy4 / 10));
      }
    }

    // 숲(미드가르드) — 유적 나무/소품 (ForgottenMemories, CC-BY — v1.5 배치1 이관)
    if (ch === "forest") {
      const rng5 = new Phaser.Math.RandomDataGenerator(["forest-ruins"]);
      for (let i = 0; i < 4; i++) {
        const px5 = rng5.between(200, this.stageW - 200);
        const py5 = rng5.between(90, this.stageH - 90);
        if (Math.abs(py5 - this.stageH / 2) < 90) continue;
        this.add.image(px5, py5, rng5.pick(["fm_tree1", "fm_tree2", "fm_tree3", "fm_tree4"])).setDepth(Math.floor(py5 / 10));
      }
      for (let i = 0; i < 5; i++) {
        const qx5 = rng5.between(120, this.stageW - 120);
        const qy5 = rng5.between(70, this.stageH - 70);
        this.add.image(qx5, qy5, rng5.pick(["fm_prop1", "fm_prop2", "fm_prop3", "fm_shrub1"])).setDepth(1);
      }
    }

    // 쿠소디아/아뜰란티스 — 육한 식물·바위·뼈 (Cursed Land, CC0 — v1.5 배치1 이관)
    if (ch === "kingdom" || ch === "abyss") {
      const rng6 = new Phaser.Math.RandomDataGenerator(["cursed-plants"]);
      for (let i = 0; i < 9; i++) {
        const px6 = rng6.between(120, this.stageW - 120);
        const py6 = rng6.between(70, this.stageH - 70);
        if (Math.abs(py6 - this.stageH / 2) < 85) continue;
        this.add.image(px6, py6, rng6.pick(["cl_mflower", "cl_eyeplant", "cl_jawsplant", "cl_manyeyes", "cl_pustules", "cl_rock", "cl_bones"])).setDepth(1);
      }
    }

    // 마을 모닥불 (Serene Village, CC-BY) — 광장 남서 고정 + 글로우
    if (stageKey === "village") {
      const fx7 = this.stageW / 2 - 250;
      const fy7 = this.stageH / 2 + 150;
      const fire = this.add.sprite(fx7, fy7, "sv_campfire").setDepth(Math.floor(fy7 / 10)).play("sv-campfire");
      this.solidGroup.add(fire);
      (fire.body as Phaser.Physics.Arcade.StaticBody).setSize(24, 14).setOffset(4, 18);
      this.add
        .image(fx7, fy7, "glow")
        .setDepth(1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffb060)
        .setScale(0.9)
        .setAlpha(0.2);
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
    const isForest = parseStage(this.stageDef.key).ch === "forest";
    this.showDialogue(isForest ? "fragment" : "fragment2");
    this.advanceQuest();
    // 전직 스토리 수확 단계 (지시 #13)
    if (this.jobStory) {
      const step = this.jobStoryDef()?.steps[this.jobStory.step];
      if (step?.type === "collect") this.completeJobStoryStep();
    }
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
    // 구역 체인 — 마을 → forest1..10 → kingdom1..10 → … → abyss10 순차 진행
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

  /* ================= 복귀 차원문 (v2.0 — 메이플식 자유 왕복, 지시 #8) ================= */

  /** 이전 구역으로 돌아가는 청록 차원문 — 스폰 지점 왼쪽에 항상 활성 */
  private spawnReturnPortal() {
    const prev = PREV_STAGE[this.stageDef.key];
    if (!prev || !this.player) return;
    const rx = 110;
    const ry = this.stageH * 0.52;
    this.returnPortal = this.physics.add.sprite(rx, ry, "portal0").setDepth(3).setTint(0x54c8ff).setScale(0.92);
    (this.returnPortal.body as Phaser.Physics.Arcade.Body).setSize(30, 40).setOffset(17, 12);
    this.returnPortal.play("portal-spin");
    this.physics.add.overlap(this.player, this.returnPortal, () => {
      if (!this.returnActive || !this.returnPortal?.active) return;
      this.enterPrevStage();
    });
    // 청록 비컨 — 전진 포탈(보라)과 시각 구분
    this.returnBeacon = this.add
      .image(rx, ry - 120, "beam")
      .setDepth(2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.32)
      .setTint(0x54c8ff);
    this.tweens.add({
      targets: this.returnBeacon,
      alpha: { from: 0.22, to: 0.42 },
      duration: 850,
      yoyo: true,
      repeat: -1,
    });
    this.add
      .text(rx, ry - 46, `← ${STAGE_SHORT[prev] ?? "이전 지역"}`, {
        fontFamily: "sans-serif",
        fontSize: "11px",
        color: "#a8ecff",
        stroke: "#0a2030",
        strokeThickness: 4,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.returnActive = true;
  }

  /** 복귀 차원문 진입 — 이전 구역으로 (스탯/진행 캐리는 전진과 동일 경로) */
  private enterPrevStage() {
    if (!this.returnActive) return;
    const prev = PREV_STAGE[this.stageDef.key];
    if (!prev) return;
    this.returnActive = false;
    audio.sfx.portal();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.player.state = "idle";
    this.time.delayedCall(520, () => {
      const carry = this.buildSave(prev);
      writeSave(carry);
      this.scene.restart({ stage: prev, save: carry });
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

    // 건물 3채 (실제 Zelda-like 타일셋 건물, 충돌은 벽 하단만) — v2.0: 전부 기능 있음 (지시 #12)
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
    // 건물 간판 + 기능 상호작용 — 여관(회복+저장), 내 집(무료 휴식), 전직관(카이엔 앞)
    this.addBuildingSign(cx - 400, cy - 236, "여관 — 20G 회복+저장", "#7de8ff");
    this.addBuildingSign(cx + 90, cy - 266, "전직관", "#ffd76a");
    this.addBuildingSign(cx - 190, cy + 149, "내 집 — 무료 휴식", "#9af0c8");
    this.interactables.push({ x: cx - 400, y: cy - 96, kind: "inn", label: "여관 — 20G로 휴식+저장" });
    this.interactables.push({ x: cx - 190, y: cy + 289, kind: "house", label: "내 집 — 휴식하기" });

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

    // 직업 교관 카이엔 (v1.9 — 전직 NPC, E키 상담 후 전직 패널 열림) — 전직관 건물 앞 배치
    const jx = cx + 90;
    const jy = cy - 120;
    const jglow = this.add.image(jx, jy + 14, "glow").setDepth(1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd76a).setScale(0.8).setAlpha(0.22);
    this.tweens.add({ targets: jglow, alpha: 0.4, scale: 1.05, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.jobNpc = this.add.image(jx, jy, "npc_villager1").setDepth(Math.floor(jy / 10)).setScale(1.7).setTint(0xffd76a);
    this.tweens.add({ targets: this.jobNpc, y: jy - 3, duration: 1000, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.add
      .text(jx, jy - 38, "직업 교관 카이엔", {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#ffd76a",
        stroke: "#1a1020",
        strokeThickness: 4,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.interactables.push({ x: jx, y: jy, kind: "job", npcId: "jobmaster", label: "카이엔 교관 — 전직 상담" });
  }

  /** 건물 간판 — 목재 패널 스타일 텍스트 */
  private addBuildingSign(x: number, y: number, label: string, color: string) {
    const pad = 5;
    const t = this.add
      .text(x, y, label, {
        fontFamily: "sans-serif",
        fontSize: "11px",
        color,
        stroke: "#0a1020",
        strokeThickness: 3,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(30);
    const w = t.width + pad * 2;
    const h = t.height + pad * 1.4;
    const bg = this.add
      .rectangle(x, y, w, h, 0x14202e, 0.82)
      .setStrokeStyle(1, 0x3a4a5e, 0.9)
      .setDepth(29);
    t.setDepth(30);
    void bg;
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

  /** 몬스터 사망 드롭 — 골드 코인 + 물약 확률 (v2.0 밸런스: GOLD_DROP_SCALE 적용) */
  dropLoot(x: number, y: number, def: EnemyDef) {
    const base = Phaser.Math.Between(def.gold[0], def.gold[1]);
    const total = Math.max(1, Math.round(base * GOLD_DROP_SCALE));
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

  /** 픽업 처리 (Drop가 접촉 시 호출 — viaPet은 펫 자동 줍기) */
  collectDrop(kind: DropKind, amount: number, x: number, y: number, viaPet = false) {
    if (kind === "gold") {
      // 펫 골드 보너스 (v1.9 BM — 슬라임 +10%, 핑크이 +20%)
      const bonus = this.player.petGoldBonusPct;
      const gold = bonus > 0 ? Math.max(1, Math.round(amount * (1 + bonus / 100))) : amount;
      this.player.addGold(gold);
      audio.sfx.coin();
      this.spawnPickupText(x, y - 14, viaPet ? `+${gold}G (펫)` : `+${gold}G`, "#ffd76a");
    } else if (kind === "potion_hp") {
      this.player.addPotion("hp");
      audio.sfx.pickup();
      this.spawnPickupText(x, y - 14, viaPet ? "+HP 물약 (펫)" : "+HP 물약", "#ff8a8a");
    } else if (kind === "potion_mp") {
      this.player.addPotion("mp");
      audio.sfx.pickup();
      this.spawnPickupText(x, y - 14, viaPet ? "+MP 물약 (펫)" : "+MP 물약", "#7dc0ff");
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
    if (this.eliteEnemy && !this.eliteEnemy.alive) this.eliteEnemy = null;
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
      } else if (q.targetKey === key) {
        // v2.0 수정 (지시 #17) — 퀘스트 대상 몬스터만 카운트 (엉뚱한 몬스터 오카운트 차단)
        this.huntCount = Math.min((this.killTotals[key] ?? 0) - (this.huntBaseline[key] ?? 0), q.need ?? 0);
        this.tryCompleteHunt(key);
      }
    }
    // 전직 스토리 토벌/시험 단계 (지시 #13)
    if (this.jobStory) {
      const story = this.jobStoryDef();
      const step = story?.steps[this.jobStory.step];
      if (story && step) {
        if (step.type === "hunt") {
          this.jobStory.hunt++;
          if (this.jobStory.hunt >= (step.need ?? 0)) this.completeJobStoryStep();
        } else if (step.type === "elite" && this.jobEliteSummoned && this.eliteEnemy === null) {
          // 소환된 시험 상대 처치 → 단계 완료
          this.completeJobStoryStep();
        }
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
   * v2.0 — 퀘스트 시작 이후의 킬만 카운트 (huntBaseline) → 이전 킬이 한꺼번에 채워지는 버그 차단.
   */
  private tryCompleteHunt(_key: EnemyKey) {
    const q = this.currentQuest();
    if (!q || q.type !== "hunt") return;
    const progress = (this.killTotals[_key] ?? 0) - (this.huntBaseline[_key] ?? 0);
    if (progress < (q.need ?? 0)) return;
    this.huntCount = Math.min(progress, q.need ?? 0);
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
    if (q.type === "hunt" && q.targetKey && !(q.targetKey in this.huntBaseline)) {
      // 토벌 퀘스트 시작 기준선 — 시작 이후 킬만 진행 (지시 #17)
      this.huntBaseline[q.targetKey] = this.killTotals[q.targetKey] ?? 0;
    }
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
    const base = BOSS_DEFS[this.stageDef.bossKey ?? "guardian"];
    // v2.0 밸런스 — 챕터 보스는 구역 진행 배율만큼 강화 (지시 #6: 보스 체력 상향)
    const sc = stageScale(this.stageDef.key);
    const def: BossDef = {
      ...base,
      hp: Math.round(base.hp * Math.max(1, sc.hp * 0.9)),
      atk: Math.round(base.atk * Math.max(1, sc.atk * 0.9)),
      exp: Math.round(base.exp * sc.exp),
      gold: Math.round(base.gold * sc.gold),
    };
    this.bossDef = def;
    const bx = this.stageW * 0.6;
    const by = this.stageH * 0.35;
    audio.sfx.roar();
    this.cameras.main.shake(260, 0.008);
    this.showBanner(`${def.name} 출현!`);
    this.boss = new Boss(this, bx, by, def);
    this.physics.add.collider(this.boss, this.solidGroup);
    EventBus.emit("boss:show", { name: def.name, hp: this.boss.hp, maxHp: this.boss.maxHp });
    // 파티 보스 토벌 공지 (v2.0 — 지시 #5)
    net.netAnnounceBoss(def.name, STAGE_SHORT[this.stageDef.key] ?? this.stageDef.key);
    // 보스전 전용 BGM (v2.0)
    audio.playBGM("boss");
    // 등장 대사 — 이어하기 복구 경로는 생략 (오프닝 대사와 충돌 방지)
    if (intro) this.showDialogue(def.introDialogue);
  }

  onBossDead() {
    const def = this.bossDef;
    audio.sfx.bossDie();
    // v2.0 수정 (지시 #7) — 보스전 종료 후 BGM이 멈추는 버그:
    // stopBGM 대신 1.4초 후 스테이지 테마 BGM으로 자연 전환
    this.time.delayedCall(1400, () => audio.playBGM(audio.stageBgm(this.stageDef.key)));
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
    audio.playBGM(this.boss ? "boss" : audio.stageBgm(this.stageDef.key));
  }

  /* ================= 입력 ================= */

  private setupInput() {
    const kb = this.input.keyboard!;
    // v1.9 키 매핑 — 모든 배정 가능 키를 미리 등록해 두고 keymap에서 조회
    // (재배치 시 키 재등록 불필요, 이동 W/A/S/D + 화살표는 고정)
    const allKeys =
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,Q,E,R,T,Y,U,I,O,P,F,G,H,J,K,L,V,B,N,M,Z,X,C";
    const raw = kb.addKeys(allKeys) as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys = raw;
    for (const letter of allKeys.split(",")) {
      if (letter.length === 1) this.keyObjs[letter] = raw[letter];
    }

    const onMove = (v: { x: number; y: number }) => this.touchMove.set(v.x, v.y);
    const onAtk = () => (this.attackQueued = true);
    const onS1 = () => this.player?.useSkill1();
    const onS2 = () => this.player?.useSkill2();
    const onRespawn = () => this.respawnPlayer();
    const onDialogueDone = () => this.resumeFromDialogue();
    const onInteract = () => this.tryInteract();
    const onKeymapChanged = (m: KeyMap) => {
      this.keymap = m;
    };
    const onNameSet = (v: { name: string }) => {
      if (this.introStep === 2) this.finishIntro(v.name);
    };
    const onBuy = (v: { key: ItemKey }) => {
      if (!this.player || this.dialoguing) return;
      if (this.player.buy(v.key)) {
        audio.sfx.questDone();
        // BM 즉시 반영 — 펫 구매 시 스프라이트 교체, 치장 구매 시 오라 교체 (v1.9)
        const kind = ITEMS[v.key]?.kind;
        if (kind === "pet") this.syncPet();
        else if (kind === "cosmetic") this.syncCosmeticAura();
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
    const onUseBuff = (v: { key: BuffKey }) => {
      if (!this.player || this.dialoguing) return;
      this.player.useBuffItem(v.key);
      this.save();
      this.emitRpgState();
    };
    const onAllocate = (v: { stat: "str" | "dex" | "int" | "luk"; n: number }) => {
      if (!this.player || this.dialoguing) return;
      if (this.player.allocateStat(v.stat, v.n)) this.save();
      this.emitRpgState();
      this.emitHud();
    };
    const onPetSet = (v: { key: PetKey | null }) => {
      if (!this.player || this.dialoguing) return;
      if (this.player.setPet(v.key)) this.save();
      this.emitRpgState();
    };
    const onCosmeticSet = (v: { key: CosmeticKey | null }) => {
      if (!this.player || this.dialoguing) return;
      if (this.player.setCosmetic(v.key)) this.save();
      this.emitRpgState();
    };
    const onUpgrade = (v: { slot: "weapon" | "armor" }) => {
      if (!this.player || this.dialoguing) return;
      this.player.tryUpgrade(v.slot);
      this.syncUpgradeGlow(); // 강화 오라 갱신 (+4 이상)
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
    // 전직/승격 선택 (JobPanel → v1.8 다차원 트리)
    const onJobSelect = (v: { key: string }) => {
      if (!this.player || this.player.state === "dead") return;
      if (this.dialoguing) {
        EventBus.emit("banner:show", { text: "대화 중에는 전직할 수 없습니다" });
        return;
      }
      const def = classDef(v.key);
      if (!def) return;
      const need = nextJobLevel(this.player.cls);
      if (need === null) {
        EventBus.emit("banner:show", { text: "이미 최종 전직 완료 — 자유 전직을 이용하세요" });
        return;
      }
      if (this.player.lv < need) {
        EventBus.emit("banner:show", { text: `전직은 Lv ${need}부터 가능합니다` });
        return;
      }
      if (!this.player.applyClass(def.key)) return;
      audio.sfx.levelup();
      this.spawnLevelUpFx(this.player.x, this.player.y);
      EventBus.emit("banner:show", { text: `전직 완료! ${def.name} — ${def.title}` });
      this.refreshPlayerTag();
      this.save();
      this.emitHud();
      this.emitRpgState();
      net.netAnnounceJob(def.key);
    };

    // 자유 전직 (v1.8 — 메이플 자유전직 재현: 같은 계열 내 반대 경로, 골드 소모)
    const onJobSwitch = (v: { key: string }) => {
      if (!this.player || this.player.state === "dead") return;
      if (this.dialoguing) {
        EventBus.emit("banner:show", { text: "대화 중에는 전직할 수 없습니다" });
        return;
      }
      const alt = freeJobOption(this.player.cls);
      if (!alt || alt.key !== v.key) return;
      if (this.player.gold < FREE_JOB_COST) {
        EventBus.emit("banner:show", { text: `자유 전직에는 ${FREE_JOB_COST}G가 필요합니다` });
        return;
      }
      if (!this.player.switchClass(alt.key)) return;
      this.player.gold -= FREE_JOB_COST;
      EventBus.emit("banner:show", { text: `자유 전직! ${alt.name} — ${alt.title} (-${FREE_JOB_COST}G)` });
      audio.sfx.levelup();
      this.refreshPlayerTag();
      this.save();
      this.emitHud();
      this.emitRpgState();
      net.netAnnounceJob(alt.key);
    };

    // 친구 따라가기 (v2.1 — 친구가 접속 중인 구역으로 즉시 이동)
    const onFriendGoto = (v: { stage: string }) => {
      if (!this.player || this.player.state === "dead") return;
      const target = resolveStage(String(v?.stage || ""));
      if (!target || target === this.stageDef.key) return;
      this.cameras.main.fadeOut(420, 0, 0, 0);
      this.player.state = "idle";
      this.time.delayedCall(440, () => {
        const carry = this.buildSave(target);
        writeSave(carry);
        this.scene.restart({ stage: target, save: carry });
      });
    };

    EventBus.on("input:move", onMove);
    EventBus.on("input:attack", onAtk);
    EventBus.on("input:skill1", onS1);
    EventBus.on("input:skill2", onS2);
    EventBus.on("input:interact", onInteract);
    EventBus.on("name:set", onNameSet);
    EventBus.on("keymap:changed", onKeymapChanged);
    EventBus.on("rpg:buy", onBuy);
    EventBus.on("rpg:equip", onEquip);
    EventBus.on("rpg:use", onUse);
    EventBus.on("rpg:useBuff", onUseBuff);
    EventBus.on("rpg:allocate", onAllocate);
    EventBus.on("rpg:pet", onPetSet);
    EventBus.on("rpg:cosmetic", onCosmeticSet);
    EventBus.on("rpg:upgrade", onUpgrade);
    EventBus.on("respawn", onRespawn);
    EventBus.on("dialogue:done", onDialogueDone);
    EventBus.on("chat:focus", onChatFocus);
    EventBus.on("chat:send", onChatSend);
    EventBus.on("job:select", onJobSelect);
    EventBus.on("job:switch", onJobSwitch);
    EventBus.on("friend:goto", onFriendGoto);
    this.events.once("shutdown", () => {
      EventBus.off("input:move", onMove);
      EventBus.off("input:attack", onAtk);
      EventBus.off("input:skill1", onS1);
      EventBus.off("input:skill2", onS2);
      EventBus.off("input:interact", onInteract);
      EventBus.off("name:set", onNameSet);
      EventBus.off("keymap:changed", onKeymapChanged);
      EventBus.off("rpg:buy", onBuy);
      EventBus.off("rpg:equip", onEquip);
      EventBus.off("rpg:use", onUse);
      EventBus.off("rpg:useBuff", onUseBuff);
      EventBus.off("rpg:allocate", onAllocate);
      EventBus.off("rpg:pet", onPetSet);
      EventBus.off("rpg:cosmetic", onCosmeticSet);
      EventBus.off("rpg:upgrade", onUpgrade);
      EventBus.off("respawn", onRespawn);
      EventBus.off("dialogue:done", onDialogueDone);
      EventBus.off("chat:focus", onChatFocus);
      EventBus.off("chat:send", onChatSend);
      EventBus.off("job:select", onJobSelect);
      EventBus.off("job:switch", onJobSwitch);
      EventBus.off("friend:goto", onFriendGoto);
    });
  }

  /** 액션에 배정된 키 객체 (키 매핑 v1.9) */
  private keyFor(a: GameAction): Phaser.Input.Keyboard.Key {
    return this.keyObjs[this.keymap[a]] ?? this.keys[this.keymap[a]];
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

    // 플레이어 투사체 진행/판정 — 대화/채팅 중에도 날아가는 것은 계속 (v1.8)
    this.tickPlayerProjs(dt);

    // 채팅 입력 중 — 게임 키/이동 완전 차단 (원격 보간은 위에서 계속)
    if (this.chatFocused || this.dialoguing || !this.player) return;
    if (this.player.state === "dead") return;

    this.wellCd = Math.max(0, this.wellCd - dt);
    this.restCd = Math.max(0, this.restCd - dt);

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

    // 키보드 이동 (v2.0 — 지시 #16: 같은 축 방향키 동시 입력 시 마지막으로 누른 키 우선)
    const mv = this.resolveDirVec();
    if (mv.lengthSq() > 0) mv.normalize();

    // 터치 우선
    const useTouch = this.touchMove.lengthSq() > 0.01;
    const move = useTouch ? this.touchMove : mv;

    // 키보드 공격/스킬 — 이동은 WASD+화살표 고정, 액션 키는 키 매핑 따름 (v1.9)
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keyFor("attack")))
      this.attackQueued = true;
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("skill1"))) this.player.useSkill1();
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("skill2"))) this.player.useSkill2();

    this.player.update(dt, move, this.attackQueued);
    this.attackQueued = false;

    // 물약 퀵슬롯 + 상점/패널 열기 + E키 상호작용 (v1.9 — 모두 키 매핑 대응)
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("potHp"))) this.player.usePotion("hp");
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("potMp"))) this.player.usePotion("mp");
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("interact"))) this.tryInteract();
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("shop")) && this.nearShop) EventBus.emit("ui:panel", { panel: "shop" });
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("bag"))) EventBus.emit("ui:panel", { panel: "inv" });
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("job"))) EventBus.emit("ui:panel", { panel: "job" });
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("stat"))) EventBus.emit("ui:panel", { panel: "stat" });
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("quest"))) EventBus.emit("ui:panel", { panel: "quest" });
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("opt"))) EventBus.emit("ui:panel", { panel: "opt" });

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

    // 드롭 아이템 (자석/픽업) — 펫이 소환 중이면 근처 드롭을 펫이 직접 줍는다 (v1.9)
    for (const d of this.drops) {
      if (!d.active) continue;
      d.tick(dt, this.player.x, this.player.y);
      if (d.active && this.pet && Phaser.Math.Distance.Between(d.x, d.y, this.pet.x, this.pet.y) < 26) {
        this.collectDrop(d.kind, d.amount, d.x, d.y, true);
        d.release();
      }
    }
    // 펫 추적 — 드롭이 있으면 그쪽으로 헤엄침
    this.pet?.tick(dt, this.player.x, this.player.y);

    // 추적 오브젝트 (치장 오라/강화 오라) 위치 갱신
    if (this.cosmeticAura) this.cosmeticAura.setPosition(this.player.x, this.player.y - 8);
    if (this.upgradeGlow) this.upgradeGlow.setPosition(this.player.x, this.player.y - 10);

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
        stage: this.stageDef.key,
      });
    }
  }

  /** 방향키 우선순위 결정 — 같은 축에서 마지막으로 누른 키가 이김 (지시 #16)
   *  예: ← 를 누른 채 → 를 누르면 → 로 이동, → 를 떼면 다시 ← 로 이동 */
  private resolveDirVec(): Phaser.Math.Vector2 {
    const mv = new Phaser.Math.Vector2(0, 0);
    // 입력 순서 스택 갱신
    const track = (key: string, axis: "x" | "y", dir: number) => {
      const k = this.keys[key];
      if (!k) return;
      const stack = this.dirOrder[axis];
      if (Phaser.Input.Keyboard.JustDown(k)) {
        const i = stack.indexOf(key);
        if (i >= 0) stack.splice(i, 1);
        stack.push(key);
      } else if (!k.isDown && stack.includes(key)) {
        stack.splice(stack.indexOf(key), 1);
      }
      void dir;
    };
    track("A", "x", -1); track("LEFT", "x", -1); track("D", "x", 1); track("RIGHT", "x", 1);
    track("W", "y", -1); track("UP", "y", -1); track("S", "y", 1); track("DOWN", "y", 1);
    const lastX = this.dirOrder.x[this.dirOrder.x.length - 1];
    const lastY = this.dirOrder.y[this.dirOrder.y.length - 1];
    if (lastX === "A" || lastX === "LEFT") mv.x = -1;
    else if (lastX === "D" || lastX === "RIGHT") mv.x = 1;
    if (lastY === "W" || lastY === "UP") mv.y = -1;
    else if (lastY === "S" || lastY === "DOWN") mv.y = 1;
    return mv;
  }

  currentMoveVec() {
    return this.touchMove.lengthSq() > 0.01 ? this.touchMove.clone() : new Phaser.Math.Vector2();
  }

  /* ================= 멀티플레이 (v1.7) ================= */

  /** 같은 서버에 접속한 다른 플레이어 실시간 동기화 — 오프라인이면 조용히 생략 */
  private initNet() {
    try {
      const s = net.netConnect();
      if (!s) {
        // APK 오프라인 모드 — 멀티 사용법을 한 번만 안내 (v2.1)
        if (net.netStatus().native) {
          this.time.delayedCall(1100, () => this.showBanner("오프라인 모드 — 타이틀 화면 우하단에서 서버 연결 시 멀티플레이"));
        }
        return;
      }
      const offPlayers = net.netOnPlayers((list) => this.syncRemotes(list));
      const offChat = net.netOnChat((m) => EventBus.emit("chat:msg", m));
      const offFriends = net.netOnFriends((list) => EventBus.emit("friends:online", list));
      this.netOffs = [offPlayers, offChat, offFriends];
      this.events.once("shutdown", () => this.shutdownNet());
      // 소켓 연결 안정화 후 입장 방송 (v2.0 — netJoin이 connect 전이면 대기열 후 자동 발송)
      this.time.delayedCall(650, () => {
        if (!this.player) return;
        net.netJoin({
          name: getPlayerName(),
          lv: this.player.lv,
          cls: this.player.cls,
          x: Math.round(this.player.x),
          y: Math.round(this.player.y),
          stage: this.stageDef.key,
          code: getFcode(), // v2.1 친구 고유번호
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

  /* ================= 플레이어 투사체 (v1.8) ================= */

  /** 궁수 화살 / 마법사 볼트 발사 — 보스 orb 풀 패턴 재사용 (물리 velocity + 수동 판정) */
  firePlayerProj(cfg: {
    x: number;
    y: number;
    angle: number;
    speed: number;
    /** 관통 가능 적 수 (1 = 단일 대상) */
    pierce: number;
    dmg: number;
    crit: boolean;
    tint: number;
    knock: number;
    scale?: number;
  }) {
    if (this.pProjPool.length === 0) {
      for (let i = 0; i < 24; i++) {
        const p = this.physics.add.image(0, 0, "orb");
        p.setBlendMode(Phaser.BlendModes.ADD).setDepth(12);
        p.setActive(false).setVisible(false);
        (p.body as Phaser.Physics.Arcade.Body).setCircle(6);
        this.pProjPool.push(p);
      }
    }
    const p = this.pProjPool[this.pProjIdx];
    this.pProjIdx = (this.pProjIdx + 1) % this.pProjPool.length;
    p.enableBody(true, cfg.x, cfg.y, true, true);
    this.physics.velocityFromRotation(cfg.angle, cfg.speed, p.body!.velocity);
    p.setTint(cfg.tint).setScale(cfg.scale ?? 0.9).setAlpha(0.95);
    p.setRotation(cfg.angle);
    p.setData("dmg", cfg.dmg);
    p.setData("crit", cfg.crit);
    p.setData("pierce", cfg.pierce);
    p.setData("knock", cfg.knock);
    p.setData("tint", cfg.tint);
    p.setData("life", 1700);
  }

  /** 투사체 진행 — 수명 감소 + 적 원판 판정(관통 소모) + 회수 */
  private tickPlayerProjs(dt: number) {
    if (this.pProjPool.length === 0) return;
    for (const p of this.pProjPool) {
      if (!p.active) continue;
      const life = (p.getData("life") as number) - dt;
      if (life <= 0) {
        p.disableBody(true, true);
        continue;
      }
      p.setData("life", life);
      const vel = p.body!.velocity;
      const dir = new Phaser.Math.Vector2(vel.x, vel.y).normalize();
      for (const e of this.getAllTargets()) {
        let pierce = p.getData("pierce") as number;
        if (pierce <= 0) break;
        if (!e.active) continue;
        if (Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) <= 28) {
          pierce--;
          p.setData("pierce", pierce);
          e.takeDamage(
            p.getData("dmg") as number,
            dir,
            p.getData("knock") as number,
            p.getData("crit") as boolean
          );
          this.onMeleeConnect(1, "skill");
          this.spawnBurstAt(p.x, p.y, 4, (p.getData("tint") as number) ?? 0xffffff);
          if (pierce <= 0) {
            p.disableBody(true, true);
            break;
          }
        }
      }
    }
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
      ? { active: true, label: best.label, kind: best.kind === "inn" || best.kind === "house" ? "talk" : best.kind, x: best.x, y: best.y }
      : { active: false, label: "", kind: null };
    EventBus.emit("ui:interact", payload);
    this.syncEBubble();
  }

  /* E 말풍선 — NPC 이름표 위(위쪽)에 배치 (지시 #14: 이름과 겹침 해소) */
  private syncEBubble() {
    const it = this.nearInteract;
    if (!it) {
      if (this.eBubble) { this.eBubble.destroy(); this.eBubble = null; }
      if (this.eBubbleText) { this.eBubbleText.destroy(); this.eBubbleText = null; }
      return;
    }
    if (!this.eBubble) {
      this.eBubble = this.add.circle(0, 0, 11, 0x0f2233).setStrokeStyle(2, 0x7de8ff, 0.95).setDepth(61);
      this.eBubbleText = this.add
        .text(0, 0, "E", {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#7de8ff",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(62);
      this.tweens.add({ targets: this.eBubble, y: "-=4", duration: 620, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    }
    // 이름표(-34~38)보다 충분히 위 — 겹침 없음
    const bx = it.x;
    const by = it.y - 58;
    this.eBubble.setPosition(bx, by);
    this.eBubbleText?.setPosition(bx, by);
  }
  /** E키/모바일 버튼 — 가까운 NPC 대화 시작, 전직 상담, 여관/집 휴식, 상점 열기 */
  tryInteract() {
    if (this.dialoguing || !this.player || this.player.state === "dead") return;
    const it = this.nearInteract;
    if (!it) return;
    if (it.kind === "shop") {
      EventBus.emit("ui:panel", { panel: "shop" });
    } else if (it.kind === "job") {
      // 전직 교관 — 상담 대사 후 전직 패널 자동 오픈 (v1.9)
      this.showDialogue("jobMaster", "jobmaster");
    } else if (it.kind === "inn") {
      this.restAtInn();
    } else if (it.kind === "house") {
      this.restAtHouse();
    } else if (it.kind === "talk" && it.dlg) {
      this.showDialogue(it.dlg, it.npcId ?? null);
    }
  }

  /* 여관 — 20G로 풀회복 + 저장 (v2.0 지시 #12) */
  private restAtInn() {
    if (this.restCd > 0) return;
    if (this.player.gold < 20) {
      this.showBanner("여관 숙박비 20G가 필요합니다");
      return;
    }
    this.player.gold -= 20;
    this.restCd = 2500;
    this.player.healFull();
    this.save();
    this.cameras.main.fadeOut(420, 0, 0, 0);
    this.time.delayedCall(460, () => {
      this.cameras.main.fadeIn(500, 0, 0, 0);
      this.spawnPickupText(this.player.x, this.player.y - 40, "푹 쉬었다! 저장 완료", "#7de8ff");
      this.spawnBurstAt(this.player.x, this.player.y, 10, 0x7de8ff);
    });
    this.emitRpgState();
    this.emitHud();
  }

  /* 내 집 — 무료 휴식 (풀회복, 2.5초 쿨다운) */
  private restAtHouse() {
    if (this.restCd > 0) return;
    this.restCd = 2500;
    this.player.healFull();
    this.spawnPickupText(this.player.x, this.player.y - 40, "집에서 휴식! 완전히 회복", "#9af0c8");
    this.spawnBurstAt(this.player.x, this.player.y, 8, 0x9af0c8);
    this.sfxPotion();
  }

  /* ================= 전직 스토리 (v2.0 — 지시 #13) ================= */

  /** 현재 진행 가능한 전직 스토리 정의 (클래스 계열 기준) */
  jobStoryDef(): JobStoryDef | null {
    const fam = familyOf(this.player.cls ?? "");
    if (!fam) return null;
    return JOBSTORY[fam][this.jobStory?.tier ?? 2] ?? null;
  }

  /** 전직 스토리 시작 — 카이엔 대화 후 (resumeFromDialogue에서 호출) */
  private maybeStartJobStory() {
    if (!this.player) return;
    const fam = familyOf(this.player.cls ?? "");
    if (!fam) return;
    const tier = chainOf(this.player.cls).length; // 0=미전직, 1=1차, 2=2차, 3=3차
    if (tier < 2) return;
    const t = tier as 2 | 3;
    if (this.jobStoryDone.includes(t)) return;
    if (this.jobStory && this.jobStory.tier === t) return;
    // 이전 티어 스토리 먼저 완료해야 다음 티어 진행
    if (t === 3 && !this.jobStoryDone.includes(2)) return;
    this.jobStory = { tier: t, step: 0, hunt: 0 };
    const story = JOBSTORY[fam][t];
    this.showDialogue(story.startDialogue);
    this.showBanner(`전직 스토리 시작 — ${story.title}`);
    audio.sfx.questDone();
  }

  /** 전직 스토리 단계 완료 — 보상 지급 + 다음 단계 대사 */
  private completeJobStoryStep() {
    if (!this.jobStory || !this.player) return;
    const story = this.jobStoryDef();
    if (!story) return;
    const step = story.steps[this.jobStory.step];
    if (!step) return;
    this.player.addGold(step.reward);
    this.player.gainExp(step.expReward);
    audio.sfx.questDone();
    this.spawnPickupText(this.player.x, this.player.y - 44, `스토리 보상 +${step.reward}G`, "#ffd76a");
    this.jobStory.step++;
    this.jobStory.hunt = 0;
    this.jobEliteSummoned = false;
    if (this.jobStory.step >= story.steps.length) {
      // 전체 완료 — 최종 보상
      this.player.addGold(story.reward.gold);
      this.player.ap += story.reward.ap;
      this.jobStoryDone.push(this.jobStory.tier);
      this.jobStory = null;
      this.showDialogue(story.doneDialogue);
      this.showBanner(`전직 스토리 완료! AP +${story.reward.ap}`);
      this.emitRpgState();
    } else {
      this.showDialogue(step.dialogue);
      const next = story.steps[this.jobStory.step];
      if (next?.type === "elite") this.showBanner("카이엔에게 말 걸어 시험 상대 소환");
    }
    this.save();
    this.emitRpgState();
  }

  /** 전직 스토리 elite 단계 — 카이엔 근처에 시험 상대 소환 */
  private summonJobElite() {
    if (!this.jobStory || !this.player) return;
    if (this.jobStoryDef()?.steps[this.jobStory.step]?.type !== "elite") return;
    if (this.eliteEnemy && this.eliteEnemy.alive) {
      this.showBanner("이미 시험 상대가 있어!");
      return;
    }
    const lv = this.player.lv;
    const e = new Enemy(this, this.player.x + 90, this.player.y - 40, "golem", {
      hp: 6 + lv * 2.2,
      atk: 1 + lv * 0.16,
      exp: 3 * lv,
      gold: 2 * lv,
      scale: 1.5,
      tint: 0xb08aff,
      displayName: "시험 상대 — 룬 제령",
    });
    this.eliteEnemy = e;
    this.jobEliteSummoned = true;
    this.enemies.push(e);
    this.physics.add.collider(e, this.solidGroup);
    this.showBanner("시험 상대 출현!");
    audio.sfx.roar();
    this.cameras.main.shake(220, 0.006);
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
   *  0) 이동 학습 — 아부디토스의 안내로 실제로 걸어보기
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
    // 아부디토스 가이드가 플레이어를 따라다님
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
        this.showBanner("펜던트의 정령 아부디토스: 마을 우물로 와! 네 이름을 정해 주고 싶어!");
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

  /* ================= BM (v1.9 — 펫/치장/강화 오라) ================= */

  /** 펫 기준 가장 가까운 활성 드롭 (Pet.tick 목표 탐색) */
  nearestDrop(x: number, y: number, range: number): Drop | null {
    let best: Drop | null = null;
    let bd = range;
    for (const d of this.drops) {
      if (!d.active) continue;
      const dist = Phaser.Math.Distance.Between(x, y, d.x, d.y);
      if (dist < bd) {
        bd = dist;
        best = d;
      }
    }
    return best;
  }

  /** 펫 소환 상태 동기화 — 가방/상점에서 변경 시 호출 */
  onPetChanged() {
    this.syncPet();
    this.save();
  }

  private syncPet() {
    if (this.pet) {
      this.pet.destroy();
      this.pet = null;
    }
    if (this.player?.pet) {
      this.pet = new Pet(this, this.player.pet, this.player.x + 26, this.player.y + 6);
    }
  }

  /** 치장 착용 상태 동기화 — 오라/날개 입자 갱신 */
  onCosmeticChanged() {
    this.syncCosmeticAura();
    this.save();
  }

  private syncCosmeticAura() {
    this.cosmeticAura?.destroy();
    this.cosmeticAura = null;
    this.cosmeticEmitter?.destroy();
    this.cosmeticEmitter = null;
    const key = this.player?.cosmetic;
    if (!key) return;
    if (key === "cos_wings") {
      // 요정 날개 — 플레이어 주위 반짝임 입자 트레일
      this.cosmeticEmitter = this.add.particles(0, 0, "sparkle0", {
        lifespan: 620,
        speedY: { min: -26, max: -10 },
        speedX: { min: -14, max: 14 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.9, end: 0 },
        frequency: 90,
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(11);
      this.cosmeticEmitter.startFollow(this.player);
    } else {
      // 오라 계열 — 플레이어 뒤 은은한 후광 (tint는 치장 정의)
      this.cosmeticAura = this.add
        .image(this.player.x, this.player.y - 8, "glow")
        .setDepth(9)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(COSMETIC_DEFS[key].tint)
        .setScale(1.7)
        .setAlpha(0.26);
      this.tweens.add({
        targets: this.cosmeticAura,
        alpha: 0.44,
        scale: 2.0,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    }
  }

  /** 강화 오라 — 무기 +4 이상이면 금빛 글로우가 플레이어를 따라다님 (강화 효과 가시화) */
  private syncUpgradeGlow() {
    const up = this.player?.upgrades.weapon ?? 0;
    if (up >= 4 && !this.upgradeGlow && this.player) {
      this.upgradeGlow = this.add
        .image(this.player.x, this.player.y - 10, "glow")
        .setDepth(9)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffd76a)
        .setScale(1.35)
        .setAlpha(0.3);
      this.tweens.add({
        targets: this.upgradeGlow,
        alpha: 0.5,
        scale: 1.55,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    } else if (up < 4 && this.upgradeGlow) {
      this.upgradeGlow.destroy();
      this.upgradeGlow = null;
    }
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
    // 인트로 시퀀스 중 — 아부디토스의 안내를 퀘스트 패널에 표시
    if (this.introStep >= 0 && this.introStep < 3) {
      EventBus.emit("quest", {
        title: "펜던트의 정령 아부디토스의 안내",
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
      s1Max: this.player.skill1MaxEff,
      s2Cd: Math.round(this.player.skill2Cd),
      s2Max: this.player.skill2MaxEff,
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
      /* v1.9 — 버프 바 + AP 배지 + 속도 */
      buffs: this.player.buffs.map((b) => ({ key: b.key, remain: b.remain, total: b.total })),
      ap: this.player.ap,
      speed: this.player.speed,
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
      cls: this.player.cls,
      canJob: canJobNow(this.player.lv, this.player.cls),
      /* v1.9 BM + 스탯 */
      buffItems: { ...this.player.buffItems } as Record<string, number>,
      pets: [...this.player.pets],
      pet: this.player.pet,
      cosmetics: [...this.player.cosmetics],
      cosmetic: this.player.cosmetic,
      stats: { ...this.player.stats },
      ap: this.player.ap,
    };
    const sig = JSON.stringify(st);
    if (sig === this.lastRpgSig) return;
    this.lastRpgSig = sig;
    EventBus.emit("rpg:state", st);
  }

  /** 퀘스트 로그 (J) — 스테이지 메인 체인 전체 진행 상황 */
  emitQuestLog() {
    if (!this.player) return;
    const list = this.stageDef.quests.map((q, i) => ({
      title: q.title,
      desc: q.desc,
      state: (i < this.questIdx ? "done" : i === this.questIdx ? "active" : "locked") as
        | "done"
        | "active"
        | "locked",
    }));
    const r = this.stageDef.repeat;
    const payload: QuestLogState = {
      stageName: `${this.stageDef.name} — ${this.stageDef.subtitle}`,
      list,
      repeat: r ? { title: r.title, desc: r.desc } : null,
    };
    EventBus.emit("questlog", payload);
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
      maxMp: this.player.maxMp,
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
      playerName: getPlayerName(),
      /* v1.9 — AP 스탯 + BM */
      stats: { ...this.player.stats },
      ap: this.player.ap,
      buffItems: { ...this.player.buffItems } as Record<string, number>,
      buffs: this.player.buffs.map((b) => ({ key: b.key, remain: Math.round(b.remain), total: b.total })),
      pets: [...this.player.pets],
      pet: this.player.pet,
      cosmetics: [...this.player.cosmetics],
      cosmetic: this.player.cosmetic,
      /* v2.0 — 전직 스토리 진행 */
      jobStory: this.jobStory ? { ...this.jobStory } : null,
      jobStoryDone: [...this.jobStoryDone],
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
    // 주민 대화 종료 → talk 퀘스트 진행 (전직 교관은 퀘스트 카운트 제외)
    if (this.activeNpcId) {
      const npc = this.activeNpcId;
      this.activeNpcId = null;
      if (npc === "jobmaster") {
        // 전직 스토리 elite 단계 — 시험 상대 소환 (지시 #13)
        const step = this.jobStory ? this.jobStoryDef()?.steps[this.jobStory.step] : null;
        if (step?.type === "elite") {
          this.summonJobElite();
        } else if (familyOf(this.player?.cls ?? "") && chainOf(this.player?.cls ?? "").length >= 2 && !this.jobStory && !this.jobStoryDone.includes(chainOf(this.player?.cls ?? "").length as 2 | 3)) {
          // 전직 후 미진행 스토리 → 스토리 시작 (패널 오픈보다 먼저)
          this.maybeStartJobStory();
          // 스토리가 시작되지 않았으면 패널 오픈 (완료/조건 미달)
          if (!this.jobStory) {
            this.time.delayedCall(120, () => EventBus.emit("ui:panel", { panel: "job" }));
          }
        } else {
          // 전직 상담 종료 → 전직 패널 자동 오픈 (v1.9 전직 NPC)
          this.time.delayedCall(120, () => EventBus.emit("ui:panel", { panel: "job" }));
        }
      } else {
        this.onNpcTalked(npc);
      }
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
