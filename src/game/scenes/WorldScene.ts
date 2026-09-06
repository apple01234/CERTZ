import Phaser from "phaser";
import { DMG_PCT, BM_STOCK, STAGES, DIALOGUES, ITEMS, SHOP_STOCK, NEXT_STAGE, PREV_STAGE, STAGE_SHORT, STAGE_THEME, BOSS_DEFS, BOSS_DIFFS, BOSS_DIFF_ORDER, BOSS_DROP_ITEMS, ENEMIES, BUFF_DEFS, PET_DEFS, COSMETIC_DEFS, GOLD_DROP_SCALE, stageScale, stageIntro, resolveStage, chapterSpec, parseStage, JOBSTORY, CHAPTER_VILLAGE_NPC, starTier, STAR_TIER_COLORS, TRADE_PRICES, tradeValue, POT_GRADE_META, potLineText, SET_GEAR, FRAGMENT_META, FRAGMENT_CHAPTERS, type StageKey, type StageDef, type ItemKey, type EnemyDef, type EnemyKey, type BossDef, type QuestDef, type BuffKey, type PetKey, type CosmeticKey, type JobStoryDef, type BossDiffKey } from "../data";
import { familyOf, isClassKey, classLabel, SKILL_ICONS, type FamilyKey } from "../classes";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { Boss } from "../entities/Boss";
import { Drop, type DropKind } from "../entities/Drop";
import { Pet } from "../entities/Pet";
import { EventBus, type QuestState, type InteractState, type QuestLogState, type RewardPopupState } from "../../components/game/EventBus";
import { writeSave, loadSave, getFcode, type SaveData, setPlayerName, getPlayerName } from "../config";
import { loadKeyMap, type KeyMap, type GameAction } from "../keymap";
import {
  classDef, canJobNow, nextJobLevel, freeJobOption, FREE_JOB_COST, chainOf, FIFTH_LEVEL,
  type ClassKey,
} from "../classes";
import * as net from "../net";
import { viewZoom } from "../PhaserGame";
import { ImpactFX, type ImpactKind } from "../fx/ImpactFX";
import * as audio from "../audio";
import {
  generateRoomLayout, cellIndexOf, cellCenterOf, isOpenXY, nextStepToward,
  type RoomLayout,
} from "../mapgen";

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
  /* v2.6 — 육식 식물 위험 오브젝트 (오버랩은 플레이어 생성 후 등록) */
  private plantHazards: Phaser.GameObjects.Image[] = [];
  private plantCd = 0;
  private beacon: Phaser.GameObjects.Image | null = null;
  private portalBeacon: Phaser.GameObjects.Image | null = null;
  /* v3.0 (사용자 지시 #7) — 아이작/개미굴식 구역 레이아웃 (필드 전용, 마을·실내는 null) */
  private layout: RoomLayout | null = null;
  /** 전진 차원문/보스가 놓이는 최원거리 셀 중심 (포탈 보루 폴백 위치로도 사용) */
  private portalHome = new Phaser.Math.Vector2(0, 0);
  /** 입구 셀 중심 — 플레이어 스폰/복귀 차원문 기준점 */
  private entryHome = new Phaser.Math.Vector2(0, 0);
  private edgeArrow: Phaser.GameObjects.Image | null = null;
  private edgeLabel: Phaser.GameObjects.Text | null = null;
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
  /* v3.0.8 디자인 개편 — Warped Shooting Fx 히트 플립북 풀 */
  private hitFxPool: Phaser.GameObjects.Sprite[] = [];
  private hitFxIdx = 0;
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
  // v2.7 — 대사/개방 유예가 시작된 시각 (보루 6초 자가해제용)
  private portalHoldSince = 0;
  // 현재 스테이지 보스 정의 (onBossDead에서 사용)
  private bossDef: BossDef | null = null;
  // 반복 토벌 의뢰 — 사이클별 목표 수 (완료할수록 +2)
  private repeatNeed = 0;

  /* ----- v3.0.16 — 몬스터 컬렉션 (메이플 몬스터 컬렉션) ----- */
  /** 영구 컬렉션 처치 기록 (id → 처치 수). 최초 처치 시 컬렉션 등록 + 마일스톤 스탯 상승 */
  private monsterKills: Record<string, number> = {};
  /* ----- v3.0.16 — 멀티킬 연출 (메이플 콤보킬/멀티킬) ----- */
  /** 1.5초 윈도 내 연속 처치 수 — 2+부터 더블킬~펜타킬 등급 표시 */
  private multiKillCount = 0;
  private multiKillUntil = 0;
  /* ----- v3.0.16 — 필드 정예 몬스터 (메이플 엘리트/챔피언) ----- */
  /** 현재 살아있는 필드 정예 (동시 1마리 제한) */
  private fieldEliteRef: Enemy | null = null;

  /* ----- v2.0: 복귀 차원문 (메이플식 자유 왕복 — 사용자 지시 #8) ----- */
  private returnPortal: Phaser.Physics.Arcade.Sprite | null = null;
  private returnBeacon: Phaser.GameObjects.Image | null = null;
  private returnActive = false;
  /* ----- v2.0: 정예 몬스터 (구역 5 미드보스급 — 사용자 지시 #5) ----- */
  private eliteEnemy: Enemy | null = null;
  /* v3.0.22 (#46) — 전직 스토리 시험 상대 전용 참조 (정예 몬스터와 분리 — 처치 판정 정확화) */
  private jobTrialEnemy: Enemy | null = null;
  /* v3.0.22 (#43/#44) — 챕터별 세계수 결정 수집 기록 (챕터키 → 수집 수) */
  private fragmentsFound: Record<string, number> = {};
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
  /* v3.1.0 (#전직스토리선행) — fam 추가: 미전직(cls null) 상태에서도 계열 스토리 진행 가능.
   *  유저 지시 "전직은 전직 스토리(n차마다 다른 스토리/컷신) 완료 후에 실행" —
   *  계열 선택 → 해당 계열 시련 스토리 → 완료 시 전직 적용 순서로 반영했다. */
  jobStory: { tier: 1 | 2 | 3; step: number; hunt: number; fam: FamilyKey } | null = null;
  private jobStoryDone: number[] = []; // 완료한 티어 기록 [2, 3]
  /** v3.1.0 (#전직스토리선행) — 미전직이 시련 스토리 중 선택해둔 1차 클래스 (완료 시 적용) */
  private pendingJobClass: ClassKey | null = null;
  /** v3.1.0 (#흑화) — 구역 전환 중 플래그: 중복 scene.restart로 인한 흑화 방지 */
  private transitioning = false;
  /* v3.2.0 (#흑화 근본 수정) — 부팅 시각/재부팅 이력 (create 래퍼 + 카메라 자가치유용) */
  private bootAt = 0;
  private bootRetried = false;
  /* v3.3.0 (지시 #8) — 5차 각성 시련 상태 */
  private fifthTrialActive = false;
  private fifthTrialEnemy: Enemy | null = null;
  /** 각성 대사 종료 후 수호자 소환 예약 (resumeFromDialogue에서 소비) */
  private pendingFifthSummon = false;
  /** v3.3.0 (#흑화) — 현재 대사 시작 시각 (20초 붙임 자가치유용) */
  private dialogueSince = 0;
  /* v3.3.0 (지시 #6) — 무릉도장 (메이플 무릉도장 오마주 훈련 스테이지) */
  dojangActive = false;
  dojangScore = 0;
  private dojangEndsAt = 0;
  private dojangFrom: StageKey = "village";
  private dojangText: Phaser.GameObjects.Text | null = null;
  private dojangTextAcc = 0;
  /** v3.1.0 (#최적화) — HUD 브로드캐스트 스로틀 (프레임당 다중 emit 억제) */
  private lastHudEmit = -999;
  private hudEmitPending = false;
  private jobEliteSummoned = false; // 시험 상대 소환 여부 (소환 전 완료 판정 방지)
  /* ----- v2.0: 여관/집 상호작용 쿨다운 ----- */
  private restCd = 0;

  /* ----- v2.2: 실내(여관/집) + 취침 연출 ----- */
  private isInterior = false;
  /** v2.9 — 실내(여관/집)에 들어가기 전 마을 스테이지 키 (챕터 마을 복귀용) */
  private interiorFrom: StageKey = "village";
  private sleeping = false;
  private sleepPending = false;
  private entryPos: { x: number; y: number } | null = null;

  /* ----- v2.3: 본 스토리 대사 기록 (재입장 시 대사 재생 방지 — 지시 #1) ----- */
  private seenSet = new Set<string>();
  /* ----- v2.3: 반복 토벌 의뢰 수주 해금 (상인 NPC에게 말 걸어 해금 — 지시 #4) ----- */
  /* ----- v2.5: 방문 구역 기록(지역 이동 부적) + 자동사냥(펫 보유 시) ----- */
  private visited = new Set<string>();
  private autoHunt = false;
  /** 자동사냥 이동 벡터 — update에서 계산해 move로 주입 */
  private autoHuntMove = new Phaser.Math.Vector2();
  /* ----- v3.0.14 — 자동사냥 장애물 회피/끼임 탈출 ----- */
  /** 이동 명령 중 제자리(막힘) 지속 시간 (ms) */
  private autoStuckMs = 0;
  /** 직전 프레임 플레이어 위치 — 실제 이동량 측정용 */
  private autoLastPos = new Phaser.Math.Vector2();
  /** 탈출 강제 이동 유지 시각 (scene.time.now 기준) */
  private autoUnstuckUntil = 0;
  /** 탈출 강제 이동 방향 */
  private autoUnstuckDir = new Phaser.Math.Vector2(1, 0);
  /* ----- v3.0.15 — 자동사냥 안정화 (제자리 와리가리 수정) ----- */
  /** 현재 추적 대상 — 1.25배 이상 가까운 후보가 생길 때만 교체 (타겟 전환 진동 방지) */
  private autoTarget: Enemy | Boss | null = null;
  /** 접근 이동 방향 홀드 (240ms) — 매 프레임 재계산으로 인한 좌우 진동 제거 */
  private autoDirHold = new Phaser.Math.Vector2();
  private autoDirHoldUntil = 0;
  /** 도달 불가(벽 뒤 등) 타겟 블랙리스트 — target → 포기 해제 시각 */
  private autoBlacklist = new Map<Enemy | Boss, number>();
  /* ----- v3.0.15 (#20) — 콤보(연속킬) 보너스 경험치 ----- */
  /** 연속킬 카운트 (마지막 킬 후 5초 내 유지) */
  private comboStreak = 0;
  private comboUntil = 0;
  /* ----- v3.0.15 (#2) — 레벨업 스탯 자동배분 on/off ----- */
  private autoAlloc = false;
  /* ----- v3.0.15 (#8) — 퀘스트 수락/추적 ----- */
  /** 스테이지 → 수락한 체인 인덱스. undefined면 기존 세이브(자동 수락 상태) */
  private acceptedQuests: Record<string, number> = {};
  /** 추적 중인 스테이지 키 (HUD 트래커 표시 대상 — null이면 현재 구역) */
  private trackedStage: string | null = null;
  /* ----- v3.0.15 (#11) — 해금된 챕터 테마 장비 세트 ----- */
  private unlockedSets: Set<string> = new Set();

  private repeatOn = false;

  /* ----- v3.0.24 (#보스재도전) — 클리어한 챕터 보스 고능력치 재판 ----- */
  /** 이동 중인 재도전 대상 챕터 (init data로 전달 — scene.restart 후 create에서 소비) */
  private pendingReplayBoss: string | null = null;
  /** v3.0.28 (#보스난이도) — 재도전 난이도 (init data로 전달) */
  private pendingReplayBossDiff: BossDiffKey | null = null;
  /** 재도전 보스 진행 중 — onBossDead에서 일반 보스 보상/포탈 진행과 분기 */
  private replayBossActive = false;
  /** v3.0.28 (#보스난이도) — 재림판 격파 에메랄드 (난이도별) */
  private replayBossEmerald = 5;

  /* ----- v3.0.28 (#보스난이도) — 메이플식 보스 난이도 (이지/노말/하드/카오스) ----- */
  /** 현재(직전) 보스전 난이도 — 선택 후 세이브, 재접속 복구에도 유지 */
  private bossDiff: BossDiffKey = "normal";
  /** 보스 퀘스트 진입 후 난이도 선택 대기 중 — 선택 전 보스 스폰 금지(보루 4초 후 노말 자가치유) */
  private bossDiffPending = false;
  private bossDiffPendingSince = 0;

  /* ----- E키 상호작용 (NPC 대화/상점/전직 교관 — 접근 자동 트리거 제거) ----- */
  private interactables: { x: number; y: number; kind: "talk" | "shop" | "job" | "gm" | "inn" | "house" | "innkeeper" | "bed" | "exit"; dlg?: string; npcId?: string; label: string }[] = [];
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
  private pProjPool: Phaser.Physics.Arcade.Sprite[] = [];
  private pProjIdx = 0;

  /* ----- v3.0.3: 몬스터 투사체 (임프 화염구/강령술사 다크볼트 등) ----- */
  private eProjPool: Phaser.Physics.Arcade.Sprite[] = [];
  private eProjIdx = 0;

  /* ----- v3.0.3: 지면 장판 (독/화염/성역/시간왜곡) — owner별 판정 분기 ----- */
  private fields: {
    zone: Phaser.GameObjects.Arc;
    x: number; y: number; radius: number;
    dur: number; dps: number; kind: "poison" | "fire" | "light" | "time";
    owner: "enemy" | "player";
    tickAcc: number;
    heal?: boolean; slow?: boolean; stun?: boolean;
    /** v3.0.7 — 크로니컬 시간왜곡: 필드가 자신의 HP를 틱마다 회복 (플레이어 소유 장판 한정) */
    selfHealPerTick?: number;
  }[] = [];

  /* ----- v3.0.3: 무기 스프라이트 (활/지팡이/단검 — 손에 들고 다니는 장비 비주얼) ----- */
  private weaponImg: Phaser.GameObjects.Image | null = null;
  private weaponKey: "x3_bow" | "x3_staff" | "x3_dagger" | null = null;

  /* ----- v3.0.3: 그림자 칼날 오비트 (나이트블레이드/섀도우로드 3차기) ----- */
  private orbitBlades: { imgs: Phaser.GameObjects.Image[]; angle: number; until: number; dmgMul: number; tint: number; hitCd: Map<unknown, number> } | null = null;

  /* ----- v1.9: 키 매핑 / 펫 / 치장 오라 / 강화 오라 ----- */
  private keymap: KeyMap = loadKeyMap();
  private keyObjs: Record<string, Phaser.Input.Keyboard.Key> = {};
  private pet: Pet | null = null;
  /** 플레이어 추적 오브젝트 (치장 오라/강화 오라/날개 입자) */
  private cosmeticAura: Phaser.GameObjects.Image | null = null;
  private cosmeticEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private upgradeGlow: Phaser.GameObjects.Image | null = null;
  /** v3.0.5 — 스타포스 궤도성(★15)/주변 스파클(★8+)/티어 추적 */
  private sfOrbits: Phaser.GameObjects.Image[] = [];
  private sfOrbitAng = 0;
  private sfSparkTimer = 0;
  private glowTier: 0 | 1 | 2 | 3 = 0;
  private jobNpc: Phaser.GameObjects.Image | null = null;

  constructor() {
    super("world");
  }

  init(data: { stage?: StageKey; save?: SaveData; fresh?: boolean; entry?: { x: number; y: number }; replayBoss?: string; replayDiff?: string }) {
    this.questIdx = 0;
    this.huntCount = 0;
    this.totalKills = 0;
    this.startTime = this.time.now;
    this.cleared = false;
    this.replayBossActive = false; // v3.0.24 — 재도전 플래그 리셋
    /* v3.0.24 — 보스 재도전: init data로 전달된 챕터키 보관 (create 후반 스폰) */
    this.pendingReplayBoss = typeof data.replayBoss === "string" ? data.replayBoss : null;
    /* v3.0.28 (#보스난이도) — 재도전 난이도 전달 (scene.restart 후 create에서 소비) */
    this.pendingReplayBossDiff =
      typeof data.replayDiff === "string" && data.replayDiff in BOSS_DIFFS ? (data.replayDiff as BossDiffKey) : null;
    this.bossDiffPending = false;
    this.bossDiffPendingSince = 0;
    this.enemies = [];
    this.boss = null;
    this.fragment = null;
    this.portal = null;
    /* v2.7 — 씬 재시작 같은 인스턴스 재사용: 이전 구역 개방 상태가 유출되면
     *  다음 구역에서 시작부터 포탈이 열려 퀘스트를 건너뛰고, 보루도 early-return으로 죽는다 */
    this.portalActive = false;
    this.returnActive = false;
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
    this.portalHoldSince = 0;
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
    /* v3.0.3 — 신규 씬 소유 리소스 리셋 (씬 재시작 후 파괴된 구 객체 참조 방지) */
    this.eProjPool = [];
    this.eProjIdx = 0;
    this.fields = [];
    this.weaponImg = null;
    this.weaponKey = null;
    this.orbitBlades = null;
    this.visited = new Set();
    this.plantHazards = [];
    this.layout = null;
    this.portalHome = new Phaser.Math.Vector2(0, 0);
    this.entryHome = new Phaser.Math.Vector2(0, 0);
    this.plantCd = 0;
    this.autoHunt = false;
    this.autoHuntMove.set(0, 0);
    this.autoStuckMs = 0;
    this.autoUnstuckUntil = 0;
    this.autoLastPos.set(0, 0);
    this.autoTarget = null;
    this.autoDirHold.set(0, 0);
    this.autoDirHoldUntil = 0;
    this.autoBlacklist.clear();
    this.autoAvoidLastSign = 0;
    this.repeatNeed = 0;
    this.keymap = loadKeyMap();
    this.keyObjs = {};
    this.pet = null;
    this.cosmeticAura = null;
    this.cosmeticEmitter = null;
    this.upgradeGlow = null;
    this.sfOrbits = [];
    this.sfOrbitAng = 0;
    this.sfSparkTimer = 0;
    this.glowTier = 0;
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
    this.jobTrialEnemy = null; // v3.0.22 (#46) — 시험 상대 별도 참조 (처치 판정 정확화)
    this.fragmentsFound = {}; // v3.0.22 (#44) — 세이브 복원 전 초기화
    this.fieldEliteRef = null;
    this.agroHoldUntil = 0;
    this.huntBaseline = {};
    /* v2.2 실내/취침 */
    this.isInterior = false;
    this.sleeping = false;
    this.sleepPending = false;
    /* v2.3 — 재시작(스테이지 전환) 시 대사 기록/의뢰 해금 리셋 후 세이브에서 복원 */
    this.seenSet = new Set();
    this.repeatOn = false;
    this.entryPos = data.entry ?? null;
    this.eBubble = null;
    this.eBubbleText = null;
    this.dirOrder = { x: [], y: [] };
    this.jobStory = null;
    this.jobStoryDone = [];
    this.pendingJobClass = null; // v3.1.0 — 전직 시련 선택 클래스 리셋
    this.transitioning = false; // v3.1.0 — 씬 재시작마다 전환 게이트 초기화
    /* v3.3.0 (#흑화) — 안전 재부팅 구제횟수 리셋: 기존엔 세션 내 1회 한정이라
     *  두 번째 초기화 실패부터는 영구 검은 화면이었다. 매 부팅마다 1회씩 재부팅 기회 부여 */
    this.bootRetried = false;
    /* v3.3.0 — 자동사냥 배회 좌표 리셋 (이전 맵 좌표가 새 맵으로 유출되는 것 방지) */
    this.autoWanderPoint = null;
    this.autoWanderUntil = 0;
    /* v3.3.0 — 5차 시련/무릉도장/대사 상태 리셋 */
    this.fifthTrialActive = false;
    this.fifthTrialEnemy = null;
    this.pendingFifthSummon = false;
    this.dialogueSince = 0;
    this.dojangActive = false;
    this.dojangScore = 0;
    this.dojangEndsAt = 0;
    this.dojangFrom = "village";
    this.dojangText = null;
    this.dojangTextAcc = 0;
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

  /* v3.2.0 (#흑화 근본 수정) — create() 안전 래퍼.
   *  "맵 이동 시 가끔 검은 화면 + 움직임 불능"의 잔존 원인은 씬 초기화(create) 중
   *  예외로 fadeIn이 아예 실행되지 않는 케이스였다 (v3.1.0은 fadeIn 위치가 create
   *  끝자락이라 초기화 중단 시 무효). 개선:
   *  1) 초기화 예외를 잡아 최소 안전 부팅(배경 + fadeIn)을 보장
   *  2) 실패 시 1회 한정 자동 재부팅 (세이브는 gotoStage마다 기록되어 있어 안전)
   *  3) fadeIn + 워치독은 성공/실패 무관하게 "항상" 마지막에 실행 */
  create() {
    this.bootAt = this.time.now;
    try {
      this.createInner();
    } catch (err) {
      console.error("[SERTZ] 씬 초기화 실패 — 안전 부팅으로 전환", err);
      this.cameras.main.setBackgroundColor("#0a0e18");
      this.cameras.main.fadeIn(320, 0, 0, 0);
      if (!this.bootRetried) {
        this.bootRetried = true;
        this.time.delayedCall(650, () => {
          /* 세이브에서 안전하게 다시 부팅 (스테이지 유지) */
          try {
            const d = this.registry.get("initData") as { stage?: StageKey; save?: SaveData } | undefined;
            this.scene.restart({ stage: d?.stage, save: d?.save });
          } catch (e2) {
            console.error("[SERTZ] 자동 재부팅 실패", e2);
          }
        });
      }
    }
    /* fadeIn + 자가치유 워치독 — v3.1.0에서 create 끝에 있던 것을 래퍼로 이동 (예외와 무관하게 항상 실행) */
    this.cameras.main.fadeIn(350, 0, 0, 0);
    this.time.delayedCall(1200, () => {
      if (!this.scene.isActive()) return;
      const cam = this.cameras.main as unknown as {
        fadeEffect?: { isRunning: boolean; stop(): void };
      };
      if (cam.fadeEffect?.isRunning) cam.fadeEffect.stop();
    });
  }

  private createInner() {
    this.impactFX = new ImpactFX(this);
    /* v3.0.3 — 씬 재시작 시 물리 월드 일시정지 상태가 이월되는 문제 방지:
     *  대사 중 씬 재시작(포탈/사망 등)이 일어나면 구 씬의 world.pause()가
     *  새 씬에서도 유지되어 캐릭터·몬스터가 완전히 멈춘다. 재시작마다 강제 resume. */
    this.physics.world.resume();
    const data = this.registry.get("initData") as {
      stage?: StageKey;
      save?: SaveData;
      fresh?: boolean;
    };
    const save = data.save;
    /* v2.2 — data.stage 명시 시 우선 (실내 진입: save는 village 캐리, stage는 interior) */
    const rawStage = (data.stage as StageKey | undefined) ?? (save ? (save.stage as StageKey) : "village");
    /* 유효하지 않은 스테이지 키(구 세이브/수정 세이브) 방어 — 체인 시작점으로 안전 폴백 (v2.0 구세이브 폴백 내장) */
    const stageKey: StageKey = resolveStage(rawStage);
    this.stageDef = STAGES[stageKey];
    this.stageW = this.stageDef.width;
    this.stageH = this.stageDef.height;

    /* ---------- 바닥 (v2.0 — 10챕터 테마 테이블 / v2.2 실내 분기) ---------- */
    const theme = STAGE_THEME[stageKey] ?? STAGE_THEME.village;
    this.solidGroup = this.physics.add.staticGroup();
    this.isInterior = stageKey === "interior_inn" || stageKey === "interior_home";
    if (this.isInterior) {
      this.buildInterior(stageKey);
    } else {
    const groundTex = theme.ground;
    this.add.tileSprite(0, 0, this.stageW, this.stageH, groundTex).setOrigin(0).setDepth(0);
    // v3.0.14 — 도로 표시 완전 제거: 가로/세로 일자 도로가 단조롭다는 피드백 ("길이 일자로만 되어있어")
    //  지형은 테마 바닥 타일링만 남기고, 빈 지형은 placeDecor의 나무·바위·장식 배치로 자연감을 채운다.
    // v3.0.13 — 지면 변형 스캐터(gvar) 완전 제거: 타 세트 색상의 64px 사각형이
    //  "이상한 타일이 막 배치"된 것처럼 보이는 사용자 불만 → 기본 바닥만 사용 (클린 지형)
    }

    this.physics.world.setBounds(0, 0, this.stageW, this.stageH);
    this.cameras.main.setBounds(0, 0, this.stageW, this.stageH);
    if (!this.isInterior) this.cameras.main.setBackgroundColor(theme.bg);

    /* ---------- v3.0 (사용자 지시 #7) — 개미굴식 구역 레이아웃 (필드 전용) ----------
     *  스테이지 키를 시드로 셀 그리드를 굴 형태로 개방하고 나머지는 벽으로 막는다.
     *  마을/실내는 개방형 유지. 포탈·스폰·파편·보스 모두 레이아웃을 따른다. */
    /* v3.3.0 (#흑화) — 굴 레이아웃 조건에서 무릉도장 제외: 개방된 도장(벽 없음)으로 생성 */
    if (!this.isInterior && !this.stageDef.isVillage && stageKey !== "dojang") {
      const lay = generateRoomLayout(stageKey, this.stageW, this.stageH);
      this.layout = lay;
      const entryC = cellCenterOf(lay, lay.entry);
      const exitC = cellCenterOf(lay, lay.exit);
      this.entryHome.set(entryC.x + 70, entryC.y);
      this.portalHome.set(exitC.x, exitC.y);
      this.buildDungeonWalls(lay, parseStage(stageKey).ch);
    } else {
      this.portalHome.set(this.stageW - 130, this.stageH * 0.52);
      this.entryHome.set(180, this.stageH / 2);
    }
    /* v3.3.0 (지시 #6) — 무릉도장 중앙 입장/퇴장 위치 보정 */
    if (stageKey === "dojang") {
      this.entryHome.set(this.stageW / 2, this.stageH - 120);
      this.portalHome.set(this.stageW / 2, 120);
    }

    // 반응형: 화면 밀도 유지용 카메라 줌 (RESIZE 캔버스 1:1 + 카메라 확대)
    this.applyCameraZoom();
    this.scale.on("resize", this.applyCameraZoom, this);

    /* ---------- 장식 (F1: 정의된 소수만 — 실내는 buildInterior가 자체 배치) ---------- */
    if (!this.isInterior) this.placeDecor(stageKey);

    /* ---------- 상점 NPC (v3.0.15 #9 — 상인은 마을에만 배치. 필드 몬스터 구역에서 제거) ---------- */
    if (!this.isInterior && this.stageDef.isVillage) this.spawnMerchant();

    /* ---------- 플레이어 (v2.2 — 실내는 문 앞 스폰, 복귀 entry 좌표 우선) ---------- */
    const savedPlayer = save;
    this.player = new Player(
      this,
      this.entryPos?.x ?? (this.isInterior ? this.stageW / 2 : this.entryHome.x),
      this.entryPos?.y ?? (this.isInterior ? this.stageH - 70 : this.entryHome.y)
    );
    /* v3.3.0 (지시 #5) — 현재 챕터 번호 기록: 챕터 4(알프헤임)부터만 체력% 고정 피해 발동 */
    this.player.stageCh = chapterSpec(stageKey)?.num ?? 1;
    if (savedPlayer) {
      this.player.lv = savedPlayer.lv;
      /* v3.0 (사용자 지시 #1) — 경험치 복원 누락 수정:
       *  buildSave는 exp를 저장하면서 복원 경로엔 없어 포탈 이동(씬 재시작)마다
       *  경험치가 0으로 초기화되는 버그. lv 복원 직후 함께 복원한다. */
      this.player.exp = savedPlayer.exp ?? 0;
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
      /* v3.0.5 — 스타포스 마일스톤 HP 복원 (가산 이력 선복원 → 델타만 반영) */
      this.player.restoreStarHp(savedPlayer.sfHp ?? 0);
      this.player.syncStarHp();
      /* v2.9 (#8) — 다중 장신구 마이그레이션 (구 세이브 accessory 1개 → 배열) */
      this.player.accessories = ((savedPlayer.accessories as ItemKey[] | undefined) ??
        (savedPlayer.accessory ? [savedPlayer.accessory as ItemKey] : [])) as ItemKey[];
      /* v3.0.7 — 장신구 스타포스 복원 (성 + HP 가산 이력) */
      this.player.accUp = { ...(savedPlayer.accUp ?? {}) };
      this.player.starBless = savedPlayer.starBless ?? 0;
      this.player.restoreAccHp(savedPlayer.accHp ?? 0);
      this.player.syncAccStarHp();
      this.player.emerald = savedPlayer.emerald ?? 0;
      // 퀘스트 진행 복원 (이어하기 — 파편/보상 중복 수령 방지)
      this.savedQuestIdx = { ...(savedPlayer.questIdx ?? {}) };
      this.questIdx = Phaser.Math.Clamp(this.savedQuestIdx[stageKey] ?? 0, 0, this.stageDef.quests.length);
      // 플레이어 이름 복원 (인트로에서 지정)
      if (savedPlayer.playerName) setPlayerName(savedPlayer.playerName);
      // 전직 클래스 복원 (v1.7 — 구 세이브 null 호환)
      this.player.applySavedClass(savedPlayer.cls);
      // v2.4 — 이어하기 시에도 이름표 유지 (클래스 복원 후 생성 — "이름 · 클래스" 표기)
      if (savedPlayer.playerName) this.ensurePlayerTag();
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
      // 전직 스토리 복원 (v2.0 / v3.1.0 — fam 포함. 구 세이브는 cls 계열로 역산)
      if (savedPlayer.jobStory && typeof savedPlayer.jobStory.tier === "number") {
        const famSaved = (savedPlayer.jobStory as { fam?: string }).fam;
        const famDerived = familyOf(savedPlayer.cls ?? "");
        const jsFam: FamilyKey | undefined = (famSaved as FamilyKey | undefined) ?? famDerived ?? undefined;
        if (jsFam) {
          this.jobStory = {
            tier: savedPlayer.jobStory.tier,
            step: savedPlayer.jobStory.step,
            hunt: savedPlayer.jobStory.hunt,
            fam: jsFam,
          };
        }
      }
      this.jobStoryDone = [...(savedPlayer.jobStoryDone ?? [])];
      // v3.1.0 — 시련 스토리 중 선택해둔 1차 클래스 복원
      if (
        !savedPlayer.cls &&
        typeof (savedPlayer as { pendingJobClass?: string | null }).pendingJobClass === "string" &&
        isClassKey((savedPlayer as { pendingJobClass?: string | null }).pendingJobClass as string)
      ) {
        this.pendingJobClass = (savedPlayer as { pendingJobClass?: string | null }).pendingJobClass as ClassKey;
      }
      // v2.3 — 본 대사 기록 + 반복 의뢰 수주 해금 복원 (지시 #1/#4)
      this.seenSet = new Set(savedPlayer.seen ?? []);
      this.repeatOn = savedPlayer.repeatOn ?? false;
      /* v3.0.26 (#76) — 스토리 클리어 플래그 복원: 기존엔 런타임 리셋(init false) 후
       *  복원이 누락돼 재접속 시 cleared 상태가 유실됐다. 일퀘 해금 판정의 전제 */
      this.cleared = savedPlayer.cleared ?? false;
      /* v3.0.6 — 자동 물약/자동 버프 설정 복원 (지시 #5) */
      if (savedPlayer.autoUse) {
        this.player.autoUse = {
          hpPct: savedPlayer.autoUse.hpPct ?? 0,
          mpPct: savedPlayer.autoUse.mpPct ?? (savedPlayer.autoUse.mpOn ? 25 : 0), // v3.0.20 (#3) 기존 mpOn 마이그레이션
          mpOn: savedPlayer.autoUse.mpOn ?? false,
          buffs: (savedPlayer.autoUse.buffs ?? []) as BuffKey[],
        };
      }
      /* v3.0.6 — 반복 의뢰 진행도 복원 (재입장 시 카운트 리셋 문제)
       *  같은 구역 세이브에서만 복원 — 다른 구역이면 신규 시작 */
      const savedRepeatStage = (savedPlayer as { repeatStage?: string }).repeatStage;
      if (savedRepeatStage === this.stageDef.key) {
        this.repeatNeed = (savedPlayer as { repeatNeed?: number }).repeatNeed ?? this.stageDef.repeat?.need ?? 0;
        this.huntCount = (savedPlayer as { huntCount?: number }).huntCount ?? 0;
      }
      // v2.5 — 방문 기록 복원 + 자동사냥 (v3.0.15 #5: 펫 조건 제거)
      this.visited = new Set(savedPlayer.visited ?? []);
      this.autoHunt = savedPlayer.autoHunt ?? false;
      /* ----- v3.0.15 복원 ----- */
      this.autoAlloc = savedPlayer.autoAlloc ?? false;
      if (savedPlayer.quickPots) this.player.quickPots = { ...savedPlayer.quickPots };
      this.player.potentials = JSON.parse(JSON.stringify(savedPlayer.potentials ?? {}));
      this.player.restorePotHp(savedPlayer.potHpApplied ?? 0);
      this.player.syncPotentialsHp();
      this.unlockedSets = new Set(savedPlayer.unlockedSets ?? []);
      /* v3.0.15 (#8) — 퀘스트 수락/추적 상태 복원 */
      this.acceptedQuests = { ...(savedPlayer.questAccepted ?? {}) };
      this.trackedStage = savedPlayer.questTracked ?? null;
      /* v3.0.16 — 몬스터 컬렉션 복원 + 등록 수 스탯 반영 */
      this.monsterKills = { ...(savedPlayer.monsterKills ?? {}) };
      this.player.setCollection(Object.keys(this.monsterKills).length);
      /* v3.0.22 (#43/#44/#50) — 결정 수집 기록 + 세계수의 가호 복원 */
      this.fragmentsFound = { ...(savedPlayer.fragmentsFound ?? {}) };
      this.player.setWorldtreeBlessing(!!savedPlayer.worldtreeBlessing);
      /* v3.0.28 (#보스난이도) — 진행 중이던 보스전 난이도 복원 (재접속 시 이지 선택 후 노말로 나오는 문제 방지) */
      if (savedPlayer.bossDiff && savedPlayer.bossDiff in BOSS_DIFFS) {
        this.bossDiff = savedPlayer.bossDiff as BossDiffKey;
      }
      this.player.recalcSpeedForLoad();
      /* v3.3.0 — 5차 각성/시련 완료 플래그 복원 */
      this.player.fifth = savedPlayer.fifth ?? false;
      this.player.fifthStoryDone = savedPlayer.fifthStoryDone ?? false;
    }
    // v2.5 — 현재 구역 방문 기록 (실내 제외) — 지역 이동 부적 워프 대상
    if (!this.isInterior) {
      const before = this.visited.size;
      this.visited.add(this.stageDef.key);
      /* v3.0.15 (#11) — 챕터 해금 시 테마 장비 세트 해금: 무기·방어구·악세 1세트가 상점에 등장 */
      const chKey = parseStage(stageKey).ch;
      if (SET_GEAR[chKey] && !this.unlockedSets.has(chKey)) {
        this.unlockedSets.add(chKey);
        this.time.delayedCall(1600, () => {
          EventBus.emit("banner:show", {
            text: `장비 세트 해금! ${SET_GEAR[chKey].title} — 마을 상점에서 구매 가능`,
          });
          audio.sfx.questDone();
        });
        this.save();
        this.emitRpgState();
      }
      if (this.visited.size !== before) this.save();
    }
    /* v3.0.6 — 반복 의뢰 진행도: 세이브에 같은 구역 기록이 있으면 유지, 없으면 신규 시작 */
    if (!((savedPlayer as { repeatStage?: string } | undefined)?.repeatStage === this.stageDef.key)) {
      this.repeatNeed = this.stageDef.repeat?.need ?? 0;
      this.huntCount = 0;
    }
    this.playerRef = this.player;
    /* v3.0.18 — 카메라 추적 lerp 0.12→0.18: 캐릭터가 카메라를 "끌고 가는" 둔감한
     *  여운(걸리는 느낌의 시각적 원인) 축소. 0.2 이상은 화면 흔들림 유발 — 0.18 채택 */
    this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
    this.physics.add.collider(this.player, this.solidGroup);
    /* v2.6 — 육식 식물 접촉 데미지 등록 (플레이어 생성 후) */
    for (const plant of this.plantHazards)
      this.physics.add.overlap(this.player, plant, () => this.hitPlantHazard(plant));

    /* ---------- BM 복원 (v1.9 — 펫 소환/치장 오라/강화 오라) ---------- */
    this.syncPet();
    this.syncCosmeticAura();
    this.syncUpgradeGlow();

    /* ---------- 적 배치 (v2.0 — 챕터/구역 난이도 배율 적용 / v3.0 — 개방 셀 스폰) ---------- */
    const sc = stageScale(stageKey);
    const rng = new Phaser.Math.RandomDataGenerator([stageKey]);
    for (const group of this.stageDef.enemies) {
      for (let i = 0; i < group.count; i++) {
        /* v3.0 (#7) — 굴 레이아웃의 개방 셀 안에만 스폰 (입구 셀 회피 + 플레이어 380px 거리) */
        const p = this.openPointRng(rng, { minDist: 380, avoidEntry: true });
        const e = new Enemy(this, p.x, p.y, group.key, {
          /* v3.0 (#8) — 몬스터 경험치 +35% (레벨업 속도 개선, 곡선 완화와 합산) */
          hp: sc.hp, atk: sc.atk, exp: sc.exp * 1.35, gold: sc.gold,
        });
        this.enemies.push(e);
        this.spawnRecords.push({ key: group.key, x: p.x, y: p.y });
        this.physics.add.collider(e, this.solidGroup);
      }
    }
    /* ---------- 정예 몬스터 (구역 5 — 미드보스급 단일 스폰, 지시 #5) ---------- */
    if (this.stageDef.elite) {
      const el = this.stageDef.elite;
      /* v3.0 (#7) — 정예도 개방 셀에 배치 (플레이어와 충분히 떨어진 방) */
      const ep = this.openPointRng(rng, { minDist: 520, avoidEntry: true });
      const ex = ep.x;
      const ey = ep.y;
      const e = new Enemy(this, ex, ey, el.key, {
        hp: el.hpMult * sc.hp,
        atk: el.atkMult * sc.atk,
        exp: 8 * sc.exp,
        gold: 9 * sc.gold,
        scale: 1.55,
        tint: 0xff9090,
        displayName: el.name,
      });
      e.dmgPct = DMG_PCT.elite; // v3.0.6 — 정예 % 피해 상향
      this.eliteEnemy = e;
      this.enemies.push(e);
      this.spawnRecords.push({ key: el.key, x: ex, y: ey });
      this.physics.add.collider(e, this.solidGroup);
      this.showBanner(`${el.name} 출현!`);
      audio.sfx.roar();
      this.cameras.main.shake(240, 0.007);
    }

    /* ---------- v3.3.0 (지시 #6) — 무릉도장: 허수아비 + 타이머/기록 UI ---------- */
    if (stageKey === "dojang") this.buildDojang();

    /* ---------- 퀘스트 오브젝트 (v2.2 — 실내는 포탈/퀘스트 오브젝트 없음) ---------- */
    if (this.isInterior) {
      /* 실내 — 출구 문은 interactables로 처리 */
    } else if (this.stageDef.isVillage) {
      /* v2.9 — 본마을 + 챕터 마을 공용 마을 빌드 (우물/여관/전직관/주민) */
      this.buildVillage();
      // 마을 차원문은 항상 열려 있음 (다음 구역으로 출발)
      this.spawnPortal(this.stageW - 110, this.stageH * 0.52);
      this.activatePortal(true);
    } else {
      if (!this.stageDef.boss && stageKey !== "dojang") this.spawnPortal(this.portalHome.x, this.portalHome.y);
      // 수확(collect) 퀘스트 진행 중 — 파편 스폰 (이어하기 무결: ATK 중복 수령 방지)
      if (this.currentQuest()?.type === "collect") this.spawnFragmentForQuest();
    }
    /* ---------- 복귀 차원문 (v2.0 — 이전 구역 자유 왕복, 지시 #8 / 실내 제외) ---------- */
    if (!this.isInterior) this.spawnReturnPortal();

    /* ---------- 퀘스트 진행 복구 (이어하기 — 진행 상태 정합, 오브젝트 생성 후) ---------- */
    const bossQuestIdx = this.stageDef.quests.findIndex((q) => q.type === "boss");
    if (this.stageDef.boss) {
      if (this.currentQuest()?.type === "boss") {
        // 보스전 진행 중 세이브 — 입장 직후 보스 등장 (복구 경로는 등장 대사 생략)
        /* v3.3.0 (#흑화) — 복구 경로 try/catch: 재입장 전용 경로가 죽으면 physics 정지가
         *  누출돼 검은 화면·조작 불능이 됐다. 실패 시 물리/대사를 즉시 복원한다 */
        this.time.delayedCall(900, () => {
          try {
            if (!this.boss) this.spawnBoss(false);
          } catch (e) {
            console.error("[SERTZ] 보스 복구 스폰 실패 — 자가치유로 정리", e);
            this.dialoguing = false;
            this.physics.world.resume();
          }
        });
      } else if (bossQuestIdx >= 0 && this.questIdx > bossQuestIdx && NEXT_STAGE[stageKey]) {
        // 보스 격파 후 세이브 — 차원문 개방 상태 복구 (구 v1.0 클리어 세이브도 이 경로로 계속)
        this.spawnPortal(this.portalHome.x, this.portalHome.y);
        this.activatePortal(true);
      }
    } else if (stageKey !== "village" && this.currentQuest()?.type === "reach") {
      // 수확 완료 후 세이브 — 차원문을 열어둔 채 시작 (소프트락 방지)
      this.activatePortal(true);
    } else if (stageKey !== "village" && !this.stageDef.boss && this.questIdx >= this.stageDef.quests.length) {
      // v2.4 — 체인 완료 상태로 이어하기 시 전진 포탈 개방 복구 (구역 1~9 소프트락 방지)
      this.activatePortal(true);
    }
    /* ---------- 이펙트 풀 ---------- */
    this.buildFxPools();

    /* v2.4 — 이어하기 시 레벨 게이트가 이미 충족된 상태면 즉시 연쇄 완료
     *  (구세이브는 questIdx가 신규 체인의 앞쪽으로 밀려날 수 있다 — 자기 레벨이 충분하면 게이트 스킵) */
    if (this.currentQuest()?.type === "level") this.tryCompleteLevel();

    /* v2.7 — 포탈 개방 보루 2.0 (자가치유형): 개방 실패의 모든 원인을 1.5초 안에 스스로 봉합.
     *  v2.6 보루의 빈틈 — dialoguing/pendingPortal 끼임 시 영구 거부, 보스 구역 영구 제외,
     *  포탈 스프라이트 부재 시 무력 — 를 닫는다 (유저 재신고: "퀘스트 깨도 바로 포탈 안열림") */
    this.time.addEvent({
      delay: 1500,
      loop: true,
      callback: () => {
        /* v3.3.0 (#흑화) — 대사 붙임 자가치유: 20초 이상 대사 상태가 지속되면 강제 종료
         *  (대사 완료 콜백 유실 → dialoguing/physics 영구 정지 → 검은 화면·조작 불능 방지.
         *  정상 대사는 이보다 훨씬 짧고, 클릭/스페이스로 언제든 넘길 수 있다) */
        if (this.dialoguing && this.dialogueSince > 0 && this.time.now - this.dialogueSince > 20000) {
          console.warn("[SERTZ] 대사 20초 붙임 감지 — 강제 종료(자가치유)");
          this.dialoguing = false;
          this.dialogueSince = 0;
          this.queuedDialogue = null;
          this.physics.world.resume();
          EventBus.emit("dialogue:hide");
        }
        if (this.portalActive || this.isInterior) return;
        const q = this.currentQuest();
        /* 오브젝트 소실 보루 — 파편/보스가 없으면 퀘스트가 영구 안 풀려 포탈이 안 열린다 */
        if (q?.type === "collect" && !this.fragment) this.spawnFragmentForQuest();
        if (q?.type === "boss" && !this.boss) {
          /* v3.0.28 (#보스난이도) — 난이도 선택 패널을 4초 이상 닫아두면 노말로 자가치유
           *  (패널을 닫고 방치해 보스가 영영 안 나오는 소프트락 방지) */
          if (this.bossDiffPending) {
            if (this.time.now - this.bossDiffPendingSince > 4000) {
              this.bossDiffPending = false;
              this.bossDiff = "normal";
              this.spawnBoss(false);
            }
          } else this.spawnBoss(false);
        }
        const chainDone = this.questIdx >= this.stageDef.quests.length;
        const shouldOpen = !q || q.type === "reach" || (chainDone && this.repeatOn);
        /* 보스 구역은 격파 전(boss 진행 중) 개방 금지 — 격파 후 reach는 개방 대상 */
        if (!shouldOpen || (this.stageDef.boss && q?.type !== "reach")) return;
        if (this.dialoguing || this.pendingPortal) {
          /* 대사 중엔 물리 정지로 전환 사고가 없다 — 유예하되 6초 이상 붙어있으면 강제 해제 */
          if (!this.portalHoldSince) this.portalHoldSince = this.time.now;
          else if (this.time.now - this.portalHoldSince > 6000) {
            this.portalHoldSince = 0;
            this.pendingPortal = false;
            if (!this.portal) this.spawnPortal(this.portalHome.x, this.portalHome.y);
            this.activatePortal();
          }
          return;
        }
        this.portalHoldSince = 0;
        if (!this.portal) this.spawnPortal(this.portalHome.x, this.portalHome.y);
        this.activatePortal();
      },
    });

    /* ---------- 미니맵 (2D MMORPG 기본 요소) ---------- */
    this.minimap = this.add.graphics().setDepth(95).setScrollFactor(0).setAlpha(0.85);
    this.redrawMinimap();

    /* v3.0.24 (#보스재도전) — 클리어 챕터 보스 재도전: 보스 구역 도착 직후 재림 보스 스폰 */
    if (this.pendingReplayBoss) {
      const ch = this.pendingReplayBoss;
      this.pendingReplayBoss = null;
      /* v3.3.0 (#흑화) — 재도전 스폰도 try/catch (physics 정지 누출 방지) */
      this.time.delayedCall(350, () => {
        try {
          this.spawnReplayBoss(ch);
        } catch (e) {
          console.error("[SERTZ] 재도전 보스 스폰 실패 — 자가치유로 정리", e);
          this.dialoguing = false;
          this.physics.world.resume();
        }
      });
    }

    /* ---------- 입력 ---------- */
    this.setupInput();

    // E2E/디버그 훅 — 씬 인스턴스 실측용 (v2.4)
    (window as unknown as { __SERTZ_SCENE__?: unknown }).__SERTZ_SCENE__ = this;

    /* ---------- 사운드/BGM (v3.0.23 — 구역별 고정 1곡 루프 / 로테이션·곡 교체 없음) ---------- */
    audio.playStageBGM(stageKey);

    /* ---------- 오프닝 대사 (인트로 시퀀스 중이면 인트로가 인계 / 실내는 연출 생략) ----------
     *  v2.3 (지시 #1): 이미 본 대사는 재입장 시 재생하지 않는다 — 이전/다음 맵 왕복마다
     *  인트로·구역 안내 대사가 반복되던 버그 수정
     *  v3.0.10 (메이플식 챕터 연출): 챕터 1구역 최초 진입 시 타이틀 카드 컷신 후 인트로 대사 */
    if (!this.isInterior && stageKey !== "dojang") {
      if (stageKey === "village" && !savedPlayer?.playerName) {
        // 신규 플레이어 — 책장 넘기기 대신 플레이형 인트로 (이동 → 우물 → 이름 짓기)
        this.startIntroSequence();
      } else {
        const spec = chapterSpec(stageKey);
        const introId = stageIntro(stageKey);
        if (spec && parseStage(stageKey).sub === 1 && !this.seenSet.has(introId)) {
          // 챕터 오프닝 컷신 — "제N장" 타이틀 카드 → 챕터 인트로 대사
          /* v3.3.0 (#흑화) — 챕터 카드 연출도 try/catch (재입장 경로 예외 시 physics 정지 누출 방지) */
          this.time.delayedCall(350, () => {
            try {
              this.showChapterCard(spec.num, spec.title, spec.subtitle, () => this.showDialogueOnce(introId));
            } catch (e) {
              console.error("[SERTZ] 챕터 카드 실패 — 대사로 폴백", e);
              this.dialoguing = false;
              this.physics.world.resume();
              this.showDialogueOnce(introId);
            }
          });
        } else {
          this.time.delayedCall(400, () => {
            this.showDialogueOnce(introId);
          });
        }
      }
    }

    EventBus.emit("ui:playing");
    this.emitHud();
    this.emitQuest();
    this.emitRpgState();

    /* ---------- 멀티플레이 (같은 서버 접속자 동기화 — v1.7 / 실내는 제외) ---------- */
    if (!this.isInterior) this.initNet();

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
    // v2.3 — 실내(정사각 방 832×832)는 확대 줌으로 아늑한 한 방 연출 (지시 #6)
    this.cameras.main.setZoom(this.isInterior ? Math.min(3, viewZoom() * 1.45) : viewZoom());
    this.redrawMinimap();
  }

  /* ================= 배치 ================= */

  /* ================= v3.0 — 개미굴 던전 레이아웃 (사용자 지시 #7) ================= */

  /** 닫힌 셀을 챕터 분위기에 맞는 암벽 타일로 채워 벽(충돌)을 만든다 */
  private buildDungeonWalls(lay: RoomLayout, ch: string) {
    /* v3.0.23 (#55) — "빈 공간이 이상한 검은 카펫으로 채워짐" 수정:
     *  구 어두운 벽돌 텍스처를 44~54% 명도로 틴트하면 카펫처럼 보였음.
     *  → 밝은 석벽 텍스처(wall_rock)로 교체 + 베이스 명도 62~74%로 상향 — 암벽으로 읽힘.
     *  챕터 구분은 틴트 색으로 (숲=연두빛, 설원=하늘빛 등) */
    const WALLS: Record<string, number> = {
      forest: 0x7a9a5a,
      kingdom: 0xa89878,
      alfheim: 0x8a7ac8,
      muspelheim: 0xa85a38,
      niflheim: 0x8ab8d8,
      cave: 0x9a7a58,
      nidavellir: 0xb8a068,
      hel: 0x8a5aaa,
      abyss: 0x6a5a9a,
    };
    const wallTex = "wall_rock";
    const wallTint = WALLS[ch] ?? 0xffffff;
    const rng = new Phaser.Math.RandomDataGenerator([this.stageDef.key + "-walls"]);
    const openAt = (c: number, r: number) => c >= 0 && r >= 0 && c < lay.cols && r < lay.rows && lay.open[r * lay.cols + c];
    for (let r = 0; r < lay.rows; r++) {
      for (let c = 0; c < lay.cols; c++) {
        const i = r * lay.cols + c;
        if (lay.open[i]) continue;
        const x = c * lay.cellW;
        const y = r * lay.cellH;
        // 셀마다 살짝 다른 명도 — 암벽 덩어리가 단조로운 격자로 보이지 않게 (v3.0.23: 0.62~0.74 — 밝게)
        const v = 0.62 + rng.frac() * 0.12;
        const tint = Phaser.Display.Color.IntegerToColor(wallTint);
        const scaled = Phaser.Display.Color.GetColor(tint.red * v, tint.green * v, tint.blue * v);
        const ts = this.add
          .tileSprite(x, y, lay.cellW + 1, lay.cellH + 1, wallTex)
          .setOrigin(0)
          .setDepth(2)
          .setTint(scaled);
        this.solidGroup.add(ts);
        // 벽 셀 중 통로에 맞닿은 면에 밝은 림(하이라이트) — 벽 윤곽 강조
        const rim = Phaser.Display.Color.GetColor(
          Math.min(255, tint.red * 0.9), Math.min(255, tint.green * 0.9), Math.min(255, tint.blue * 0.9)
        );
        const RIM = 3;
        if (openAt(c, r - 1))
          this.add.rectangle(x, y, lay.cellW, RIM, rim, 0.34).setOrigin(0).setDepth(3);
        if (openAt(c, r + 1))
          this.add.rectangle(x, y + lay.cellH - RIM, lay.cellW, RIM, 0x000000, 0.3).setOrigin(0).setDepth(3);
        if (openAt(c - 1, r))
          this.add.rectangle(x, y, RIM, lay.cellH, rim, 0.26).setOrigin(0).setDepth(3);
        if (openAt(c + 1, r))
          this.add.rectangle(x + lay.cellW - RIM, y, RIM, lay.cellH, 0x000000, 0.26).setOrigin(0).setDepth(3);
      }
    }
    // 길 쪽 그림자(앰비언트 오클루전) — 벽 옆 통로가 파인 것처럼 보이게
    const SH = 14;
    for (let r = 0; r < lay.rows; r++) {
      for (let c = 0; c < lay.cols; c++) {
        const i = r * lay.cols + c;
        if (!lay.open[i]) continue;
        const x = c * lay.cellW;
        const y = r * lay.cellH;
        if (!openAt(c, r - 1))
          this.add.rectangle(x, y, lay.cellW, SH, 0x000000, 0.22).setOrigin(0).setDepth(2.5);
        if (!openAt(c, r + 1))
          this.add.rectangle(x, y + lay.cellH - SH, lay.cellW, SH, 0x000000, 0.16).setOrigin(0).setDepth(2.5);
        if (!openAt(c - 1, r))
          this.add.rectangle(x, y, SH, lay.cellH, 0x000000, 0.2).setOrigin(0).setDepth(2.5);
        if (!openAt(c + 1, r))
          this.add.rectangle(x + lay.cellW - SH, y, SH, lay.cellH, 0x000000, 0.14).setOrigin(0).setDepth(2.5);
      }
    }
  }

  /** 레이아웃 내 무작위 개방 지점 — 적/오브젝트 스폰 공용 (결정적 rng 주입) */
  private openPointRng(
    rng: Phaser.Math.RandomDataGenerator,
    opts?: { minDist?: number; avoidEntry?: boolean }
  ): { x: number; y: number } {
    const lay = this.layout;
    if (!lay) return { x: rng.between(240, this.stageW - 160), y: rng.between(120, this.stageH - 120) };
    const idxs: number[] = [];
    for (let i = 0; i < lay.open.length; i++) {
      if (!lay.open[i]) continue;
      if (opts?.avoidEntry && i === lay.entry && lay.open.filter(Boolean).length > 2) continue;
      idxs.push(i);
    }
    if (idxs.length === 0) idxs.push(lay.entry);
    const minDist = opts?.minDist ?? 0;
    for (let tries = 0; tries < 24; tries++) {
      const cell = idxs[rng.between(0, idxs.length - 1)];
      const c = cellCenterOf(lay, cell);
      const x = c.x + rng.realInRange(-lay.cellW * 0.26, lay.cellW * 0.26);
      const y = c.y + rng.realInRange(-lay.cellH * 0.26, lay.cellH * 0.26);
      if (minDist > 0 && this.player && Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < minDist) continue;
      return { x, y };
    }
    return cellCenterOf(lay, idxs[rng.between(0, idxs.length - 1)]);
  }

  /** 실행 시점 무작위 개방 지점 (파편 등 — 재결정성 불필요) */
  private openPointAny(opts?: { minDist?: number }): { x: number; y: number } {
    return this.openPointRng(new Phaser.Math.RandomDataGenerator([`${Date.now()}-${Phaser.Math.Between(0, 1e9)}`]), opts);
  }

  /** 지점이 개방 영역인지 — 장식 배치 판정용 */
  private inOpenArea(x: number, y: number): boolean {
    return !this.layout || isOpenXY(this.layout, x, y);
  }

  /** v3.0.14 — 배치 겹침 방지: 지점이 기존 충돌 오브제(나무/바위) 중심에 너무 가까운지 */
  private nearSolidObstacle(x: number, y: number, minDist: number): boolean {
    for (const go of this.solidGroup.children.entries) {
      if (!go.active || !go.getData("obstacle")) continue;
      const s = go as Phaser.Physics.Arcade.Sprite;
      if (Phaser.Math.Distance.Between(x, y, s.x, s.y) < minDist) return true;
    }
    return false;
  }

  private placeDecor(stageKey: StageKey) {
    const def = this.stageDef;
    const ch = parseStage(stageKey).ch;
    const rng = new Phaser.Math.RandomDataGenerator([stageKey + "-decor"]);

    // 마을 건물/우물/주민 영역 보호 — 장식이 집 위에 심기지 않게
    const vx = def.width / 2;
    const vy = def.height / 2;
    const reserved: [number, number][] =
      STAGES[stageKey]?.isVillage
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
    // v3.0 (사용자 지시 #7) — 스바르트알프헤임(동굴) 초록 소나무 제거: 시든 나무·암석으로 교체
    const treeSet: string[] =
      ch === "niflheim" ? ["pine_snow"]
      : ch === "abyss" || ch === "hel" ? ["pine_dark"]
      : ch === "muspelheim" ? ["pine_dark", "ud_deadtree1", "ud_deadtree2"]
      : ch === "cave" || ch === "nidavellir" ? ["ud_deadtree1", "ud_deadtree2", "ud_deadtree3", "pine_dark"]
      : ["tree", "tree", "pine"];
    const rockTex = ch === "niflheim" ? "rock_snow" : ch === "abyss" || ch === "hel" ? "rock_dark" : ch === "muspelheim" || ch === "nidavellir" ? "rock_stone" : "rock";

    /* v2.1 자연 배치 — 군집 중심 산포 (v3.0.15 #18: 군집 반경 축소로 진로 봉쇄 완화) */
    const clusterN = ch === "village" ? 2 : 3;
    const clusters: [number, number][] = [];
    for (let i = 0; i < clusterN; i++)
      clusters.push([rng.between(200, this.stageW - 200), rng.between(140, this.stageH - 140)]);
    const natPoint = (): [number, number] => {
      if (rng.frac() < 0.55) {
        const [kx, ky] = rng.pick(clusters);
        return [
          Phaser.Math.Clamp(kx + (rng.frac() + rng.frac() - 1) * 250, 80, this.stageW - 80),
          Phaser.Math.Clamp(ky + (rng.frac() + rng.frac() - 1) * 180, 90, this.stageH - 80),
        ];
      }
      return [rng.between(80, this.stageW - 80), rng.between(90, this.stageH - 80)];
    };
    /* v3.0.15 (#18) — 오브젝트 수 축소: 진로 방해 완화. 배치수 0.7배 + 간격 48px.
     *  (v3.0.14에서 1.5배로 늘려 산맥처럼 막히던 문제 되돌림) */
    const treeN = Math.round(def.treeCount * 0.7);
    for (let i = 0; i < treeN; i++) {
      for (let tries = 0; tries < 6; tries++) {
        const [x, y] = natPoint();
        if (blocked(x, y)) continue;
        /* v3.0 — 개미굴 벽 셀에는 심지 않음 */
        if (!this.inOpenArea(x, y)) continue;
        if (this.nearSolidObstacle(x, y, 48)) continue;
        const tex = rng.pick(treeSet);
        const t = this.add.image(x, y, tex).setDepth(Math.floor(y / 10));
        this.solidGroup.add(t);
        /* v3.0.10 — 64x96 캔버스 하단 줄기 부근만 충돌 (캐노피는 통과)
         *  v3.0.10 후속 — 신규 나무(bbox 2~62, 하단 밀착) 줄기 폭 실측 (중앙 x20~44)
         *  v3.0.18 — 24x20→16x14: 줄기에 스치기만 해도 멈추는 "걸리는 느낌" 완화
         *  (중앙 x24~40 / y78~92 — 시각적 줄기보다 살짝 작게, 막힘은 유지) */
        (t.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 14).setOffset(24, 78);
        t.setData("obstacle", true);
        break;
      }
    }
    const rockN = Math.round(def.rockCount * 0.7);
    for (let i = 0; i < rockN; i++) {
      for (let tries = 0; tries < 6; tries++) {
        const [x, y] = natPoint();
        if (blocked(x, y)) continue;
        if (!this.inOpenArea(x, y)) continue;
        if (this.nearSolidObstacle(x, y, 48)) continue;
        const r = this.add.image(x, y, rockTex).setDepth(Math.floor(y / 10));
        this.solidGroup.add(r);
        /* v3.0.10 — 64x64 바위 하단 실측
         *  v3.0.18 — 44x28→36x20: 바위 모서리 걸림 완화 (x14~50 / y39~59) */
        (r.body as Phaser.Physics.Arcade.StaticBody).setSize(36, 20).setOffset(14, 39);
        r.setData("obstacle", true);
        break;
      }
    }

    // F1 핵심: 꽃은 def.flowerCount 송이만 (10 이하)
    const flowers = ["flower_r", "flower_y", "flower_w"];
    for (let i = 0; i < def.flowerCount; i++) {
      const x = rng.between(60, this.stageW - 60);
      const y = rng.between(60, this.stageH - 60);
      if (blocked(x, y)) continue;
      if (!this.inOpenArea(x, y)) continue;
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
        /* v3.0.19 — tile_magma 64→256px 텍스처 전환: 0.5→0.125 스케일 (시각 32px 동일 유지) */
        this.add.image(ex3, ey3, "tile_magma").setDepth(0).setScale(0.125).setTint(0xffb070);
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
    /* v2.6 수정 — 육식 식물류(cl_jawsplant 등)는 장식이 아니라 '위험 오브젝트'.
     *  (※ 능대 swampbeast는 몬스터명 — 이 오브젝트와는 별개)
     *  밟으면 챕터 배율에 비례한 접촉 데미지 + 씹기 연출 (버그: 닿아도 데미지 없음) */
    if (ch === "kingdom" || ch === "abyss") {
      const rng6 = new Phaser.Math.RandomDataGenerator(["cursed-plants"]);
      const hazardPlants = ["cl_jawsplant", "cl_eyeplant", "cl_manyeyes"];
      const passiveProps = ["cl_mflower", "cl_pustules", "cl_rock", "cl_bones"];
      const allProps = [...hazardPlants, ...passiveProps];
      for (let i = 0; i < 9; i++) {
        const px6 = rng6.between(120, this.stageW - 120);
        const py6 = rng6.between(70, this.stageH - 70);
        if (Math.abs(py6 - this.stageH / 2) < 85) continue;
        if (blocked(px6, py6)) continue;
        if (!this.inOpenArea(px6, py6)) continue;
        const tex6 = rng6.pick(allProps);
        const p6 = this.add.image(px6, py6, tex6).setDepth(1);
        if (hazardPlants.includes(tex6)) {
          // 육식 식물 — 목록 적재만 (오버랩은 플레이어 생성 후 일괄 등록)
          this.physics.add.existing(p6, true);
          (p6.body as Phaser.Physics.Arcade.StaticBody).setSize(56, 44); // center=true — 식물 중앙 배치
          this.plantHazards.push(p6);
          this.tweens.add({ targets: p6, scaleX: 1.06, scaleY: 0.96, duration: 900 + (i % 4) * 130, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        }
      }
    }

    // 마을 모닥불 (Serene Village, CC-BY) — 광장 남서 고정 + 글로우
    if (STAGES[stageKey]?.isVillage) {
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

  /** v2.6 — 육식 식물(jawsplant류) 접촉 데미지. 피격 처리(무적시간·연출)는 Player.takeDamage 재사용 */
  private hitPlantHazard(plant: Phaser.GameObjects.Image) {
    const p = this.player;
    if (p.state === "dead" || this.time.now < this.plantCd) return;
    this.plantCd = this.time.now + 700;
    const dir = new Phaser.Math.Vector2(p.x - plant.x, p.y - plant.y);
    if (dir.length() < 1) dir.set(1, 0);
    p.takeDamage(Math.round(16 * stageScale(this.stageDef.key).atk), dir.normalize(), 0, DMG_PCT.plant);
    this.tweens.add({ targets: plant, angle: { from: -9, to: 9 }, yoyo: true, duration: 70, repeat: 1, onComplete: () => plant.setAngle(0) });
    plant.setTint(0xff9a8a);
    this.time.delayedCall(220, () => plant.clearTint());
  }

  private spawnFragment(x: number, y: number) {
    /* v3.0.22 (#44) — 챕터별 결정 색상 (결정 본체+글로우+비컨 틴트) */
    const fmeta = FRAGMENT_META[parseStage(this.stageDef.key).ch];
    this.fragment = this.physics.add.sprite(x, y, "fragment").setDepth(4);
    if (fmeta) this.fragment.setTint(fmeta.color);
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
    /* v3.0.22 (#43/#44) — 챕터별 고유 결정: 이름·색·보너스(ATK 5→30)가 전부 다르다 */
    const ch = parseStage(this.stageDef.key).ch;
    const meta = FRAGMENT_META[ch] ?? { name: "결정의 흔적", color: 0x9df0ff, atk: 5, lines: ["결정이 손안에서 빛난다."] };
    this.player.atk += meta.atk; // 파편 보너스 — 챕터별 상이 (기존 고정 +5)
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
    this.spawnBurstAt(f.x, f.y, 14, meta.color);
    this.spawnPickupText(this.player.x, this.player.y - 80, `「${meta.name}」 획득! ATK +${meta.atk}`, "#9df0ff");
    /* v3.0.22 (#43) — 수확 멘트 다양화: 챕터 첫 수확은 스토리 대사, 이후엔 3종 랜덤 멘트 */
    const firstId = `fragment_${ch}`;
    if (DIALOGUES[firstId] && !this.seenSet.has(firstId)) {
      this.showDialogueOnce(firstId);
    } else {
      const line = meta.lines[Math.floor(Math.random() * meta.lines.length)];
      this.showDialogueRaw({ speaker: "{name}", lines: [line] });
    }
    /* v3.0.22 (#50) — 세계수의 가호: 아홉 챕터의 결정을 모두 수집하면 영구 해방 */
    this.fragmentsFound[ch] = (this.fragmentsFound[ch] ?? 0) + 1;
    if (!this.player.worldtreeBlessing && FRAGMENT_CHAPTERS.every((k) => (this.fragmentsFound[k] ?? 0) > 0)) {
      this.player.setWorldtreeBlessing(true);
      audio.sfx.levelup();
      this.spawnBurstAt(this.player.x, this.player.y, 26, 0x7de8ff);
      this.showBanner("세계수의 가호 해방! — ATK+20 · DEF+8 · HP+200 · 공격 +3% (영구)");
      if (!this.queuedDialogue) {
        this.markSeen("worldtreeBlessing");
        this.queuedDialogue = "worldtreeBlessing";
      }
      this.emitRpgState();
    }
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

  /**
   * v3.1.0 (#흑화) — 구역 전환 공통 게이트. 유저 지시 "가끔 맵 이동 시 검은 화면":
   *  포탈/부적/재림 등 여러 경로가 같은 프레임에 restart를 예약하거나 이중 호출되면
   *  init 데이터가 유실되어 create()가 비정상 종료 → 화면이 검은 채로 멈춘다.
   *  모든 전환을 단일 헬퍼로 모으고 transitioning 플래그로 1회만 실행되도록 막는다.
   */
  private gotoStage(next: StageKey, extra?: { entry?: { x: number; y: number }; replayBoss?: string; replayDiff?: string }) {
    if (this.transitioning) return;
    this.transitioning = true;
    // ⚠️ 다음 스테이지에 현재 스탯/소지품을 그대로 넘긴다
    //   (restart에 save를 안 넘기면 기본값 플레이어로 시작 — 골드/레벨/장비 소실 버그)
    // v3.2.0 (#흑화) — 세이브 직렬화/기록 실패가 씬 전환을 막아 검은 화면·멈춤으로
    //   이어지던 것을 차단: 예외가 나도 restart는 반드시 진행한다.
    let carry: SaveData | null = null;
    try {
      carry = this.buildSave(next);
      if (carry) writeSave(carry);
    } catch (e) {
      console.error("[SERTZ] 전환 세이브 실패 — 무시하고 이동", e);
    }
    this.scene.restart({ stage: next, save: carry ?? undefined, ...extra });
  }

  private enterPortal() {
    this.portalActive = false;
    audio.sfx.portal();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.player.state = "idle";
    /* v3.0.28 (#이동퀘스트) — 이동형(reach) 퀘스트 완료 판정 누락 수정:
     *  포탈을 타고 구역을 떠날 때 현재 퀘스트가 reach면 완료(advance) 처리 후 이동.
     *  기존엔 완료 처리 없이 씬만 전환해 세이브의 questIdx가 reach에 그대로 남아
     *  "숲의 신전으로"/"다음 해역으로"가 이동해도 영영 미완료로 유지됐다.
     *  (다음 퀘스트 배치는 새 구역 진입 복구 로직이 처리하므로 afterAdvance는 생략) */
    if (this.currentQuest()?.type === "reach") this.advanceQuest();
    // 구역 체인 — 마을 → forest1..10 → kingdom1..10 → … → abyss10 순차 진행
    const next: StageKey | null = NEXT_STAGE[this.stageDef.key];
    if (!next) return;
    /* v3.0.25 (#다음퀘스트 자동추적) — 다음 구역으로 진행하면 추적도 자동으로 따라간다
     *  (기존은 이전 구역 추적이 유지돼 화살표가 뒤를 가리켰다) */
    if (this.trackedStage === this.stageDef.key) {
      this.trackedStage = next;
      this.emitQuestLog();
    }
    this.time.delayedCall(520, () => this.gotoStage(next));
  }

  /* ================= 복귀 차원문 (v2.0 — 메이플식 자유 왕복, 지시 #8) ================= */

  /** 이전 구역으로 돌아가는 청록 차원문 — 스폰 지점 왼쪽에 항상 활성 */
  private spawnReturnPortal() {
    const prev = PREV_STAGE[this.stageDef.key];
    if (!prev || !this.player) return;
    /* v3.0 (#7) — 필드는 입구 셀 중심에 복귀 차원문 (마을은 기존 좌측 가장자리) */
    const rx = this.layout ? this.entryHome.x - 80 : 110;
    const ry = this.layout ? this.entryHome.y : this.stageH * 0.52;
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
    /* v3.3.0 (지시 #6) — 무릉도장 복귀: 들어오기 전 구역으로 (기록 없으면 마을) */
    const prev: StageKey | null = this.stageDef.key === "dojang"
      ? (STAGES[this.dojangFrom] ? this.dojangFrom : "village")
      : PREV_STAGE[this.stageDef.key];
    if (!prev) return;
    /* v3.3.0 — 무릉도장 중간 퇴장 시 기록 확정 */
    if (this.dojangActive) this.finishDojang(true);
    this.returnActive = false;
    audio.sfx.portal();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.player.state = "idle";
    this.time.delayedCall(520, () => this.gotoStage(prev));
  }

  /* ================= 시작 마을 (인간들의 마을) ================= */

  private buildVillage() {
    const cx = this.stageW / 2;
    const cy = this.stageH / 2;

    // 광장 우물 (중앙 랜드마크, 충돌 있음) — 접근 시 샘물 회복
    const well = this.add.image(cx, cy, "well").setDepth(Math.floor(cy / 10));
    this.solidGroup.add(well);
    (well.body as Phaser.Physics.Arcade.StaticBody).setSize(68, 38).setOffset(14, 57); // v3.0.10 — 분수 72x72 하단 실측
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
    // v3.0 (#4) — 챕터 마을은 챕터 분위기색 틴트 + 마을 간판
    const chKey = parseStage(this.stageDef.key).ch;
    const vSpec = chKey !== "village" ? CHAPTER_VILLAGE_NPC[chKey] : undefined;
    const chSpec = chapterSpec(this.stageDef.key);
    const houses: { x: number; y: number; tex: string; flip?: boolean }[] = [
      { x: cx - 400, y: cy - 170, tex: "house_a" },
      { x: cx + 90, y: cy - 200, tex: "house_b" },
      { x: cx - 190, y: cy + 215, tex: "house_a", flip: true },
    ];
    for (const h of houses) {
      const img = this.add.image(h.x, h.y, h.tex).setDepth(Math.floor(h.y / 10));
      if (vSpec) img.setTint(vSpec.houseTint);
      if (h.flip) img.setFlipX(true);
      this.solidGroup.add(img);
      const bw = h.tex === "house_a" ? 110 : 100;
      (img.body as Phaser.Physics.Arcade.StaticBody)
        .setSize(bw, 56)
        .setOffset((img.width - bw) / 2, img.height - 66);
    }
    // v3.0 (#4) — 챕터 마을 간판 (마을 이름을 알려준다)
    if (chSpec && vSpec) {
      this.addBuildingSign(cx, cy - 320, `${chSpec.title} 마을`, vSpec.signColor);
    }
    // 건물 간판 + 기능 상호작용 — 여관(회복+저장), 내 집(무료 휴식), 전직관(카이엔 앞)
    this.addBuildingSign(cx - 400, cy - 236, "여관 — 20G 회복+저장", "#7de8ff");
    this.addBuildingSign(cx + 90, cy - 266, "전직관", "#ffd76a");
    this.addBuildingSign(cx - 190, cy + 149, "내 집 — 무료 휴식", "#9af0c8");
    this.interactables.push({ x: cx - 400, y: cy - 140, kind: "inn", label: "여관 — 들어가기" });
    this.interactables.push({ x: cx - 190, y: cy + 289, kind: "house", label: "내 집 — 들어가기" });

    // 마을 주민 2인 — E키 상호작용 (접근 자동 트리거 제거, 바운스 애니 + 이름표 유지)
    // v3.0 (#4) — 챕터마다 이름/대사가 다른 주민 배치 (본마을은 기존 주민)
    const villagers: { x: number; y: number; tex: string; name: string; dlg: string }[] = vSpec
      ? [
          { x: cx + 210, y: cy + 120, tex: vSpec.npcA.tex, name: vSpec.npcA.name, dlg: vSpec.npcA.dlg },
          { x: cx - 90, y: cy - 90, tex: vSpec.npcB.tex, name: vSpec.npcB.name, dlg: vSpec.npcB.dlg },
        ]
      : [
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

    /* v3.0.3 (사용자 지시 #2) — 임시 GM NPC: 자유전직/골드/레벨 지원
     *  마을 전직관 옆에 배치. E키 → GM 패널 (전직 무제한/골드/레벨 조정) */
    const gx = jx + 70;
    const gy = jy + 6;
    const gglow = this.add.image(gx, gy + 14, "glow").setDepth(1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe9a0).setScale(0.75).setAlpha(0.3);
    this.tweens.add({ targets: gglow, alpha: 0.5, scale: 0.95, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const gmNpc = this.add.image(gx, gy, "npc_gm").setDepth(Math.floor(gy / 10)).setScale(1.15);
    this.tweens.add({ targets: gmNpc, y: gy - 3, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.add
      .text(gx, gy - 46, "GM", {
        fontFamily: "sans-serif", fontSize: "12px", color: "#ffd76a",
        stroke: "#1a1020", strokeThickness: 4, fontStyle: "bold",
      })
      .setOrigin(0.5).setDepth(21);
    this.add
      .text(gx, gy - 34, "운영자 지원", {
        fontFamily: "sans-serif", fontSize: "10px", color: "#ffe9b0",
        stroke: "#000000", strokeThickness: 3,
      })
      .setOrigin(0.5).setDepth(21);
    this.interactables.push({ x: gx, y: gy, kind: "gm", npcId: "gm", label: "GM — 자유전직·골드·레벨·5차전직·무릉도장" });
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
    for (const s of this.hitFxPool) s.destroy();
    this.hitFxPool = [];

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

    /* v3.0.8 디자인 개편 — Warped 히트 플립북 6장 고정 풀 */
    for (let i = 0; i < 6; i++) {
      const s = this.add
        .sprite(0, 0, "vfx2_hit1")
        .setDepth(24)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setActive(false)
        .setVisible(false);
      this.hitFxPool.push(s);
    }
  }

  /** v3.0.15 (#16) — color/prefix 지원: 원소 약점 시 원소색 + "약점" 접두 표시
   *  v3.3.0 (지시 #9) — 크리티컬 펀치 스케일 + 큰 글씨 (타격감 강화) */
  spawnDamageText(x: number, y: number, val: number, crit = false, color?: string, prefix?: string) {
    const t = this.dmgPool.find((d) => d.scene && !d.active);
    if (!t) return; // 풀 소진 시 조용히 포기 (프레임 보호)
    // 크리티컬: 금색 큰 글씨 + 느낌표 (타격감 강조) · 약점: 원소색
    const c = color ?? (crit ? "#ffd76a" : "#ffffff");
    const label = `${prefix ? prefix + " " : ""}${val}${crit ? "!" : ""}`;
    t.setText(label).setColor(c);
    t.setPosition(x, y)
      .setActive(true)
      .setVisible(true)
      .setAlpha(1)
      .setScale(crit ? 1.75 : 1.08);
    this.tweens.add({
      targets: t,
      y: y - (crit ? 52 : 36),
      alpha: 0,
      scale: crit ? 1.15 : 0.92, // 펀치 스케일 — 튀어오르다 살짝 수축
      duration: crit ? 740 : 560,
      ease: "Quad.out",
      onComplete: () => t.setActive(false).setVisible(false),
    });
  }

  spawnHitSpark(x: number, y: number) {
    /* v3.3.0 (지시 #9) — 타격 스파크 5→9개로 증량 (화면이 더 밝게 터진다) */
    this.hitEmitter.setParticleTint(0xfff0a0);
    this.hitEmitter.explode(9, x, y);

    /* v3.0.8 디자인 개편 — Warped Hits 플립북 오버레이 (3종 랜덤, ADD 블렌드) */
    const fx = this.hitFxPool.find((s) => s.scene && !s.active);
    if (fx) {
      const anim = Phaser.Utils.Array.GetRandom(["fx2-hit1", "fx2-hit3", "fx2-hit5"]);
      fx.setPosition(x, y - 4)
        .setScale(0.55)
        .setActive(true)
        .setVisible(true)
        .setAlpha(0.95)
        .play(anim);
      fx.once("animationcomplete", () => fx.setActive(false).setVisible(false));
    }

    // v2.2 타격감 — 충격 링 (shock_ring 확산)
    const ring = this.add.image(x, y, "shock_ring").setDepth(19).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.85).setTint(0xfff2c0);
    this.tweens.add({
      targets: ring,
      scale: 0.85,
      alpha: 0,
      duration: 170,
      ease: "Cubic.out",
      onComplete: () => ring.destroy(),
    });

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
    /* v3.0 (#7) — 필드는 입구 셀 안에 상인 배치 (개미굴 벽에 묻히지 않게) */
    const mx = this.layout ? this.entryHome.x - 120 : 340;
    const my = this.layout ? this.entryHome.y - 40 : this.stageH / 2 - 60;
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
    } else {
      /* v3.0.6 (지시 #9) — 보스 전용 드롭 아이템: 인벤토리 지급
       *  상점 판매 금지(tradeLock) — 추후 유저 거래소에서 사고팔 예정 */
      const it = ITEMS[kind as ItemKey];
      if (!it) return;
      this.player.owned.push(kind as ItemKey);
      audio.sfx.questDone();
      this.spawnPickupText(x, y - 14, viaPet ? `${it.name} (펫)` : `${it.name} 획득!`, "#ffd76a");
      this.showBanner(`${it.name} 획득! — 보스 전용 아이템 (상점 판매 금지 · 거래소 예정)`);
      this.emitRpgState();
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
    /* v3.0 (#7) — 개미굴 벽 셀을 어두운 블록으로 표시 */
    if (this.layout) {
      const lay = this.layout;
      mm.fillStyle(0x2a3550, 0.9);
      const cw = (lay.cellW / this.stageW) * gw;
      const chh = (lay.cellH / this.stageH) * gh;
      for (let r = 0; r < lay.rows; r++) {
        for (let c = 0; c < lay.cols; c++) {
          if (lay.open[r * lay.cols + c]) continue;
          mm.fillRect(mx(c * lay.cellW), my(r * lay.cellH), cw + 0.5, chh + 0.5);
        }
      }
    }
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
  spawnSlash(x: number, y: number, dir: Phaser.Math.Vector2, alt: boolean, scale = 1, tint?: number) {
    const s = this.slashPool[this.slashIdx];
    this.slashIdx = (this.slashIdx + 1) % this.slashPool.length;
    if (!s || !s.scene) return;
    this.tweens.killTweensOf(s);
    s.off("animationcomplete"); // 재사용 시 지연된 완료 콜백 제거
    const base = Math.atan2(dir.y, dir.x);
    if (tint) s.setTint(tint); // v3.0.2 — 계열별 검기 색 (도적 보라 등)
    else s.clearTint();
    s.setPosition(x + dir.x * 30, y - 6 + dir.y * 16)
      .setRotation(base + (alt ? -0.28 : 0.28))
      .setActive(true)
      .setVisible(true)
      .setAlpha(1)
      .setScale(1.35 * scale) // 사용자 지시: 검 이펙트 크게 (원본 64x76 → 실제 표시 ~86x103)
      .play("fx-slash");
    s.once("animationcomplete", () => {
      s.setActive(false).setVisible(false).clearTint();
    });
    /* v3.3.0 (지시 #9) — 참격 글로우 링: 검기가 지나가는 자리에 확산 링이 겹쳐진다 */
    const glowRing = this.add
      .image(x + dir.x * 34, y - 6 + dir.y * 16, "shock_ring")
      .setDepth(24)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint ?? 0xfff2c0)
      .setScale(0.2 * scale)
      .setAlpha(0.7);
    this.tweens.add({
      targets: glowRing,
      scale: 0.62 * scale,
      alpha: 0,
      duration: 210,
      ease: "Cubic.out",
      onComplete: () => glowRing.destroy(),
    });
  }

  /** v3.0.2 — 궁수 활 비주얼: 발사 순간 활 프레임 표시 (20x20, 각도 회전) */
  spawnBow(x: number, y: number, angle: number) {
    // v3.0.4 — 활 텍스처는 오른쪽(촉 방향)을 향하므로 조준각 그대로 회전 (기존 +90° 오프셋 제거 — 지시 #1)
    const bow = this.add.image(x, y, "x2_bow").setDepth(11).setRotation(angle).setScale(1.15);
    this.tweens.add({
      targets: bow,
      alpha: 0,
      scale: 0.85,
      duration: 170,
      onComplete: () => bow.destroy(),
    });
  }

  /** v3.0.2 — 마법사 시전 이펙트: 손 앞 마나 불꽃 (Pixelart Spells 6프레임 1회) */
  spawnCast(x: number, y: number) {
    const fx = this.add.sprite(x, y, "x2_sp_sparks").setDepth(11).setScale(1.2);
    fx.play("fx-sparks");
    fx.once("animationcomplete", () => fx.destroy());
  }

  /* ================= 히트스톱 / 타격감 ================= */

  /** F5: 명중 시 히트스톱 + 등급별 카메라 셰이크 — '베인' 느낌의 핵심.
   *  기본공격(basic)은 히트스톱 65ms 유지로 타격감을 살리고 흔들림은 최소로 절제,
   *  크리티컬(crit)/스킬(skill)만 더 강한 흔들림으로 대비를 만든다. (피드백: 기본공격 흔들림 과다) */
  onMeleeConnect(_hits: number, profile: ImpactKind = "basic") {
    audio.sfx.hit();
    this.impactFX.trigger(profile);
  }

  onEnemyKilled(key: EnemyKey, exp: number, spawnX: number, spawnY: number, ref?: Enemy | Boss) {
    // alive 플래그 기준으로 정리 (죽은 개체 즉시 제외)
    this.enemies = this.enemies.filter((e) => e.alive);
    if (this.eliteEnemy && !this.eliteEnemy.alive) this.eliteEnemy = null;
    /* v3.0.16 — 필드 정예 처치 보상: 에메랄드 +1 확정 (메이플 엘리트 몬스터 컨셉) */
    if (this.fieldEliteRef && !this.fieldEliteRef.alive) {
      this.fieldEliteRef = null;
      this.player.emerald += 1;
      this.spawnPickupText(this.player.x, this.player.y - 74, "정예 처치! +1 에메랄드", "#7de8ff");
      audio.sfx.questDone();
      this.emitRpgState();
    }
    this.totalKills++;
    this.registry.set("runKills", this.totalKills);
    /* v3.0.15 (#20) — 콤보킬 보너스 경험치: 5초 내 연속 킬 시 콤보×5% (최대 +50%).
     *  콤보 3 이상부터 "연속킬 xN" 플로팅 텍스트로 연출 */
    const nowMs = this.time.now;
    this.comboStreak = nowMs < this.comboUntil ? this.comboStreak + 1 : 1;
    this.comboUntil = nowMs + 5000;
    const comboMul = 1 + Math.min(0.5, (this.comboStreak - 1) * 0.05);
    this.player.gainExp(Math.round(exp * comboMul));
    if (this.comboStreak >= 3) {
      const pct = Math.round((comboMul - 1) * 100);
      this.spawnPickupText(this.player.x, this.player.y - 52 + (this.comboStreak % 2) * 12, `연속킬 x${this.comboStreak}! EXP +${pct}%`, "#ffd76a");
    }
    this.killTotals[key] = (this.killTotals[key] ?? 0) + 1;
    /* v3.0.16 — 몬스터 컬렉션 등록 (최초 처치 시) */
    this.registerCollection(key, ENEMIES[key].name);
    /* v3.0.16 — 멀티킬 연출 (1.5초 내 다중 처치 등급 표시 — 메이플 멀티킬) */
    this.multiKillCount = nowMs < this.multiKillUntil ? this.multiKillCount + 1 : 1;
    this.multiKillUntil = nowMs + 1500;
    if (this.multiKillCount >= 2) {
      const mk = WorldScene.MULTI_KILL_META[Math.min(this.multiKillCount, 5) - 2];
      this.spawnPickupText(this.player.x + 18, this.player.y - 66 + (this.multiKillCount % 2) * 10, mk.label, mk.color);
      if (this.multiKillCount >= 5) this.cameras.main.shake(140, 0.004);
    }
    // 리스폰 예약 — v2.3 단축: 9~13초 → 3.2~4.8초 (지시 #2 — 리젠이 너무 길어 사냥이 끊긴다)
    // v3.1.0 (#전직시련) — 시험 상대는 리스폰하지 않는다. 기존엔 시련 상대(golem 기반)를
    //  잡으면 일반 몬스터 리스폰 큐에 등록돼 "시련 후 약한 몬스터가 계속 소환"되었다.
    if (ref && ref === this.jobTrialEnemy) {
      /* 시련 상대 — 재소환 금지 (재도전은 카이엔에게 말 걸기) */
    } else {
      this.time.delayedCall(Phaser.Math.Between(3200, 4800), () =>
        this.respawnEnemy(key, spawnX, spawnY, 0)
      );
    }
    const q = this.currentQuest();
    if (q && q.type === "hunt") {
      if (!this.repeatActive() && !this.isQuestAccepted(this.stageDef.key, this.questIdx)) {
        /* v3.0.15 (#8) — 미수락 토벌 퀘스트는 카운트하지 않는다 */
      } else if (this.repeatActive()) {
        // 반복 토벌 의뢰 — 메인 체인 종료 후 무한 파밍 (사이클별 카운트)
        if (q.targetKey === key) {
          this.huntCount++;
          if (this.huntCount >= this.repeatNeed) this.completeRepeat();
          else this.emitQuest();
        }
      } else if (q.targetKeys ? q.targetKeys.includes(key) : q.targetKey === key) {
        // v2.0 수정 (지시 #17) — 퀘스트 대상 몬스터만 카운트
        // v3.0.28 (#퀘스트이름) — targetKeys 지정(자동 토벌) 시 구역 몬스터 전체 합산 카운트
        this.huntCount = Math.min(this.huntProgressSum(q), q.need ?? 0);
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
        } else if (step.type === "elite" && (ref === this.jobTrialEnemy || (this.jobEliteSummoned && this.eliteEnemy === null))) {
          // 소환된 시험 상대 처치 → 단계 완료
          // v3.0.22 (#46) — 죽은 개체 참조 기반 판정(기존 eliteEnemy null 우연 의존 → 시험 상대가
          //  몇 번이고 재소환되던 무한 루프 제거). 참조 일치 시에만 완료 처리
          this.jobTrialEnemy = null;
          this.jobEliteSummoned = false;
          this.completeJobStoryStep();
        }
      }
    }
    /* v3.3.0 (지시 #8) — 5차 각성 시련: 각성의 수호자 격파 → 각성 완료 의식 */
    if (ref && ref === this.fifthTrialEnemy) {
      this.fifthTrialEnemy = null;
      this.fifthTrialActive = false;
      this.completeFifthTrial();
    }
    this.emitQuest();
  }

  /** 메인 체인 완료 후 반복 의뢰 활성 여부
   *  v2.3 (지시 #4): 스토리 체인이 끝나도 자동 활성되지 않는다 —
   *  마을 상인에게 말을 걸어 수주해야 [반복] 토벌 의뢰가 퀘스트창에 뜬다 */
  private repeatActive(): boolean {
    return this.repeatOn && this.questIdx >= this.stageDef.quests.length && !!this.stageDef.repeat;
  }

  /** 반복 의뢰 시스템 수주 가능 여부 — v3.0.26 (#76): 일퀘(라고스 의뢰)는
   *  "전체 스토리(최종 보스) 완료 후"에만 해금 (사용자 요구: 메이플식 엔드게임 일일의뢰).
   *  v3.0.15 (#3)의 "대화만 하면 항상 수주" 완화를 폐지 — 스토리 진행 중엔 라고스가
   *  그냥 상점으로만 응대한다. 기존에 repeatOn=true로 수주해둔 유저는 그대로 진행 유지. */
  private repeatUnlockable(): boolean {
    if (this.repeatOn || this.isInterior) return false;
    return this.cleared;
  }

  /* ================= v3.3.0 (지시 #6) — 무릉도장 (메이플 무릉도장 오마주) =================
   *  GM NPC → 무릉도장 입장 → 90초 동안 허수아비를 자유롭게 공격해 누적 피해를 기록.
   *  종료(시간 경과 or 중간 퇴장) 시 기록 + 최고 기록(localStorage) + 훈련 보상 지급. */

  /** GM → 무릉도장 입장 (어느 구역에서든 — 복귀는 원 구역) */
  enterDojang() {
    if (!this.player || this.transitioning) return;
    if (this.stageDef.key === "dojang") return;
    this.dojangFrom = this.stageDef.key; // 퇴장 시 이 구역으로 복귀
    this.showBanner("무릉도장으로 이동합니다 — 90초 동안 최대한 많은 피해를!");
    this.gotoStage("dojang");
  }

  /** 무릉도장 빌드 — 허수아비 6기 + 중앙 문양 + 타이머/기록 UI */
  private buildDojang() {
    const cx = this.stageW / 2;
    const cy = this.stageH / 2;
    /* 도장 중앙 문양 (Add 링 2겹 + 중심 원) */
    const emblem = this.add.circle(cx, cy, 150).setStrokeStyle(4, 0xc8a05a, 0.35).setDepth(1);
    const emblem2 = this.add.circle(cx, cy, 110).setStrokeStyle(2, 0xc8a05a, 0.28).setDepth(1);
    const emblemFill = this.add.circle(cx, cy, 56, 0xc8a05a, 0.12).setDepth(1);
    void emblem2;
    this.tweens.add({ targets: emblem, scale: 1.04, alpha: 0.7, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    void emblemFill;
    this.add
      .text(cx, 66, "無 量 道 場", {
        fontFamily: "sans-serif",
        fontSize: "30px",
        color: "#e8c88a",
        stroke: "#1a1020",
        strokeThickness: 6,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(90)
      .setScrollFactor(0)
      .setAlpha(0.9);
    /* 훈련용 허수아비 6기 — 2열 배치 (dummy = AI/사망 없음, 피해 누적만) */
    for (let i = 0; i < 6; i++) {
      const dx = cx - 260 + (i % 3) * 260;
      const dy = cy - 80 + Math.floor(i / 3) * 170;
      const e = new Enemy(this, dx, dy, "golem", {
        hp: 1, atk: 0, exp: 0, gold: 0,
        scale: 1.55, tint: 0xd8b06a,
        displayName: "훈련용 허수아비",
        dummy: true,
      });
      this.enemies.push(e);
      this.physics.add.collider(e, this.solidGroup);
    }
    /* 타이머/기록 UI (화면 고정) */
    this.dojangText = this.add
      .text(cx, 108, "", {
        fontFamily: "sans-serif",
        fontSize: "17px",
        color: "#ffe66a",
        stroke: "#1a1020",
        strokeThickness: 5,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(96)
      .setScrollFactor(0);
    /* 도장 개시 */
    this.dojangActive = true;
    this.dojangScore = 0;
    this.dojangEndsAt = this.time.now + 90000;
    this.dojangTextAcc = 0;
    this.showBanner("무릉도장 입장! 90초 동안 허수아비에게 최대 피해를 기록하라");
  }

  /** 허수아비 피해 누적 — Enemy.takeDamage(dummy)에서 호출 */
  addDojangScore(v: number) {
    if (this.dojangActive) this.dojangScore += v;
  }

  /** 무릉도장 진행 (update에서 매 프레임 — UI는 100ms 스로틀) */
  private tickDojang(dt: number) {
    this.dojangTextAcc += dt;
    if (this.dojangTextAcc >= 100) {
      this.dojangTextAcc = 0;
      const remain = Math.max(0, this.dojangEndsAt - this.time.now);
      this.dojangText?.setText(
        `무릉도장  ${Math.ceil(remain / 1000)}초  |  기록: ${this.dojangScore.toLocaleString()}`
      );
    }
    if (this.time.now >= this.dojangEndsAt) this.finishDojang(false);
  }

  /** 무릉도장 종료 — 기록/최고기록/보상 정산 (early=true면 중간 퇴장) */
  finishDojang(early: boolean) {
    if (!this.dojangActive) return;
    this.dojangActive = false;
    const score = this.dojangScore;
    const KEY = "sertz.dojang.best";
    let best = 0;
    try { best = Number(localStorage.getItem(KEY) ?? "0") || 0; } catch { best = 0; }
    const record = score > best && score > 0;
    if (record) {
      try { localStorage.setItem(KEY, String(score)); } catch { /* 저장 불가 환경 무시 */ }
    }
    const reward = Math.min(30000, Math.round(score / 250));
    if (reward > 0) this.player.addGold(reward);
    this.dojangText?.setText(
      `무릉도장 ${early ? "중단" : "종료"} — 기록: ${score.toLocaleString()}${record ? " (신기록!)" : ""}`
    );
    EventBus.emit("reward:show", {
      title: early ? "무릉도장 — 훈련 중단" : "무릉도장 — 훈련 종료!",
      lines: [
        { text: `누적 피해: ${score.toLocaleString()}`, color: "#ffe66a" },
        { text: record ? "신기록 달성!" : `최고 기록: ${Math.max(best, score).toLocaleString()}`, color: record ? "#7dffa8" : "#a8ecff" },
        { text: reward > 0 ? `훈련 보상 +${reward.toLocaleString()} G` : "보상 없음 — 더 세게 때려라!", color: "#ffd76a" },
      ] satisfies RewardPopupState["lines"],
    });
    audio.sfx.questDone();
    this.emitRpgState();
  }

  /* ================= v3.3.0 (지시 #8) — 5차 각성 스토리/시련 ================= */

  /** 각성 챕터 카드 → 각성의 수호자 소환 (resumeFromDialogue에서 호출) */
  private startFifthTrial() {
    if (!this.player || this.fifthTrialActive) return;
    this.fifthTrialActive = true;
    audio.sfx.questDone();
    /* 챕터 카드 규약 재사용 — "각성" 타이틀 카드 (physics 정지 + 자동 복귀 내장) */
    this.showChapterCard(5, "각성 — 제5의 문", "모든 스킬이 극으로, 궁극기가 손에 쥐어진다", () => {
      this.summonFifthGuardian();
    });
  }

  /** 각성의 수호자 소환 — 카이엔 근처, 레벨 비례 강력한 정예 */
  private summonFifthGuardian() {
    if (!this.player) return;
    if (this.fifthTrialEnemy && this.fifthTrialEnemy.alive) {
      this.showBanner("이미 각성의 수호자가 있어!");
      return;
    }
    const lv = Math.max(1, this.player.lv);
    const e = new Enemy(this, this.player.x + 110, this.player.y - 30, "runegolem", {
      hp: 10 + lv * 4,
      atk: 1 + lv * 0.18,
      exp: 6 * lv,
      gold: 3 * lv,
      scale: 1.8,
      tint: 0xffd76a,
      displayName: "각성의 수호자",
    });
    e.dmgPct = DMG_PCT.elite;
    this.fifthTrialEnemy = e;
    this.enemies.push(e);
    this.physics.add.collider(e, this.solidGroup);
    this.spawnPillar(e.x, e.y, 0xffd76a, 260);
    this.spawnBurstAt(e.x, e.y, 40, 0xffd76a);
    this.showBanner("각성의 수호자 출현! 쓰러트려 5차 각성을 증명하라");
    audio.sfx.roar();
    this.cameras.main.shake(280, 0.008);
  }

  /** 각성 완료 의식 — fifth 플래그 + 풀 의식 FX + 완료 대사 + 세이브 */
  private completeFifthTrial() {
    if (!this.player) return;
    const p = this.player;
    p.fifthStoryDone = true;
    p.fifth = true;
    p.healFull();
    p.skill5Cd = 0;
    audio.sfx.levelup();
    this.spawnLevelUpFx(p.x, p.y);
    this.spawnPillar(p.x, p.y, 0xffe66a, 300);
    this.spawnBurstAt(p.x, p.y, 80, 0xffe66a);
    this.spawnCrack(p.x, p.y);
    this.cameras.main.flash(240, 255, 230, 120);
    this.cameras.main.shake(460, 0.02);
    EventBus.emit("banner:show", {
      text: "5차 각성 완료! 전 스킬 ·극 강화 + 세부 직업 고유 궁극기(N) 해금",
    });
    this.showDialogueRaw({
      speaker: "카이엔",
      lines: [
        "...드디어 제5의 문이 열렸다. 그대는 이제 '극'의 경지에 섰다.",
        "모든 스킬이 강화됐고 쿨타임도 짧아졌다. 그리고—",
        "N 키 (모바일은 황금 버튼)로 그대만의 궁극기를 쏟아내라!",
      ],
    });
    this.emitSkills();
    this.emitRpgState();
    this.save();
  }

  /* ================= v3.0.22 (#38) — 전직 퀘스트 게이트 =================
   *  "전직 퀘스트를 완료해야만 전직 시켜줘야지!!" — 레벨 조건만으로 전직되던 것을
   *  퀘스트 완료까지 요구한다.
   *  v3.1.0 (#전직스토리선행) — 순서 반영: 미전직 → 마을 체인 완료 후 계열 선택 시
   *  1차 시련 스토리 시작(선택 즉시 전직 아님), 1→2차 · 2→3차 → 다음 차수의
   *  [전직 시련] 스토리 완료가 승격 잠금 해제 조건. */
  private jobQuestCleared(): boolean {
    const tier = chainOf(this.player?.cls ?? "").length;
    if (tier >= 3) return true;
    if (tier === 0) {
      const vq = STAGES["village"].quests.length;
      return (this.savedQuestIdx["village"] ?? 0) >= vq;
    }
    // 1차 → 2차: 2차 시련 완료 / 2차 → 3차: 3차 시련 완료
    return this.jobStoryDone.includes((tier + 1) as 2 | 3);
  }

  /** 전직 잠금 사유 문구 (패널 표기용 — null이면 퀘스트 조건 충족) */
  private jobQuestLockText(): string | null {
    const tier = chainOf(this.player?.cls ?? "").length;
    if (tier >= 3) return null;
    if (tier === 0) {
      const vq = STAGES["village"].quests.length;
      if ((this.savedQuestIdx["village"] ?? 0) < vq) return "마을 퀘스트 체인 완료 (이그니와 함께)";
      return null;
    }
    if (!this.jobStoryDone.includes((tier + 1) as 2 | 3)) {
      return tier === 1
        ? "[전직 시련] 2차 스토리 완료 필요 (카이엔과 대화)"
        : "[전직 시련] 3차 스토리 완료 필요 (카이엔과 대화)";
    }
    return null;
  }

  /** v3.0.22 (#43) — 동적 단발 대사 (DIALOGUES 테이블 밖 — 결정 수확 랜덤 멘트) */
  private showDialogueRaw(d: { speaker: string; lines: string[] }) {
    if (!this.player) return;
    this.activeNpcId = null;
    this.dialoguing = true;
    this.dialogueSince = this.time.now; // v3.3.0 — 대사 붙임 자가치유 기준 시각
    this.player.setVelocity(0, 0);
    this.physics.world.pause();
    EventBus.emit("dialogue:show", d);
  }

  /* ================= v3.0.22 (#47) — 추적 퀘스트 구역 자동 여행 =================
   *  추적 구역이 다르면 경유 포탈 좌표를 반환한다. 전진 포탈은 체인 완료(활성)일 때만,
   *  복귀 포탈은 항상. 포탈이 잠긴 구역은 null — 자동사냥이 현 구역 체인을 진행한다. */
  private autoTravelPortal(): { x: number; y: number } | null {
    if (!this.trackedStage || this.trackedStage === this.stageDef.key || this.isInterior) return null;
    const path = this.stagePathTo(this.trackedStage);
    if (!path || path.length === 0) return null;
    const next = path[0];
    if (NEXT_STAGE[this.stageDef.key] === next) {
      if (this.portal?.active && this.portalActive) return { x: this.portal.x, y: this.portal.y };
      return null;
    }
    if (PREV_STAGE[this.stageDef.key] === next) {
      if (this.returnPortal?.active) return { x: this.returnPortal.x, y: this.returnPortal.y };
      return null;
    }
    return null;
  }

  /** 현재 구역 → 목표 구역 최단 경로 (NEXT/PREV 양방향 BFS — 다음 경유지만 반환) */
  private stagePathTo(target: string): string[] | null {
    const cur = this.stageDef.key;
    if (target === cur) return [];
    const prev = new Map<string, string | null>([[cur, null]]);
    const queue: string[] = [cur];
    while (queue.length) {
      const s = queue.shift()!;
      for (const nx of [NEXT_STAGE[s as StageKey], PREV_STAGE[s as StageKey]]) {
        if (!nx || prev.has(nx)) continue;
        prev.set(nx, s);
        if (nx === target) {
          const path: string[] = [];
          let c: string | null = nx;
          while (c && c !== cur) {
            path.unshift(c);
            c = prev.get(c) ?? null;
          }
          return path;
        }
        queue.push(nx);
      }
    }
    return null;
  }

  /** 반복 토벌 완료 — 보상 지급 후 목표 +2 (무한 확장) */
  private completeRepeat() {
    const r = this.stageDef.repeat!;
    audio.sfx.questDone();
    this.player.addGold(r.gold);
    this.player.gainExp(r.exp);
    this.spawnPickupText(this.player.x, this.player.y - 44, `토벌 완료 +${r.gold}G`, "#ffd76a");
    /* v3.0.16 — 반복 의뢰 보상 수령 팝업 */
    EventBus.emit("reward:show", {
      title: "반복 토벌 의뢰 완료!",
      lines: [
        { text: `골드 +${r.gold} G`, color: "#ffd76a" },
        { text: `경험치 +${r.exp} EXP`, color: "#8fe84a" },
        { text: "에메랄드 +1", color: "#7de8ff" },
      ],
    } satisfies RewardPopupState);
    this.huntCount = 0;
    this.repeatNeed += 2;
    /* v3.0.6 — 반복 의뢰 사이클 완료 보너스 에메랄드 +1 */
    this.player.emerald += 1;
    this.spawnPickupText(this.player.x, this.player.y - 58, "+1 에메랄드", "#7de8ff");
    this.save();
    this.emitRpgState();
    this.emitQuest();
    this.emitRpgState();
  }

  /** v3.0.16 — 멀티킬 등급 메타 (더블킬~펜타킬) */
  static MULTI_KILL_META = [
    { label: "더블킬!", color: "#7dd8ff" },
    { label: "트리플킬!", color: "#c08aff" },
    { label: "쿼드라킬!", color: "#ffd76a" },
    { label: "펜타킬!!", color: "#ff8a5c" },
  ];

  /** v3.0.16 — 컬렉션 등록: 최초 처치 시 등록 연출 + 보너스 스탯 재계산 + 영구 세이브 */
  private registerCollection(id: string, name: string) {
    const before = Object.keys(this.monsterKills).length;
    this.monsterKills[id] = (this.monsterKills[id] ?? 0) + 1;
    const after = Object.keys(this.monsterKills).length;
    if (after === before) return;
    this.player.setCollection(after);
    this.spawnPickupText(this.player.x - 6, this.player.y - 84, `컬렉션 등록! ${name}`, "#ffe86a");
    audio.sfx.questDone();
    this.emitRpgState();
    this.save();
  }
  /** 컬렉션 전체 종수 (잡몹 전 종 + 보스 전 종) */
  get collectionTotal(): number {
    return Object.keys(ENEMIES).length + Object.keys(BOSS_DEFS).length;
  }

  /**
   * 몬스터 리스폰 — 원래 스폰 지점에서 페이드 인.
   * 플레이어가 스폰 지점 근처(140px)에 서 있으면 얼굴에 팝업하는 걸 막기 위해 2.5초씩 재시도.
   */
  private respawnEnemy(key: EnemyKey, x: number, y: number, tries: number) {
    if (!this.scene.isActive() || this.player.state === "dead") {
      return; // 씬 전환/사망 중은 스킵 (다음 킬에서 다시 예약됨)
    }
    /* v3.0 (사용자 지시 #6) — 동시 몬스터 상한 20마리: 이미 가득하면 리스폰 보류
     * v3.0.2 — 정예/보스도 총량에 포함 (잡몹 20 + 정예/보스로 21~22마리 되던 빈틈 봉합) */
    const aliveMobs = this.enemies.filter((e) => e.active && e.alive).length;
    const eliteAlive = this.eliteEnemy?.active && this.eliteEnemy.alive ? 1 : 0;
    const bossAlive = this.boss?.active && this.boss.alive ? 1 : 0;
    if (aliveMobs + eliteAlive + bossAlive >= 20) {
      this.time.delayedCall(2400, () => this.respawnEnemy(key, x, y, tries));
      return;
    }
    const nearPlayer = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 140;
    if (nearPlayer && tries < 24) {
      // v2.3 — 재시도 간격 2.5초 → 1.2초 (리젠 단축에 맞춰 스폰 지점 대기도 짧게)
      this.time.delayedCall(1200, () => this.respawnEnemy(key, x, y, tries + 1));
      return;
    }
    /* v3.0.16 — 필드 정예 출현 (메이플 엘리트/챔피언): 전투 구역 4.5%, 동시 1마리, 보스 부재 시.
     *  3.2배 HP / 1.45배 ATK / 4배 EXP / 3배 골드 + 처치 시 에메랄드 +1 확정 */
    const eliteOk = !this.fieldEliteRef && !this.boss?.active && !this.stageDef.isVillage && !this.isInterior;
    const spawnElite = eliteOk && Math.random() < 0.045;
    const e = spawnElite
      ? new Enemy(this, x, y, key, {
          hp: 3.2, atk: 1.45, exp: 4, gold: 3, scale: 1.35, tint: 0xffd76a,
          displayName: `정예 ${ENEMIES[key].name}`,
        })
      : new Enemy(this, x, y, key);
    if (spawnElite) {
      this.fieldEliteRef = e;
      this.showBanner("정예 몬스터 출현!");
      audio.sfx.roar();
    }
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

  /** v3.0.28 (#퀘스트이름) — 현재 hunt 퀘스트의 합산 진행량.
   *  targetKeys(자동 토벌)면 구역 몬스터 전체, 단일 대상(스토리/반복)이면 해당 종만. */
  private huntProgressSum(q: QuestDef): number {
    const keys = q.targetKeys ?? (q.targetKey ? [q.targetKey] : []);
    let sum = 0;
    for (const k of keys) sum += (this.killTotals[k] ?? 0) - (this.huntBaseline[k] ?? 0);
    return sum;
  }

  /**
   * 토벌 퀘스트 완료 시도.
   * v2.0 — 퀘스트 시작 이후의 킬만 카운트 (huntBaseline) → 이전 킬이 한꺼번에 채워지는 버그 차단.
   * v3.0.28 — targetKeys(자동 토벌) 지정 시 구역 몬스터 전체 합산 판정.
   */
  private tryCompleteHunt(_key: EnemyKey) {
    const q = this.currentQuest();
    if (!q || q.type !== "hunt") return;
    const progress = this.huntProgressSum(q);
    if (progress < (q.need ?? 0)) return;
    this.huntCount = Math.min(progress, q.need ?? 0);
    audio.sfx.questDone();
    this.advanceQuest();
    this.afterAdvance();
    this.save();
  }

  /** v3.0.15 (#8) — 현재 구역 활성 퀘스트의 토벌 기준선 재설정 (수락 시점 킬만 카운트)
   *  v3.0.28 — targetKeys 지원: 자동 토벌은 구역 몬스터 전체의 기준선 설정 */
  private syncQuestBaseline() {
    const q = this.currentQuest();
    if (q?.type === "hunt" && !this.repeatActive()) {
      const keys = q.targetKeys ?? (q.targetKey ? [q.targetKey] : []);
      for (const k of keys) {
        if (!(k in this.huntBaseline)) this.huntBaseline[k] = this.killTotals[k] ?? 0;
      }
    }
  }

  /** v3.0.15 (#8) — 현재 구역 체인 퀘스트가 수락됐는지.
   *  기존 세이브(acceptedQuests에 기록 없음)는 자동 수락 상태로 간주 — 무중단 호환. */
  private isQuestAccepted(stageKey: string, idx: number): boolean {
    const a = this.acceptedQuests[stageKey];
    return a === undefined || a >= idx;
  }

  /**
   * 퀘스트 진행기 — 체인의 다음 목표를 범용으로 배치한다.
   *  reach → 안내 대사 후 차원문 개방 / collect → 파편 스폰 / boss → 보스 등장
   *  hunt → 이미 조건 충족이면 즉시 연쇄 완료 (미리 잡은 경우 소프트락 방지)
   *  v3.0.15 (#8) — 수락되지 않은 hunt/collect/boss 퀘스트는 활성화하지 않는다
   *  (reach는 구역 이동 자유도를 위해 수락 전에도 포탈 개방 유지)
   */
  private afterAdvance() {
    const q = this.currentQuest();
    this.emitQuest();
    if (!q) {
      /* v2.4 치명 버그 수정 — 구역 1~9(보스 없는 구역)에서 체인 완료 후 전진 포탈이
       *  활성화되지 않는 소프트락. v1.9는 모든 스테이지가 reach로 끝났지만 v2.0 구역
       *  시스템에서 이 경로가 누락됐다. 체인 종료 = 곧바로 다음 사냥터 개방. */
      if (!this.isInterior && !this.stageDef.boss && this.portal && !this.portalActive) {
        this.activatePortal();
      }
      return;
    }
    if (q.type === "hunt" && !this.repeatActive()) {
      /* 토벌 퀘스트 시작 기준선 — 시작 이후 킬만 진행 (지시 #17)
       * v3.0.28 — targetKeys(자동 토벌)는 구역 몬스터 전체 기준선 */
      const keys = q.targetKeys ?? (q.targetKey ? [q.targetKey] : []);
      for (const k of keys) {
        if (!(k in this.huntBaseline)) this.huntBaseline[k] = this.killTotals[k] ?? 0;
      }
    }
    if (q.type === "level") {
      // v2.4 — 이미 목표 레벨을 넘었으면 즉시 연쇄 완료 (소프트락 방지)
      this.tryCompleteLevel();
      return;
    }
    if (q.type === "reach") {
      if (!this.portal) this.spawnPortal(this.portalHome.x, this.portalHome.y);
      if (!this.portalActive) {
        // v2.3 (지시 #1) — 이미 본 체인 대사는 재생하지 않고 바로 개방
        if (q.dialogue && !this.seenSet.has(q.dialogue)) {
          // 대사 중 포탈 위 즉시 전환 방지 — 대사 종료 후 개방 (resumeFromDialogue)
          this.pendingPortal = true;
          /* v2.6 보루 — 대사 종료 훅을 어떤 이유로 놓쳐도 5초 뒤엔 반드시 개방 */
          this.time.delayedCall(5000, () => {
            if (this.pendingPortal && !this.portalActive) { this.pendingPortal = false; this.activatePortal(); }
          });
          if (this.dialoguing) {
            // 이미 대사 진행 중 (파편 수집 직후 등) — 기록 후 예약 순차 재생
            this.markSeen(q.dialogue);
            this.queuedDialogue = q.dialogue;
          } else {
            this.showDialogueOnce(q.dialogue); // 표시 + 기록
          }
        } else {
          this.activatePortal();
        }
      } else if (q.dialogue && !this.dialoguing && !this.seenSet.has(q.dialogue)) {
        this.showDialogueOnce(q.dialogue);
      }
    } else if (q.type === "collect") {
      if (!this.fragment) this.spawnFragmentForQuest();
    } else if (q.type === "boss") {
      /* v3.1.0 (#스토리보스난이도) — 유저 지시 "스토리 보스는 전용 난이도, 난이도 선택창은 띄우지 마라":
       *  스토리 보스는 선택창 없이 전용 기준(노말 상향치 고정 — stages.ts BOSS_DIFFS.normal)으로 즉시 스폰.
       *  난이도 선택은 재림(재도전) 보스판에서만 노출된다. */
      if (!this.boss) this.spawnBoss(true);
    } else if (q.type === "hunt") {
      /* v3.0.28 — targetKeys(자동 토벌) 합산 판정: 이미 조건 충족이면 즉시 연쇄 완료 (소프트락 방지) */
      if (this.huntProgressSum(q) >= (q.need ?? 0) && q.targetKey) this.tryCompleteHunt(q.targetKey);
    }
  }

  /**
   * v2.4 레벨 목표 퀘스트 완료 판정 — 현재 체인 퀘스트가 "level"이고
   *  목표 레벨에 도달했으면 즉시 완료. 레벨업 순간(Player.onLevelUp 훅)과
   *  체인 진입 시각(afterAdvance) 양쪽에서 호출된다.
   */
  private tryCompleteLevel() {
    const q = this.currentQuest();
    if (!q || q.type !== "level") return;
    if (this.player.lv < (q.need ?? 1)) return;
    audio.sfx.questDone();
    this.showBanner(`목표 달성 — Lv ${this.player.lv}! 다음 목표로!`);
    this.spawnPickupText(this.player.x, this.player.y - 58, `Lv ${q.need} 달성!`, "#8fe84a");
    this.advanceQuest();
    this.afterAdvance();
    this.save();
  }

  /** Player.gainExp 레벨업 훅 — 레벨 목표 퀘스트 즉시 판정 (v2.4)
   *  v3.0.15 (#2) — 자동배분 ON이면 지급된 AP를 계열 권장 비율로 즉시 분배 */
  onLevelUp() {
    this.tryCompleteLevel();
    if (this.autoAlloc && this.player.ap > 0) {
      if (this.player.allocateAutoPoints()) {
        this.spawnPickupText(this.player.x, this.player.y - 70, "AP 자동 배분!", "#a8ff7d");
        this.emitHud();
      }
    }
  }

  /* ================= 보스 ================= */

  private spawnBoss(intro = true) {
    /* v3.0.28 (#보스난이도) — 난이도 선택 전엔 스폰 금지 (보루/복구 경로도 이 게이트로 통과 차단) */
    if (this.bossDiffPending) return;
    const base = BOSS_DEFS[this.stageDef.bossKey ?? "guardian"];
    // v2.0 밸런스 — 챕터 보스는 구역 진행 배율만큼 강화 (지시 #6: 보스 체력 상향)
    // v3.0.6 (지시 #8 — "보스가 너무 약함"): HP ×1.35·ATK ×1.05로 대폭 상향 (기존 ×0.9 완화)
    // v3.0.22 (#50 — "챕터 지날수록 쎄져야"): 잡몹 곡선 강화에 맞춰 보스 가중치 HP ×1.6·ATK ×1.15로 재상향
    //  + Boss 내부 관통 50%·페이즈별 태진 단축·탄막 증가가 함께 적용된다
    // v3.0.28 (#보스난이도) — 이지 0.65 / 노말 1.0 / 하드 1.8 / 카오스 2.8 배율 (보상은 reward 배율)
    const sc = stageScale(this.stageDef.key);
    const dif = BOSS_DIFFS[this.bossDiff];
    const def: BossDef = {
      ...base,
      hp: Math.round(base.hp * 1.25 * Math.max(1, sc.hp * 1.6) * dif.hp),
      atk: Math.round(base.atk * Math.max(1, sc.atk * 1.15) * dif.atk),
      exp: Math.round(base.exp * sc.exp * dif.reward),
      gold: Math.round(base.gold * sc.gold * dif.reward),
    };
    this.bossDef = def;
    this.bossDiffPending = false; // v3.0.28 — 스폰 시점에 선택 완료
    /* v3.0 (#7) — 보스는 최원거리 셀(포탈 방)에 배치 — 격파 후 포탈이 바로 그 자리에 열림 */
    const bx = this.portalHome.x;
    const by = this.portalHome.y - 10;
    audio.sfx.roar();
    this.cameras.main.shake(260, 0.008);
    this.showBanner(`${def.name} 출현!`);
    this.boss = new Boss(this, bx, by, def);
    this.physics.add.collider(this.boss, this.solidGroup);
    EventBus.emit("boss:show", { name: `[${dif.label}] ${def.name}`, hp: this.boss.hp, maxHp: this.boss.maxHp });
    // 파티 보스 토벌 공지 (v2.0 — 지시 #5)
    net.netAnnounceBoss(def.name, STAGE_SHORT[this.stageDef.key] ?? this.stageDef.key);
    // 보스전 전용 BGM (v2.0)
    audio.playStageBGM(this.stageDef.key, true);
    // 등장 대사 — 이어하기 복구 경로는 생략 (오프닝 대사와 충돌 방지) / v2.3: 1회만 재생
    // v3.0.10 (메이플식 보스 조우 연출): 카메라가 보스에게 팬 → 보스 인트로 대사 → 카메라 복귀
    if (intro) this.bossIntroCinematic(bx, by, def.introDialogue);
  }

  /* v3.0.24 (#보스재도전) — 재림 보스 스폰: 클리어한 챕터 보스의 고능력치 판
   *  유저 지시: "이미 스토리를 진행한 챕터의 보스전을 따로 플레이 (스토리 보스보다 훨씬 능력치가 높음)"
   *  · 스토리판 대비 HP ×5.0 · ATK ×2.2 (챕터 스케일링 포함 위에 곱연산)
   *  · 스토리 진행과 완전 분리 — 퀘스트 진행/포탈 개방/클리어 판정 없음 (onBossDead 분기)
   *  · 보상: EXP/GOLD ×3 · 에메랄드 +5 (보상 팝업 표시) */
  private spawnReplayBoss(ch: string) {
    if (!this.player || this.boss || this.isInterior) return;
    const spec = chapterSpec(`${ch}10`);
    if (!spec?.boss) return;
    const base = BOSS_DEFS[spec.boss];
    const sc = stageScale(`${ch}10`);
    /* v3.0.28 (#보스난이도) — 재림판 기준 수치(HP ×5.0 · ATK ×2.2 · 보상 ×3)에 난이도 배율 추가 적용 */
    const lv = this.pendingReplayBossDiff ?? "normal";
    const dif = BOSS_DIFFS[lv];
    this.pendingReplayBossDiff = null;
    const def: BossDef = {
      ...base,
      name: `재림한 ${base.name}`,
      hp: Math.round(base.hp * 1.25 * Math.max(1, sc.hp * 1.6) * 5.0 * dif.hp),
      atk: Math.round(base.atk * Math.max(1, sc.atk * 1.15) * 2.2 * dif.atk),
      exp: Math.round(base.exp * sc.exp * 3 * dif.reward),
      gold: Math.round(base.gold * sc.gold * 3 * dif.reward),
    };
    this.bossDef = def;
    this.replayBossActive = true;
    this.replayBossEmerald = dif.emerald; // v3.0.28 — 난이도별 에메랄드 (2/5/9/15)
    const bx = this.portalHome.x;
    const by = this.portalHome.y - 10;
    audio.sfx.roar();
    this.cameras.main.shake(340, 0.01);
    this.showBanner(`재림한 ${base.name} 출현!`);
    this.boss = new Boss(this, bx, by, def);
    this.physics.add.collider(this.boss, this.solidGroup);
    EventBus.emit("boss:show", { name: `[${dif.label}] ${def.name}`, hp: this.boss.hp, maxHp: this.boss.maxHp });
    // 재도전 전투곡 — 일반 보스전과 동일 오버라이드
    audio.playStageBGM(this.stageDef.key, true);
    // 조우 연출은 카메라 팬만 (인트로 대사는 이미 본 대사 — 재생 생략 로직이 자동 처리)
    this.bossIntroCinematic(bx, by, def.introDialogue);
  }

  /** v3.0.10 — 보스 조우 시네마틱: 물리 정지 + 카메라 팬(보스) + 인트로 대사 + 카메라 복귀
   *  v3.3.0 (#흑화) — 전체 try/catch: 시네마틱 도중 예외로 physics 정지가 누출되는 것 차단 */
  private bossIntroCinematic(bx: number, by: number, introId: string) {
    try {
      const cam = this.cameras.main;
      this.dialoguing = true;
      this.dialogueSince = this.time.now; // v3.3.0 — 붙임 자가치유 기준
      this.player.setVelocity(0, 0);
      this.physics.world.pause();
      cam.pan(bx, by - 20, 780, "Sine.easeInOut", true);
      this.time.delayedCall(820, () => {
        if (!this.scene.isActive()) return;
        cam.pan(this.player.x, this.player.y, 520, "Sine.easeInOut", true);
        // 이미 본 대사면 연출만 종료, 아니면 인트로 대사 재생(resume은 resumeFromDialogue가 담당)
        if (!this.showDialogueOnce(introId)) {
          this.dialoguing = false;
          this.physics.world.resume();
        }
      });
    } catch (err) {
      console.error("[SERTZ] 보스 인트로 시네마틱 실패 — 즉시 복구", err);
      this.dialoguing = false;
      this.physics.world.resume();
    }
  }

  onBossDead() {
    const def = this.bossDef;
    audio.sfx.bossDie();
    /* v3.0.24 (#보스재도전) — 재림 보스 격파: 스토리 진행과 분리된 전용 보상 경로
     *  퀘스트 진행/포탈 개방/클리어 판정 없음 → 골드·경험치·에메랄드 즉시 지급 후 구역 BGM 복귀 */
    if (this.replayBossActive) {
      this.replayBossActive = false;
      this.totalKills++;
      this.registry.set("runKills", this.totalKills);
      this.cameras.main.shake(400, 0.01);
      this.spawnBurstAt(this.boss!.x, this.boss!.y, 30, def?.orbTint ?? 0x9d7aff);
      const exp = def?.exp ?? 220;
      const gold = def?.gold ?? 200;
      const em = this.replayBossEmerald;
      this.player.gainExp(exp);
      this.player.addGold(gold);
      this.player.emerald += em;
      this.spawnPickupText(this.player.x, this.player.y - 60, `+${em} 에메랄드`, "#7de8ff");
      this.registerCollection(`boss_${def?.key ?? "guardian"}`, def?.name ?? "보스");
      EventBus.emit("reward:show", {
        title: `재도전 성공 — ${def?.name ?? "보스"}`,
        lines: [
          { text: `골드 +${gold} G`, color: "#ffd76a" },
          { text: `경험치 +${exp} EXP`, color: "#8fe84a" },
          { text: `에메랄드 +${em}`, color: "#7de8ff" },
        ] satisfies RewardPopupState["lines"],
      });
      this.emitRpgState();
      this.emitHud();
      this.save();
      this.time.delayedCall(1400, () => audio.playStageBGM(this.stageDef.key));
      return;
    }
    // v2.0 수정 (지시 #7) — 보스전 종료 후 BGM이 멈추는 버그:
    // stopBGM 대신 1.4초 후 스테이지 테마 BGM으로 자연 전환
    this.time.delayedCall(1400, () => audio.playStageBGM(this.stageDef.key));
    this.cameras.main.shake(400, 0.01);
    this.spawnBurstAt(this.boss!.x, this.boss!.y, 30, def?.orbTint ?? 0x9d7aff);
    this.player.gainExp(def?.exp ?? 220);
    this.totalKills++;
    this.registry.set("runKills", this.totalKills);
    /* v3.0.6 (지시 #1) — 보스 처치 시 에메랄드 +2 (BM 상점 재화) */
    this.player.emerald += 2;
    this.spawnPickupText(this.player.x, this.player.y - 60, "+2 에메랄드", "#7de8ff");
    /* v3.0.16 — 보스 컬렉션 등록 (최초 처치 시) */
    this.registerCollection(`boss_${def?.key ?? "guardian"}`, def?.name ?? "보스");
    this.emitRpgState();
    /* v3.0.6 (지시 #9) — 보스 전용 드롭: 보스별 유니크 아이템 100% 드롭
     *  상점에서 살 수 없음(tradeLock) — 추후 유저 거래소에서 사고팔게 할 예정 */
    const dropKey = BOSS_DROP_ITEMS[def?.key ?? "guardian"];
    if (dropKey && this.boss) {
      const bx = this.boss.x;
      const by = this.boss.y;
      this.time.delayedCall(420, () => {
        if (!this.scene.isActive()) return;
        const d = this.acquireDrop();
        if (d) d.spawnItem(dropKey, bx + Phaser.Math.Between(-14, 14), by + Phaser.Math.Between(-10, 6));
        audio.sfx.roar();
      });
    }
    // 최종 보스(심연의 군주)만 클리어 — 이전 보스는 차원문으로 다음 지역 진행
    const final = NEXT_STAGE[this.stageDef.key] === null;
    this.cleared = final;
    this.advanceQuest(); // 보스 퀘스트 완료 — 골드/경험치 보상 포함
    this.save();
    if (final) {
      this.time.delayedCall(1200, () => {
        this.showDialogueOnce("victory");
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
    audio.playStageBGM(this.stageDef.key, !!this.boss);
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
    /* v3.0.4 (지시 #7) — 모바일 3/4차기 버튼이 발행하는 input:skill3/4 미수신으로 안 쓰이던 버그 수정 */
    const onS3 = () => this.player?.useSkill3();
    const onS4 = () => this.player?.useSkill4();
    const onS5 = () => this.player?.useSkill5(); // v3.2.0 — 궁극기 (모바일 버튼 공용)
    const onRespawn = () => this.respawnPlayer();
    const onDialogueDone = () => this.resumeFromDialogue();
    const onInteract = () => this.tryInteract();
    const onKeymapChanged = (m: KeyMap) => {
      this.keymap = m;
    };
    const onNameSet = (v: { name: string }) => {
      if (this.introStep === 2) {
        this.finishIntro(v.name);
        return;
      }
      // v2.4 — 인트로 외 이름 변경 (옵션 패널 → NamePanel 공용) — "이름 지정 어디감?" 해소
      setPlayerName(v.name);
      this.refreshPlayerTag();
      this.save();
      EventBus.emit("banner:show", { text: `이름이 '${v.name}'(으)로 바뀌었어요!` });
    };
    const onBuy = (v: { key: ItemKey; qty?: number }) => {
      if (!this.player || this.dialoguing) return;
      const qty = Math.max(1, Math.min(99, Math.floor(v.qty ?? 1))); // v3.0.24 — 수량 지정 구매
      const it = ITEMS[v.key];
      const cost = (it?.price ?? 0) * (it?.kind === "consumable" || it?.kind === "buff" ? qty : 1);
      if (this.player.buy(v.key, qty)) {
        audio.sfx.questDone();
        // BM 즉시 반영 — 펫 구매 시 스프라이트 교체, 치장 구매 시 오라 교체 (v1.9)
        const kind = ITEMS[v.key]?.kind;
        if (kind === "pet") this.syncPet();
        else if (kind === "cosmetic") this.syncCosmeticAura();
        this.save();
        EventBus.emit("banner:show", { text: `${it?.name ?? "아이템"}${qty > 1 ? ` ×${qty}` : ""} 구매 완료! (-${cost}G)` });
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
    /* v2.9 (#8) — 장신구 슬롯 클릭 해제 */
    const onUnequip = (v: { key: ItemKey }) => {
      if (!this.player || this.dialoguing) return;
      this.player.unequipAccessory(v.key);
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
      const r = this.player.tryUpgrade(v.slot);
      this.syncUpgradeGlow(); // 스타포스 오라 갱신 (티어별)
      /* v3.0.5 — 패널에 결과 통보 (성공 금빛/실패 붉은 흔들림 CSS 연출용) */
      if (r === "ok" || r === "fail")
        EventBus.emit("rpg:upgradeResult", { slot: v.slot, result: r, up: this.player.upgrades[v.slot] });
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
    /* v3.1.0 (#전직스토리선행) — 유저 지시 "전직은 전직 스토리(n차마다 다른 스토리·컷신)
     *  완료 후에만": 미전직 계열 선택 → 1차 시련 시작 (전직은 시련 완료 시 자동 적용),
     *  2차/3차 승격 → 다음 차수 시련 완료가 잠금 해제 조건 (scene-side 재검증). */
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
      /* ---------- 미전직: 계열 선택 → 1차 시련 스토리 ---------- */
      if (chainOf(this.player.cls).length === 0) {
        const fam = familyOf(def.key);
        if (!fam) return;
        if (this.jobStory?.tier === 1 && !this.player.cls) {
          if (this.jobStory.fam === fam) {
            EventBus.emit("banner:show", { text: "이미 전직 시련 진행 중 — 스토리를 완료하면 전직한다!" });
            return;
          }
          if (this.jobStory.step === 0) {
            // 시작 직후라면 계열 변경 허용 — 시련 재시작
            this.jobStory = null;
            this.pendingJobClass = def.key;
            this.startJobStory(fam, 1);
            return;
          }
          EventBus.emit("banner:show", { text: "시련 도중에는 계열을 바꿀 수 없다" });
          return;
        }
        if (this.jobStoryDone.includes(1)) {
          // 1차 시련 완료 후 재선택 — 복구 경로 (즉시 적용)
        } else {
          this.pendingJobClass = def.key;
          this.startJobStory(fam, 1);
          return;
        }
      } else if (!this.jobQuestCleared()) {
        // 2차/3차 승격 — 다음 차수 시련 완료 필수 (패널 우회 방지 scene-side 재검증)
        EventBus.emit("banner:show", {
          text: `📜 ${this.jobQuestLockText() ?? "전직 시련을 먼저 완료하세요"}`,
        });
        return;
      }
      if (!this.player.applyClass(def.key)) return;
      audio.sfx.levelup();
      this.spawnLevelUpFx(this.player.x, this.player.y);
      /* v3.0.4 (지시 #2) — 전직 시 기존 스킬 강화 체감 연출: 클래스색 빛기둥+폭발+화면 플래시 */
      {
        const jhex = def.hex;
        this.spawnPillar(this.player.x, this.player.y, jhex, 200);
        this.spawnBurstAt(this.player.x, this.player.y, 34, jhex);
        this.cameras.main.flash(180, (jhex >> 16) & 0xff, (jhex >> 8) & 0xff, jhex & 0xff);
        this.cameras.main.shake(200, 0.008);
        this.spawnPickupText(this.player.x, this.player.y - 56, `${def.name} 각성! 스킬 강화`, `#${jhex.toString(16).padStart(6, "0")}`);
      }
      EventBus.emit("banner:show", { text: `전직 완료! ${def.name} — ${def.title}` });
      this.refreshPlayerTag();
      this.save();
      this.emitHud();
      this.emitRpgState();
      net.netAnnounceJob(def.key);
      // v3.1.0 — 승격 직후 다음 차수 시련 자동 시작 (n차마다 다른 스토리)
      this.time.delayedCall(900, () => this.maybeStartJobStory());
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
      this.time.delayedCall(440, () => this.gotoStage(target));
    };

    // v2.5 — 소지품 사용 (상급 물약/마을 귀환서/지역 이동 부적 — 지시 #5/#6/#7)
    const onUseItem = (v: { key: string }) => {
      if (!this.player || this.dialoguing || this.player.state === "dead") return;
      const key = v.key as ItemKey;
      if (key === "potion_hp2" || key === "potion_mp2" || key === "potion_elixir") {
        // v3.0.20 (#7) — 엘릭서(HP/MP 100% 회복) 포함
        this.player.useConsumablePotion(key);
        this.emitRpgState();
        return;
      }
      if (key === "scroll_return") {
        // v2.9 (지시 #6) — 마을 귀환서: “가장 가까운 마을(현재 챕터의 마을)”로 즉시 귀환
        if (this.stageDef.isVillage) {
          EventBus.emit("banner:show", { text: "이미 마을에 있습니다" });
          return;
        }
        if (!this.player.hasConsumable(key)) return;
        this.player.consumeConsumable(key);
        audio.sfx.portal();
        const { ch } = parseStage(this.stageDef.key);
        const vk: StageKey = ch === "village" ? "village" : `${ch}v`;
        EventBus.emit("banner:show", { text: `마을 귀환서 사용! ${STAGES[vk]?.name ?? "마을"}로 이동합니다…` });
        this.cameras.main.fadeOut(420, 0, 0, 0);
        this.player.state = "idle";
        this.time.delayedCall(440, () => this.gotoStage(vk));
        return;
      }
      if (key === "scroll_warp") {
        // 지역 이동 부적 — 방문한 구역 선택 UI 오픈 (차감은 워프 실행 시)
        if (this.visited.size === 0) {
          EventBus.emit("banner:show", { text: "기록된 방문 구역이 없습니다" });
          return;
        }
        EventBus.emit("ui:panel", { panel: "warp" });
        return;
      }
    };

    // v2.5 — 지역 이동 부적 워프 실행 (WarpPanel → 방문한 구역으로)
    const onWarp = (v: { stage: string }) => {
      if (!this.player || this.dialoguing || this.player.state === "dead") return;
      const target = resolveStage(String(v?.stage || ""));
      if (!target) return;
      if (!this.visited.has(target)) {
        EventBus.emit("banner:show", { text: "한 번이라도 도착한 구역만 이동할 수 있어요" });
        return;
      }
      if (target === this.stageDef.key) {
        EventBus.emit("banner:show", { text: "이미 있는 구역입니다" });
        return;
      }
      if (!this.player.hasConsumable("scroll_warp")) {
        EventBus.emit("banner:show", { text: "지역 이동 부적이 없습니다 — 상인 라고스에게서 구매" });
        EventBus.emit("ui:panel", { panel: null });
        return;
      }
      this.player.consumeConsumable("scroll_warp");
      audio.sfx.portal();
      EventBus.emit("ui:panel", { panel: null });
      EventBus.emit("banner:show", { text: `부적 사용! ${STAGE_SHORT[target] ?? target}(으)로 이동합니다…` });
      this.cameras.main.fadeOut(420, 0, 0, 0);
      this.player.state = "idle";
      this.time.delayedCall(440, () => this.gotoStage(target));
    };

    /* v3.0.24 (#보스재도전) — 클리어한 챕터 보스 고능력치 재판:
     *  해당 챕터 보스 구역(`${ch}10`)으로 이동 후 "재림" 보스 스폰 (스토리판 HP ×5 · ATK ×2.2) */
    const onBossReplay = (v: { ch: string; lv?: string }) => {
      if (!this.player || this.dialoguing || this.player.state === "dead") return;
      const ch = String(v?.ch ?? "");
      /* v3.0.28 (#보스난이도) — 재도전 난이도 (기본 노말) */
      const lv = typeof v?.lv === "string" && v.lv in BOSS_DIFFS ? (v.lv as BossDiffKey) : "normal";
      const target = `${ch}10` as StageKey;
      const spec = chapterSpec(target);
      if (!spec || !spec.boss) return;
      // 스토리 완료 확인 — 해당 보스 퀘스트가 진행 인덱스를 지난 경우만 (미완료 챕터는 거부)
      const stageQuests = STAGES[target]?.quests ?? [];
      const bossIdx = stageQuests.findIndex((q) => q.type === "boss");
      const cleared = bossIdx >= 0 ? (this.savedQuestIdx[target] ?? 0) > bossIdx : false;
      if (!cleared) {
        EventBus.emit("banner:show", { text: "아직 스토리를 완료하지 않은 챕터의 보스입니다" });
        return;
      }
      audio.sfx.portal();
      EventBus.emit("ui:panel", { panel: null });
      EventBus.emit("banner:show", { text: `재림 — ${BOSS_DEFS[spec.boss].name}의 재도전! [${BOSS_DIFFS[lv].label}]` });
      this.cameras.main.fadeOut(420, 0, 0, 0);
      this.player.state = "idle";
      this.time.delayedCall(440, () => this.gotoStage(target, { replayBoss: ch, replayDiff: lv }));
    };
    /* v3.0.28 (#보스난이도) — 스토리 보스 난이도 선택 수신은 v3.1.0에서 제거됐다:
     *  스토리 보스는 전용 난이도(노말 상향 고정)로 즉시 스폰, 선택창 없음.
     *  난이도 선택은 재림판(rpg:bossReplay · lv)에서만 받는다. */

    // v2.5 — 자동사냥 토글 (v3.0.15 #5: 펫 없이도 사용 가능)
    const onAutoHunt = () => {
      if (!this.player) return;
      this.autoHunt = !this.autoHunt;
      this.autoHuntMove.set(0, 0);
      this.autoTarget = null;
      this.autoDirHoldUntil = 0;
      EventBus.emit("banner:show", { text: this.autoHunt ? "자동사냥 ON — 위협 제거 우선 · 사냥/보스 최적화" : "자동사냥 OFF" });
      this.emitRpgState();
      this.save();
    };

    /* v3.0.3 — GM 패널 명령 (자유전직/골드/레벨/회복 — 임시 운영자 도구)
     *  v3.3.0 (지시 #3/#6) — 5차 전직(임시) 부여/해제 + 무릉도장 입장 추가 */
    const onGm = (v: { type: "job" | "gold" | "lv" | "heal" | "ap" | "em" | "fifth" | "dojang"; value?: number | string }) => {
      if (!this.player) return;
      const p = this.player;
      if (v.type === "job" && typeof v.value === "string") {
        if (!isClassKey(v.value)) return;
        const ok = p.gmSetClass(v.value);
        EventBus.emit("banner:show", { text: ok ? `GM 전직 완료 — ${classLabel(v.value)}` : "전직 실패" });
        if (ok) {
          /* v3.0.4 — GM 전직도 강화 연출 동일 적용 */
          const jhex = classDef(v.value)?.hex ?? 0xffffff;
          this.spawnPillar(p.x, p.y, jhex, 200);
          this.spawnBurstAt(p.x, p.y, 34, jhex);
          this.cameras.main.flash(180, (jhex >> 16) & 0xff, (jhex >> 8) & 0xff, jhex & 0xff);
          this.cameras.main.shake(200, 0.008);
        }
        this.emitSkills();
        this.emitRpgState();
        this.save();
      } else if (v.type === "gold" && typeof v.value === "number") {
        p.addGold(v.value);
        EventBus.emit("banner:show", { text: `GM — 골드 ${v.value >= 0 ? "+" : ""}${v.value}` });
      } else if (v.type === "lv" && typeof v.value === "number") {
        p.gmSetLevel(v.value);
        EventBus.emit("banner:show", { text: `GM — 레벨 ${p.lv}` });
        this.emitSkills();
      } else if (v.type === "heal") {
        p.healFull();
        EventBus.emit("banner:show", { text: "GM — HP/MP 완전 회복" });
      } else if (v.type === "ap" && typeof v.value === "number") {
        p.ap += v.value;
        this.emitHud();
        EventBus.emit("banner:show", { text: `GM — AP +${v.value}` });
      } else if (v.type === "em" && typeof v.value === "number") {
        /* v3.0.6 — GM 에메랄드 지급 (BM 상점 테스트용) */
        p.emerald = Math.max(0, p.emerald + v.value);
        this.emitRpgState();
        EventBus.emit("banner:show", { text: `GM — 에메랄드 ${v.value >= 0 ? "+" : ""}${v.value}` });
      } else if (v.type === "fifth") {
        /* v3.3.0 (지시 #3) — GM 5차전직(임시): 부여/해제 토글 */
        const on = v.value === 1 || v.value === "1";
        p.gmGrantFifth(on);
        EventBus.emit("banner:show", {
          text: on
            ? "GM 5차 전직 완료(임시)! 전 스킬 ·극 강화 + 고유 궁귁기(N) 해금"
            : "5차 각성 해제 — 일반 상태로 복귀",
        });
        this.emitSkills();
        this.emitRpgState();
        this.save();
      } else if (v.type === "dojang") {
        /* v3.3.0 (지시 #6) — GM → 무릉도장 입장 */
        this.enterDojang();
      }
    };

    EventBus.on("input:move", onMove);
    EventBus.on("input:attack", onAtk);
    EventBus.on("input:skill1", onS1);
    EventBus.on("input:skill2", onS2);
    EventBus.on("input:skill3", onS3);
    EventBus.on("input:skill4", onS4);
    EventBus.on("input:skill5", onS5);
    EventBus.on("input:interact", onInteract);
    EventBus.on("name:set", onNameSet);
    EventBus.on("keymap:changed", onKeymapChanged);
    EventBus.on("rpg:buy", onBuy);
    EventBus.on("rpg:equip", onEquip);
    EventBus.on("rpg:unequip", onUnequip);
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
    EventBus.on("rpg:useItem", onUseItem);
    EventBus.on("rpg:warp", onWarp);
    EventBus.on("rpg:bossReplay", onBossReplay); // v3.0.24 — 보스 재도전
    /* v3.1.0 — 스토리 보스 난이도 선택 이벤트는 제거됐다: 전용 난이도로 즉시 스폰 */
    /* v3.0.6 (지시 #4) — 아이템 판매 · v3.1.0 (#판매포기) — 수량 지정 판매 (MAX = 전량) */
    const onSell = (v: { key: string; qty?: number }) => {
      if (!this.player || this.dialoguing) return;
      const qty = Math.max(1, Math.min(999, Math.floor(v.qty ?? 1)));
      const sold = this.player.sell(v.key as ItemKey, qty);
      if (sold > 0) {
        this.save();
        this.emitRpgState();
        EventBus.emit("banner:show", {
          text: sold > 1 ? `판매 완료 ×${sold} — 상점가의 40%` : "판매 완료 — 상점가의 40%",
        });
      }
    };
    /* v3.0.20 (#7) — 물약 판매 (기본은 카운터 차감, 상급/엘릭서는 owned) · v3.1.0 — 수량 지정 */
    const onSellPotion = (v: { key: string; qty?: number }) => {
      if (!this.player || this.dialoguing) return;
      const qty = Math.max(1, Math.min(999, Math.floor(v.qty ?? 1)));
      const sold = this.player.sellPotion(v.key as "potion_hp" | "potion_mp" | "potion_hp2" | "potion_mp2" | "potion_elixir", qty);
      if (sold > 0) {
        this.save();
        this.emitRpgState();
        EventBus.emit("banner:show", {
          text: sold > 1 ? `물약 판매 완료 ×${sold} — 상점가의 40%` : "물약 판매 완료 — 상점가의 40%",
        });
      }
    };
    /* v3.0.6 (지시 #1) — BM 상점 구매 (에메랄드) · v3.0.24 — 수량 지정 + 소모품 재구매 버그 수정 */
    const onBmBuy = (v: { key: string; qty?: number }) => {
      if (!this.player || this.dialoguing) return;
      const qty = Math.max(1, Math.min(99, Math.floor(v.qty ?? 1)));
      const it = ITEMS[v.key as ItemKey];
      const cost = (it?.bmPrice ?? 0) * (it?.kind === "consumable" || it?.kind === "buff" ? qty : 1);
      const okBuy = this.player.buyBm(v.key as ItemKey, qty);
      if (okBuy) {
        this.save();
        this.emitRpgState();
        this.emitHud();
        EventBus.emit("banner:show", { text: `${it?.name ?? "아이템"}${qty > 1 ? ` ×${qty}` : ""} 구매 완료! (-${cost} 에메랄드)` });
        if (it?.kind === "pet") this.onPetChanged();
        if (it?.kind === "cosmetic") this.onCosmeticChanged();
        audio.sfx.equip();
      } else {
        EventBus.emit("banner:show", { text: "에메랄드가 부족하거나 이미 보유 중입니다" });
      }
    };
    /* v3.0.6 (지시 #5) — 자동 물약/자동 버프 설정 */
    const onAutoSet = (v: { hpPct?: number; mpPct?: number; mpOn?: boolean; buffs?: string[] }) => {
      if (!this.player) return;
      this.player.setAutoUse({
        hpPct: v.hpPct,
        mpPct: v.mpPct,
        mpOn: v.mpOn,
        buffs: v.buffs as BuffKey[] | undefined,
      });
      this.save();
      this.emitRpgState();
    };
    /* v3.0.7 — 유저 거래소: 구매(에메랄드 차감) */
    const onTradeBuy = (v: { key: string }) => {
      if (!this.player || this.dialoguing) return;
      const it = ITEMS[v.key as ItemKey];
      const okBuy = this.player.tradeBuy(v.key as ItemKey);
      if (okBuy) {
        this.save();
        this.emitRpgState();
        this.emitHud();
        EventBus.emit("banner:show", { text: `거래소 구매 — ${it?.name ?? "아이템"} (-${TRADE_PRICES[v.key] ?? 0} 에메랄드)` });
        audio.sfx.equip();
      } else {
        EventBus.emit("banner:show", { text: "에메랄드가 부족하거나 이미 보유 중입니다" });
      }
    };
    /* v3.0.7 — 유저 거래소: 판매(에메랄드 환급) */
    const onTradeSell = (v: { key: string }) => {
      if (!this.player || this.dialoguing) return;
      const okSell = this.player.tradeSell(v.key as ItemKey);
      if (okSell) {
        this.save();
        this.emitRpgState();
        this.emitHud();
        EventBus.emit("banner:show", { text: `거래소 판매 — +${tradeValue(v.key as ItemKey)} 에메랄드` });
      }
    };
    /* v3.0.7 — 강화 주문서 사용 (충전) */
    const onStarScroll = () => {
      if (!this.player || this.dialoguing) return;
      if (!this.player.useStarScroll()) {
        EventBus.emit("banner:show", { text: this.player.starBless >= 3 ? "충전 최대 3장 — 강화부터" : "강화 주문서가 없습니다" });
        return;
      }
      this.save();
      this.emitRpgState();
    };
    /* v3.0.7 — 장신구 스타포스 강화 */
    const onUpgradeAcc = (v: { key: string }) => {
      if (!this.player || this.dialoguing) return;
      const r = this.player.tryUpgradeAcc(v.key as ItemKey);
      if (r === "poor") {
        EventBus.emit("banner:show", { text: "골드가 부족합니다" });
      } else if (r === "max") {
        EventBus.emit("banner:show", { text: "이미 최대 성수입니다 (★15)" });
      }
      if (r === "ok" || r === "fail") {
        this.save();
        this.emitRpgState();
        EventBus.emit("rpg:upgradeResult", { slot: "weapon", result: r === "ok" ? "ok" : "fail" });
      }
    };
    /* ================= v3.0.15 신규 리스너 ================= */
    /* #2 — 레벨업 스탯 자동배분 on/off */
    const onAutoAlloc = (v: { on: boolean }) => {
      this.autoAlloc = !!v.on;
      if (this.autoAlloc && this.player && this.player.ap > 0) {
        if (this.player.allocateAutoPoints()) this.emitHud();
      }
      this.save();
      this.emitRpgState();
      EventBus.emit("banner:show", { text: v.on ? "레벨업 자동 배분 ON — 스탯을 자동으로 나눕니다" : "레벨업 자동 배분 OFF" });
    };
    /* #7 — 물약 퀵슬롯 장착 (인벤토리에서) */
    const onQuickPot = (v: { slot: "hp" | "mp"; key: string }) => {
      if (!this.player) return;
      const item = ITEMS[v.key as ItemKey];
      if (!item || item.kind !== "consumable") return;
      this.player.quickPots[v.slot] = v.key;
      this.save();
      this.emitRpgState();
      EventBus.emit("banner:show", { text: `${item.name} → ${v.slot === "hp" ? "HP" : "MP"} 버튼에 장착!` });
    };
    /* #13 — eert 큐브 리롤 */
    const onEert = (v: { key: string }) => {
      if (!this.player || this.dialoguing) return;
      const pot = this.player.rerollPotentials(v.key as ItemKey);
      if (!pot) {
        EventBus.emit("banner:show", { text: "eert 큐브가 없습니다 (BM 상점 8💎)" });
        return;
      }
      const meta = POT_GRADE_META[pot.grade];
      const gradeHex = pot.grade === 3 ? 0xff8a5c : pot.grade === 2 ? 0xffd76a : pot.grade === 1 ? 0xc08aff : 0x6fb8ff;
      this.spawnPillar(this.player.x, this.player.y, gradeHex, 220);
      this.spawnBurstAt(this.player.x, this.player.y, 20, gradeHex);
      EventBus.emit("banner:show", {
        text: `eert 큐브 — ${meta.name} 등급! ${pot.lines.map((l) => potLineText(l)).join(" · ")}`,
      });
      this.save();
      this.emitRpgState();
      this.emitHud();
    };
    /* #8 — 퀘스트 수락 */
    const onQuestAccept = (v: { stage: string }) => {
      const idx = v.stage === this.stageDef.key ? this.questIdx : this.savedQuestIdx[v.stage] ?? 0;
      const def = STAGES[v.stage as StageKey];
      if (!def || idx >= def.quests.length) {
        EventBus.emit("banner:show", { text: "수락할 퀘스트가 없습니다" });
        return;
      }
      this.acceptedQuests[v.stage] = idx;
      // 현재 구역 퀘스트를 수락했다면 즉시 활성화 (기준선/파편/보스 배치)
      if (v.stage === this.stageDef.key) {
        this.syncQuestBaseline();
        this.afterAdvance();
      }
      this.save();
      EventBus.emit("banner:show", { text: `퀘스트 수락! — ${def.quests[idx].title}` });
      audio.sfx.questDone();
      this.emitQuest();
      this.emitQuestLog();
    };
    /* #8 — 퀘스트 추적 선택 */
    const onQuestTrack = (v: { stage: string | null }) => {
      this.trackedStage = v.stage;
      this.save();
      this.emitQuest();
      this.emitQuestLog();
    };

    EventBus.on("rpg:tradeBuy", onTradeBuy);
    EventBus.on("rpg:tradeSell", onTradeSell);
    EventBus.on("rpg:starScroll", onStarScroll);
    EventBus.on("rpg:upgradeAcc", onUpgradeAcc);
    EventBus.on("rpg:sell", onSell);
    EventBus.on("rpg:sellPotion", onSellPotion);
    EventBus.on("rpg:bmBuy", onBmBuy);
    /* v3.0.15 — 신규 패널 리스너 */
    EventBus.on("rpg:autoAlloc", onAutoAlloc);
    EventBus.on("rpg:quickpot", onQuickPot);
    EventBus.on("rpg:eert", onEert);
    EventBus.on("rpg:questAccept", onQuestAccept);
    EventBus.on("rpg:questTrack", onQuestTrack);
    EventBus.on("rpg:autoset", onAutoSet);
    EventBus.on("rpg:autohunt", onAutoHunt);
    EventBus.on("rpg:gm", onGm);
    this.events.once("shutdown", () => {
      EventBus.off("input:move", onMove);
      EventBus.off("input:attack", onAtk);
      EventBus.off("input:skill1", onS1);
      EventBus.off("input:skill2", onS2);
      EventBus.off("input:skill3", onS3);
      EventBus.off("input:skill4", onS4);
      EventBus.off("input:skill5", onS5);
      EventBus.off("input:interact", onInteract);
      EventBus.off("name:set", onNameSet);
      EventBus.off("keymap:changed", onKeymapChanged);
      EventBus.off("rpg:buy", onBuy);
      EventBus.off("rpg:equip", onEquip);
      EventBus.off("rpg:unequip", onUnequip);
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
      EventBus.off("rpg:useItem", onUseItem);
      EventBus.off("rpg:warp", onWarp);
      EventBus.off("rpg:bossReplay", onBossReplay);
      EventBus.off("rpg:sell", onSell);
      EventBus.off("rpg:sellPotion", onSellPotion);
      EventBus.off("rpg:bmBuy", onBmBuy);
      EventBus.off("rpg:autoset", onAutoSet);
      EventBus.off("rpg:autohunt", onAutoHunt);
      EventBus.off("rpg:gm", onGm);
      EventBus.off("rpg:tradeBuy", onTradeBuy);
      EventBus.off("rpg:tradeSell", onTradeSell);
      EventBus.off("rpg:starScroll", onStarScroll);
      EventBus.off("rpg:upgradeAcc", onUpgradeAcc);
    });

    /* ================= v3.1.0 (#흑화) — fadeIn/워치독은 create() 래퍼로 이동 (v3.2.0)
     *  초기화 중 예외가 나도 화면이 반드시 밝아지도록 보장하기 위함 */
  }

  /** 액션에 배정된 키 객체 (키 매핑 v1.9) */
  private keyFor(a: GameAction): Phaser.Input.Keyboard.Key {
    return this.keyObjs[this.keymap[a]] ?? this.keys[this.keymap[a]];
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50);

    /* v3.2.0 (#흑화) — 카메라 자가치유 (v3.3.0: 상시화 — 6초 한정 제거):
     *  페이드 이펙트가 실행 중이 아닌데 알파가 1 미만으로 남아있으면(WebView에서
     *  fadeOut 완료 콜백 유실 등) 매 프레임 강제로 밝힌다. 사망 페이드아웃은 fadeEffect가
     *  실행 중이라 미간섭 — 죽은 뒤 어두운 화면도 정상 유지된다. */
    {
      const cam = this.cameras.main as unknown as {
        fadeEffect?: { isRunning: boolean }; alpha: number; setAlpha(a: number): void;
      };
      if (!cam.fadeEffect?.isRunning && cam.alpha < 1) cam.setAlpha(1);
    }
    /* v3.3.0 (#흑화) — 물리 월드 자가치유: 대사/취침/사망도 아닌데 정지돼 있으면
     *  (보스 시네마틱 도중 예외, 복구 경로 실패 등) 즉시 복원해 조작 불능을 막는다 */
    if (
      this.physics.world.isPaused && !this.dialoguing && !this.sleeping &&
      this.player && this.player.state !== "dead"
    ) {
      this.physics.world.resume();
    }
    /* v3.3.0 (지시 #6) — 무릉도장 타이머/기록 UI 진행 */
    if (this.dojangActive) this.tickDojang(dt);

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
    // v3.0.3 — 몬스터 투사체/장판/오비트 칼날 + 무기 비주얼 (사망/대화 중에도 진행)
    this.tickEnemyProjs(dt);
    this.tickFields(dt);
    this.tickOrbitBlades(dt);
    if (this.player && this.player.state !== "dead") this.syncWeaponSprite();
    else if (this.weaponImg) { this.weaponImg.setVisible(false); }

    // 채팅 입력 중 — 게임 키/이동 완전 차단 (원격 보간은 위에서 계속)
    if (this.chatFocused || this.dialoguing || !this.player) return;
    if (this.player.state === "dead") return;

    this.wellCd = Math.max(0, this.wellCd - dt);
    this.restCd = Math.max(0, this.restCd - dt);

    // 마을 우물 샘물 — 근접 시 풀회복 (HP/MP가 꽉 차 있으면 미발동, 8초 쿨다운)
    if (this.wellPos && this.stageDef.isVillage && this.wellCd <= 0) {
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
    // v2.5 — 자동사냥 (펫 보유 시): 가장 가까운 적 추적·공격 — 조이스틱/키보드 입력 시 수동 우선
    this.tickAutoHunt();
    // v3.0.14 — 끼임 탈출: 이동 명령 중 제자리면 측면 탈출로 autoHuntMove 덮어씀
    this.tickAutoUnstuck(dt);
    let move = useTouch ? this.touchMove : mv;
    if (this.autoHunt && !useTouch) move = this.autoHuntMove; // v3.0.15 (#5): 펫 조건 제거

    // 키보드 공격/스킬 — 이동은 WASD+화살표 고정, 액션 키는 키 매핑 따름 (v1.9)
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keyFor("attack")))
      this.attackQueued = true;
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("skill1"))) this.player.useSkill1();
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("skill2"))) this.player.useSkill2();
    /* v3.0.3 — 3차기(V) / 4차기(B): 해금 티어 미달/쿨/MP 무시하고 호출하면 내부에서 무시된다 */
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("skill3"))) this.player.useSkill3();
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("skill4"))) this.player.useSkill4();
    /* v3.2.0 — 5차 궁극기(N): Lv.200 해금, 쿨타임 60초 */
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("skill5"))) this.player.useSkill5();

    // 수면 연출 중 — 입력 봉인 (v2.2)
    if (this.sleeping) {
      this.player.update(dt, Phaser.Math.Vector2.ZERO, false);
    } else {
      this.player.update(dt, move, this.attackQueued);
    }
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
    /* v3.0.16 — 몬스터 컬렉션 패널 (M키) */
    if (Phaser.Input.Keyboard.JustDown(this.keyFor("collection"))) EventBus.emit("ui:panel", { panel: "collection" });

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
    /* v3.0.5 — 스타포스: 궤도성 회전(★15) + 주변 스파클(★8+) */
    if (this.sfOrbits.length && this.player) {
      this.sfOrbitAng += dt * 0.0026;
      for (let i = 0; i < this.sfOrbits.length; i++) {
        const ang = this.sfOrbitAng + (i * Math.PI * 2) / this.sfOrbits.length;
        this.sfOrbits[i].setPosition(
          this.player.x + Math.cos(ang) * 27,
          this.player.y - 12 + Math.sin(ang) * 11
        );
      }
    }
    if (this.upgradeGlow && this.player) {
      const wUp = this.player.upgrades.weapon;
      if (wUp >= 8) {
        this.sfSparkTimer -= dt;
        if (this.sfSparkTimer <= 0) {
          this.sfSparkTimer = wUp >= 12 ? 230 : 420;
          const sx = this.player.x + (Math.random() - 0.5) * 44;
          const sy = this.player.y - 6 - Math.random() * 36;
          const sp = this.add
            .image(sx, sy, "sparkle0")
            .setDepth(11)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setScale(0.5 + Math.random() * 0.4)
            .setAlpha(0.9);
          this.tweens.add({
            targets: sp,
            y: sy - 16,
            alpha: 0,
            duration: 520,
            onComplete: () => sp.destroy(),
          });
        }
      }
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

  /** v2.5 — 자동사냥 틱 (펫 보유 시): 가장 가까운 적 추적·공격 + 물약 자동 사용.
   *  이동은 autoHuntMove 주입(조이스틱 터치 중이면 무시), 공격은 attackQueued로 자연 연결
   *  v3.0.1 — 직업별 스킬 최적화: 조준 보정 / 원거리 카이팅+이탈 점멸 / 근접 돌진 갭클로저 /
   *  광역기(회전베기·관통 화살)는 군집·보스 한정, 마법사 볼트는 쿨마다 */
  private tickAutoHunt() {
    this.autoHuntMove.set(0, 0);
    // v3.0.15 (#5) — 펫 없이도 자동전투 가능 (펫 게이트 제거)
    if (!this.autoHunt || !this.player) return;
    if (this.dialoguing || this.sleeping) return;
    this.autoPotion();
    if (this.player.state !== "idle") return; // 공격/돌진/사망 중엔 개입 안 함
    /* v3.0.25 (#길찾기제거) — 구역 간 자동 길찾기 제거: 자동사냥은 현 구역 안에서만 사냥하고,
     *  다음 목표는 대형 어시스트 화살표(엣지 화살표 + 구역명 라벨)가 방향을 안내한다.
     *  (기존 #47 자동 여행은 포탈 앞 정지·장거리 왕복 체감이 나빠 삭제 — #1 요청 반영) */
    const targets = this.getAllTargets();
    if (targets.length === 0) {
      this.autoWanderTick(); // v3.0.25 — 적 없음: 제자리 대신 구역 내 배회 (리스폰 탐색)
      return;
    }
    /* v3.0.15 (#1) — 제자리 와리가리 수정 3종:
     *  ① 블랙리스트 정리: 도달 불가 타겟은 만료 시 제외
     *  ② 타겟 히스테리시스: 현재 타겟보다 25% 이상 가까울 때만 교체
     *  ③ 접근 방향 홀드: autoApproach 내부에서 240ms 유지 (매 프레임 재계산 진동 제거) */
    if (this.autoBlacklist.size > 0) {
      for (const [k, until] of this.autoBlacklist) {
        if (this.time.now >= until || !k.active) this.autoBlacklist.delete(k);
      }
    }
    const live = targets.filter((e) => e.active && !this.autoBlacklist.has(e));
    if (live.length === 0) {
      this.autoWanderTick();
      return;
    }
    /* v3.0.28 (#자동전투개편) — 퀘스트 비종속 사냥·보스 최적화:
     *  ① 퀘스트 타겟 우선 필터(v3.0.25) 완전 제거 — 퀘스트 몬스터를 먼저 잡으려 몬스터 무리 한가운데로
     *     돌진해 계속 맞던 원인. 이제 자동전투는 퀘스트에 전혀 영향을 받지 않는다.
     *  ② 위협도 우선: 나에게 붙어있는/다가오는 몬스터를 먼저 제거해 피격 최소화 (생존 1순위)
     *  ③ 보스 우선: 보스전 구역에선 보스를 최우선 타겟
     *  ④ 밀집도 보정 유지(v3.0.22) — 무리를 따라가며 효율 사냥 */
    const pool = live;
    let best: Enemy | Boss = pool[0];
    let bestEff = Infinity;
    for (const e of pool) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      const eff = this.autoThreatScore(e, d, live);
      if (eff < bestEff) {
        bestEff = eff;
        best = e;
      }
    }
    const curT = this.autoTarget;
    if (curT && curT !== best && curT.active && !this.autoBlacklist.has(curT) && pool.includes(curT)) {
      const curD = Phaser.Math.Distance.Between(this.player.x, this.player.y, curT.x, curT.y);
      const curEff = this.autoThreatScore(curT, curD, live);
      /* v3.0.22 (#41) — 히스테리시스 확대(1.25→1.3·420→700px): 먼 무리 이동 중 매 틱 타깃이
       *  바뀌며 제자리에서 방향만 흔들리던 떨림 제거 */
      if (curEff <= bestEff * 1.3 && curD < 700) best = curT; // 위협도 반영한 히스테리시스
    }
    this.autoTarget = best;
    const bestD = Phaser.Math.Distance.Between(this.player.x, this.player.y, best.x, best.y); // v3.0.20 (#4) — 실거리 기준 판정 유지
    const fam = familyOf(this.player.cls);
    const ranged = fam === "ranger" || fam === "mage";
    const atkRange = ranged ? 250 : 56;
    /* v3.0.15 (#1) — 도달 불가 타겟 포기: 사거리 밖인데 1.2초 이상 제자리면(벽 뒤·장애물 뒤)
     *  5초간 이 타겟을 제외하고 다음 가까운 적을 잡는다 */
    if (bestD > atkRange && this.autoStuckMs > 1200) {
      this.autoBlacklist.set(best, this.time.now + 5000);
      this.autoStuckMs = 0;
      this.autoTarget = null;
      this.autoDirHoldUntil = 0;
      return;
    }
    const p = this.player;

    // 조준 보정 — 공격 전 대상 방향으로 facing 고정 (정지 뒤 조준이 어긋나는 문제 제거)
    const aimAt = () => {
      const aim = new Phaser.Math.Vector2(best.x - p.x, best.y - p.y);
      if (aim.lengthSq() > 0.001) p.facing.copy(aim).normalize();
    };

    if (ranged) {
      /* v3.0.6 (지시 #6 — "원거리 자동사냥시 몬스터가 너무 가까이 있으면 끼어버리는 버그"):
       *  ① 후퇴 방향 탐색을 110px로 확대 + 다른 근접 위협까지 고려한 스코어링
       *  ② 코너(8방향 전부 막힘) 판정 — 영원히 벽을 보고 후퇴만 하던 원인 제거:
       *     - 돌진기 가능 → 적 "통과" 돌진으로 반대편 탈출
       *     - 아니면 정면 반격 (공격+주력기) — 맞으면서라도 싸움
       *  ③ 열린 후퇴로가 있으면 이탈하되 즉시 조준·사격 유지 (카이팅) */
      if (bestD < 150) {
        const cornered = this.autoRetreatBlocked();
        aimAt();
        if (cornered) {
          if (p.skill2Cd <= 0 && p.mp >= 20) {
            // 적을 통과해 반대편으로 탈출 (돌진은 적과 충돌하지 않음 — 스윕 피해도 함께)
            p.autoDashDir = new Phaser.Math.Vector2(best.x - p.x, best.y - p.y).normalize();
            p.useSkill2();
          } else {
            // 반격 — 벽에 붙어서 맞기만 하던 상태를 끊음
            this.attackQueued = true;
            if (p.skill1Cd <= 0 && p.mp >= 15) p.useSkill1();
          }
          return;
        }
        const away = this.autoRetreatDir(best);
        if (p.skill2Cd <= 0 && p.mp >= 20) {
          p.autoDashDir = away;
          p.useSkill2();
        } else {
          // 카이팅 — 이탈 방향 이동 유지 (공격은 state가 attack이면 다음 틱에 이어서)
          this.autoHuntMove.copy(away);
          this.attackQueued = true;
        }
        return;
      }
      if (bestD > atkRange) {
        this.autoApproach(best);
        return;
      }
      // 사거리 내 — 조준 보정 후 공격 + 직업별 주력기 판단
      aimAt();
      this.attackQueued = true;
      if (p.skill1Cd <= 0 && p.mp >= 15) {
        if (fam === "mage") p.useSkill1(); // 매직 볼트 — 주력 딜링, 쿨마다
        // 궁수 관통 화살 — 군집(2+) 또는 보스 한정 (단일 몹엔 기본공격으로 MP 절약)
        else if (this.countTargetsNear(340) >= 2 || best instanceof Boss) p.useSkill1();
      }
      /* v3.0.3 — 3차기: 보스/군집에서 우선 사용, 4차기: 보스 또는 군집 3+ */
      if (p.skill3Unlocked && p.skill3Cd <= 0 && p.mp >= 40 && (best instanceof Boss || this.countTargetsNear(300) >= 2)) {
        p.useSkill3();
      }
      if (p.skill4Unlocked && p.skill4Cd <= 0 && p.mp >= 60 && (best instanceof Boss || this.countTargetsNear(340) >= 3)) {
        p.useSkill4();
      }
    } else {
      // 근접 (전사/도적/미전직)
      /* v3.0.28 (#자동전투개편) — 생존 우선: HP 30% 이하 + 포위(2+)면 물약 회복 텀을 벌리기 위해
       *  열린 후퇴로로 잠깐 이탈 (코너에선 후퇴가 불가하므로 정면 반격 유지) */
      if (p.hp <= p.maxHp * 0.3 && this.countTargetsNear(150) >= 2 && !this.autoRetreatBlocked()) {
        this.autoHuntMove.copy(this.autoRetreatDir(best));
        this.attackQueued = false;
        return;
      }
      if (bestD > atkRange) {
        // 돌진 갭클로저 — 240px 이내 + 직선 경로 개방 시 돌진기 접근 (2.1x 스윕 + 전사 충격파)
        if (bestD <= 240 && p.skill2Cd <= 0 && p.mp >= 20 && this.dashPathClear(best)) {
          aimAt();
          p.autoDashDir = new Phaser.Math.Vector2(best.x - p.x, best.y - p.y).normalize();
          p.useSkill2();
          return;
        }
        this.autoApproach(best);
        return;
      }
      aimAt();
      this.attackQueued = true;
      // 회전베기 — 주변 2+ 군집 또는 보스일 때만 (단일 대상엔 기본공격)
      if (p.skill1Cd <= 0 && p.mp >= 15) {
        const spinR = 118 + 16 * p.tier; // v3.0.4 — 회전베기 강화 반경과 동기화
        if (this.countTargetsNear(spinR) >= 2 || best instanceof Boss) p.useSkill1();
      }
      /* v3.0.3 — 3차기/4차기: 군집·보스 상황에서 자동 기동 */
      if (p.skill3Unlocked && p.skill3Cd <= 0 && p.mp >= 40 && (best instanceof Boss || this.countTargetsNear(260) >= 2)) {
        p.useSkill3();
      }
      if (p.skill4Unlocked && p.skill4Cd <= 0 && p.mp >= 60 && (best instanceof Boss || this.countTargetsNear(320) >= 3)) {
        p.useSkill4();
      }
    }
  }

  /** v3.0.28 (#자동전투개편) — 자동전투 타겟 스코어링 (작을수록 우선).
   *  위협도(나에게 붙은 몬스터) > 보스 > 밀집도 보정. 퀘스트 대상은 점수에 아예 개입하지 않는다. */
  private autoThreatScore(e: Enemy | Boss, d: number, live: (Enemy | Boss)[]): number {
    let eff = d;
    /* 밀집도 보정 (v3.0.22 #37 로직 유지) — 무리가 모인 곳으로의 효율 사냥 */
    let near = 0;
    for (const o of live) {
      if (o === e) continue;
      if (Phaser.Math.Distance.Between(e.x, e.y, o.x, o.y) <= 260) near++;
    }
    eff *= 1 - Math.min(0.62, near * 0.15);
    /* 위협도 우선 — 내 근접 위험대(220px) 몬스터를 먼저 제거해 피격 최소화 */
    if (d <= 220) eff *= 0.45;
    else if (d <= 340) eff *= 0.8;
    /* 보스 우선 — 보스전에선 보스를 잡는 게 답 */
    if (e instanceof Boss) eff *= 0.5;
    return eff;
  }

  /** v3.0.25 (#자동사냥개선) — 적이 없을 때 구역 내 배회: 리스폰/남은 몬스터를 찾아 이동
   *  (기존은 제자리 정지 — 화면 밖 몬스터를 영영 못 찾는 문제) */
  private autoWanderPoint: { x: number; y: number } | null = null;
  private autoWanderUntil = 0;
  private autoWanderTick() {
    if (!this.player) return;
    if (this.time.now >= this.autoWanderUntil) {
      this.autoWanderPoint = this.randomOpenPointNear(560);
      this.autoWanderUntil = this.time.now + 2800;
    }
    const w = this.autoWanderPoint;
    if (!w) return;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, w.x, w.y) > 44) this.autoApproach(w);
    else this.autoWanderUntil = 0;
  }

  /** 반경 내 열린 셀 중 무작위 지점 (배회 대상) */
  private randomOpenPointNear(radius: number): { x: number; y: number } | null {
    if (!this.layout || !this.player) return null;
    const pcc = cellCenterOf(this.layout, cellIndexOf(this.layout, this.player.x, this.player.y));
    const cand: number[] = [];
    for (let i = 0; i < this.layout.open.length; i++) {
      if (!this.layout.open[i]) continue;
      const c = cellCenterOf(this.layout, i);
      if (Phaser.Math.Distance.Between(pcc.x, pcc.y, c.x, c.y) <= radius) cand.push(i);
    }
    if (cand.length === 0) return null;
    const c = cellCenterOf(this.layout, cand[Phaser.Math.Between(0, cand.length - 1)]);
    return { x: c.x, y: c.y };
  }

  /** v3.0.1 — BFS 우회 접근 (개미굴 레이아웃: 다른 셀이면 경로의 다음 셀 중심으로)
   *  v3.0.14 — 셀 내부 오브젝트(나무·바위) 직선 돌파 방지: 바로 앞이 막혔으면 열린 각도로 우회
   *  v3.0.22 (#47) — 좌표 일반화: 적뿐 아니라 여행 포탈 좌표도 접근 가능
   *  v3.0.22 (#41) — 원거리 목표(340px+)는 방향 홀드 1100ms — 제자리 떨림 제거 */
  private autoApproach(target: { x: number; y: number }) {
    if (!this.player) return;
    /* v3.0.15 (#1) — 이동 방향 홀드(240ms): 매 프레임 BFS/회피 재계산으로 좌우로 흔들리던
     *  "제자리 와리가리" 제거. 홀드 중에는 직전 방향을 유지한다 */
    if (this.time.now < this.autoDirHoldUntil) {
      this.autoHuntMove.copy(this.autoDirHold);
      return;
    }
    let dir: Phaser.Math.Vector2;
    const pc = this.layout ? cellIndexOf(this.layout, this.player.x, this.player.y) : -1;
    const tc = this.layout ? cellIndexOf(this.layout, target.x, target.y) : -1;
    const step = this.layout ? nextStepToward(this.layout, pc, tc) : null;
    if (this.layout && step !== null && step !== pc) {
      const c = cellCenterOf(this.layout, step);
      dir = new Phaser.Math.Vector2(c.x - this.player.x, c.y - this.player.y).normalize();
    } else {
      dir = new Phaser.Math.Vector2(target.x - this.player.x, target.y - this.player.y).normalize();
    }
    dir = this.autoAvoidDir(dir);
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
    this.autoDirHold.copy(dir);
    this.autoDirHoldUntil = this.time.now + (dist > 340 ? 1100 : 300);
    this.autoHuntMove.copy(dir);
  }

  /** v3.0.14 — 지점이 장애물(나무/바위) 충돌 박스와 겹치는지 (플레이어 반경 여유 포함) */
  private blockedByObstacle(x: number, y: number): boolean {
    for (const go of this.solidGroup.children.entries) {
      if (!go.active || !go.getData("obstacle")) continue;
      const b = (go as Phaser.Physics.Arcade.Image).body as Phaser.Physics.Arcade.StaticBody | null;
      if (!b) continue;
      if (x >= b.x - 14 && x <= b.x + b.width + 14 && y >= b.y - 12 && y <= b.y + b.height + 14) return true;
    }
    return false;
  }

  /** v3.0.14 — 진행 방향 장애물 회피: 전방 탐지점 3단계(40/110/180px) 중 하나라도 막히면
   *  ±34°/±69°/±103°/±137° 순으로 열린 방향 탐색 (전부 막히면 원방향 유지 — 끼임 탈출이 처리) */
  /** v3.0.15 (#1) — 직전 회피 부호 (±): 같은 쪽 회피를 우선해 좌우 번갈아 진동 억제 */
  private autoAvoidLastSign = 0;
  private autoAvoidDir(base: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const p = this.player!;
    const probe = (d: Phaser.Math.Vector2, dist: number) => {
      const nx = p.x + d.x * dist;
      const ny = p.y + d.y * dist;
      if (this.layout && !isOpenXY(this.layout, nx, ny)) return false;
      return !this.blockedByObstacle(nx, ny);
    };
    const clear = (d: Phaser.Math.Vector2) => probe(d, 40) && probe(d, 110) && probe(d, 180);
    if (clear(base)) {
      this.autoAvoidLastSign = 0;
      return base;
    }
    // 이전에 +쪽으로 피했다면 +쪽 후보를 먼저 검사 (부호 연속성)
    const sign = this.autoAvoidLastSign || 1;
    const angles = [0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.4, -2.4].map((a) => a * sign);
    for (const ang of angles) {
      const d = base.clone().rotate(ang);
      if (clear(d)) {
        this.autoAvoidLastSign = Math.sign(ang);
        return d;
      }
    }
    return base;
  }

  /** v3.0.14 — 끼임 탈출: 이동 명령 중인데 실제 이동량이 0.35초 이상 미미하면
   *  측면(±51°/±86°/±126°) 중 열린 방향으로 0.5초간 강제 이동 (autoHuntMove를 덮어씀) */
  private tickAutoUnstuck(dt: number) {
    if (!this.autoHunt || !this.player) return;
    const p = this.player;
    if (this.autoHuntMove.lengthSq() < 0.01) {
      this.autoStuckMs = 0;
      this.autoLastPos.set(p.x, p.y);
      return;
    }
    if (this.time.now < this.autoUnstuckUntil) {
      this.autoHuntMove.copy(this.autoUnstuckDir); // tickAutoHunt가 다시 덮어써도 탈출 유지
      return;
    }
    const moved = Phaser.Math.Distance.Between(p.x, p.y, this.autoLastPos.x, this.autoLastPos.y);
    this.autoLastPos.set(p.x, p.y);
    /* 초당 ~48px 미만 이동이면 막힘으로 간주 (정상 속도의 절반 이하) */
    if (moved < dt * 0.048) this.autoStuckMs += dt;
    else this.autoStuckMs = 0;
    if (this.autoStuckMs < 350) return;
    const base = this.autoHuntMove.clone();
    const wb = this.physics.world.bounds;
    for (const ang of [0.9, -0.9, 1.5, -1.5, 2.2, -2.2]) {
      const d = base.clone().rotate(ang);
      const nx = p.x + d.x * 60;
      const ny = p.y + d.y * 60;
      if (nx < 60 || nx > wb.width - 60 || ny < 60 || ny > wb.height - 60) continue;
      if (this.layout && !isOpenXY(this.layout, nx, ny)) continue;
      if (this.blockedByObstacle(nx, ny)) continue;
      this.autoUnstuckDir.copy(d);
      this.autoUnstuckUntil = this.time.now + 500;
      this.autoStuckMs = 0;
      break;
    }
  }

  /** v3.0.1 — 돌진 갭클로저 직선 경로 개방 확인 (중간 지점이 열려 있어야 허용) */
  private dashPathClear(best: Enemy | Boss): boolean {
    if (!this.layout || !this.player) return true;
    return isOpenXY(this.layout, (this.player.x + best.x) / 2, (this.player.y + best.y) / 2);
  }

  /** v3.0.1 — 사거리 내 적 수 (광역기 가치 판단) */
  private countTargetsNear(r: number): number {
    if (!this.player) return 0;
    let n = 0;
    for (const e of this.getAllTargets()) {
      if (!e.active) continue;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) <= r) n++;
    }
    return n;
  }

  /** v3.0.1 — 이탈 방향: 대상 반대편 (개미굴 벽이면 45°씩 회전해 열린 방향 탐색)
   *  v3.0.6 (지시 #6) — 탐지 거리 72→110px 확대 + 각 후보 방향을 "주변 위협과의 최소거리"로 스코어링해
   *  몬스터 사이로 끼이는 후퇴를 줄인다 */
  private autoRetreatDir(threat: Enemy | Boss): Phaser.Math.Vector2 {
    const p = this.player!;
    const wb = this.physics.world.bounds;
    const base = new Phaser.Math.Vector2(p.x - threat.x, p.y - threat.y);
    if (base.lengthSq() < 0.001) base.set(1, 0);
    base.normalize();
    const threats = this.getAllTargets().filter(
      (e) => e.active && e !== threat && Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) < 260
    );
    // v3.0.6 — 개미굴 벽 + 맵 가장자리(월드 바운드) 양쪽을 열림 판정에 반영
    // v3.0.14 — 오브젝트(나무/바위) 방향도 후퇴 불가로 판정 — 후퇴 중 끼임 방지
    const openDir = (d: Phaser.Math.Vector2) => {
      const nx = p.x + d.x * 110;
      const ny = p.y + d.y * 110;
      if (nx < 70 || nx > wb.width - 70 || ny < 70 || ny > wb.height - 70) return false;
      if (this.blockedByObstacle(p.x + d.x * 56, p.y + d.y * 56)) return false;
      return !this.layout || isOpenXY(this.layout, nx, ny);
    };
    let bestDir: Phaser.Math.Vector2 | null = null;
    let bestScore = -Infinity;
    for (const ang of [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1, Math.PI]) {
      const d = base.clone().rotate(ang);
      if (openDir(d)) {
        // 스코어 = 이 방향으로 90px 이동했을 때의 최악 위협 거리 (클수록 좋음)
        const nx = p.x + d.x * 90;
        const ny = p.y + d.y * 90;
        let score = 9999;
        for (const e of threats) {
          const dd = Phaser.Math.Distance.Between(nx, ny, e.x, e.y);
          if (dd < score) score = dd;
        }
        // 진행 방향 앞쪽 후보에 소폭 가산 (제자리 회전 방지)
        score += d.dot(base) * 24;
        if (score > bestScore) {
          bestScore = score;
          bestDir = d;
        }
      }
    }
    return bestDir ?? base;
  }

  /** v3.0.6 — 코너 판정: 8방향 모두 막혀 후퇴 불가 (원거리 자동사냥 "끼어버림" 해결용)
   *  맵 가장자리(월드 바운드)도 벽으로 간주 — 개미굴이 아닌 개방 맵 코너도 잡는다 */
  private autoRetreatBlocked(): boolean {
    const p = this.player!;
    const wb = this.physics.world.bounds;
    for (const ang of [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1, Math.PI]) {
      const d = new Phaser.Math.Vector2(1, 0).rotate(ang);
      const nx = p.x + d.x * 110;
      const ny = p.y + d.y * 110;
      if (nx < 70 || nx > wb.width - 70 || ny < 70 || ny > wb.height - 70) continue;
      if (!this.layout || isOpenXY(this.layout, nx, ny)) return false;
    }
    return true;
  }

  /** v2.5 — 자동 물약 (자동사냥 중).
   *  v3.0.15 (#6) — 하드코딩 45% 대신 BM 설정값(autoUse.hpPct/mpOn)을 따르되,
   *  설정이 꺼져 있어도 안전망(HP 35%)으로 기본 물약만 사용. 슬롯에 지정된 물약 사용. */
  private autoPotion() {
    if (!this.player) return;
    const cfg = this.player.autoUse;
    const hpKey = (this.player.quickPots.hp ?? "potion_hp") as ItemKey;
    const mpKey = (this.player.quickPots.mp ?? "potion_mp") as ItemKey;
    const hpHave = hpKey === "potion_hp" ? this.player.potions.hp > 0 : this.player.owned.includes(hpKey);
    const mpHave = mpKey === "potion_mp" ? this.player.potions.mp > 0 : this.player.owned.includes(mpKey);
    if (this.player.potionCd > 0) return;
    if (cfg.hpPct > 0 && this.player.hp <= this.player.maxHp * (cfg.hpPct / 100) && hpHave) {
      this.player.usePotion("hp");
    } else if (this.player.hp < this.player.maxHp * 0.35 && hpHave) {
      this.player.usePotion("hp"); // 안전망
    } else if (cfg.mpOn && this.player.mp <= this.player.maxMp * 0.25 && mpHave) {
      this.player.usePotion("mp");
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

  /** 플레이어 이름표 확보 — v2.4 수정: 재접속/씬 재시작 시에도 이름표 유지 (기존엔 인트로에서만 생성) */
  private ensurePlayerTag() {
    if (this.playerNameTag || !this.player) return;
    this.playerNameTag = this.add
      .text(this.player.x, this.player.y - 48, getPlayerName(), {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#baf3ff",
        stroke: "#0a2030",
        strokeThickness: 4,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.refreshPlayerTag();
  }

  /* ================= 플레이어 투사체 (v1.8) ================= */

  /** 궁수 화살 / 마법사 볼트 발사 — 보스 orb 풀 패턴 재사용 (물리 velocity + 수동 판정) */
  /** v3.0.2 — tex/anim/blend 지원: 궁수는 실제 화살(normal), 마법사는 스펠 애니 프레임 */
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
    tex?: string;
    anim?: string;
    blend?: "add" | "normal";
    /** angle로 스프라이트 회전 (화살 등 방향성 텍스처) */
    rot?: boolean;
    /** v3.0.3 — 유도 (데드아이 신의 화살비): 가장 가까운 적으로 진로 수정 */
    homing?: boolean;
    /** v3.0.16 (#4) — 비행 잔상(트레일) 색. 지정하면 진행 경로가 발광 잔상으로 남는다 */
    trail?: number;
  }) {
    if (this.pProjPool.length === 0) {
      for (let i = 0; i < 24; i++) {
        const p = this.physics.add.sprite(0, 0, "orb");
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
    p.anims.stop(); // 풀 재사용 — 이전 애니/텍스처 잔존 제거
    if (cfg.tex) p.setTexture(cfg.tex);
    else if (p.texture.key !== "orb") p.setTexture("orb");
    p.setTint(cfg.tint).setScale(cfg.scale ?? 0.9).setAlpha(0.95);
    p.setBlendMode(cfg.blend === "normal" ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
    if (cfg.anim && this.anims.exists(cfg.anim)) p.play(cfg.anim);
    else if (cfg.anim) p.setTexture("orb");
    p.setRotation(cfg.rot ? cfg.angle : 0);
    p.setData("rot", cfg.rot === true); // v3.0.12 — 유도 중 회전 갱신용 플래그
    p.setData("dmg", cfg.dmg);
    p.setData("crit", cfg.crit);
    p.setData("pierce", cfg.pierce);
    p.setData("knock", cfg.knock);
    p.setData("tint", cfg.tint);
    p.setData("homing", cfg.homing === true);
    p.setData("trail", cfg.trail ?? 0); // 0 = 트레일 없음
    p.setData("trailAcc", 0);
    p.setData("life", 1700);
  }

  /** v3.0.16 (#4) — 투사체 잔상: 진행 경로를 따라 페이드아웃하는 발광 애프터이미지.
   *  다중사격 부채꼴이 “화살비”처럼 보이는 핵심 연출. 이미지는 tween으로 자가 소멸 */
  private spawnProjTrail(p: Phaser.Physics.Arcade.Sprite, hex: number) {
    const img = this.add.image(p.x, p.y, p.texture.key)
      .setRotation(p.rotation)
      .setScale(p.scaleX, p.scaleY)
      .setTint(hex)
      .setAlpha(0.4)
      .setDepth(11)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: img,
      alpha: 0,
      scale: p.scaleX * 0.5,
      duration: 240,
      ease: "Cubic.out",
      onComplete: () => img.destroy(),
    });
  }

  /* ================= v3.0.6 — 클래스 고유 주력기 신규 이펙트 4종 ================= */

  /** 스나이퍼 저격 라인 — 즉발 히트스캔 빔 (짧게 번쩍이고 소멸) */
  spawnSnipeBeam(x1: number, y1: number, x2: number, y2: number, hex: number) {
    const line = this.add.line(0, 0, x1, y1, x2, y2, hex, 0.9)
      .setDepth(22)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setLineWidth(3);
    const core = this.add.line(0, 0, x1, y1, x2, y2, 0xffffff, 0.9)
      .setDepth(23)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setLineWidth(1);
    this.tweens.add({
      targets: [line, core],
      alpha: 0,
      duration: 170,
      ease: "Cubic.out",
      onComplete: () => { line.destroy(); core.destroy(); },
    });
  }

  /* ================= v3.0.11 — 돌진 계열별 특색 이펙트 =================
   *  전사=대지 먼지 / 궁수=질풍 바람꼬리 / 도적=그림자 잔상 / 마법사=룬 링 (직업 특색 돌진) */

  /** 전사 계열 — 발밑 먼지 기둥 (대지를 박차는 무게감) */
  spawnDashDust(x: number, y: number, tint = 0xff9a8a) {
    for (let i = 0; i < 2; i++) {
      const c = this.add.circle(x + (Math.random() - 0.5) * 24, y + 16 + Math.random() * 6, 3 + Math.random() * 3, 0xb8a890, 0.5)
        .setDepth(9);
      this.tweens.add({ targets: c, scale: 2.1, alpha: 0, y: c.y + 7, duration: 380, ease: "Cubic.out", onComplete: () => c.destroy() });
    }
    this.spawnBurstAt(x, y + 14, 1, tint);
  }

  /** 궁수 계열 — 몸 뒤로 흩어지는 바람 꼬리 선 (질풍 질주감) */
  spawnWindStreak(x: number, y: number, dir: Phaser.Math.Vector2, tint = 0x9dffc4) {
    const len = 34 + Math.random() * 18;
    const ox = (Math.random() - 0.5) * 26;
    const oy = (Math.random() - 0.5) * 30 - 6;
    const line = this.add.line(
      0, 0,
      x + ox - dir.x * len, y + oy - dir.y * len,
      x + ox, y + oy,
      tint, 0.7
    )
      .setDepth(11)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setLineWidth(1.5);
    this.tweens.add({ targets: line, alpha: 0, duration: 260, ease: "Cubic.out", onComplete: () => line.destroy() });
  }

  /** 도적 계열 — 내 실루엣이 어둡게 남는 그림자 잔상 */
  spawnShadowAfterimage(p: Player, tint = 0x2a1040) {
    const img = this.add.image(p.x, p.y, p.texture.key, p.frame.name)
      .setDepth(p.depth - 1)
      .setFlipX(p.flipX)
      .setTint(tint)
      .setAlpha(0.55);
    this.tweens.add({ targets: img, alpha: 0, scale: 0.92, duration: 320, ease: "Cubic.out", onComplete: () => img.destroy() });
  }

  /** 마법사 계열(블링크) — 출발/도착 지점에 펼쳐지는 룬 링 */
  spawnRuneRing(x: number, y: number, hex = 0x8fa6ff) {
    const ring = this.add.circle(x, y + 10, 42, 0x8fa6ff, 0.001)
      .setStrokeStyle(2, hex, 0.9)
      .setDepth(12)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.2);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 340, ease: "Cubic.out", onComplete: () => ring.destroy() });
  }

  /** 윈드러너 회오리 화살 — 회오리 투사체: 경로상 적을 끌어당기고 틱 피해
   *  v3.0.11 — 단색 원 → 토네이도 스프라이트(fx-tornado 8프레임 회전)로 교체 + 바람 꼬리 잔상 */
  fireGustTornado(cfg: {
    x: number; y: number; angle: number; speed: number;
    dmg: number; crit: boolean; hex: number; pull: number; radius: number; life: number;
  }) {
    const g = this.add.sprite(cfg.x, cfg.y, "fx_tornado", 0)
      .setDepth(13)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(cfg.hex)
      .setScale(1.15)
      .setAlpha(0.92);
    g.play("fx-tornado");
    const vx = Math.cos(cfg.angle) * cfg.speed;
    const vy = Math.sin(cfg.angle) * cfg.speed;
    let life = cfg.life;
    const tick = this.time.addEvent({
      delay: 120,
      repeat: Math.ceil(cfg.life / 120),
      callback: () => {
        life -= 120;
        if (!g.active || life <= 0) { tick.remove(); if (g.active) g.destroy(); return; }
        g.setPosition(g.x + vx * 0.12, g.y + vy * 0.12);
        const wb = this.physics.world.bounds;
        for (const e of this.getAllTargets()) {
          if (!e.active) continue;
          const d = Phaser.Math.Distance.Between(g.x, g.y, e.x, e.y);
          if (d <= cfg.radius) {
            // 끌어당김 — 회오리 중심으로
            const nx = Phaser.Math.Clamp(e.x + (g.x - e.x) * cfg.pull * 0.22, 40, wb.width - 40);
            const ny = Phaser.Math.Clamp(e.y + (g.y - e.y) * cfg.pull * 0.22, 40, wb.height - 40);
            (e as unknown as { body?: Phaser.Physics.Arcade.Body }).body?.reset?.(nx, ny);
            // 틱 피해 — 낮은 배율 다발
            if (Math.random() < 0.65) {
              e.takeDamage(Math.max(1, Math.round(cfg.dmg * 0.28)), new Phaser.Math.Vector2(vx, vy).normalize(), 60, cfg.crit);
            }
          }
        }
        this.spawnBurstAt(g.x, g.y, 2, cfg.hex);
      },
    });
    this.time.delayedCall(cfg.life, () => { if (g.active) g.destroy(); });
  }

  /* v3.0.11 — 스카이로드 전용 대형 토네이도 (폭풍 소용돌이/천공의 폭풍).
   *  회오리 스프라이트가 이동하며 주변 적을 강하게 빨아들이고 틱 피해.
   *  종료 시(또는 벽 도달 시) 소용돌이가 터지며 마무리. */
  fireCyclone(cfg: {
    x: number; y: number; angle: number; speed: number;
    dmg: number; crit: boolean; hex: number;
    pull: number; radius: number; life: number; scale: number;
  }) {
    const g = this.add.sprite(cfg.x, cfg.y, "fx_tornado", 0)
      .setDepth(14)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(cfg.hex)
      .setScale(cfg.scale)
      .setAlpha(0.95);
    g.play("fx-tornado");
    const vx = Math.cos(cfg.angle) * cfg.speed;
    const vy = Math.sin(cfg.angle) * cfg.speed;
    // 진행 축에 수직인 방향 — 소용돌이가 S자로 흔들리는 와인딩
    const px = -Math.sin(cfg.angle);
    const py = Math.cos(cfg.angle);
    const wb0 = this.physics.world.bounds;
    const hitOnce = new Set<Enemy | Boss>();
    let life = cfg.life;
    let t = 0;
    const tick = this.time.addEvent({
      delay: 100,
      repeat: Math.ceil(cfg.life / 100),
      callback: () => {
        life -= 100;
        t += 100;
        if (!g.active || life <= 0) {
          tick.remove();
          if (g.active) {
            // 소멸 연출 — 회오리가 터지며 마무리 타격
            this.spawnBurstAt(g.x, g.y, 14, cfg.hex);
            for (const e of this.getAllTargets()) {
              if (!e.active || hitOnce.has(e)) continue;
              const d = Phaser.Math.Distance.Between(g.x, g.y, e.x, e.y);
              if (d <= cfg.radius * 1.1) {
                hitOnce.add(e);
                const away = new Phaser.Math.Vector2(e.x - g.x, e.y - g.y).normalize();
                e.takeDamage(Math.max(1, Math.round(cfg.dmg * 0.9)), away, 340, cfg.crit);
              }
            }
            g.destroy();
          }
          return;
        }
        // 이동 + 사인 와인딩 (토네이도 특유의 꿈틀거림)
        const sway = Math.sin(t * 0.012) * 34;
        g.setPosition(
          Phaser.Math.Clamp(g.x + vx * 0.1 + px * sway * 0.1, 30, wb0.width - 30),
          Phaser.Math.Clamp(g.y + vy * 0.1 + py * sway * 0.1, 30, wb0.height - 30)
        );
        // 크기 맥동 — 숨쉬는 회오리
        g.setScale(cfg.scale * (0.94 + 0.1 * Math.sin(t * 0.02)));
        const wb = this.physics.world.bounds;
        for (const e of this.getAllTargets()) {
          if (!e.active) continue;
          const d = Phaser.Math.Distance.Between(g.x, g.y, e.x, e.y);
          if (d <= cfg.radius) {
            // 강한 끌어당김 — 회오리 안으로 빨려들어감
            const nx = Phaser.Math.Clamp(e.x + (g.x - e.x) * cfg.pull * 0.3, 40, wb.width - 40);
            const ny = Phaser.Math.Clamp(e.y + (g.y - e.y) * cfg.pull * 0.3, 40, wb.height - 40);
            (e as unknown as { body?: Phaser.Physics.Arcade.Body }).body?.reset?.(nx, ny);
            if (Math.random() < 0.7) {
              e.takeDamage(Math.max(1, Math.round(cfg.dmg * 0.3)), new Phaser.Math.Vector2(vx, vy).normalize(), 40, cfg.crit);
            }
          }
        }
        // 바람 파편 — 회오리 가장자리에서 흩날림
        if (Math.random() < 0.8) {
          const a = Math.random() * Math.PI * 2;
          this.spawnBurstAt(g.x + Math.cos(a) * cfg.radius * 0.5, g.y + Math.sin(a) * cfg.radius * 0.4, 1, cfg.hex);
        }
      },
    });
  }

  /** 아크메이지 아크 볼트 — 착탄 광역 폭발 투사체 (첫 명중 지점에서 폭발, 4차+ 2차 폭발) */
  fireExplodingBolt(cfg: {
    x: number; y: number; angle: number; speed: number;
    dmg: number; crit: boolean; pierce: number; hex: number;
    blastRadius: number; blastMul: number; secondary: boolean; scale: number;
  }) {
    this.firePlayerProj({
      x: cfg.x, y: cfg.y, angle: cfg.angle, speed: cfg.speed,
      pierce: cfg.pierce, dmg: cfg.dmg, crit: cfg.crit,
      tint: cfg.hex, knock: 260, scale: cfg.scale,
      anim: "fx-arcane", blend: "normal", rot: true, // v3.0.12 — 아크 볼트도 비행 방향 회전
    });
    // 마지막 발사 투사체에 폭발 플래그 부여 — tickPlayerProjs에서 첫 명중 시 처리
    const p = this.pProjPool[(this.pProjIdx + this.pProjPool.length - 1) % this.pProjPool.length];
    if (p?.active) {
      p.setData("explodeR", cfg.blastRadius);
      p.setData("explodeMul", cfg.blastMul);
      p.setData("explodeHex", cfg.hex);
      p.setData("explodeSecondary", cfg.secondary);
    }
  }

  /** 세이지 정화의 파동 — 확산 링 비주얼 */
  spawnPurifyRing(x: number, y: number, radius: number, hex: number) {
    const ring = this.add.image(x, y, "shock_ring")
      .setDepth(19)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(hex)
      .setScale(0.2)
      .setAlpha(0.85);
    this.tweens.add({
      targets: ring,
      scale: radius / 130,
      alpha: 0,
      duration: 420,
      ease: "Cubic.out",
      onComplete: () => ring.destroy(),
    });
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
      /* v3.0.16 (#4) — 잔상 스폰 (50ms 간격): 텍스처가 화살/볼트일 때만 (구슬은 원래 발광이라 생략) */
      const trailHex = p.getData("trail") as number;
      if (trailHex && p.texture.key !== "orb") {
        const acc = (p.getData("trailAcc") as number) + dt;
        if (acc >= 50) {
          this.spawnProjTrail(p, trailHex);
          p.setData("trailAcc", acc - 50);
        } else p.setData("trailAcc", acc);
      }
      const vel = p.body!.velocity;
      /* v3.0.3 — 유도 화살: 활성 적 중 가장 가까운 대상으로 진로 서서히 수정 */
      if (p.getData("homing") === true) {
        let tgt: Enemy | Boss | null = null;
        let bd = 420;
        for (const e of this.getAllTargets()) {
          if (!e.active) continue;
          const d = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y);
          if (d < bd) { bd = d; tgt = e; }
        }
        if (tgt) {
          const want = Math.atan2(tgt.y - p.y, tgt.x - p.x);
          const cur = Math.atan2(vel.y, vel.x);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const speed = Math.hypot(vel.x, vel.y);
          const na = cur + Phaser.Math.Clamp(diff, -0.12, 0.12);
          p.body!.velocity.set(Math.cos(na) * speed, Math.sin(na) * speed);
          vel.setTo(p.body!.velocity.x, p.body!.velocity.y);
          // v3.0.12 — 유도 중 스프라이트도 진행 방향 추적 (화살/볼트가 옆으로 날아 보이던 문제)
          if (p.getData("rot") === true) p.setRotation(na);
        }
      }
      const dir = new Phaser.Math.Vector2(vel.x, vel.y).normalize();
      for (const e of this.getAllTargets()) {
        let pierce = p.getData("pierce") as number;
        if (pierce <= 0) break;
        if (!e.active) continue;
        /* v3.0 (사용자 지시 #2) — 히트박스 확대: 투사체 크기 + 대상 몸통 반영
         *  (기존 평면 28px는 마법사 볼트가 코앞을 스쳐도 빗나가는 체감 유발) */
        const projR = 14 * (p.scaleX || 1);
        const bodyR = Math.max(
          ((e as unknown as { hitW?: number }).hitW ?? 24),
          ((e as unknown as { hitH?: number }).hitH ?? 24)
        ) * 0.5;
        const hitR = projR + bodyR + 8;
        if (Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) <= hitR) {
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
          /* v3.0.6 — 아크 볼트 착탄 폭발: 첫 명중 지점에서 광역 폭발 (4차+ 2차 폭발) */
          const exR = p.getData("explodeR") as number | undefined;
          if (exR) {
            const exHex = (p.getData("explodeHex") as number) ?? 0x8fa6ff;
            const blastDmg = Math.max(1, Math.round((p.getData("dmg") as number) * ((p.getData("explodeMul") as number) ?? 1)));
            this.spawnBurstAt(p.x, p.y, 16, exHex);
            const ringFx = this.add.image(p.x, p.y, "shock_ring").setDepth(19).setBlendMode(Phaser.BlendModes.ADD).setTint(exHex).setScale(0.25).setAlpha(0.9);
            this.tweens.add({ targets: ringFx, scale: exR / 110, alpha: 0, duration: 320, ease: "Cubic.out", onComplete: () => ringFx.destroy() });
            for (const e2 of this.getAllTargets()) {
              if (!e2.active) continue;
              const d2 = Phaser.Math.Distance.Between(p.x, p.y, e2.x, e2.y);
              if (d2 <= exR) {
                const away = new Phaser.Math.Vector2(e2.x - p.x, e2.y - p.y).normalize();
                e2.takeDamage(blastDmg, away, 240, p.getData("crit") as boolean);
              }
            }
            if (p.getData("explodeSecondary") === true) {
              const sx = p.x, sy = p.y;
              this.time.delayedCall(280, () => {
                this.spawnBurstAt(sx, sy, 12, exHex);
                for (const e3 of this.getAllTargets()) {
                  if (!e3.active) continue;
                  const d3 = Phaser.Math.Distance.Between(sx, sy, e3.x, e3.y);
                  if (d3 <= exR * 0.85) {
                    const away = new Phaser.Math.Vector2(e3.x - sx, e3.y - sy).normalize();
                    e3.takeDamage(Math.round(blastDmg * 0.7), away, 200, false);
                  }
                }
              });
            }
          }
          if (pierce <= 0) {
            p.disableBody(true, true);
            break;
          }
        }
      }
    }
  }

  /* ================= v3.0.3 — 몬스터 투사체 (고유 개성: 원거리 캐스터) ================= */

  /** 몬스터 투사체 발사 — 임프 화염구 / 강령술사 다크볼트 / 서리 날도요 얼음창 등 */
  fireEnemyProj(cfg: { x: number; y: number; angle: number; speed: number; dmg: number; anim: string; tint?: number; scale?: number }) {
    if (this.eProjPool.length === 0) {
      for (let i = 0; i < 16; i++) {
        const p = this.physics.add.sprite(0, 0, "orb");
        p.setBlendMode(Phaser.BlendModes.ADD).setDepth(12);
        p.setActive(false).setVisible(false);
        (p.body as Phaser.Physics.Arcade.Body).setCircle(6);
        this.eProjPool.push(p);
      }
    }
    const p = this.eProjPool[this.eProjIdx];
    this.eProjIdx = (this.eProjIdx + 1) % this.eProjPool.length;
    p.enableBody(true, cfg.x, cfg.y, true, true);
    this.physics.velocityFromRotation(cfg.angle, cfg.speed, p.body!.velocity);
    p.anims.stop();
    if (this.anims.exists(cfg.anim)) p.play(cfg.anim);
    else p.setTexture("orb");
    p.setTint(cfg.tint ?? 0xffffff).setScale(cfg.scale ?? 0.85).setAlpha(0.95);
    p.setBlendMode(Phaser.BlendModes.ADD);
    p.setData("dmg", cfg.dmg);
    p.setData("life", 2600);
  }

  /** 몬스터 투사체 진행 — 플레이어 원판 판정 */
  private tickEnemyProjs(dt: number) {
    if (!this.player || this.eProjPool.length === 0) return;
    for (const p of this.eProjPool) {
      if (!p.active) continue;
      const life = (p.getData("life") as number) - dt;
      if (life <= 0) {
        p.disableBody(true, true);
        continue;
      }
      p.setData("life", life);
      const d = Phaser.Math.Distance.Between(p.x, p.y, this.player.x, this.player.y);
      if (d <= 26 && this.player.state !== "dead") {
        const dir = new Phaser.Math.Vector2(p.body!.velocity.x, p.body!.velocity.y).normalize();
        this.player.takeDamage(p.getData("dmg") as number, dir, 0, DMG_PCT.mob); // v3.0.6 — 적 투사체 % 하한
        this.spawnBurstAt(p.x, p.y, 6, (p.getData("tint") as number) ?? 0xffffff);
        p.disableBody(true, true);
      }
    }
  }

  /* ================= v3.0.3 — 지면 장판 (독/화염/성역/시간왜곡) ================= */

  /** 범용 장판 생성 — owner=enemy(플레이어에 데미지) / player(적에 데미지+옵션 힐/감속) */
  spawnField(cfg: {
    x: number; y: number; radius: number; dur: number; dps: number;
    kind: "poison" | "fire" | "light" | "time";
    owner: "enemy" | "player";
    heal?: boolean; slow?: boolean; stun?: boolean;
    selfHealPerTick?: number;
  }) {
    const tint = cfg.kind === "poison" ? 0x7ade4a : cfg.kind === "fire" ? 0xff8a3a : cfg.kind === "light" ? 0xffe9a0 : 0xb0a0ff;
    const zone = this.add.circle(cfg.x, cfg.y, cfg.radius, tint, 0.22).setDepth(2).setStrokeStyle(2, tint, 0.55);
    this.tweens.add({ targets: zone, alpha: { from: 0.85, to: 0.5 }, duration: 900, yoyo: true, repeat: -1 });
    this.fields.push({
      zone, x: cfg.x, y: cfg.y, radius: cfg.radius,
      dur: cfg.dur, dps: cfg.dps, kind: cfg.kind, owner: cfg.owner,
      tickAcc: 0, heal: cfg.heal, slow: cfg.slow, stun: cfg.stun,
      selfHealPerTick: cfg.selfHealPerTick,
    });
  }

  private tickFields(dt: number) {
    if (this.fields.length === 0) return;
    for (let i = this.fields.length - 1; i >= 0; i--) {
      const f = this.fields[i];
      f.dur -= dt;
      f.tickAcc += dt;
      if (f.dur <= 0) {
        f.zone.destroy();
        this.fields.splice(i, 1);
        continue;
      }
      if (f.tickAcc < 500) continue; // 0.5초마다 판정
      f.tickAcc = 0;
      const dmgTick = Math.max(1, Math.round(f.dps * 0.5));
      if (f.owner === "enemy") {
        // 몬스터 장판 — 플레이어가 밟으면 피해 (+독이면 상태이상도)
        if (this.player && this.player.state !== "dead" &&
            Phaser.Math.Distance.Between(f.x, f.y, this.player.x, this.player.y) <= f.radius) {
          this.player.applyFieldDamage(dmgTick, f.kind === "poison" ? "poison" : "burn");
          if (f.kind === "poison") this.player.applyDot("poison", f.dps * 0.6, 2000);
        }
      } else {
        // 플레이어 장판 — 적 피해 (+감속/기절/힐 옵션)
        for (const e of this.getAllTargets()) {
          if (!e.active) continue;
          if (Phaser.Math.Distance.Between(f.x, f.y, e.x, e.y) > f.radius) continue;
          const away = new Phaser.Math.Vector2(e.x - f.x, e.y - f.y).normalize();
          e.takeDamage(dmgTick, away, 40, false);
          const now = this.time.now;
          if (f.slow) (e as Enemy).applySlow?.(0.45, 1200);
          if (f.stun) (e as Enemy).applyStun?.(600);
          void now;
        }
        if (f.heal && this.player && this.player.state !== "dead" &&
            Phaser.Math.Distance.Between(f.x, f.y, this.player.x, this.player.y) <= f.radius) {
          const healAmt = Math.max(2, Math.round(this.player.maxHp * 0.015));
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmt);
          this.spawnHealFx(this.player.x, this.player.y, 0xffe9a0);
          this.emitHud();
        }
        // v3.0.7 — 시간왜곡 자신 회복 (selfHealPerTick — 크로니컬 힐러 강화)
        if (f.selfHealPerTick && this.player && this.player.state !== "dead" &&
            Phaser.Math.Distance.Between(f.x, f.y, this.player.x, this.player.y) <= f.radius) {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + f.selfHealPerTick);
          this.spawnHealFx(this.player.x, this.player.y, 0xb0a0ff);
          this.emitHud();
        }
      }
    }
  }

  /** v3.0.7 — 세이지 정화의 파동: 반경 내 동접자(원격 아군)에게 치유 파동 연출.
   *  HP는 각 클라이언트 로컬 권한이라 연출(이펙트+텍스트)만 — 멀티 힐러 정체성 표현 */
  healRemotesPulse(x: number, y: number, radius: number, amount: number) {
    for (const r of this.remotes.values()) {
      if (!r.sp?.active) continue;
      if (Phaser.Math.Distance.Between(x, y, r.tx, r.ty) > radius) continue;
      this.spawnHealFx(r.tx, r.ty - 10, 0x7dffa8);
      this.spawnPickupText(r.tx, r.ty - 42, `+${amount} HP`, "#7dffa8");
    }
  }

  /* ================= v3.0.3 — 신규 스킬 이펙트 헬퍼 ================= */

  /** 힐 이펙트 — 상승하는 초록/빛 반짝임 */
  spawnHealFx(x: number, y: number, tint = 0x7dffa8) {
    this.burstEmitter.setParticleTint(tint);
    this.burstEmitter.explode(10, x, y - 10);
    const ring = this.add.image(x, y - 6, "shock_ring").setDepth(26).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.18).setAlpha(0.9);
    this.tweens.add({ targets: ring, scale: 0.9, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
  }

  /** 빛기둥 — 크루세이더 심판/낙뢰 공용 기둥 이펙트
   *  v3.3.0 (지시 #9) — 백색 코어 기둥 + 착지 플래시 추가 (더 웅장하게) */
  spawnPillar(x: number, y: number, tint = 0xffe9a0, height = 120) {
    const pillar = this.add.rectangle(x, y - height / 2 + 14, 22, height, tint, 0.75).setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
    const core = this.add.rectangle(x, y - height / 2 + 14, 8, height * 0.92, 0xffffff, 0.9).setDepth(26).setBlendMode(Phaser.BlendModes.ADD);
    const glow = this.add.image(x, y, "glow").setDepth(24).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(1.2).setAlpha(0.8);
    const flash = this.add.image(x, y, "glow").setDepth(24).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffffff).setScale(0.9).setAlpha(0.95);
    this.tweens.add({ targets: pillar, alpha: 0, scaleY: 0.2, duration: 320, ease: "Quad.in", onComplete: () => pillar.destroy() });
    this.tweens.add({ targets: core, alpha: 0, scaleY: 0.12, duration: 260, ease: "Quad.in", onComplete: () => core.destroy() });
    this.tweens.add({ targets: glow, alpha: 0, scale: 0.4, duration: 380, onComplete: () => glow.destroy() });
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.7, duration: 180, onComplete: () => flash.destroy() });
    this.spawnBurstAt(x, y, 14, tint);
  }

  /** 그림자 칼날 오비트 시작 — 나이트블레이드/섀도우로드 3차기 */
  startOrbitBlades(dmgMul: number, tint: number, durMs = 6000) {
    if (this.orbitBlades) {
      for (const im of this.orbitBlades.imgs) im.destroy();
    }
    const imgs: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 3; i++) {
      const im = this.add.image(0, 0, "slash0").setDepth(14).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.55).setRotation(i * ((Math.PI * 2) / 3));
      imgs.push(im);
    }
    this.orbitBlades = { imgs, angle: 0, until: this.time.now + durMs, dmgMul, tint, hitCd: new Map() };
  }

  private tickOrbitBlades(dt: number) {
    const ob = this.orbitBlades;
    if (!ob || !this.player) return;
    if (this.time.now >= ob.until || this.player.state === "dead") {
      for (const im of ob.imgs) im.destroy();
      this.orbitBlades = null;
      return;
    }
    ob.angle += dt * 0.0055; // 초당 ~315°
    const r = 78;
    for (let i = 0; i < ob.imgs.length; i++) {
      const a = ob.angle + (i * Math.PI * 2) / ob.imgs.length;
      ob.imgs[i].setPosition(this.player.x + Math.cos(a) * r, this.player.y - 8 + Math.sin(a) * r * 0.72);
      ob.imgs[i].setRotation(a + Math.PI / 2);
    }
    // 판정 — 개체별 380ms 재히트 쿨
    for (const e of this.getAllTargets()) {
      if (!e.active) continue;
      const last = ob.hitCd.get(e) ?? 0;
      if (this.time.now - last < 380) continue;
      for (const im of ob.imgs) {
        if (Phaser.Math.Distance.Between(im.x, im.y, e.x, e.y) <= 34) {
          ob.hitCd.set(e, this.time.now);
          const away = new Phaser.Math.Vector2(e.x - this.player.x, e.y - this.player.y).normalize();
          e.takeDamage(Math.round(this.player.atkTotal * ob.dmgMul), away, 140, false);
          break;
        }
      }
    }
  }

  /** 그림자 분신 자폭 — 섀도우로드 4차기 (플레이어 위치에서 대상에게 돌진 후 폭발) */
  fireShadowClone(target: Enemy | Boss, tint: number, dmgMul: number) {
    if (!this.player) return;
    const sx = this.player.x;
    const sy = this.player.y;
    const clone = this.add.image(sx, sy, "hero_idle0").setDepth(14).setTint(tint).setAlpha(0.85);
    this.tweens.add({
      targets: clone,
      x: target.x, y: target.y,
      duration: 240, ease: "Cubic.in",
      onComplete: () => {
        this.spawnBurstAt(target.x, target.y, 18, tint);
        const away = new Phaser.Math.Vector2(1, 0);
        target.takeDamage(Math.round(this.player!.atkTotal * dmgMul), away, 240, false);
        clone.destroy();
      },
    });
  }

  /* ================= v3.0.3 — 무기 스프라이트 (활/지팡이/단검 손에 들기) =================
   *  사용자 지시 #6 — "궁수가 왜 활을 안씀? 마법사가 왜 지팡이를 안씀? 도적이 왜 단검을 안씀?":
   *  계열별 무기를 항상 손에 든 채로 렌더링. 바라보는 방향에 따라 앞/뒤 레이어가 바뀐다. */
  private syncWeaponSprite() {
    if (!this.player) return;
    const fam = familyOf(this.player.cls);
    const want = fam === "ranger" ? "x3_bow" : fam === "mage" ? "x3_staff" : fam === "thief" ? "x3_dagger" : null;
    if (!want) {
      if (this.weaponImg) { this.weaponImg.setVisible(false); }
      return;
    }
    if (this.weaponKey !== want) {
      if (!this.weaponImg) {
        this.weaponImg = this.add.image(0, 0, want).setDepth(11);
      } else {
        this.weaponImg.setTexture(want);
      }
      this.weaponKey = want;
    }
    const w = this.weaponImg!;
    w.setVisible(true);
    const p = this.player;
    const f = p.facing;
    const aimingUp = Math.abs(f.x) < Math.abs(f.y) && f.y < 0;
    const aimingDown = Math.abs(f.x) < Math.abs(f.y) && f.y > 0;
    if (want === "x3_bow") {
      // 활 — 조준 방향을 향함. v3.0.4 — 활 텍스처(현 왼쪽·활몸 오른쪽 → 오른쪽 발사)는
      // 조준각 그대로 회전. 기존 +90° 오프셋이 활을 수직으로 세워 “이상하다”는 지시 #1 원인.
      const ang = Math.atan2(f.y, f.x);
      w.setRotation(ang);
      w.setPosition(p.x + f.x * 14, p.y - 8 + f.y * 10);
      w.setScale(0.62);
    } else if (want === "x3_staff") {
      // 지팡이 — 어깨 옆에 세워 들기 (위를 보면 뒤로 기울임)
      w.setRotation(aimingUp ? -0.35 : aimingDown ? 0.15 : 0.1);
      w.setPosition(p.x + (p.flipX ? -13 : 13), p.y - 10);
      w.setScale(0.58);
    } else {
      // 단검 — 허리 옆 (역습 시 그림자연타 스윕과 함께)
      w.setRotation(p.flipX ? 2.4 : 0.7);
      w.setPosition(p.x + (p.flipX ? -11 : 11), p.y - 2);
      w.setScale(0.9);
    }
    // 측면 반대 방향을 볼 때 몸 뒤로 (원근감)
    w.setDepth(f.x < 0 && Math.abs(f.x) >= Math.abs(f.y) ? 9 : 11);
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
      ? {
          active: true,
          label: best.label,
          kind: best.kind === "shop" ? "shop" : best.kind === "job" ? "job" : "talk",
          x: best.x,
          y: best.y,
        }
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
  /** E키/모바일 버튼 — 가까운 NPC 대화 시작, 전직 상담, 건물 출입, 실내 상호작용, 상점 열기 */
  tryInteract() {
    if (this.dialoguing || this.sleeping || !this.player || this.player.state === "dead") return;
    const it = this.nearInteract;
    if (!it) return;
    if (it.kind === "shop") {
      // v2.3 (지시 #4) — 반복 의뢰 수주 가능하면 상점 대신 수주 대사부터
      if (this.repeatUnlockable()) {
        this.showDialogue("merchantRepeat", "merchant");
      } else {
        EventBus.emit("ui:panel", { panel: "shop" });
      }
    } else if (it.kind === "job") {
      // 전직 교관 — 상담 대사 후 전직 패널 자동 오픈 (v1.9)
      this.showDialogue("jobMaster", "jobmaster");
    } else if (it.kind === "gm") {
      /* v3.0.3 — GM NPC: 전직 상담 없이 즉시 GM 패널 오픈 */
      EventBus.emit("ui:panel", { panel: "gm" });
    } else if (it.kind === "inn") {
      this.enterInterior("interior_inn");
    } else if (it.kind === "house") {
      this.enterInterior("interior_home");
    } else if (it.kind === "innkeeper") {
      // 여관주인 대사 → 대사 종료 후 취침 연출로 이어짐 (resumeFromDialogue 훅)
      this.sleepPending = true;
      this.showDialogue("innkeeper", "innkeeper");
    } else if (it.kind === "bed") {
      this.trySleep();
    } else if (it.kind === "exit") {
      this.leaveInterior();
    } else if (it.kind === "talk" && it.dlg) {
      this.showDialogue(it.dlg, it.npcId ?? null);
    }
  }

  /* ================= 실내(여관/내 집) + 취침 연출 (v2.2 — 사용자 지시) ================= */

  /** 건물 E — 실내 맵으로 이동 (세이브 스테이지는 유지) */
  private enterInterior(key: "interior_inn" | "interior_home") {
    if (this.restCd > 0 || this.transitioning) return;
    this.restCd = 1500;
    /* v2.9 — 어느 마을(챕터 마을 포함)에서 들어왔는지 기억 → 퇴장 시 그 마을로 복귀 */
    this.interiorFrom = this.stageDef.isVillage ? this.stageDef.key : "village";
    audio.sfx.portal();
    this.player.state = "idle";
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(420, 0, 0, 0);
    this.time.delayedCall(460, () => {
      /* v3.3.0 (#흑화) — 실내 전환도 transitioning 게이트 통일: gotoStage와 이중 restart 경합 차단 */
      if (this.transitioning) return;
      this.transitioning = true;
      // 실내는 세이브에 기록하지 않음(종료 시 들어온 마을로 복귀)
      const carry = this.buildSave(this.interiorFrom);
      this.scene.restart({ stage: key, save: carry });
    });
  }

  /** 실내 출구 문 E — 밖(건물 앞)으로 복귀 */
  private leaveInterior() {
    if (this.restCd > 0 || this.sleeping || this.transitioning) return;
    this.restCd = 1500;
    audio.sfx.portal();
    this.player.state = "idle";
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(380, 0, 0, 0);
    this.time.delayedCall(420, () => {
      /* v3.3.0 (#흑화) — 전환 게이트 통일 */
      if (this.transitioning) return;
      this.transitioning = true;
      /* v2.9 — 들어온 마을(챕터 마을 포함)로 복귀 */
      const vk = STAGES[this.interiorFrom] ? this.interiorFrom : "village";
      const carry = this.buildSave(vk);
      writeSave(carry);
      const def = STAGES[vk];
      const cx = def.width / 2;
      const cy = def.height / 2;
      const entry = this.stageDef.key === "interior_inn"
        ? { x: cx - 400, y: cy - 60 } // 여관 문 앞
        : { x: cx - 190, y: cy + 330 }; // 내 집 문 앞
      this.scene.restart({ stage: vk, save: carry, entry });
    });
  }

  /** 취침 — 여관(20G)/내 집(무료): 암막 + Zzz 연출 → 풀회복 + 버프 + 저장 */
  private trySleep() {
    if (this.sleeping || this.restCd > 0) return;
    const paid = this.stageDef.key === "interior_inn";
    if (paid && this.player.gold < 20) {
      this.showDialogue("innkeeperNoMoney", "innkeeper");
      return;
    }
    if (paid) this.player.gold -= 20;
    this.sleeping = true;
    this.player.state = "idle";
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.emitHud();
    this.time.delayedCall(700, () => {
      const vw = this.scale.width;
      const vh = this.scale.height;
      // 암막 + Zzz 연출
      const veil = this.add.rectangle(0, 0, vw, vh, 0x000000, 1).setOrigin(0).setScrollFactor(0).setDepth(300).setAlpha(0);
      this.tweens.add({ targets: veil, alpha: 1, duration: 380 });
      const zzz = this.add
        .text(vw / 2, vh / 2 - 24, "Zzz…", {
          fontFamily: "sans-serif", fontSize: "44px", color: "#ffe9b0", fontStyle: "bold",
          stroke: "#000000", strokeThickness: 6,
        })
        .setOrigin(0.5).setScrollFactor(0).setDepth(301).setAlpha(0);
      this.tweens.add({ targets: zzz, alpha: 1, y: "-=14", duration: 950, yoyo: true, repeat: 1, ease: "Sine.inOut" });
      const sub = this.add
        .text(vw / 2, vh / 2 + 40, paid ? "20G를 내고 푹 잤다…" : "내 침대에서 푹 잤다…", {
          fontFamily: "sans-serif", fontSize: "14px", color: "#ffffffcc", fontStyle: "bold",
        })
        .setOrigin(0.5).setScrollFactor(0).setDepth(301).setAlpha(0);
      this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 300 });
      this.time.delayedCall(2600, () => {
        veil.destroy();
        zzz.destroy();
        sub.destroy();
        this.player.healFull();
        // 숙면 보상 — 공격력·방어력 버프 (인벤토리 지급 후 즉시 사용)
        this.player.addBuffItem("buff_atk");
        this.player.useBuffItem("buff_atk");
        this.player.addBuffItem("buff_def");
        this.player.useBuffItem("buff_def");
        this.save();
        this.restCd = 1500;
        this.sleeping = false;
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.showBanner("푹 잤다! HP/MP 완전 회복 + 공격력·방어력 버프 (60초)");
        this.spawnBurstAt(this.player.x, this.player.y, 12, 0xffe9b0);
        this.emitHud();
        this.emitRpgState();
        if (paid) this.time.delayedCall(600, () => this.showDialogue("innkeeperSlept", "innkeeper"));
      });
    });
  }

  /** 실내 맵 — v2.3 정사각 방 개편 (지시 #6: 여관/집은 굳이 크게 만들 필요 없다)
   *  832×832 정사각 한 방 + 실내 전용 확대 줌 → 아늑한 방 느낌.
   *  나무 바닥 + 상단/좌우 벽 + 원형 러그 + 침대/모닥불/촛불 + 여관주인(여관) + 출구 문 */
  private buildInterior(stageKey: StageKey) {
    const W = this.stageW;
    const H = this.stageH;
    const isInn = stageKey === "interior_inn";
    this.cameras.main.setBackgroundColor("#150e08");

    // 상단 벽 + 나무판 바닥
    this.add.rectangle(0, 0, W, 104, 0x34220f).setOrigin(0).setDepth(0);
    this.add.rectangle(0, 96, W, 8, 0x1c1108).setOrigin(0).setDepth(1);
    this.add.tileSprite(0, 104, W, H - 104, "tile_path").setOrigin(0).setDepth(0).setAlpha(0.96);
    // 좌우 벽 — 정사각 방 테두리 (원목 패널 + 어두운 베이스보드 라인)
    this.add.rectangle(0, 104, 22, H - 104, 0x2c1c0c).setOrigin(0).setDepth(2);
    this.add.rectangle(22, 104, 5, H - 104, 0x1c1108).setOrigin(0).setDepth(2);
    this.add.rectangle(W - 22, 104, 22, H - 104, 0x2c1c0c).setOrigin(0).setDepth(2);
    this.add.rectangle(W - 27, 104, 5, H - 104, 0x1c1108).setOrigin(0).setDepth(2);
    // 원형 러그 — 방 중앙
    this.add.ellipse(W / 2, H / 2 + 30, 300, 210, isInn ? 0x7a3030 : 0x2f5a7a, 0.55).setDepth(0);

    // 충돌 (보이지 않는 벽) — 상단 벽 + 좌우 벽
    const wall = this.add.rectangle(W / 2, 92, W, 28, 0x000000, 0);
    this.solidGroup.add(wall);
    const wallL = this.add.rectangle(11, (104 + H) / 2, 26, H - 104, 0x000000, 0);
    this.solidGroup.add(wallL);
    const wallR = this.add.rectangle(W - 11, (104 + H) / 2, 26, H - 104, 0x000000, 0);
    this.solidGroup.add(wallR);

    // 벽 촛불 — 상단 2개 + 측벽 2개, 은은한 조명
    for (const cx of [W * 0.26, W * 0.74]) {
      this.add.image(cx, 78, "cv_candle").setDepth(2).setScale(1.15);
      const g = this.add.image(cx, 92, "glow").setDepth(1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc878).setScale(1.6).setAlpha(0.16);
      this.tweens.add({ targets: g, alpha: 0.3, scale: 1.9, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    }
    for (const cy of [H * 0.4, H * 0.66]) {
      this.add.image(40, cy, "cv_candle").setDepth(3).setScale(0.9);
      this.add.image(W - 40, cy, "cv_candle").setDepth(3).setScale(0.9);
      const gl = this.add.image(40, cy + 10, "glow").setDepth(2).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc878).setScale(1.1).setAlpha(0.13);
      const gr = this.add.image(W - 40, cy + 10, "glow").setDepth(2).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc878).setScale(1.1).setAlpha(0.13);
      this.tweens.add({ targets: gl, alpha: 0.24, duration: 820, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.tweens.add({ targets: gr, alpha: 0.24, duration: 940, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    }

    // 침대 (그래픽 조합) — 프레임/매트리스/베개/이불 (좌측 상단)
    const bx = 52;
    const by = 150;
    this.add.rectangle(bx, by, 68, 100, 0x5a3a1e).setOrigin(0).setDepth(2);
    this.add.rectangle(bx + 6, by + 6, 56, 88, 0xe8dcc4).setOrigin(0).setDepth(3);
    this.add.rectangle(bx + 6, by + 6, 56, 24, 0xf7f2e2).setOrigin(0).setDepth(4);
    this.add.rectangle(bx + 6, by + 42, 56, 52, isInn ? 0x3f6f8f : 0x7a4f8f).setOrigin(0).setDepth(4);
    const bedBody = this.add.rectangle(bx + 34, by + 50, 68, 96, 0x000000, 0);
    this.solidGroup.add(bedBody);

    if (isInn) {
      // 모닥불 — 여관 감성 (4프레임 애니메이션, 우측 상단)
      const fire = this.add.sprite(W - 100, 160, "sv_campfire", 0).setDepth(3);
      if (this.anims.exists("sv-campfire")) fire.play("sv-campfire");
      const fg = this.add.image(W - 100, 160, "glow").setDepth(2).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff9a40).setScale(1.8).setAlpha(0.2);
      this.tweens.add({ targets: fg, alpha: 0.34, scale: 2.1, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      // 카운터 + 여관주인 로안 (상단 중앙)
      this.add.rectangle(W / 2 - 75, 148, 150, 18, 0x6b4423).setOrigin(0).setDepth(3);
      this.add.rectangle(W / 2 - 75, 130, 150, 10, 0x8a5a2e).setOrigin(0).setDepth(3);
      const keeper = this.add.image(W / 2, 116, "npc_villager1").setDepth(4);
      this.add
        .text(keeper.x, keeper.y - 34, "로안", {
          fontFamily: "sans-serif", fontSize: "11px", color: "#ffe9b0",
          stroke: "#0a2030", strokeThickness: 4, fontStyle: "bold",
        })
        .setOrigin(0.5).setDepth(60);
      this.interactables.push({ x: keeper.x, y: keeper.y + 26, kind: "innkeeper", npcId: "innkeeper", label: "로안 — 잠자기 (20G)" });
    } else {
      // 내 집 — 화분/선반 느낌의 소품 (우측 상단)
      this.add.image(W - 84, 150, "fm_shrub1").setDepth(3).setScale(1.2);
      this.add.rectangle(W * 0.3, 142, 110, 14, 0x6b4423).setOrigin(0).setDepth(3);
    }

    // 침대 상호작용
    this.interactables.push({
      x: bx + 34, y: by + 118,
      kind: "bed",
      label: isInn ? "침대 — 쉬기 (20G)" : "침대 — 쉬기",
    });

    // 출구 문 (하단 중앙)
    this.add.image(W / 2, H - 34, "sv_door").setDepth(3);
    this.interactables.push({ x: W / 2, y: H - 44, kind: "exit", label: "밖으로 나가기" });
  }

  /* ================= 전직 스토리 (v2.0 — 지시 #13) ================= */

  /** 현재 진행 가능한 전직 스토리 정의 (v3.1.0 — fam 우선: 미전직 시련도 지원) */
  jobStoryDef(): JobStoryDef | null {
    const fam = this.jobStory?.fam ?? familyOf(this.player?.cls ?? "");
    if (!fam) return null;
    return JOBSTORY[fam][this.jobStory?.tier ?? 1] ?? null;
  }

  /**
   * v3.1.0 (#전직스토리선행) — 전직 스토리(시련) 시작. 유저 지시:
   *  "전직은 전직 스토리(n차마다 다른 스토리·컷신)를 완료한 후에 실행한다."
   *  · 미전직: 전직관에서 계열 선택 시 tier-1 시련 시작 → 완료 시 전직 적용
   *  · 1차/2차: 다음 차수(tier+1) 시련 시작 → 완료 시 다음 전직 잠금 해제
   */
  private startJobStory(fam: FamilyKey, tier: 1 | 2 | 3): boolean {
    if (!this.player || this.jobStory) return false;
    if (this.jobStoryDone.includes(tier)) return false;
    // 이전 티어 시련을 먼저 완료해야 다음 티어 진행 (연쇄 게이팅 유지)
    if (tier >= 2 && !this.jobStoryDone.includes((tier - 1) as 1 | 2)) return false;
    this.jobStory = { tier, step: 0, hunt: 0, fam };
    const story = JOBSTORY[fam][tier];
    this.showDialogue(story.startDialogue);
    this.showBanner(`전직 시련 시작 — ${story.title} (완료 후 전직!)`);
    audio.sfx.questDone();
    this.save();
    this.emitQuest();
    this.emitRpgState();
    return true;
  }

  /** 전직관 카이엔 대화 후 — 미진행 다음 차수 시련 자동 시작 (v3.1.0 재정의) */
  private maybeStartJobStory() {
    if (!this.player) return;
    const fam = familyOf(this.player.cls ?? "");
    if (!fam) return;
    const len = chainOf(this.player.cls).length; // 1=1차, 2=2차, 3=3차
    if (len < 1 || len >= 3) return;
    this.startJobStory(fam, (len + 1) as 2 | 3);
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
      const finTier = this.jobStory.tier;
      this.jobStoryDone.push(finTier);
      this.jobStory = null;
      this.showDialogue(story.doneDialogue);
      /* v3.1.0 (#전직스토리선행) — 시련 완료 후 전직 적용 (유저 지시 핵심):
       *  미전직이 tier-1 시련을 끝냈으면 여기서 비로소 1차 전직이 이루어진다. */
      if (finTier === 1 && !this.player.cls && this.pendingJobClass) {
        const def = classDef(this.pendingJobClass);
        this.pendingJobClass = null;
        if (def && this.player.applyClass(def.key)) {
          audio.sfx.levelup();
          this.spawnLevelUpFx(this.player.x, this.player.y);
          const jhex = def.hex;
          this.spawnPillar(this.player.x, this.player.y, jhex, 200);
          this.spawnBurstAt(this.player.x, this.player.y, 34, jhex);
          this.cameras.main.flash(180, (jhex >> 16) & 0xff, (jhex >> 8) & 0xff, jhex & 0xff);
          this.cameras.main.shake(200, 0.008);
          this.spawnPickupText(this.player.x, this.player.y - 56, `${def.name} 각성! 스킬 강화`, `#${jhex.toString(16).padStart(6, "0")}`);
          EventBus.emit("banner:show", { text: `전직 완료! ${def.name} — ${def.title}` });
          this.refreshPlayerTag();
          net.netAnnounceJob(def.key);
          this.time.delayedCall(1400, () => this.showBanner("카이엔과 대화하면 2차 전직 시련이 이어집니다"));
        }
      } else if (finTier === 2) {
        this.showBanner(`전직 시련 완료! AP +${story.reward.ap} — 2차 전직이 해금되었다`);
      } else if (finTier === 3) {
        this.showBanner(`전직 시련 완료! AP +${story.reward.ap} — 최종 승격이 해금되었다`);
      }
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
    /* v3.0.22 (#46) — 시험 상대 생존 여부는 전용 참조로 판정 (정예 몬스터와 충돌 제거) */
    if (this.jobTrialEnemy && this.jobTrialEnemy.alive) {
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
    e.dmgPct = DMG_PCT.elite; // v3.0.6 — 시험 상대 % 피해 상향
    this.eliteEnemy = e;
    this.jobTrialEnemy = e; // v3.0.22 (#46) — 전용 참조 (처치 판정/재소환 방지)
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
   *  0) 이동 학습 — 이그니의 안내로 실제로 걸어보기
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
    // 이그니 가이드가 플레이어를 따라다님
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
        this.showBanner("룬 정령 이그니: 마을 우물로 와! 네 이름을 정해 주고 싶어!");
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
    // 플레이어 이름표 (머리 위) — v2.4: 이어하기 경로와 공용 생성기 사용
    this.ensurePlayerTag();
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
    // 이름 리액션 → 마을 오프닝(본게임 세계관) 순차 재생 (v2.3 — 기록 후 재생 방지)
    this.queuedDialogue = "villageIntro";
    this.markSeen("villageIntro");
    this.showDialogue("introNamed");
    this.emitQuest();
  }

  /** 수확(collect) 퀘스트용 파편 스폰 — 맵 우측 원영역 무작위 */
  private spawnFragmentForQuest() {
    /* v3.0 (#7) — 개방 셀 안, 플레이어와 충분히 먼 지점에 파편 배치 */
    const p = this.openPointAny({ minDist: Math.max(420, this.stageW * 0.28) });
    this.spawnFragment(p.x, p.y);
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

  /**
   * v3.0.5 — 스타포스 오라 (성급 티어별 강화 효과 가시화)
   *  ★4~7  흰빛(따뜻한 백금) 글로우
   *  ★8~11 청록 글로우 + 주변 스파클 입자 (update 루프)
   *  ★12~14 보라 글로우 + 촘촘한 스파클
   *  ★15   금색 글로우 + 궤도성 2기 + 최밀 스파클
   * 티어 변경 시 오라 재생성. ★4 미만은 소멸.
   */
  private syncUpgradeGlow() {
    const up = this.player?.upgrades.weapon ?? 0;
    const tier = starTier(up);
    // 궤도성은 항상 재평가 (★15 미만이면 제거)
    if (up < 15 && this.sfOrbits.length) {
      for (const o of this.sfOrbits) o.destroy();
      this.sfOrbits = [];
    }
    if ((up < 4 || tier !== this.glowTier) && this.upgradeGlow) {
      this.upgradeGlow.destroy();
      this.upgradeGlow = null;
    }
    if (up >= 4 && this.player && !this.upgradeGlow) {
      const raw = STAR_TIER_COLORS[tier];
      const col = tier === 0 ? 0xffe9c9 : raw;
      this.upgradeGlow = this.add
        .image(this.player.x, this.player.y - 10, "glow")
        .setDepth(9)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(col)
        .setScale(1.3 + tier * 0.14)
        .setAlpha(0.28 + tier * 0.05);
      this.tweens.add({
        targets: this.upgradeGlow,
        alpha: 0.46 + tier * 0.05,
        scale: 1.5 + tier * 0.16,
        duration: 700 - tier * 60,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
      this.glowTier = tier;
    }
    // ★15 — 궤도성 2기 (impact_star, ADD 블렌드 금색)
    if (up >= 15 && this.player && this.sfOrbits.length === 0) {
      for (let i = 0; i < 2; i++) {
        const o = this.add
          .image(this.player.x, this.player.y - 12, "impact_star")
          .setDepth(12)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xffd76a)
          .setScale(0.42);
        this.sfOrbits.push(o);
      }
      this.sfOrbitAng = 0;
    }
  }

  /**
   * v3.0.5 — 스타포스 강화 결과 연출
   *  성공: 티어색 스타 버스트 + 확장 링 + 중앙 스타 팝
   *  실패: 잿빛 연기 퍼프 (착실히 실패감)
   */
  spawnStarForceBurst(x: number, y: number, up: number, ok: boolean) {
    if (ok) {
      const raw = STAR_TIER_COLORS[starTier(up)];
      const col = raw === 0xffffff ? 0xfff3c4 : raw;
      this.spawnBurstAt(x, y - 14, 18, col);
      const ring = this.add
        .image(x, y - 10, "shock_ring")
        .setDepth(27)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(col)
        .setScale(0.15);
      this.tweens.add({ targets: ring, scale: 0.95, alpha: 0, duration: 430, onComplete: () => ring.destroy() });
      const star = this.add
        .image(x, y - 40, "impact_star")
        .setDepth(30)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(col)
        .setScale(0.4);
      this.tweens.add({
        targets: star,
        scale: 1.15,
        alpha: 0,
        duration: 470,
        ease: "Cubic.out",
        onComplete: () => star.destroy(),
      });
    } else {
      this.spawnBurstAt(x, y - 10, 8, 0x8a8f99);
      const puff = this.add
        .image(x, y - 24, "glow")
        .setDepth(27)
        .setTint(0x555a66)
        .setScale(0.4)
        .setAlpha(0.7);
      this.tweens.add({ targets: puff, scale: 1.05, alpha: 0, duration: 500, onComplete: () => puff.destroy() });
    }
  }

  /** v3.0.5 — ★5/10/15 마일스톤 돌파 대형 연출 (3중 링 + 카메라 플래시/쉐이크 + 배너) */
  spawnStarForceBreakthrough(x: number, y: number, slot: "weapon" | "armor", next: number) {
    const col = STAR_TIER_COLORS[starTier(next)];
    this.spawnBurstAt(x, y - 14, 40, col);
    for (let i = 0; i < 3; i++) {
      const ring = this.add
        .image(x, y - 12, "shock_ring")
        .setDepth(28)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(col)
        .setScale(0.2);
      this.tweens.add({
        targets: ring,
        scale: 1.5 + i * 0.45,
        alpha: 0,
        delay: i * 130,
        duration: 650,
        onComplete: () => ring.destroy(),
      });
    }
    this.cameras.main.flash(240, (col >> 16) & 0xff, (col >> 8) & 0xff, col & 0xff);
    this.cameras.main.shake(260, 0.006);
    EventBus.emit("banner:show", { text: `${slot === "weapon" ? "무기" : "방어구"} ★${next} 돌파!` });
  }

  /* ================= 가독성 (F2) ================= */

  private questTargetPos(): Phaser.Math.Vector2 | null {
    const q = this.currentQuest();
    if (!q) {
      /* v2.7 — 체인 완료 시 화살표가 사라져 포탈 개방을 못 알아봄 (체감 "안열림") → 개방된 포탈을 가리킨다 */
      return this.portalActive && this.portal?.active ? new Phaser.Math.Vector2(this.portal.x, this.portal.y) : null;
    }
    /* v3.0.22 (#47) — 추적 퀘스트가 다른 구역이면 경유 포탈을 가리킨다 (방향 어시스턴트 + 미니맵 금색 점) */
    const travel = this.autoTravelPortal();
    if (travel) return new Phaser.Math.Vector2(travel.x, travel.y);
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

  /** v3.0.25 (#화살표 가독성) — 어시스트 화살표 라벨: 이동 대상 구역명 / 퀘스트 목표명 */
  private questTargetLabel(): string {
    const travel = this.autoTravelPortal();
    if (travel) {
      const t = this.trackedStage ? STAGES[this.trackedStage as StageKey] : null;
      return t ? `▶ ${t.name}` : "▶ 목표 구역";
    }
    const q = this.currentQuest();
    if (!q) return this.portalActive ? "▶ 차원문" : "";
    if (q.type === "hunt") return q.targetLabel ? `▶ ${q.targetLabel}` : "";
    if (q.type === "boss") return "▶ 보스";
    if (q.type === "reach") return "▶ 동쪽 차원문"; /* v3.0.26 (#75) — 목적지 방향 명시 */
    if (q.type === "collect") return "▶ 결정";
    return "";
  }

  private updateEdgeArrow() {
    const target = this.questTargetPos();
    if (!target) {
      if (this.edgeArrow) {
        this.edgeArrow.destroy();
        this.edgeArrow = null;
      }
      if (this.edgeLabel) {
        this.edgeLabel.destroy();
        this.edgeLabel = null;
      }
      if (this.questMark) {
        this.questMark.destroy();
        this.questMark = null;
      }
      return;
    }

    // 목표물 바로 위 퀘스트 마커(?) — 외부 에셋(Zelda-like CC0 말풍선)
    // v3.0.25 — 16px 텍스처 → 스케일 2.1 (기존 1.3은 너무 작음)
    if (!this.questMark) {
      this.questMark = this.add.image(target.x, target.y - 34, "quest_mark").setDepth(22).setScale(2.1);
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
      /* v3.0.25 (#화살표 가독성) — 16px 텍스처 → 스케일 2.7 + 맥동 강화 + 목표명 라벨
       *  (기존 1.0 스케일 16px는 어시스트 화살표 역할을 못함 — #2 요청) */
      if (!this.edgeArrow)
        this.edgeArrow = this.add
          .image(0, 0, "edge_arrow")
          .setDepth(50)
          .setScrollFactor(0)
          .setTint(0xffd76a)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setScale(2.7);
      if (!this.edgeLabel)
        this.edgeLabel = this.add
          .text(0, 0, "", {
            fontFamily: "sans-serif",
            fontSize: "13px",
            fontStyle: "900",
            color: "#ffe9a8",
            stroke: "#3a2400",
            strokeThickness: 4,
          })
          .setDepth(50)
          .setScrollFactor(0)
          .setOrigin(0.5, 0);
      const cx = this.cameras.main.width / 2;
      const cy = this.cameras.main.height / 2;
      const angle = Phaser.Math.Angle.Between(cx, cy, target.x - view.x, target.y - view.y);
      // 화면 중심에서 끝까지 레이캐스트하여 클램프 (큰 화살표 여유 64px)
      const halfW = this.cameras.main.width / 2 - 64;
      const halfH = this.cameras.main.height / 2 - 64;
      const t = Math.min(
        Math.abs(halfW / Math.cos(angle)) || Infinity,
        Math.abs(halfH / Math.sin(angle)) || Infinity
      );
      this.edgeArrow.setPosition(cx + Math.cos(angle) * t, cy + Math.sin(angle) * t);
      this.edgeArrow.setRotation(angle);
      this.edgeArrow.setScale(2.7 + Math.sin(this.time.now / 140) * 0.3);
      this.edgeArrow.setAlpha(0.72 + Math.sin(this.time.now / 140) * 0.28);
      const label = this.questTargetLabel();
      this.edgeLabel.setText(label);
      this.edgeLabel.setVisible(label.length > 0);
      // 라벨은 화살표 안쪽에 붙이되 화면 밖으로 못 나가게 클램프
      const lx = Phaser.Math.Clamp(cx + Math.cos(angle) * Math.max(0, t - 84), 70, this.cameras.main.width - 70);
      const ly = Phaser.Math.Clamp(cy + Math.sin(angle) * Math.max(0, t - 24) + 12, 20, this.cameras.main.height - 34);
      this.edgeLabel.setPosition(lx, ly);
    } else if (this.edgeArrow || this.edgeLabel) {
      this.edgeArrow?.destroy();
      this.edgeArrow = null;
      this.edgeLabel?.destroy();
      this.edgeLabel = null;
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
    /* v3.0.15 (#3) — 반복의뢰 수주 판정용 savedQuestIdx 즉시 갱신 (stale 판정 제거:
     *  기존엔 씬 재입장 전까지 옛 인덱스를 보고 수주 조건을 false로 판정했다) */
    this.savedQuestIdx[this.stageDef.key] = this.questIdx;
    // 퀘스트 보상 — 골드 + 경험치 (2D MMORPG 기본 요소)
    if (done?.reward) {
      this.player.addGold(done.reward);
      this.spawnPickupText(this.player.x, this.player.y - 44, `퀘스트 보상 +${done.reward}G`, "#ffd76a");
    }
    if (done?.expReward) {
      this.player.gainExp(done.expReward);
      this.spawnPickupText(this.player.x, this.player.y - 62, `경험치 +${done.expReward}`, "#8fe84a");
    }
    /* v3.0.16 — 퀘스트 보상 수령 팝업 (메이플식 보상 내역 창 — 지급 내역을 명확히 안내) */
    if (done && (done.reward || done.expReward)) {
      const lines: { text: string; color?: string }[] = [];
      if (done.reward) lines.push({ text: `골드 +${done.reward} G`, color: "#ffd76a" });
      if (done.expReward) lines.push({ text: `경험치 +${done.expReward} EXP`, color: "#8fe84a" });
      EventBus.emit("reward:show", { title: `퀘스트 완료 — ${done.title}`, lines } satisfies RewardPopupState);
    }
    this.emitQuest();
    this.emitRpgState();
  }

  /** v3.0.2 — 모든 퀘스트 emit에 진행 중인 전직 스토리 정보 병기 (트래커 발견성) */
  private emitQuestState(st: QuestState) {
    if (this.jobStory) {
      const story = this.jobStoryDef();
      const step = story?.steps[this.jobStory.step];
      if (story && step) {
        st.jobStory = {
          title: story.title,
          step: this.jobStory.step + 1,
          total: story.steps.length,
          stepTitle: step.title.replace("[전직 스토리] ", ""),
        };
      }
    }
    EventBus.emit("quest", st);
  }

  emitQuest() {
    // 인트로 시퀀스 중 — 이그니의 안내를 퀘스트 패널에 표시
    if (this.introStep >= 0 && this.introStep < 3) {
      this.emitQuestState({
        title: "룬 정령 이그니의 안내",
        desc: "배너를 따라 마을을 돌아보자",
        current: 1,
        target: 1,
        distance: null,
      } satisfies QuestState);
      return;
    }
    const q = this.currentQuest();
    if (!q) {
      // v2.3 (지시 #4) — 체인 완료 + 반복 의뢰 존재 + 미수주 → 수주 안내
      /* v3.0.26 (#76) — 스토리 미완료 시엔 수주 안내 트래커도 노출 금지 */
      if (!this.isInterior && this.cleared && this.stageDef.repeat && !this.repeatOn) {
        this.emitQuestState({
          title: "반복 의뢰 수주 가능",
          desc: "마을 상인 라고스에게 말을 걸어 [반복] 토벌 의뢰를 수주하자",
          current: 1,
          target: 1,
          distance: null,
        } satisfies QuestState);
        return;
      }
      /* v3.0 (사용자 지시 #5) — 마을/실내는 "지역 클리어!" 오표기 버그 수정:
       *  퀘스트 없는 안전 구역에 전투 구역 완료 배너가 뜨지 않게 전용 문구 사용 */
      if (this.isInterior) {
        this.emitQuestState({
          title: "실내 — 잠시 쉬어 가자",
          desc: "",
          current: 1,
          target: 1,
          distance: null,
        } satisfies QuestState);
        return;
      }
      if (this.stageDef.isVillage) {
        this.emitQuestState({
          title: "마을 — 안전 지대",
          desc: "우물·여관·상점·전직관을 이용하자",
          current: 1,
          target: 1,
          distance: null,
        } satisfies QuestState);
        return;
      }
      this.emitQuestState({
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
    } else if (q.type === "level") {
      // v2.4 — 현재 레벨 / 목표 레벨 진행 바
      current = Math.min(this.player.lv, q.need ?? 1);
      target = q.need ?? 1;
    }
    let distance: number | null = null;
    const t = this.questTargetPos();
    if (t) distance = Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y) / 32);
    /* v3.0.15 (#8) — 추적 중인 다른 구역 퀘스트 안내: 해당 구역으로 이동하라는 표시 */
    if (this.trackedStage && this.trackedStage !== this.stageDef.key) {
      const tdef = STAGES[this.trackedStage as StageKey];
      const tIdx = tdef ? (this.savedQuestIdx[this.trackedStage] ?? 0) : 0;
      const tq = tdef?.quests[tIdx];
      if (tdef && tq) {
        this.emitQuestState({
          title: `[이동] ${tq.title}`,
          desc: `${tdef.name}에서 진행할 수 있는 수락 퀘스트입니다`,
          current: 0,
          target: 1,
          distance: null,
        } satisfies QuestState);
        return;
      }
    }
    /* v3.0.15 (#8) — 현재 구역 퀘스트 미수락 시 수락 유도 */
    const accepted = this.isQuestAccepted(this.stageDef.key, this.questIdx);
    this.emitQuestState({
      title: accepted ? q.title : `[수락 대기] ${q.title}`,
      desc: accepted ? q.desc : "퀘스트 로그(J)에서 수락하면 진행됩니다",
      current: accepted ? current : 0,
      target: accepted ? target : 1,
      distance: accepted ? distance : null,
      pending: !accepted,
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
      /* v3.0.3 — 3차기(V)/4차기(B) 쿨다운 + 해금 */
      s3Cd: Math.round(this.player.skill3Cd),
      s3Max: this.player.skill3MaxEff,
      s4Cd: Math.round(this.player.skill4Cd),
      s4Max: this.player.skill4MaxEff,
      s3Unlocked: this.player.skill3Unlocked,
      s4Unlocked: this.player.skill4Unlocked,
      /* v3.2.0 — 5차 궁극기 (Lv.200) */
      s5Cd: Math.round(this.player.skill5Cd),
      s5Max: this.player.skill5Max,
      s5Unlocked: this.player.skill5Unlocked,
      s5Name: this.player.skill5Name,
      s5Icon: "/assets/skillicon/ultimate_s5.png",
      /* v2.5 — 계열별 스킬 라벨 (기본공격 포함 3슬롯 교체 표기) */
      atkName: this.player.attackName,
      s1Name: this.player.skill1Name,
      s2Name: this.player.skill2Name,
      s3Name: this.player.skill3Name,
      s4Name: this.player.skill4Name,
      /* v3.0.8 디자인 개편 — 클래스별 스킬 아이콘 (RPG Icons Pixel Art)
       * v3.0.10 — 미전직(cls=null)은 "base" 아이콘 세트 사용 (스킬 아이콘 미적용 버그 수정) */
      ...(SKILL_ICONS[(this.player.cls ?? "base") as keyof typeof SKILL_ICONS] ?? {}),
    });
  }

  /**
   * v3.1.0 (#최적화) — HUD 브로드캐스트 스로틀.
   *  피격·회복·자동사냥 등 한 프레임에 수 회 호출되면 React HUD가 매번 리렌더돼
   *  모바일에서 프레임 드롭이 컸다. 90ms 내 중복 호출은 하나의 지연 emit으로 합친다
   *  (trailing 보장 — 마지막 상태가 반드시 반영된다).
   */
  emitHud() {
    if (!this.player) return;
    const now = this.time.now;
    if (now - this.lastHudEmit < 90) {
      if (!this.hudEmitPending) {
        this.hudEmitPending = true;
        this.time.delayedCall(100, () => {
          this.hudEmitPending = false;
          this.emitHud();
        });
      }
      return;
    }
    this.lastHudEmit = now;
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
      accessories: [...this.player.accessories],
      emerald: this.player.emerald,
      upWea: this.player.upgrades.weapon,
      upArm: this.player.upgrades.armor,
      sfHp: this.player.starHpApplied,
      accUp: { ...this.player.accUp },
      starBless: this.player.starBless,
      accHp: this.player.accHpAppliedVal,
      nearShop: this.nearShop,
      shopStock: [...SHOP_STOCK],
      /* v3.0.6 — BM 상점 재고 + 자동 사용 설정 (지시 #1/#5) */
      bmStock: [...BM_STOCK],
      autoUse: { ...this.player.autoUse },
      cls: this.player.cls,
      /* v3.0.22 (#38) — 전직은 레벨 + 전직 퀘스트 완료가 모두 필요. jobLock = 미완료 사유 */
      canJob: canJobNow(this.player.lv, this.player.cls) && this.jobQuestCleared(),
      jobLock: this.jobQuestLockText(),
      /* v3.0.22 (#43/#44/#50) — 결정 수집 진행도 + 세계수의 가호 */
      fragFound: FRAGMENT_CHAPTERS.filter((k) => (this.fragmentsFound[k] ?? 0) > 0).length,
      fragTotal: FRAGMENT_CHAPTERS.length,
      blessing: this.player.worldtreeBlessing,
      /* v1.9 BM + 스탯 */
      buffItems: { ...this.player.buffItems } as Record<string, number>,
      pets: [...this.player.pets],
      pet: this.player.pet,
      cosmetics: [...this.player.cosmetics],
      cosmetic: this.player.cosmetic,
      stats: { ...this.player.stats },
      ap: this.player.ap,
      /* v2.5 — 자동사냥 상태 (v3.0.15 #5: 펫 조건 제거) */
      autoHunt: this.autoHunt,
      canAutoHunt: true, // v3.0.15 (#5) — 펫 없이도 자동전투 가능
      /* ----- v3.0.15 신규 ----- */
      autoAlloc: this.autoAlloc,
      quickPots: { ...this.player.quickPots },
      potentials: JSON.parse(JSON.stringify(this.player.potentials)),
      eertCube: this.player.owned.filter((k) => k === "eert_cube").length,
      unlockedSets: [...this.unlockedSets],
      /* ----- v3.0.16 — 컬렉션 + 세트 효과 ----- */
      collection: {
        registered: Object.keys(this.monsterKills).length,
        total: this.collectionTotal,
        kills: { ...this.monsterKills },
      },
      activeSet: (() => {
        const s = this.player.activeSet;
        if (!s) return null;
        const b = s.bonus;
        const lines: string[] = [];
        if (b.atkPct) lines.push(`공격력 +${b.atkPct}%`);
        if (b.defAdd) lines.push(`방어력 +${b.defAdd}`);
        if (b.maxHp) lines.push(`최대 HP +${b.maxHp}`);
        if (b.critAdd) lines.push(`크리티컬 +${b.critAdd}%`);
        return { title: s.title, lines };
      })(),
    };
    const sig = JSON.stringify(st);
    if (sig === this.lastRpgSig) return;
    this.lastRpgSig = sig;
    EventBus.emit("rpg:state", st);
  }

  /** 퀘스트 로그 (J) — 스테이지 메인 체인 전체 진행 상황
   *  v3.0.15 (#8) — 수락/추적 상태 + 전 구역 수락 퀘스트 목록 (메이플식 퀘스트 선택) */
  emitQuestLog() {
    if (!this.player) return;
    const curAcc = this.isQuestAccepted(this.stageDef.key, this.questIdx);
    const list = this.stageDef.quests.map((q, i) => ({
      title: q.title,
      desc: q.desc,
      state: (i < this.questIdx ? "done" : i === this.questIdx ? "active" : "locked") as
        | "done"
        | "active"
        | "locked",
      /* 수락 가능: 현재 진행 인덱스 && 아직 미수락 */
      canAccept: i === this.questIdx && !this.isQuestAccepted(this.stageDef.key, i),
      accepted: i < this.questIdx || this.isQuestAccepted(this.stageDef.key, i),
    }));
    /* 전 구역 수락 퀘스트 목록 — 다른 구역에서 수락해둔 것 (메이플식: 수락한 퀘스트 선택 진행) */
    const tracked: QuestLogState["trackedList"] = [];
    const allIdx: Record<string, number> = { ...this.savedQuestIdx, [this.stageDef.key]: this.questIdx };
    for (const [k, idx] of Object.entries(allIdx)) {
      const def = STAGES[k as StageKey];
      if (!def || !this.isQuestAccepted(k, idx)) continue;
      const q = def.quests[idx];
      if (!q) continue;
      tracked.push({
        stage: k,
        stageName: def.name,
        title: q.title,
        desc: q.desc,
        isCurrent: k === this.stageDef.key,
        isTracked: this.trackedStage === k,
        state: (idx >= def.quests.length ? "done" : k === this.stageDef.key ? "active" : "move") as "done" | "active" | "move",
      });
    }
    const r = this.stageDef.repeat;
    const payload: QuestLogState = {
      stageName: `${this.stageDef.name} — ${this.stageDef.subtitle}`,
      list,
      /* v3.0.26 (#76) — 스토리 미완료 시 반복 의뢰 섹션 자체를 숨김 ("스토리 다 완료 후 창이 뜨게") */
      repeat: this.cleared && r ? { title: r.title, desc: r.desc } : null,
      repeatActive: this.repeatActive(),
      repeatUnlocked: this.repeatOn,
      trackedList: tracked,
    };
    EventBus.emit("questlog", payload);
  }

  private save() {
    // v2.3 — 실내(여관/집)에서의 저장도 세이브 스테이지는 진행 구역 유지
    //  (설계 의도대로 실내가 세이브에 기록되지 않게 — 재접속 시 마을에서 계속)
    writeSave(this.buildSave(this.isInterior ? "village" : undefined));
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
      sfHp: this.player.starHpApplied,
      accUp: { ...this.player.accUp },
      starBless: this.player.starBless,
      accHp: this.player.accHpAppliedVal,
      accessories: [...this.player.accessories],
      emerald: this.player.emerald,
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
      pendingJobClass: this.pendingJobClass, // v3.1.0 — 시련 중 선택한 1차 클래스
      jobStoryDone: [...this.jobStoryDone],
      /* v2.3 — 반복 의뢰 수주 해금 + 본 스토리 대사 기록 */
      repeatOn: this.repeatOn,
      /* v3.0.22 (#43/#44/#50) — 결정 수집 + 세계수의 가호 */
      fragmentsFound: { ...this.fragmentsFound },
      worldtreeBlessing: this.player.worldtreeBlessing,
      /* v3.0.6 — 반복 의뢰 진행도 (재입장 시 카운트 유지) */
      repeatNeed: this.repeatNeed,
      huntCount: this.huntCount,
      repeatStage: this.stageDef.key,
      autoUse: { ...this.player.autoUse },
      seen: [...this.seenSet].slice(-160),
      /* v2.5 — 방문 구역 기록 + 자동사냥 토글 */
      visited: [...this.visited],
      autoHunt: this.autoHunt,
      /* v3.0.15 ----- */
      autoAlloc: this.autoAlloc,
      /* v3.0.28 (#보스난이도) — 보스전 난이도 세이브 */
      bossDiff: this.bossDiff,
      /* v3.3.0 — 5차 각성 상태 (GM 임시 전직 or 각성 시련 완료) */
      fifth: this.player.fifth,
      fifthStoryDone: this.player.fifthStoryDone,
      quickPots: { ...this.player.quickPots },
      potentials: JSON.parse(JSON.stringify(this.player.potentials)),
      potHpApplied: this.player.potHpAppliedVal,
      unlockedSets: [...this.unlockedSets],
      questAccepted: { ...this.acceptedQuests },
      questTracked: this.trackedStage,
      /* ----- v3.0.16 ----- */
      monsterKills: { ...this.monsterKills },
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

  /* v3.0.10 (메이플식 챕터 연출) — 챕터 타이틀 카드 컷신.
   *  화면을 세미 클로즈업 어둡게 덮고 "제N장 / 챕터명 / 부제" 카드를 페이드 인·아웃한다.
   *  컷신 중엔 물리를 일시 정지해 이동·전투가 멈춘다(대사 박스와 동일 규약). */
  private showChapterCard(chNum: number, title: string, subtitle: string, cb?: () => void) {
    const cam = this.cameras.main;
    const vw = cam.width;
    const vh = cam.height;
    this.dialoguing = true;
    this.player.setVelocity(0, 0);
    this.physics.world.pause();
    audio.sfx.questDone();
    const depth = 118;
    const veil = this.add
      .rectangle(vw / 2, vh / 2, vw, vh, 0x06080f, 0.78)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth)
      .setAlpha(0);
    const rule = this.add
      .rectangle(vw / 2, vh / 2 + 30, 0, 2, 0xffd76a, 0.95)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1);
    const tCh = this.add
      .text(vw / 2, vh / 2 - 34, `제${chNum}장`, {
        fontFamily: "Roboto, sans-serif",
        fontSize: "26px",
        color: "#ffd76a",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1)
      .setAlpha(0);
    const tTitle = this.add
      .text(vw / 2, vh / 2 + 2, title, {
        fontFamily: "Roboto, sans-serif",
        fontSize: "40px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1)
      .setAlpha(0);
    const tSub = this.add
      .text(vw / 2, vh / 2 + 46, subtitle, {
        fontFamily: "Roboto, sans-serif",
        fontSize: "15px",
        color: "#cfe3ff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1)
      .setAlpha(0);
    const cleanup = () => {
      veil.destroy();
      rule.destroy();
      tCh.destroy();
      tTitle.destroy();
      tSub.destroy();
      this.dialoguing = false;
      this.physics.world.resume();
      cb?.();
    };
    this.tweens.add({ targets: veil, alpha: 0.78, duration: 420, ease: "Sine.easeOut" });
    this.tweens.add({ targets: rule, width: 300, duration: 560, ease: "Sine.easeOut" });
    this.tweens.add({ targets: [tCh, tTitle], alpha: 1, y: "+10", duration: 560, ease: "Sine.easeOut" });
    this.tweens.add({ targets: tSub, alpha: 1, delay: 160, duration: 460, ease: "Sine.easeOut" });
    this.time.delayedCall(2050, () => {
      this.tweens.add({ targets: [veil, rule, tCh, tTitle, tSub], alpha: 0, duration: 420, ease: "Sine.easeIn", onComplete: cleanup });
    });
  }

  showDialogue(id: string, npcId: string | null = null) {
    let d = DIALOGUES[id];
    if (!d) {
      /* v3.0.28 (#NPC대화) — 키 불일치 방어 폴백: dlg 키가 등록 규칙과 어긋나도
       *  현재 챕터 마을 주민 대사(vlg{챕터명}A/B)로 재시도해 대화가 조용히 무시되는 일 방지 */
      const ch = parseStage(this.stageDef.key).ch;
      const cap = ch.charAt(0).toUpperCase() + ch.slice(1);
      d = DIALOGUES[`vlg${cap}A`] ?? DIALOGUES[`vlg${cap}B`];
    }
    if (!d) return;
    this.activeNpcId = npcId;
    this.dialoguing = true;
    this.dialogueSince = this.time.now; // v3.3.0 — 대사 붙임 자가치유 기준 시각
    this.player.setVelocity(0, 0);
    this.physics.world.pause();
    EventBus.emit("dialogue:show", d);
  }

  /** v2.3 (지시 #1) — 스토리 대사 1회 재생: 이미 본 대사(세이브 기록)는 스킵.
   *  인트로/구역 안내/체인 대사/보스 등장 대사 등 재입장 시 다시 뜨던 버그 방지 */
  private showDialogueOnce(id: string, npcId: string | null = null): boolean {
    if (!DIALOGUES[id] || this.seenSet.has(id)) return false;
    this.seenSet.add(id);
    this.save();
    this.showDialogue(id, npcId);
    return true;
  }

  /** 대사 기록만 저장 (예약 재생 대상 — queuedDialogue) */
  private markSeen(id: string) {
    if (this.seenSet.has(id)) return;
    this.seenSet.add(id);
    this.save();
  }

  resumeFromDialogue() {
    this.dialoguing = false;
    this.dialogueSince = 0; // v3.3.0 — 붙임 시각 리셋
    this.portalHoldSince = 0; // v2.7 — 정상 종료면 강제개방 카운터도 리셋
    this.physics.world.resume();
    EventBus.emit("dialogue:hide");
    // 대화 닫기 키의 잔여 justDown 소비 — 스페이스로 대화 넘긴 직후 공격이 새어나가는 것 방지
    if (this.keys) {
      for (const k of [this.keys.SPACE, this.keys.X, this.keys.Z, this.keys.C, this.keys.E]) {
        Phaser.Input.Keyboard.JustDown(k);
      }
    }
    // v2.2 — 여관주인 대사 종료 → 취침 연출로 자연스럽게 이어짐
    if (this.sleepPending) {
      this.sleepPending = false;
      this.activeNpcId = null;
      this.time.delayedCall(160, () => this.trySleep());
      return;
    }
    // 주민 대화 종료 → talk 퀘스트 진행 (전직 교관은 퀘스트 카운트 제외)
    if (this.activeNpcId) {
      const npc = this.activeNpcId;
      this.activeNpcId = null;
      if (npc === "jobmaster") {
        /* v3.3.0 (지시 #8) — 5차 각성 스토리: Lv.200 도달 + 미각성 → 카이엔이 제5의 문을 연다 */
        if (
          !this.player.fifth && !this.player.fifthStoryDone &&
          this.player.lv >= FIFTH_LEVEL && !this.fifthTrialActive
        ) {
          this.pendingFifthSummon = true;
          this.showDialogueRaw({
            speaker: "카이엔",
            lines: [
              "...제법 서늘한 눈이 되었군. 그 힘이 등 뒤에서 속삭이고 있어.",
              "레벨 200 — 이그드라실의 정점에 선 자만이 '다섯 번째 문'을 볼 수 있다.",
              "제5의 문이 열리면 모든 스킬이 '극'으로 재태어나고, 세부 직업마다 다른 궁극기가 손에 쥐어진다.",
              "준비됐나? 각성의 수호자를 쓰러뜨려 스스로를 증명해라!",
            ],
          });
          return; // 대사 종료 후 pendingFifthSummon 경로로 이어짐
        }
        // 전직 스토리 elite 단계 — 시험 상대 소환 (지시 #13)
        const step = this.jobStory ? this.jobStoryDef()?.steps[this.jobStory.step] : null;
        if (step?.type === "elite") {
          this.summonJobElite();
        } else if (
          familyOf(this.player?.cls ?? "") &&
          chainOf(this.player?.cls ?? "").length >= 1 &&
          !this.jobStory
        ) {
          // v3.1.0 — 전직관 대화로 미진행 다음 차수 시련 시작 (완료 시 승격 해금)
          this.maybeStartJobStory();
          // 시련이 시작되지 않았으면(완료/조건) 패널 오픈
          if (!this.jobStory) {
            this.time.delayedCall(120, () => EventBus.emit("ui:panel", { panel: "job" }));
          }
        } else {
          // 전직 상담 종료 → 전직 패널 자동 오픈 (v1.9 전직 NPC)
          this.time.delayedCall(120, () => EventBus.emit("ui:panel", { panel: "job" }));
        }
      } else if (npc === "merchant") {
        // v2.3 (지시 #4) — 상인 대화 종료 → 반복 토벌 의뢰 수주
        if (this.repeatUnlockable()) {
          this.repeatOn = true;
          this.save();
          audio.sfx.questDone();
          this.showBanner("토벌 의뢰 수주! 구역 체인을 모두 끝낸 사냥터에서 [반복] 의뢰를 진행할 수 있어요");
          this.spawnPickupText(this.player.x, this.player.y - 44, "의뢰 수주!", "#7dffa8");
          this.emitQuest();
          this.emitQuestLog();
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
    /* v3.3.0 (지시 #8) — 각성 대사 종료 → "각성" 챕터 카드 + 수호자 소환 */
    if (this.pendingFifthSummon) {
      this.pendingFifthSummon = false;
      this.time.delayedCall(120, () => this.startFifthTrial());
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
  /** v3.0.24 — 직업별 스킬 전용 효과음 (audio.ts SKILL_SFX_FILES 매핑)
   *  @param key 스킬 음향 키 (arrow/cast/knife/flame/wind/dark/holy/thunder/warcry 등)
   *  @param rate 피치 배율 (상위직 강화판·계열 변주) */
  sfxSkill(key: string, rate = 1) {
    audio.sfx.skill(key, rate);
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
