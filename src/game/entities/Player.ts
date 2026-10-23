import Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import {
  ITEMS, BUFF_DEFS, PET_DEFS, COSMETIC_DEFS, UPGRADE_MAX, UPGRADE_RATES, UPGRADE_FALLBACK_FROM, upgradeCost, sellValue, type BuffKey as BuffKeyT,
  starWeaponBonus, starArmorBonus, STAR_MILESTONES, starPerStarAtk, starPerStarDef,
  TRADE_PRICES, tradeValue, STAR_BLESS_RATE, STAR_BLESS_MAX, starAccBonus,
  sumPotLines, FAMILY_ELEM, rollPotentials, activeSetBonus, collectionBonus, WORLDTREE_BLESSING,
  POT_PITY_MAX, STAR_PITY_STEP, STAR_PITY_MAX, STAR_PITY_FROM,
  type ItemKey, type BuffKey, type PetKey, type CosmeticKey, type ElemKey, type Potentials,
} from "../data";
import {
  classDef, isClassKey, bonusOf, nextTierOf, freeJobOption, familyOf, chainOf, tier2RootOf,
  resolveSkill1Of, resolveSkill2Of, resolveSkill5Of,
  type ClassKey, type ClassBonus, SKILL_LABELS, SKILL3_KIND, SKILL4_KIND,
  SKILL5_INFO, SKILL5B_INFO, FIFTH_SKILL_MULT, FIFTH_CD_MULT, FIFTH_LEVEL, FIFTH1_MULT, FIFTH2_MULT,
  type Skill1Kind, type Skill2Kind, type Skill3Kind, type Skill4Kind,
} from "../classes";
import { sweptHitsTarget } from "../collision/sweep";
import { loadBodyPrefix } from "../textures"; // v1.5.0 — 게임 중 미로드 외형 동적 로드
import { spawnPentacle, spawnFlarePop, spawnRingPop, spawnUltimateIntro, spawnUltIntroSig, spawnTierFlair, spawnUltFlourish, type FamKey } from "../fx/StudioFX"; // v1.0.10 — GameStudio FX (4차/5차 스킬 강화) · v1.4.0 — 5차 고유 시그니처 · vc147 — 계열별 지면 시그니처
import { DEATH_SLASH_CFG, runDeathSlashCinematic } from "../fx/DeathSlash"; // vc153 — 도적 제2궁극기 「사(死)의 일섬」 3D 시네마틱
import * as audio from "../audio";
import { netAction } from "../net"; // v4.1.0 — 파티원 공격/스킬 동기화
import type { Enemy } from "./Enemy";
import type { Boss } from "./Boss";
import { ZERO_EXT, expBookExp, type ExtBonus, type GateCard } from "../isekai";
import { expToNext } from "../expTable"; // v1.0.15 (피드백 #1) — 메이플 공식 레벨별 경험치표
import { memoCooldowns, restoreCooldowns } from "../cooldownMemo"; // v1.0.15 (피드백 #3) — 맵 이동 간 쿨타임 유지

/**
 * 주인공 세르츠.
 *  - 3프레임 베기 모션 + 참격 초승달 이펙트 / 전방 160px x 폭 116px 판정
 *  - 베기 시 살짝 전진(미세 러지) + 히트스톱 + 넉백 — 타격감
 *  - 2D MMORPG 기본 요소: 골드·물약·장비(무기 ATK/방어구 DEF)·방어 판정
 *  - RPG 2차 확장: 크리티컬·장비 강화(+1~+5)·장신구 슬롯
 *  - 월드 경계 충돌
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  declare scene: WorldScene;

  lv = 1;
  exp = 0;
  maxHp = 100;
  hp = 100;
  maxMp = 60;
  mp = 60;
  atk = 12;

  /* ----- RPG 기본 자원 ----- */
  gold = 30; // 시작 자금 (물약 1개 분)
  potions: { hp: number; mp: number } = { hp: 2, mp: 1 }; // 시작 지급
  /* v3.0.15 (#7) — 물약 퀵슬롯 장착 (슬롯 → 아이템키. 인벤토리에서 지정) */
  quickPots: { hp: string; mp: string } = { hp: "potion_hp", mp: "potion_mp" };
  /* v3.0.15 (#13) — eert 큐브 잠재옵션 (아이템키 → 잠재) */
  potentials: Record<string, Potentials> = {};
  weapon: ItemKey = "weapon_1";
  armor: ItemKey = "armor_1";
  /** v2.9 (#8) — 장신구 슬롯: 반지 4개 + 펜던트 2개 중복 장착 (메이플 장비창 감각) */
  accessories: ItemKey[] = [];
  static RING_SLOTS = 4;
  static PENDANT_SLOTS = 2;
  /** v2.9 (#12) — 과금 화폐 에메랄드 (상점 코스메틱/편의 구매용 시드) */
  emerald = 0;
  owned: ItemKey[] = ["weapon_1", "armor_1"];
  upgrades: { weapon: number; armor: number } = { weapon: 0, armor: 0 }; // [호환 미러] 장착 중 아이템의 강화 단계 (실 저장은 starMap)
  /** vc145 (#16 긴급) — 장비 스타포스를 **아이템 단위**로 저장 (itemKey → 성 0~15).
   *  기존 upgrades{weapon,armor}는 슬롯 단위라 다른 장비를 장착해도 이전 장비의 성이 그대로
   *  적용되는 심각 버그의 근원. 이제 성은 아이템에 소속되며, upgrades는 세이브 호환용 미러로만 유지 */
  starMap: Record<string, number> = {};
  /** v3.0.7 — 장신구 스타포스 (itemKey → 성 0~15) — 장착/미장착 무관 보유 단위 유지 */
  accUp: Record<string, number> = {};
  /** v3.0.7 — 강화 주문서 충전 수 (다음 강화 성공률 +15%p/장, 최대 3) */
  starBless = 0;
  /** v1.0.8 — 강화 실패 가산 (★10+ 실패 연속 1회당 +5%p, 최대 +15%p, 성공 시 리셋 — 천장) */
  starPity = 0;
  /** v1.0.8 — eert 큐브 잠재 천장 카운터 (유니크 미달 연속 횟수, 10회 도달 시 유니크+ 확정) */
  potPity = 0;
  /** 전직 클래스 (v1.8 다차원 트리 — 1차/2차/3차 키, 미전직 null) */
  cls: ClassKey | null = null;
  /** v1.0.18 — 캐릭터 생성 시 선택한 시작(스타트) 1차 클래스. 환생 시 이 클래스로 돌아간다.
   *  구 세이브는 로드 시 cls 체인의 최상위(1차)키로 자동 마이그레이션된다. */
  startCls: ClassKey | null = null;
  /** 경로 누적 보너스 캐시 — cls 변경 시에만 갱신 (getter 프레임 호출 부담 제거) */
  private clsBonus: ClassBonus = bonusOf(null);
  private potCd = 0;

  /* ----- AP 스탯 (v1.9 — 메이플식 4스탯, 레벨업당 AP +5) ----- */
  stats: { str: number; dex: number; int: number; luk: number } = { str: 5, dex: 5, int: 5, luk: 5 };
  ap = 0;

  /* ----- BM (v1.9 — 버프 물약 / 펫 / 치장) ----- */
  buffItems: Partial<Record<BuffKey, number>> = {};
  /** 활성 버프 — remain 감소, 같은 버프 재사용 시 시간 갱신 */
  buffs: { key: BuffKey; remain: number; total: number }[] = [];
  pets: PetKey[] = [];
  pet: PetKey | null = null;
  cosmetics: CosmeticKey[] = [];
  cosmetic: CosmeticKey | null = null;
  /* v1.0.7 — 슬롯형 치장: 코스튬(스프라이트 착장)·헤어(포니테일 등) — 오라(cosmetic)와 독립 착용 */
  outfit: CosmeticKey | null = null;
  hair: CosmeticKey | null = null;
  /* v1.0.19 (B-1 캐릭터 생성 — 외형) — 로비에서 고른 색조(전체 스프라이트 틴트).
   *  null/0xffffff면 미적용. 상태 이상 틴트(독/출혈)가 끝나면 이 색으로 복원된다. */
  lookTint: number | null = null;

  /** 기본 크리티컬 확률 (%) — 장신구로 증가 */
  private static readonly BASE_CRIT = 8;
  private static readonly CRIT_MULT = 1.7;
  /** vc145 (#9) — 전 스킬 공통 화력 계수 (평타 대비 스킬 우위 보장, 기본공격엔 미적용) */
  private static readonly SKILL_PWR = 1.25;
  /* v3.0.6 (지시 #4 — 그림자 숨기) — 다음 기본공격 강화 플래그 */
  nextAtkEmpowered = false;
  /** v1.0.18 — 유니온 버프 경험치 % 훅 (씬이 주입 — null이면 미적용) */
  expBonusPct?: () => number;
  /* v3.0.6 (지시 #5) — 자동 물약/자동 버프 설정 (hpPct 0=끝, mpOn, 버프 키 목록) */
  autoUse: { hpPct: number; mpPct: number; mpOn: boolean; buffs: BuffKey[] } = { hpPct: 45, mpPct: 25, mpOn: false, buffs: [] }; // v1.1.0 (#5) — 기본 활성화 45%/25% (설정 저장값 우선, 0이면 끔)
  /* v1.1.0 (#5) — 운영자 무한 소모품: 물약/엘릭서가 없어도 회복되고 소모되지 않는다 (WorldScene이 adminRole로 설정) */
  gmInfinite = false;
  /* v1.1.0 (#1/#22/#21) — 외형: 성별/피부/시트 프리픽스. "" = 기본(남성·기본피부 = 원본 hero_*) */
  gender: "m" | "f" = "m";
  /* v1.2.0 (#7) — GM 외형 플래그: 로비에서 GM 외형을 고른 캐릭터. WorldScene이 서버 롤(admin)을
   *  확인해 gmApproved를 설정한 뒤에만 실제 gm 시트로 렌더된다 (비GM 세이브 변조 차단) */
  gmSkin = false;
  gmApproved = false;
  /* v1.2.0 (#1) — 포니테일 환수 1회성 플래그 (buildSave가 세이브에 유지 — 이중 환수 방지) */
  ponyRefund = false;
  skinIdx = 2;
  bodyPrefix = "";
  /* v1.5.0 — 미로드 외형 로드 시도 이력 (무한 루프 방지 — 프리픽스당 1회) */
  private bodyLoadTried: string | null = null;
  /* v1.5.0 — 동적 외형 로드 완료 대기 중인 프리픽스 (preUpdate 폴링으로 재적용) */
  private bodyPending: string | null = null;
  /* v1.5.0 — 로더 재킥 스로틀/한도 (큐잉 씹힘 커버) */
  private bodyKickAt: number | null = null;
  private bodyKickCount = 0;
  /* v3.3.0 (지시 #3/#8 — GM 5차전직(임시) + 5차전직 스토리) — 5차 각성 상태 (세이브 대상)
   *  GM 부여 or 각성 시련 완료 시 true. Lv.200 도달과 별개 — true면 200 미만이어도 5차 강화+궁극기 사용 가능 */
  fifth = false;
  /** v3.3.0 — 5차 각성 시련 완료 여부 (스토리 1회성 — 세이브) */
  fifthStoryDone = false;
  /** v3.3.0 (지시 #5) — 현재 스테이지 챕터(1~10). 챕터 4+에서만 체력% 고정 피해 발동 (WorldScene이 매 이동마다 설정) */
  stageCh = 1;
  private autoBuffAcc = 0;
  /** v3.0.6 (지시 #8) — 보스 공격 방어 관통률 (Boss.takeDamage 호출 시 true) */
  bossPierceHit = false;

  speed = 240; // v4.2.0 — 225→240 (피로도 완화: 사냥 회전률 +7%)
  /** 이동 기본값 — 클래스 속도 보너스는 이 값에 배율 (recalcSpeed)
   *  v3.0.16 — 230→265 (+15%) / v3.0.18 — 265→300 (+13%)
   *  v3.0.24 — 300→225 되돌림 (유저: "기본 이속이 너무 빠름 — 강화 및 스텟을 올려야지 빠르게 해야지!!")
   *  → 기본은 보수적으로, 민첩 스탯(+0.5%/점)과 강화(스타포스 +0.5%/성)에 투자해야 빨라진다 */
  static readonly BASE_SPEED = 225;
  facing: Phaser.Math.Vector2 = new Phaser.Math.Vector2(1, 0);

  state: "idle" | "attack" | "dash" | "dead" = "idle";
  private atkCooldown = 0;
  private slashAlt = false; // 위/아래 교차 베기
  private swingDone = false; // v2.2 — 스윙 판정(65ms) 완료 플래그 (공격 중 걷기 복귀용)
  private lastMove = new Phaser.Math.Vector2(); // v2.2 — 최근 입력 이동 (러지 여부 판단)
  private hitSet: Set<unknown> = new Set();

  skill1Cd = 0; // 계열별 주력기 (전사 회전베기 / 궁수 관통 화살 / 마법사 매직 볼트)
  skill2Cd = 0; // 계열별 기동기 (전사·궁수 돌진 / 마법사 점멸)
  /* v3.0.3 — 3차기(V) / 4차기(B): 상위직 고유 메커니즘 스킬 */
  skill3Cd = 0;
  skill4Cd = 0;
  /* v3.2.0 — 5차 궁극기 (Lv.200 · 쿨타임 60초 고정 — cdMult 미적용) */
  skill5Cd = 0;
  readonly skill5Max = 60000;
  /* vc146 (#2) — 5차 제2궁극기 (Lv.200 · 쿨타임 120초 고정 — cdMult 미적용) */
  skill5bCd = 0;
  readonly skill5bMax = 120000;
  /** vc146 (#2) — 영겁전격 "시간 역행" 재현 로그: 최근 6초 rollDamage 합산
   *  (제2궁극기 중 이터널 전용 — “최근에 입힌 피해가 2배가 되어 재현”의 근거 데이터)
   *  v1.0.16 — 고정 링 버퍼. 매 타격 push+shift(객체 할당 + 배열 이동)를 제거한다.
   *  cap은 6초 창에서 도달 불가능한 크기(2048 ≈ 341타/초)라 합산 결과는 종전과 동일하다. */
  recentDmgLog: { t: number; v: number }[] = [];
  private dmgLogIdx = 0;
  private static readonly DMG_LOG_CAP = 2048;
  readonly skill3Max = 9000;
  readonly skill4Max = 14000;
  get skill3MaxEff(): number {
    return Math.round(this.skill3Max * this.clsBonus.cdMult * (this.isFifth ? FIFTH_CD_MULT : 1));
  }
  get skill4MaxEff(): number {
    return Math.round(this.skill4Max * this.clsBonus.cdMult * (this.isFifth ? FIFTH_CD_MULT : 1));
  }
  /** 3차기 해금 — 3차 전직부터 (스킬 3개) */
  get skill3Unlocked(): boolean {
    return this.tier >= 3 && !!SKILL3_KIND[this.cls ?? ""];
  }
  /** 4차기 해금 — 4차 각성부터 (스킬 4개) */
  get skill4Unlocked(): boolean {
    return this.tier >= 4 && !!SKILL4_KIND[this.cls ?? ""];
  }
  /** v3.2.0 — 5차 궁극기 해금 — Lv.200 도달 (전직 티어 무관)
   *  v3.3.0 — GM 5차전직(임시)/각성 시련 완료(fifth)여도 해금 (레벨 무관) */
  get skill5Unlocked(): boolean {
    return this.lv >= FIFTH_LEVEL || this.fifth;
  }
  /** vc146 (#2) — 제2궁극기 해금 — vc147 (#19): Lv.200 동시 해금 폐지.
   *  · 스토리 퀘스트 "각성의 대가"(fifth2.ts, 12단계) 완료 시 해금 — 수주 조건 Lv.220
   *  · 각성 시련 완료/GM 부여(fifth)는 기존대로 전부 해금 (테스트/GM 편의 유지) */
  get skill5bUnlocked(): boolean {
    return this.fifth2Done || this.fifth;
  }
  get skill5bName(): string {
    if (!this.skill5bUnlocked) return "";
    return SKILL5B_INFO[resolveSkill5Of(this.cls)].name;
  }
  /** v3.3.0 (지시 #1/#3) — 5차 각성 상태. Lv.200 도달 or GM 부여 or 각성 시련 완료 */
  get isFifth(): boolean {
    return this.lv >= FIFTH_LEVEL || this.fifth;
  }
  /* vc147 (#19) — "각성의 대가" 스토리 퀘스트 진행 상태 (fifth2.ts — 세이브 저장 대상)
   *  step: 0=미수주, 1~12=진행, 12 초과=완료 · count: 현재 단계 카운터 */
  fifth2Step = 0;
  fifth2Count = 0;
  fifth2Done = false;
  /* vc147 (#18) — 궁극기 시전 중 슬롯 표시 (1=1차 궁극기 ×300%, 2=제2궁극기 ×500%).
   *  useSkill5/useSkill5b 내부의 rd() 래퍼가 설정하고 rollDamage가 소비한다 (동기 호출 단위). */
  private ultSlot: 0 | 1 | 2 = 0;
  /* vc153 — 3D 시네마틱(사(死)의 일섬) 재생 중 경직 유용 플래그 — 공통 마무리(300ms)가 잠금을 풀지 못하게 */
  cineLock = false;
  /** v3.3.0 — 스킬 강화 티어: 5차 각성 시 5 (기존 공식 사다리가 한 칸 더 연장된다) */
  get sTier(): number {
    return this.isFifth ? 5 : this.tier;
  }
  /* v3.0.3 — 상태이상 (몬스터가 부여: 출혈/독/감속) */
  dots: {
    bleed: { dps: number; until: number } | null;
    poison: { dps: number; until: number } | null;
    slow: { mult: number; until: number } | null;
  } = { bleed: null, poison: null, slow: null };
  private dotAcc = 0;
  /* v3.0.3 — 스킬 자기버프 (전장의 함성 공증 / 심판의 방어 / 천공 신속) */
  selfAtkBuff: { mult: number; until: number } | null = null;
  selfDefBuff: { add: number; until: number } | null = null;
  selfSpdBuff: { mult: number; until: number } | null = null;
  /* v3.0.3 — 도적 표창 카운터 (기본공격 3회마다 표창 투척)
   *  v3.0.6 — 2차+ 2회마다 (전직마다 기본공격 강화 — 지시 #3) */
  private atkCount = 0;
  /** v3.0.1 — 자동사냥이 돌진 방향을 지정 (설정 시 조이스틱/조준보다 우선, 사용 후 1회 소모) */
  autoDashDir: Phaser.Math.Vector2 | null = null;
  readonly skill1Max = 4000;
  readonly skill2Max = 6000;
  /** 클래스 cdMult 반영 실효 쿨다운 (v3.3.0 — 5차 각성 시 -15%) */
  get skill1MaxEff(): number {
    return Math.round(this.skill1Max * this.clsBonus.cdMult * (this.isFifth ? FIFTH_CD_MULT : 1));
  }
  get skill2MaxEff(): number {
    return Math.round(this.skill2Max * this.clsBonus.cdMult * (this.isFifth ? FIFTH_CD_MULT : 1));
  }
  private mpRegenAcc = 0;

  private iframes = 0;
  private dashTime = 0;
  private dashGhostAcc = 0; // v4.9.0 — 돌진 잔상 스폰 간격 누적
  private dashDir = new Phaser.Math.Vector2();
  /** v3.0.6 — 현재 기동기 종류 (종착 효과 분기용) */
  private dashKind: string = "dash";


  /** 대시 속도 — 계열별 차등 (마법사 점멸은 짧고 즉발) */
  private dashSpeed = 640;
  /** 공격 미세 러지 — "살짝 돌진" 타격감 (예전 360 상시 돌진보다 작고 빠르게 감쇠) */
  private static readonly LUNGE_SPEED = 190;
  private static readonly LUNGE_MS = 170;
  private lungeTime = 0;
  private lungeDir = new Phaser.Math.Vector2();

  constructor(scene: WorldScene, x: number, y: number) {
    super(scene, x, y, "hero_idle0");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    // 96x64 캔버스 (몸 중심 x=48, 발 y=64) 기준 히트박스
    this.body!.setSize(20, 44);
    this.body!.setOffset(38, 20);
    // 맵 밖으로 나가지 않도록 월드 경계 충돌 (러지/넉백/대시 전부 차단)
    (this.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    (this.body as Phaser.Physics.Arcade.Body).pushable = false;
    this.play(this.bodyKey("hero-idle"));
    /* v1.0.15 (피드백 #3) — 맵 이동 직전에 기록된 스킬 쿨타임 복원.
     *  scene.restart로 Player가 재생성돼도 남은 쿨타임이 이어진다 (1회성 — 복원 후 메모 비움). */
    const cdMemo = restoreCooldowns();
    this.skill1Cd = cdMemo.skill1 ?? 0;
    this.skill2Cd = cdMemo.skill2 ?? 0;
    this.skill3Cd = cdMemo.skill3 ?? 0;
    this.skill4Cd = cdMemo.skill4 ?? 0;
    this.skill5Cd = cdMemo.skill5 ?? 0;
    this.skill5bCd = cdMemo.skill5b ?? 0;
    this.potCd = cdMemo.pot ?? 0;
  }

  /** v1.0.15 (피드백 #3) — 맵 전환 직전 현재 남은 스킬/물약 쿨타임을 메모에 기록.
   *  WorldScene.gotoStage(유일한 맵 이동 통로)에서 호출된다. */
  memoSkillCooldowns() {
    memoCooldowns({
      skill1: this.skill1Cd,
      skill2: this.skill2Cd,
      skill3: this.skill3Cd,
      skill4: this.skill4Cd,
      skill5: this.skill5Cd,
      skill5b: this.skill5bCd,
      pot: this.potCd,
    });
  }

  /* ---------------- 메인 업데이트 ---------------- */

  update(dt: number, move: Phaser.Math.Vector2, attackPressed: boolean) {
    if (this.state === "dead") return;
    const ms = dt;

    this.atkCooldown = Math.max(0, this.atkCooldown - ms);
    this.skill1Cd = Math.max(0, this.skill1Cd - ms);
    this.skill2Cd = Math.max(0, this.skill2Cd - ms);
    this.skill3Cd = Math.max(0, this.skill3Cd - ms);
    this.skill4Cd = Math.max(0, this.skill4Cd - ms);
    this.skill5Cd = Math.max(0, this.skill5Cd - ms); // v3.2.0 — 5차 궁극기 쿨다운
    this.skill5bCd = Math.max(0, this.skill5bCd - ms); // vc146 (#2) — 제2궁극기 쿨다운
    this.iframes = Math.max(0, this.iframes - ms);
    this.potCd = Math.max(0, this.potCd - ms);
    this.tickBuffs(ms);
    this.tickDots(ms); // v3.0.3 — 출혈/독 도트 + 감속 만료
    // 자기버프 만료 정리
    const now = this.scene.time.now;
    if (this.selfAtkBuff && now >= this.selfAtkBuff.until) this.selfAtkBuff = null;
    if (this.selfDefBuff && now >= this.selfDefBuff.until) this.selfDefBuff = null;
    if (this.selfSpdBuff && now >= this.selfSpdBuff.until) { this.selfSpdBuff = null; this.recalcSpeed(); }

    // 마나 리젠
    this.mpRegenAcc += ms;
    if (this.mpRegenAcc >= 1000) {
      this.mp = Math.min(this.maxMp, this.mp + 5);
      this.mpRegenAcc -= 1000;
      this.scene.emitHud();
    }
    this.tickAutoUse(); // v3.0.6 — 자동 물약/자동 버프 (지시 #5)

    if (this.state === "dash") {
      this.dashTime -= ms;
      this.setVelocity(this.dashDir.x * this.dashSpeed, this.dashDir.y * this.dashSpeed);
      /* v3.0.11 — 돌진 중 주행 애니 (기존엔 애니 없이 마지막 프레임이 얼어붙은 채 미끄러짐) */
      {
        const horiz = Math.abs(this.dashDir.x) >= Math.abs(this.dashDir.y);
        const key = horiz ? this.bodyKey("hero-walk-side") : this.dashDir.y > 0 ? this.bodyKey("hero-walk") : this.bodyKey("hero-walk-up");
        if (horiz) this.setFlipX(this.dashDir.x > 0); // v3.0.10 — 시트 왼쪽 기준
        if (!this.anims.isPlaying || this.anims.currentAnim?.key !== key) this.play(key);
      }
      /* v4.9.0 — 돌진 잔상 (스킬 전용 셰이더 #1의 짝 — 유저 지시 #1 "돌진 잔상").
       *  현재 프레임 그대로의 고스트를 42ms 간격으로 흘려 궤적을 남긴다.
       *  계열별 색: 전사=은백 / 마법사=룬 청보라 / 도적=암흑보라 / 궁수=질풍 청록.
       *  적응형 축소 모드(fxLevel 0)에선 생략 — 기존 연출(먼지/바람꼬리 등)은 유지. */
      this.dashGhostAcc += ms;
      if (this.dashGhostAcc >= 42 && this.scene.fxLevel === 1) {
        this.dashGhostAcc = 0;
        this.scene.spawnDashGhost(
          this.x,
          this.y,
          this.texture.key,
          this.frame?.name,
          this.flipX,
          this.clsHex(),
          this.scaleX
        );
      }
      if (this.dashTime <= 0) {
        this.state = "idle";
        this.setVelocity(0, 0);
        /* v4.1.3 (#1차전사차별화) — 전사 계열 1차+ 돌진 종착 은백 충격 링 (지시 #9:
         *  "1차 전사는 기본캐릭이랑 달라지는 게 없다" — 미전직과 같은 회전베기+돌진 조합이라
         *  육안 구분이 안 됐다. 이제 전사는 돌진이 끝나며 강철 은백 참격 파동이 터진다.
         *  미전직은 파동 없음 — 코스메틱 전용이라 밸런스 영향 없음) */
        if (familyOf(this.cls) === "warrior") {
          const wx = this.x + this.dashDir.x * 26;
          const wy = this.y + this.dashDir.y * 26;
          const ring = this.scene.add.circle(wx, wy, 20)
            .setStrokeStyle(3, 0xd6e6ff, 0.85)
            .setDepth(12)
            .setBlendMode(Phaser.BlendModes.ADD);
          this.scene.tweens.add({ targets: ring, scale: 2.3, alpha: 0, duration: 320, ease: "Cubic.out", onComplete: () => ring.destroy() });
          this.scene.spawnBurstAt(wx, wy, 8, 0xd6e6ff);
        }
      }
      return;
    }

    // 공격 중 미세 러지 — 선형 감쇠로 "살짝" 전진 (총 이동 ~16px) — v2.2: 정지 상태 공격에서만
    if (this.state === "attack" && this.lungeTime > 0) {
      this.lungeTime -= ms;
      const k = Math.max(0, this.lungeTime / Player.LUNGE_MS);
      this.setVelocity(
        this.lungeDir.x * Player.LUNGE_SPEED * k,
        this.lungeDir.y * Player.LUNGE_SPEED * k
      );
      if (this.lungeTime <= 0) this.setVelocity(0, 0);
    }

    /* v3.0.6 (지시 — "화살이 바라보는 방향에 맞게 안나감") — 공격 입력을 이동 처리보다 먼저:
     *  기존엔 같은 프레임의 이동이 facing을 덮어쓴 뒤 공격이 처리되어
     *  화살/마법탄이 "이동 방향"으로 발사됐다 (조이스틱을 기울인 채 공격 탭 시 특히 심각).
     *  이제 탭 순간 바라보던 방향(facing) 그대로 발사된다. */
    if (attackPressed && this.atkCooldown <= 0 && this.state === "idle") {
      (this.lastMove as Phaser.Math.Vector2).copy(move);
      this.doAttack();
    }

    // 이동
    if (this.state === "idle") {
      if (move.lengthSq() > 0.01) {
        this.setVelocity(move.x * this.speed, move.y * this.speed);
        this.facing.copy(move).normalize();
        // 방향 우세 축 기준 실제 걷기 프레임 사용 (아래/위/측면)
        const horiz = Math.abs(move.x) >= Math.abs(move.y);
        const key = horiz ? this.bodyKey("hero-walk-side") : move.y > 0 ? this.bodyKey("hero-walk") : this.bodyKey("hero-walk-up");
        // v3.0.2 — idle에서 setTexture로 전환 후 currentAnim 키가 잔존해 같은 방향 재입력 시 play가 스킵되던 버그:
        // 재생 중이 아니면 항상 재시작 (정지→같은 방향 재입력 애니메이션 복구)
        if (!this.anims.isPlaying || this.anims.currentAnim?.key !== key) this.play(key);
        /* v3.0.10 픽스 — Mystic Woods 시트 기본이 "왼쪽" 향함 (기존 주석은 옛 시트 기준).
         *  이제 오른쪽 이동 시에만 뒤집는다 — 좌우 걷기 애니 반전 버그 수정 */
        if (horiz) this.setFlipX(move.x > 0);
      } else {
        this.setVelocity(0, 0);
        // 정지 시 마지막 바라본 방향 유지 (정면 idle로 튀는 문제 방지 — 사용자 피드백)
        const f = this.facing;
        let tex = this.bodyKey("hero_idle0"); // 기본: 정면 (아래쪽 바라볼 때/초기) — v1.1.0 외형 매핑
        if (Math.abs(f.x) >= Math.abs(f.y) && f.x !== 0) {
          this.setFlipX(f.x > 0); // v3.0.10 — 측면 시트는 왼쪽 기준
          tex = this.bodyKey("hero_walkside0");
        } else if (f.y < 0) {
          tex = this.bodyKey("hero_walkup0"); // 위쪽 — 뒷모습 서있기
        }
        if (this.anims.isPlaying) this.anims.stop();
        if (this.texture.key !== tex) this.setTexture(tex);
      }
    } else if (this.state === "attack" && this.lungeTime <= 0) {
      // v2.2 — 공격 중 이동: 입력 방향 우선(80% 속도), 러지가 입력을 덮어쓰지 않음 → 뚝 끊기는 감삭 제거
      // v3.0.6 (지시 — "화살이 바라보는 방향에 맞게 안나감"): 공격 중 facing 고정.
      //  기존은 이동 입력이 facing을 덮어써 조준 방향이 흔들리고 다음 발 화살이 엉뚱한 방향으로 나갔다.
      // v3.0.18 — 0.8→0.92: 공격 연타 중 이동이 크게 느려져 "걸리는" 체감 완화
      if (move.lengthSq() > 0.01) {
        this.setVelocity(move.x * this.speed * 0.92, move.y * this.speed * 0.92);
        // 스윙 판정(65ms) 이후엔 걷기 애니로 복귀 — 공격 포즈로 미끄러지는 얼음막기 감삭 제거
        if (this.swingDone) {
          const horiz = Math.abs(this.facing.x) >= Math.abs(this.facing.y);
          const key = horiz ? this.bodyKey("hero-walk-side") : this.facing.y > 0 ? this.bodyKey("hero-walk") : this.bodyKey("hero-walk-up");
          if (!this.anims.isPlaying || this.anims.currentAnim?.key !== key) this.play(key); // v3.0.2 — 동일 버그
          if (horiz) this.setFlipX(move.x > 0); // v1.0.12 — 회복 구간 걷기는 걷기 시트(좌향) 기준 — 공격 플립(우향)과 의미가 달라 직접 갱신
        }
      } else if (this.swingDone) {
        this.setVelocity(0, 0);
      }
    }

    // 마지막 이동 입력 기억 — doAttack에서 러지 여부 판단에 사용
    (this.lastMove as Phaser.Math.Vector2).copy(move);
  }

  /* ---------------- 기본 공격 ----------------
   * v2.5 (지시 #3) — 계열별 기본공격: 미전직 참격 / 전사 강화 참격(2연타) / 궁수 활쏘기 / 마법사 마법탄 */

  private doAttack() {
    this.state = "attack";
    this.atkCooldown = 300;
    this.swingDone = false;
    this.slashAlt = !this.slashAlt;
    this.hitSet.clear();
    this.netEmitAction("atk"); // v4.1.0 — 기본 공격 동기화

    // 살짝 돌진 — 정지 상태에서 공격할 때만 (이동 중엔 입력 방향 유지 — 스터터 제거 v2.2)
    const dir = this.aimDir();
    const moving = this.lastMove.lengthSq() > 0.01;
    if (!moving) {
      this.lungeDir.copy(dir);
      this.lungeTime = Player.LUNGE_MS;
      this.setVelocity(dir.x * Player.LUNGE_SPEED, dir.y * Player.LUNGE_SPEED);
    } else {
      this.lungeTime = 0;
      // 이동 관성 유지 — 다음 프레임의 공격 중 이동 분기가 입력 방향으로 이어받음
    }

    // 계열별 공격 분기 — 원거리 계열은 발사형(자유 조준 v3.0)
    const fam = familyOf(this.cls);
    if (fam === "ranger") return this.atkBow(this.aimDirFree());
    if (fam === "mage") return this.atkBolt(this.aimDirFree());
    /* v3.0.3 — 도적 표창: 기본공격 3회마다 단검 대신 표창 투척 (근/원거리 혼합 무기감) */
    if (fam === "thief") {
      this.atkCount++;
      // v3.0.6 — 표창 주기: 2차+ 2회마다 (전직 강화)
      if (this.atkCount % (this.tier >= 2 ? 2 : 3) === 0) return this.atkShuriken(dir);
    }
    this.atkSlash(dir);
  }

  /** v3.0.20 (#6) — 근접 직업별 검기 색 ("검기 색깔이 다 같아" — 직업 정체성 분리)
   *  미정의 키: 전사 계열 강철 은백, 그 외 원래 색(틴트 없음) */
  private meleeSlashTint(): number | undefined {
    const map: Partial<Record<ClassKey, number>> = {
      warrior: 0xd6e6ff,      // 전사 — 강철 은백
      berserker: 0xff5c4a,    // 버서커 — 광기의 혈색
      guardian: 0x7cb8ff,     // 가디언 — 수호 강철푸른
      warlord: 0xff9a3a,      // 워로드 — 전장의 활화
      paladin: 0xffe29a,      // 팔라딘 — 성스러운 금
      warbringer: 0xff3d2e,   // 워브링어 — 전쟁의 진홍
      crusader: 0xfff3c2,     // 크루세이더 — 심판의 성광
      thief: 0xc08aff,        // 도적 — 기존 보라 유지
      assassin: 0x8a5cff,     // 어세신 — 암살 심보라
      swashbuckler: 0x6ff2d8, // 스와시버클러 — 파도의 청록
      nightblade: 0x7a4aff,   // 나이트블레이드 — 야경 보라
      duelist: 0xff6ac8,      // 듀얼리스트 — 결투 로즈
      shadowlord: 0xa86aff,   // 섀도우로드 — 그림자 보라
      blademaster: 0xffaaff,  // 블레이드마스터 — 극검 살홍
    };
    return this.cls ? map[this.cls] : undefined;
  }

  /** v4.1.0 — 내 공격/스킬을 같은 구역 플레이어에게 브로드캐스트 (코스메틱 전용) */
  protected netEmitAction(kind: "atk" | "s1" | "s2" | "s3" | "s4" | "s5" | "s5b") {
    try {
      /* v1.0.14 — flip을 물리 방향(오른쪽=true)으로 정규화해 전송. 원격의
       *  fireRemoteProj/spawnBow는 걷기 컨벤션(오른쪽=true)으로 해석하므로
       *  공격 중 flipX를 그대로 보내면 화살이 항상 반대로 나갔다. */
      netAction({ kind, x: Math.round(this.x), y: Math.round(this.y), flip: this.netFacingFlip, cls: this.cls });
    } catch {
      /* 오프라인 — 무시 */
    }
  }

  /** 참격 (미전직 + 전사 공용 뼈대) — 전사는 2연타·확대 판정·강화 배율
   *  v3.0.6 (지시 #3 — 전직마다 기본공격 강화): 2차+ 3연타 / 3차+ 마지막 타 검기 파동 / 4차+ 대형 파동+출혈 */
  private atkSlash(dir: Phaser.Math.Vector2) {
    const fam = familyOf(this.cls);
    const warrior = fam === "warrior";
    const t = this.sTier;
    const empowered = this.nextAtkEmpowered; // v3.0.6 — 그림자 숨기 강화 소모
    this.nextAtkEmpowered = false;
    const dmgMul = (warrior ? 1.1 : 1.0) + 0.08 * t + (empowered ? 0.5 : 0); // v1.4.30 (#2) 사다리 0.05→0.08
    const reach = warrior ? 176 : 160; // 전사 — 전방 판정 확대
    const knock = warrior ? 320 : 280;

    // 실제 방향별 베기 프레임 (측면/위/아래 4프레임 스윙)
    const atkKey = dir.y > 0 ? this.bodyKey("hero-atk-down") : dir.y < 0 ? this.bodyKey("hero-atk-up") : this.bodyKey("hero-atk");
    this.setFlipX(dir.y === 0 && dir.x > 0); // v1.0.16 — 실측 재검증: 공격 시트도 좌향 네이티브(걷기와 동일) — 기존 우향 가정이 "공격 방향≠바라보는 방향"의 근원
    this.play(atkKey);
    // v3.0.2 — 도적(단검)은 참격 검기를 보라색으로 (무기 정체성)
    // v3.0.20 (#6) — 근접 직업 전원 검기 색 분리 (전원이 같은 색이었다)
    const slashTint = this.meleeSlashTint();

    // 베기 타이밍: 65ms 후 판정+참격 스윕 (모션 2프레임 시점)
    this.scene.time.delayedCall(65, () => {
      if (this.state !== "attack") return;
      this.swingDone = true;
      this.scene.spawnSlash(this.x, this.y, dir, this.slashAlt, warrior ? 1.15 : 1, slashTint);
      /* v3.0.24 — 도적(단검)=나이프음
       * v4.3.0 — 전사·미전직 기본공격음 = 회전베기음(카타나 연속 베기) 스왑 적용 (유저 지시:
       *  "전사 회전베기 소리를 기본공격 소리랑 바꿔") — 매번 피치 변주 유지 */
      if (fam === "thief") this.scene.sfxSkill("knife", 0.98 + Math.random() * 0.06);
      else this.scene.sfxSkill("spin", 0.92 + Math.random() * 0.1);
      // 참격 판정 확대 — 전방 160px x 폭 116px (사용자 지시: 히트박스 크게)
      this.checkMeleeHit(dir, reach, 116, dmgMul, knock);
    });

    /* v3.0.6 (지시 #3 — 전직마다 기본공격 강화) 티어 래더:
     *  미전직 1타 → 1차+ 2연타 → 2차+ 3연타 → 3차+ 마지막 타 검기 파동 → 4차 대형 파동 */
    if (t >= 1) {
      this.scene.time.delayedCall(195, () => {
        if (this.state !== "attack") return;
        this.scene.spawnSlash(this.x, this.y, dir, !this.slashAlt, 0.95, slashTint);
        this.scene.sfxSkill("spin", 1.02 + Math.random() * 0.08); // v4.3.0 — 연타 2타 (고피치 변주)
        this.checkMeleeHit(dir, reach, 116, dmgMul * 0.8, knock * 0.8);
      });
    }
    if (t >= 2) {
      this.scene.time.delayedCall(300, () => {
        if (this.state !== "attack") return;
        this.scene.spawnSlash(this.x, this.y, dir, this.slashAlt, 0.9, slashTint);
        this.scene.sfxSkill("spin", 1.1 + Math.random() * 0.08); // v4.3.0 — 연타 3타 (최고피치 변주)
        this.checkMeleeHit(dir, reach, 116, dmgMul * 0.7, knock * 0.6);
        if (t >= 3) {
          // 검기 파동 — 관통 투사체 (3차: 관통 3 / 4차: 대형+관통 5)
          const angle = Math.atan2(dir.y, dir.x);
          const { dmg, crit } = this.rollDamage(0.9 + 0.1 * t, true);
          this.scene.firePlayerProj({
            x: this.x, y: this.y - 8,
            angle, speed: 520, pierce: t >= 4 ? 5 : 3, dmg, crit,
            tint: slashTint ?? 0xffb08a, knock: 220,
            scale: t >= 4 ? 1.5 : 1.0,
            tex: "x3_shuriken", blend: t >= 4 ? "add" : "normal", rot: true,
          });
        }
      });
    }

    this.scene.time.delayedCall(t >= 2 ? 360 : t >= 1 ? 260 : 200, () => {
      if (this.state === "attack") {
        this.state = "idle";
        // v2.2 — 이동 입력이 없을 때만 정지 (입력 중이면 다음 프레임 걷기로 자연 연결)
        if (this.lastMove.lengthSq() > 0.01) return;
        this.setVelocity(0, 0);
      }
    });
  }

  /** 궁수 기본공격 — 활쏘기 (화살 1발, 관통 1)
   *  v3.0.2 — 발광 구슬 대신 실제 화살 투사체 + 활 당기기 비주얼 (무기 정체성)
   *  v3.0.15 (#4) — "N차마다 N개" 공식: 미전직·1차 1발 / 2차 2발 / 3차 3발 / 4차 4발
   *  v3.0.16 (#3/#4) — 데드아이 전용 초록 발광 화살 + 다중사격 재미 강화:
   *    부채꼴 확대(차수별 0.13~0.22rad) · 연사 간격 90→60ms · 발사 머즐 플래시 ·
   *    비행 잔상(트레일) · 3발+ 동시 타격감 카메라 마이크로 셰이크 */
  private atkBow(dir: Phaser.Math.Vector2) {
    const atkKey = dir.y > 0 ? this.bodyKey("hero-atk-down") : dir.y < 0 ? this.bodyKey("hero-atk-up") : this.bodyKey("hero-atk");
    this.setFlipX(dir.y === 0 && dir.x > 0); // v1.0.16 — 좌향 네이티브 통일 (faceAtk 주석 참고)
    this.play(atkKey);
    const angle0 = Math.atan2(dir.y, dir.x);
    this.scene.spawnBow(this.x + dir.x * 10, this.y - 8, angle0);

    const t = this.sTier;
    const empowered = this.nextAtkEmpowered;
    this.nextAtkEmpowered = false;
    const shots = Math.max(1, t); // v3.0.15 (#4): N차 = N발
    const pierce = 1 + (t >= 2 ? 1 : 0);
    const isDeadeye = this.cls === "deadeye";
    const isSkylord = this.cls === "skylord"; // v3.0.20 (#1) — 스카이로드 계열은 구름색(하늘색) 화살
    const arrowTex = isDeadeye ? "x2_arrow_green" : isSkylord ? "x2_arrow_sky" : "x2_arrow";
    const arrowTint = 0xffffff; // 텍스처 자체 색 사용 (초록 화살은 텍스처가 에메랄드)
    const trailHex = isDeadeye ? 0x53ff9a : isSkylord ? 0x9fd8ff : t >= 2 ? this.clsHex() : 0xffd98a; // 잔상색: 데드아이 초록발광 / 스카이로드 구름발광 / 2~3차 클래스색 / 그 외 골드
    const flashHex = isDeadeye ? 0x7dffb0 : isSkylord ? 0xc2ecff : t >= 2 ? this.clsHex() : 0xffe08a; // 머즐 플래시색
    const spread = 0.1 + 0.03 * t; // v3.0.16 — 부채꼴 확대 (1차 0.13°rad ~ 4차 0.22rad)
    /* v3.0.24 — 1차 궁수 화살 과강렬 완화 (유저: "1차 궁수 화살이 너무 강해보임")
     *  ① 크기 계층화: 1차 1.0 / 2차 1.15 / 3차 1.3 / 4차 1.5 (기존 전 차수 1.35+ 고정)
     *  ② 비행 잔상·머즐 플래시는 2차+ 부만 (1차는 투박한 일반 화살) */
    const arrowScale = t >= 4 ? 1.5 : t === 3 ? 1.3 : t === 2 ? 1.15 : 1.0;
    const showTrail = t >= 2 || isDeadeye || isSkylord; // 4차 정체성 화살(초록/구름)은 유지
    const showFlash = t >= 2 || isDeadeye || isSkylord;

    const fireOne = (i: number) => {
      const { dmg, crit } = this.rollDamage(0.95 + 0.07 * t + (i === 0 && empowered ? 0.5 : 0), i > 0); // v1.4.30 (#2) 0.04→0.07
      if (crit) this.scene.sfxCrit();
      this.scene.firePlayerProj({
        x: this.x, y: this.y - 8,
        angle: angle0 + (shots > 1 ? (i - (shots - 1) / 2) * spread : 0),
        speed: 620 + Math.floor(Math.random() * 40) - 15, // 미세 속도 편차 — 화살비 유기적 느낌
        pierce, dmg, crit,
        tint: arrowTint, knock: 180, scale: arrowScale, // v3.0.24 — 차수별 크기 계층 (1차 1.0)
        tex: arrowTex, blend: "normal", rot: true, // v3.0.16 — normal 블렌드: ADD는 밝은 배경에서 초록이 하얗게 씻김 (텍스처 자체가 에메랄드+발광 트레일)
        trail: showTrail ? trailHex : undefined, // v3.0.24 — 1차는 잔상 없음
      });
      if (showFlash) this.scene.spawnBurstAt(this.x + dir.x * 16, this.y - 8, 3, flashHex); // 머즐 플래시 (2차+ / 4차 정체성)
    };

    this.scene.time.delayedCall(65, () => {
      if (this.state !== "attack") return;
      this.swingDone = true;
      this.scene.sfxSkill("arrow", 0.96 + Math.random() * 0.08); // v3.0.24 — 활발사음 (검 스윙음 → 활음)
      for (let i = 0; i < shots; i++) {
        if (i > 0) {
          this.scene.time.delayedCall(i * 60, () => { // v3.0.16 — 90→60ms 연사 (다다다닥 타격감)
            if (this.state === "dead") return;
            fireOne(i);
          });
        } else {
          fireOne(0);
        }
      }
      if (shots >= 3) this.scene.cameras.main.shake(70, 0.0016); // 3발+ 동시 사격 임팩트
    });

    this.scene.time.delayedCall(200, () => {
      if (this.state === "attack") {
        this.state = "idle";
        if (this.lastMove.lengthSq() > 0.01) return;
        this.setVelocity(0, 0);
      }
    });
  }

  /** 마법사 기본공격 — 마법탄 (볼트 1발, 관통 2)
   *  v3.0.2 — 칼을 휘두르지 않고 시전 이펙트(마나 불꽃) + 마법 구슬 발사 (무기 정체성)
   *  v3.0.15 (#4) — "N차마다 N개" 공식 적용 (1차 1발 ~ 4차 4발) */
  private atkBolt(dir: Phaser.Math.Vector2) {
    const atkKey = dir.y > 0 ? this.bodyKey("hero-atk-down") : dir.y < 0 ? this.bodyKey("hero-atk-up") : this.bodyKey("hero-atk");
    this.setFlipX(dir.y === 0 && dir.x > 0); // v1.0.16 — 좌향 네이티브 통일
    this.play(atkKey);
    this.scene.spawnCast(this.x + dir.x * 12, this.y - 12);

    const t = this.sTier;
    const empowered = this.nextAtkEmpowered;
    this.nextAtkEmpowered = false;
    const shots = Math.max(1, t); // v3.0.15 (#4): N차 = N발

    this.scene.time.delayedCall(65, () => {
      if (this.state !== "attack") return;
      this.swingDone = true;
      this.scene.sfxSkill("cast", 0.98 + Math.random() * 0.06); // v3.0.24 — 마법사 지팡이 시전음 (검 스윙음 → 마법음)
      const angle = Math.atan2(dir.y, dir.x);
      for (let i = 0; i < shots; i++) {
        this.scene.time.delayedCall(i * 90, () => {
          if (this.state === "dead") return;
          const { dmg, crit } = this.rollDamage(1.0 + 0.07 * t + (i === 0 ? (empowered ? 0.5 : 0) : 0), true); // v1.4.30 (#2) 0.04→0.07
          this.scene.firePlayerProj({
            x: this.x, y: this.y - 10,
            angle: angle + (shots > 1 ? (i - (shots - 1) / 2) * 0.09 : 0),
            speed: 540, pierce: 2, dmg, crit,
            tint: this.cls === "eternal" ? 0xffdf6e : 0xffffff, knock: 200, scale: 0.85 + 0.1 * t, // v3.0.20 (#5) — 이터널 기본공격은 시간지기 노랑
            anim: "fx2-bolt", blend: "add", rot: true, // v3.0.12 — 방향성 텍스처: 비행 방향으로 회전 (v3.0.8 스킨 교체 시 누락됐던 것)
          });
        });
      }
      // v3.0.6 — 3차+ 유도뢰 1발 추가 (매직 볼트 유도뢰와 구분 — 소형·즉발)
      if (t >= 3) {
        this.scene.time.delayedCall(shots * 90 + 40, () => {
          if (this.state === "dead") return;
          const d2 = this.rollDamage(0.9, true);
          this.scene.firePlayerProj({
            x: this.x, y: this.y - 10,
            angle: angle + 0.14, speed: 600, pierce: 1, dmg: d2.dmg, crit: d2.crit,
            tint: this.cls === "eternal" ? 0xffc94a : 0xffffff, knock: 150, scale: 0.85, // v3.0.20 (#5) — 이터널 유도뢰도 노랑
            anim: "fx-darkbolt", blend: "normal", rot: true, // v3.0.12 — 다크볼트도 방향 회전
          });
        });
      }
    });

    this.scene.time.delayedCall(200, () => {
      if (this.state === "attack") {
        this.state = "idle";
        if (this.lastMove.lengthSq() > 0.01) return;
        this.setVelocity(0, 0);
      }
    });
  }

  /**
   * v3.0.3 — 도적 표창 투척 (기본공격 3회마다):
   *  단검 근접 스윕과 번갈아 나가는 원거리 투사체 — "단검과 표창을 안 쓰냐" 지시 반영.
   *  회전하는 표창(24x24 픽셀 아트)이 관통 1로 날아간다.
   */
  private atkShuriken(dir: Phaser.Math.Vector2) {
    const atkKey = dir.y > 0 ? this.bodyKey("hero-atk-down") : dir.y < 0 ? this.bodyKey("hero-atk-up") : this.bodyKey("hero-atk");
    this.setFlipX(dir.y === 0 && dir.x > 0); // v1.0.16 — 좌향 네이티브 통일
    this.play(atkKey);
    const t = this.sTier;
    const empowered = this.nextAtkEmpowered;
    this.nextAtkEmpowered = false;
    this.scene.time.delayedCall(65, () => {
      if (this.state !== "attack") return;
      this.swingDone = true;
      this.scene.sfxSkill("knife", 1.08 + Math.random() * 0.08); // v3.0.24 — 도적 표창 투척 (단검음 고자)
      const angle = Math.atan2(dir.y, dir.x);
      // v3.0.6 (지시 #3): 표창 발수 — 3차+ 2발 / 4차+ 3발 부채꼴
      const n = t >= 4 ? 3 : t >= 3 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const { dmg, crit } = this.rollDamage(1.05 + 0.08 * t + (i === 0 ? (empowered ? 0.5 : 0) : 0), true); // v1.4.30 (#2) 0.05→0.08
        this.scene.firePlayerProj({
          x: this.x, y: this.y - 8,
          angle: angle + (n > 1 ? (i - (n - 1) / 2) * 0.1 : 0),
          speed: 540, pierce: 1, dmg, crit,
          tint: 0xd8c8ff, knock: 160, scale: 0.95,
          tex: "x3_shuriken", blend: "normal", rot: true,
        });
      }
    });
    this.scene.time.delayedCall(200, () => {
      if (this.state === "attack") {
        this.state = "idle";
        if (this.lastMove.lengthSq() > 0.01) return;
        this.setVelocity(0, 0);
      }
    });
  }

  /** v1.0.16 — 픽셀 실측(hero_atk0~3 렌더) 결과 공격 시트도 좌향 네이티브로 확정:
   *  v1.0.12의 "우향 네이티브" 전제가 틀려 공격 내내 캐릭터가 조준 반대편을 봤고,
   *  화살은 정면으로 나가니 "스킬 방향↔화살 반대"로 보였던 것이 근원.
   *  이제 걷기와 동일 컨벤션(오른쪽 조준 시 flip) — 시트 전반이 좌향으로 통일.
   *  부수 효과: 공격 중 flipX == 걷기 flipX == 물리 방향(오른쪽=true) 단일 컨벤션. */
  private faceAtk(aim: Phaser.Math.Vector2) {
    if (Math.abs(aim.x) >= Math.abs(aim.y)) this.setFlipX(aim.x > 0);
  }

  /** v1.0.14 — 네트워크 flip 정규화: "지금 오른쪽을 보고 있는가?" (물리 방향)
   *  v1.0.16 — 전 시트 좌향 네이티브로 통일돼 공격/걷기 flipX가 동일 의미(오른쪽=true)가
   *  됐지만, 수직 조준 시 facing.x가 0이므로 마지막 flipX로 대체하는 폴백은 유지한다.
   *  이 값을 netState/netAction에 실으면 원격 클라가 정확한 물리 방향으로 재현한다. */
  get netFacingFlip(): boolean {
    return this.facing.x !== 0 ? this.facing.x > 0 : this.flipX;
  }

  /** 조준 방향: 마지막 이동 방향(4방향 스냅 — 근접 애니메이션은 4방향 시트 기준) */
  private aimDir(): Phaser.Math.Vector2 {
    const f = this.facing;
    if (Math.abs(f.x) >= Math.abs(f.y)) return new Phaser.Math.Vector2(f.x >= 0 ? 1 : -1, 0);
    return new Phaser.Math.Vector2(0, f.y >= 0 ? 1 : -1);
  }

  /** v3.0 (사용자 지시 #2) — 자유 조준: facing 그대로 정규화해 반환
   *  원거리 계열(마법사 볼트/궁수 화살)은 4방향 스냅 없이 8방향+대각선(아날로그) 조준 */
  private aimDirFree(): Phaser.Math.Vector2 {
    const f = this.facing;
    if (f.lengthSq() < 0.001) return new Phaser.Math.Vector2(1, 0);
    return f.clone().normalize();
  }

  /** 광역 근접 판정 — rect + 목표 크기 반영 (보스처럼 큰 적도 실제 몸통에 맞음) */
  checkMeleeHit(
    dir: Phaser.Math.Vector2,
    reach: number,
    width: number,
    dmgMul: number,
    knock: number
  ): number {
    const cx = this.x + dir.x * reach * 0.45;
    const cy = this.y + dir.y * reach * 0.45;
    const halfW = dir.x !== 0 ? reach / 2 : width / 2;
    const halfH = dir.x !== 0 ? width / 2 : reach / 2;
    let hits = 0;
    let anyCrit = false;
    for (const e of this.scene.getAllTargets()) {
      if (!e.active || this.hitSet.has(e)) continue;
      const tw = ((e as unknown as { hitW?: number }).hitW ?? 24) / 2;
      const th = ((e as unknown as { hitH?: number }).hitH ?? 24) / 2;
      const ex = e.x - cx;
      const ey = (e.y - cy) * 1.15; // 조금 관대하게
      if (Math.abs(ex) <= halfW + tw && Math.abs(ey) <= halfH + th) {
        this.hitSet.add(e);
        hits++;
        const { dmg, crit } = this.rollDamage(dmgMul);
        if (crit) {
          this.scene.sfxCrit();
          anyCrit = true;
        }
        e.takeDamage(dmg, dir, knock, crit);
        /* v1.3.0 (#에셋통합) — 명중 지점 참격 궤적 + Unity 근접 원음 (마지막 타격 지점 기준) */
        this.scene.spawnMeleeVfx(e.x, e.y, dir.x, dir.y, crit);
      }
    }
    if (hits > 0) {
      // 크리티컬이 섞인 타격은 crit 등급 — 히트스톱 연장 + 셰이크 강조 (타격감 대비)
      this.scene.onMeleeConnect(hits, anyCrit ? "crit" : "basic");
    }
    return hits;
  }

  /* ---------------- 스킬 (v1.8 — 계열별 전투 방식 차별화, 메이플 계열 정체성 참고) ----------------
   * v2.5 (지시 #3) — 전직 시 3슬롯 전부 교체: 기본공격까지 계열별 분기 + 티어(1/2/3차)별 강화 */

  /** 전직 티어 — 미전직 0 / 1차 1 / 2차 2 / 3차 3 (스킬 강화 배율용) */
  get tier(): number {
    return chainOf(this.cls).length;
  }

  /* v3.0.2 — 2차 이상 클래스별 라벨 테이블(SKILL_LABELS) 우선, 1차/미전직은 계열 기본값
   * v3.0.3 — 5슬롯 확장: [기본공격, Z, C, V(3차), B(4차)] */
  private tierLabels(): [string, string, string, string, string] | null {
    const d = classDef(this.cls);
    return d ? (SKILL_LABELS[d.key] ?? null) : null;
  }

  /** 기본공격 이름 — 계열별 (v3.3.0 — 5차 각성 시 "·극" 접미어) */
  get attackName(): string {
    const t = this.tierLabels();
    const base = (() => {
      if (t) return t[0];
      const fam = familyOf(this.cls);
      if (fam === "ranger") return "활쏘기";
      if (fam === "mage") return "마법탄";
      if (fam === "thief") return this.tier >= 1 ? "그림자 연타" : "단검 베기";
      if (fam === "warrior") return this.tier >= 1 ? "강화 참격" : "참격";
      return "참격";
    })();
    return this.isFifth ? `${base} ·극` : base;
  }

  /** 주력기(Z) 이름 — 계열별 (v3.3.0 — 5차 각성 시 "·극" 접미어) */
  get skill1Name(): string {
    const t = this.tierLabels();
    const base = (() => {
      if (t) return t[1];
      const fam = familyOf(this.cls);
      if (fam === "ranger") return "관통 화살";
      if (fam === "mage") return "매직 볼트";
      if (fam === "thief") return "그림자 회전베기";
      return "회전베기";
    })();
    return this.isFifth ? `${base} ·극` : base;
  }

  /** 기동기(C) 이름 — 계열별 (v3.3.0 — 5차 각성 시 "·극" 접미어) */
  get skill2Name(): string {
    const t = this.tierLabels();
    const base = (() => {
      if (t) return t[2];
      const fam = familyOf(this.cls);
      if (fam === "ranger") return "질풍 차지";
      if (fam === "mage") return "점멸";
      return "돌진베기";
    })();
    return this.isFifth ? `${base} ·극` : base;
  }

  /** v3.0.3 — 3차기(V) 이름 — 3차 클래스별 고유 스킬 (미해금 시 빈 문자열, 5차 각성 시 "·극") */
  get skill3Name(): string {
    if (!this.skill3Unlocked) return "";
    const t = this.tierLabels();
    const base = t?.[3] || "";
    return base ? (this.isFifth ? `${base} ·극` : base) : "";
  }

  /** v3.0.3 — 4차기(B) 이름 — 4차 클래스별 고유 스킬 (미해금 시 빈 문자열, 5차 각성 시 "·극") */
  get skill4Name(): string {
    if (!this.skill4Unlocked) return "";
    const t = this.tierLabels();
    const base = t?.[4] || "";
    return base ? (this.isFifth ? `${base} ·극` : base) : "";
  }

  /** v3.2.0 — 5차 궁극기 이름 — v3.3.0: 4차 세부직업 8종 전용 궁극기 → 계열 폴백 (미해금 시 빈 문자열) */
  get skill5Name(): string {
    if (!this.skill5Unlocked) return "";
    return SKILL5_INFO[resolveSkill5Of(this.cls)].name;
  }

  /** 주력기(Z) — v3.0.6: 클래스 고유 메커니즘 12종 (겹침 0 — 지시 #4)
   *  3차/4차는 계열 체인에서 2차기 승계(강화판) — resolveSkill1Of */
  /* v1.0.11 — N차마다 기존 스킬 강화 (유저 상시 지시): 주력기/기동기/3차기 시전 시
   *  GameStudio(Gameworks) 3D VFX를 전직 단계에 비례해 합성 — v1.0.13 재설계:
   *  모든 직업이 자기 계열색 마법진 시그니처 보유 / 2·3차는 절제판(알파·크기 축소) /
   *  4차 룬 마법진+크리티컬 플래시 풀 / 5차 폭발+화염 풀. 미전직·1차는 기존 연출 유지 */
  private tierFlair(major = false) {
    const t = this.sTier;
    if (t < 2) return;
    const fam = familyOf(this.cls) as FamKey;
    const aim = this.aimDir();
    /* v1.4.30 (#6 5차 공통 이펙트 축소) — major=true(중요 스킬: 4차기 B)만 전체 패키지,
     *  Z/C/V 주력기는 3차 수준 경량판만 — 5차 스킬마다 폭발+화염이 겹치던 과잉 연출 완화 */
    spawnTierFlair(this.scene, this.x, this.y, this.clsHex(), t, fam, aim.lengthSq() > 0.01 ? aim.angle() : 0, major);
  }

  /** v1.0.11 — 튜토리얼 알림 (월드 튜토리얼 컨트롤러에 이벤트 전달 — 스킬/물약 학습 판정) */
  tutNotify(ev: string) {
    const w = this.scene as unknown as { tut?: { notify: (e: string) => void } | null };
    w.tut?.notify(ev);
  }

  useSkill1() {
    if (this.state !== "idle" || this.skill1Cd > 0 || this.mp < 15) return;
    this.mp -= 15;
    this.skill1Cd = this.skill1MaxEff;
    this.state = "attack";
    this.hitSet.clear();
    this.setVelocity(0, 0);
    this.netEmitAction("s1"); // v4.1.0
    this.tutNotify("skill"); // v1.0.11 — 튜토리얼 스킬 학습 판정
    this.tierFlair(); // v1.0.11 — N차 기존 스킬 강화 (전직 단계 비례 3D VFX)
    const kind = resolveSkill1Of(this.cls) ?? "spin";
    /* v3.0.11 — 3차/4차 주력기 진화감: 상위직은 클래스색 오라 링이 터지며 시전
     *  (2차기 승계라 이름만 바뀌어 보이던 문제를 시각적으로도 "강화판"임을 드러냄) */
    if (this.tier >= 3) {
      const aura = this.scene.add.circle(this.x, this.y, 30)
        .setStrokeStyle(2, this.clsHex(), 0.7)
        .setDepth(12)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: aura, scale: 1.9, alpha: 0, duration: 400, ease: "Cubic.out", onComplete: () => aura.destroy() });
    }
    switch (kind) {
      case "volley": return this.skill1Arrows();
      case "bolt": return this.skill1Bolt();
      case "bladestorm": return this.skill1BladeStorm();
      case "ragespin": return this.skill1Spin(true);
      case "wallsmash": return this.skill1WallSmash();
      case "snipe": return this.skill1Snipe();
      case "gustarrow": return this.skill1GustArrow();
      case "arcbolt": return this.skill1ArcBolt();
      case "purify": return this.skill1Purify();
      case "shadowexec": return this.skill1ShadowExec();
      case "flurrydance": return this.skill1FlurryDance();
      default: return this.skill1Spin(false);
    }
  }

  /** 전사 — 회전베기 360° (v3.0.4 — 전직마다 기존 스킬 강화: 배율/반경 대폭 상향 + 단계별 부가효과)
   *  2차+ 잔상 강화 / 3차+ 이중 회전+적 끌어당김 / 4차+ 지면 균열+출혈 추가타
   *  v3.0.6 — bleed=true는 버서커 "파괴의 회전베기"(ragespin)
   *  v3.0.11 — 버서커 분기 완전 분리: 붉은 분노 오라 3겹 + 전방 러지 회전 + 이중 참격판
   *  (기존엔 전사 원판과 동일 비주얼이라 "이름만 바뀐다"는 피드백을 받은 대표 사례) */
  private skill1Spin(bleed = false) {
    const t = this.sTier; // 0(미전직)~4
    /* v4.1.3 (#1차전사차별화) — 1차(t=1) 전사 대미지 보정 +0.25 (1.9→2.15, 미전직 1.6 대비 +34%).
     *  지시 #9 "1차 전사가 기본캐릭이랑 같아 보인다" — 수치 체감 + 전용 연출(하단)으로 분리.
     *  2차+(t>=2)는 기존 곡선 유지. bleed(버서커 판)도 영향 없음 */
    const dmgMul = 1.6 + 0.42 * t + (t === 1 ? 0.25 : 0); // v1.4.30 (#2) 사다리 0.3→0.42 — 5차 회전베기 3.7배
    const radius = 118 + 16 * t;
    /* v4.3.0 — 직업별 사운드: 전사 회전베기=대검 참격음(bigsword) — 기본공격음과 스왑 (유저 지시)
     *  버서커(bleed)=bigsword 저피치 유지 */
    if (bleed) this.scene.sfxSkill("bigsword", 0.85);
    else this.scene.sfxSkill("bigsword", 0.9 + Math.random() * 0.1);

    // 회전 방향: 조준 측면 기준 (상하 조준 시 현재 플립 방향 따름)
    const aim = this.aimDir();
    /* v3.0.10 — flip 의미 반전(시트 왼쪽 기준)에 맞춰 회전 방향 부호도 반전 */
    const spin = aim.x !== 0 ? (aim.x > 0 ? 1 : -1) : this.flipX ? 1 : -1;
    const famHex = familyOf(this.cls) === "thief" ? 0xb98aff : 0xff9a8a;

    if (bleed) {
      /* ═══ 버서커 — 파괴의 회전베기 (전사 원판과 완전 별개 연출) ═══
       *  광전사 정체성: 서서 돌지 않고 전방으로 박면서 돈다. 붉은 광기가 몸을 감쌈. */
      const dir = aim.lengthSq() > 0.01 ? aim.clone().normalize() : new Phaser.Math.Vector2(this.flipX ? 1 : -1, 0); // v1.0.16 — flipX는 물리 방향(오른쪽=true) 단일 컨벤션
      this.scene.spawnSpinSlash(this.x, this.y, spin);
      this.scene.spawnSpinSlash(this.x + dir.x * 52, this.y + dir.y * 52, -spin); // 전방 이중 참격판
      /* v4.9.0 — 회전베기 참격 궤적 셰이더: 붉은 광기 2궤적 (이중 참격판 대응, 시작각 엇갈림) */
      this.scene.spawnSlashArc(this.x, this.y, spin, 0xff5c3c, radius / 46, 300, 0.95);
      this.scene.spawnSlashArc(this.x + dir.x * 52, this.y + dir.y * 52, -spin, 0xff8a5c, (radius * 0.85) / 46, 280, 0.8, spin > 0 ? 2.2 : -2.2);
      this.scene.spawnBurstAt(this.x, this.y, 16, 0xff3c1c);
      // 분노 오라 — 붉은 링 3겹이 터져나감
      for (let i = 0; i < 3; i++) {
        const ring = this.scene.add.circle(this.x, this.y, 26 + i * 13)
          .setStrokeStyle(2, 0xff5c3c, 0.55)
          .setDepth(12)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({ targets: ring, scale: 1.7, alpha: 0, duration: 480 + i * 110, ease: "Cubic.out", onComplete: () => ring.destroy() });
      }
      // 전방 러지 — 박고 나서 멈춤 (공격에 공격을 더한다)
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(dir.x * 500, dir.y * 500);
      this.scene.time.delayedCall(240, () => {
        if (this.state !== "dead") body.setVelocity(0, 0);
      });
      this.scene.spawnPickupText(this.x, this.y - 44, "파괴의 광기!", "#ff5c3c");
      this.scene.cameras.main.shake(90, 0.004);
    } else {
      // 전사 원판 — 360° 궤도 반달 + 충격파 + 스파크 — 티어 2 이상에서 충격 링 추가
      this.scene.spawnSpinSlash(this.x, this.y, spin);
      /* v4.9.0 — 회전베기 참격 궤적 셰이더: 스킬 반경에 맞춘 광륜 스윕 (전사=은백, 그 외=계열색) */
      const warr0 = familyOf(this.cls) === "warrior";
      this.scene.spawnSlashArc(
        this.x,
        this.y,
        spin,
        warr0 && t >= 1 ? 0xd6e6ff : famHex,
        radius / 46,
        290 + t * 15,
        0.88
      );
      /* v4.1.3 (#1차전사차별화) — 전사는 1차(t=1)부터 은백 버스트+충격 링 (기존 t>=2만).
       *  미전직엔 없는 전용 연출 — 1차 전직의 "같아 보임" 해소 (지시 #9).
       *  t>=2 연출/색(famHex)은 기존 그대로 유지 */
      const warr = familyOf(this.cls) === "warrior";
      if (t >= 2 || (warr && t >= 1)) {
        this.scene.spawnBurstAt(this.x, this.y, 10 + 3 * t + (warr && t === 1 ? 4 : 0), warr && t === 1 ? 0xd6e6ff : famHex);
        if (warr && t === 1) {
          const ring = this.scene.add.circle(this.x, this.y, 24)
            .setStrokeStyle(3, 0xd6e6ff, 0.8)
            .setDepth(12)
            .setBlendMode(Phaser.BlendModes.ADD);
          this.scene.tweens.add({ targets: ring, scale: 2.1, alpha: 0, duration: 380, ease: "Cubic.out", onComplete: () => ring.destroy() });
        }
      }
      if (t >= 3) {
        this.scene.spawnSpinSlash(this.x, this.y, -spin); // 이중 회전 잔상 (3차 강화)
        /* v4.9.0 — 역방향 참격 궤적 (이중 회전 잔상과 동기화) */
        this.scene.spawnSlashArc(this.x, this.y, -spin, warr0 ? 0xd6e6ff : famHex, (radius * 0.86) / 46, 260, 0.7, spin > 0 ? 2.6 : -2.6);
      }
    }

    // 몸통(스프라이트) 360° 회전 — 검 뻗은 공격 프레임을 돌려 휘두르는 동작
    this.faceAtk(aim); // v1.0.12 — 공격 시트 우향 네이티브 정면화
    this.play(this.bodyKey("hero-atk"));
    this.scene.tweens.add({
      targets: this,
      rotation: spin * Math.PI * 2,
      duration: 250,
      ease: "Cubic.inOut",
      onComplete: () => this.setRotation(0),
    });

    // v3.0.4 — 3차+: 주변 적을 몸쪽으로 끌어당김 (회전베기 명중률 향상)
    if (t >= 3) {
      this.scene.time.delayedCall(60, () => {
        if (this.state === "dead") return;
        const wb = this.scene.physics.world.bounds;
        for (const e of this.scene.getAllTargets()) {
          if (!e.active) continue;
          const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
          if (d <= radius * 1.35 && d > 34) {
            const nx = Phaser.Math.Clamp(e.x + (this.x - e.x) * 0.42, 60, wb.width - 60);
            const ny = Phaser.Math.Clamp(e.y + (this.y - e.y) * 0.42, 60, wb.height - 60);
            (e as unknown as { body?: Phaser.Physics.Arcade.Body }).body?.reset?.(nx, ny);
          }
        }
        this.scene.spawnBurstAt(this.x, this.y, 8, famHex);
      });
    }

    this.scene.time.delayedCall(90, () => {
      // 360° 전체 판정
      for (const e of this.scene.getAllTargets()) {
        if (!e.active || this.hitSet.has(e)) continue;
        const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
        if (d <= radius) {
          this.hitSet.add(e);
          const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
          const { dmg, crit } = this.rollDamage(dmgMul, true);
          if (crit) this.scene.sfxCrit();
          e.takeDamage(dmg, away, 300, crit);
          // v3.0.6 — ragespin(버서커): 명중 대상 출혈 추가타 2회 (전사 회전베기와 메커니즘 분리)
          if (bleed || t >= 4) {
            const eb = e;
            for (const dl of [220, 440]) {
              this.scene.time.delayedCall(dl, () => {
                if (!eb.active || this.state === "dead") return;
                const { dmg: d2 } = this.rollDamage(0.35, true);
                eb.takeDamage(d2, new Phaser.Math.Vector2(0, 0.1).normalize(), 60, false);
                this.scene.spawnBurstAt(eb.x, eb.y, 3, 0xff4d4d);
              });
            }
          }
        }
      }
      this.scene.onMeleeConnect(1, "skill");
    });
    if (t >= 4) this.scene.spawnCrack?.(this.x, this.y);
    this.scene.time.delayedCall(310, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  /** 궁수 — 관통 화살 다연발 (부채꼴, v3.0.4 — 전직마다 강화: 관통/발수/잔상 티어별 증가)
   *  2차+ 클래스색 화살 / 3차+ 2차 연사 추가 / 4차+ 발광 화살+대폭 관통
   *  v3.0.16 (#4) — 부채꼴 확대(0.09→0.125) + 비행 잔상 트레일 + 넉백 상향(220→250) + 머즐 플래시 */
  private skill1Arrows() {
    const aim = this.aimDirFree(); // v3.0.1 — 8방향 자유 조준 (자동사냥 명중률 + 대각선 일관)
    const base = Math.atan2(aim.y, aim.x);
    const t = this.sTier;
    const hex = this.clsHex();
    this.faceAtk(aim); // v1.0.12 — 공격 시트 우향 네이티브 정면화
    this.play(this.bodyKey("hero-atk"));
    this.scene.sfxSkill("arrow", 0.92); // v3.0.24 — 궁수 활발사 (회전베기음 → 활음 교체)
    const count = 3 + t;
    const fireVolley = (n: number, spread: number, dmgMul: number, delay0: number) => {
      for (let i = 0; i < n; i++) {
        this.scene.time.delayedCall(delay0 + i * 100, () => {
          if (this.state === "dead") return;
          const { dmg, crit } = this.rollDamage(dmgMul, true);
          if (crit) this.scene.sfxCrit();
          this.scene.firePlayerProj({
            x: this.x, y: this.y - 8,
            angle: base + (i - (n - 1) / 2) * spread,
            speed: 580, pierce: 2 + t, dmg, crit,
            tint: t >= 2 ? hex : 0xffffff, knock: 250, scale: 1.0 + 0.08 * t,
            tex: this.cls === "skylord" ? "x2_arrow_sky" : "x2_arrow", blend: t >= 4 ? "add" : "normal", rot: true, // v3.0.20 (#1) — 스카이로드 일제사격도 구름색 화살
            trail: t >= 2 ? hex : 0xffd98a, // v3.0.16 — 잔상
          });
          this.scene.spawnBurstAt(this.x + aim.x * 16, this.y - 8, 2, t >= 2 ? hex : 0xffe08a);
        });
      }
    };
    fireVolley(count, 0.125, 1.2, 0);
    // v3.0.4 — 3차+: 2차 연사 추가 (기존 스킬 강화)
    if (t >= 3) fireVolley(count, 0.075, 1.0, count * 100 + 40);
    if (t >= 3) this.scene.cameras.main.shake(80, 0.0016); // 연사 볼레이 임팩트
    this.scene.time.delayedCall(count * 100 + (t >= 3 ? count * 100 + 60 : 0) + 260, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  /** 마법사 — 매직 볼트 (느리지만 대폭 관통·고배율, v3.0.4 — 전직마다 강화: 배율/크기/유도뢰 증가) */
  private skill1Bolt() {
    const aim = this.aimDirFree(); // v3.0 — 8방향 자유 조준
    const angle = Math.atan2(aim.y, aim.x);
    this.faceAtk(aim); // v1.0.12 — 공격 시트 우향 네이티브 정면화
    this.play(this.bodyKey("hero-atk"));
    this.scene.sfxSkill("flame"); // v3.0.24 — 마법사 대관통 볼트 (화염 시전음)
    this.scene.spawnCast(this.x + aim.x * 14, this.y - 12 + aim.y * 8); // v3.0.2 — 시전 이펙트
    const t = this.sTier;
    if (t >= 4) this.scene.spawnPillar(this.x + aim.x * 14, this.y - 12 + aim.y * 8, 0xa5b9ff, 90); // 4차 강화 시전 이펙트
    const { dmg, crit } = this.rollDamage(2.0 + 0.5 * t, true); // v1.4.30 (#2) 사다리 0.35→0.5
    if (crit) this.scene.sfxCrit();
    this.scene.firePlayerProj({
      x: this.x, y: this.y - 10,
      angle, speed: 430, pierce: 5 + 2 * t, dmg, crit,
      tint: 0xffffff, knock: 260, scale: 1.3 + 0.14 * t,
      anim: "fx-arcane", blend: "normal", rot: true, // v3.0.2 — 아케인 볼트 6프레임 · v3.0.12 방향 회전
    });
    // 티어 3 — 볼트 후속 유도뢰 2발 (4차는 3발) 추가 (스톰브링어/크로니컬 강화)
    if (t >= 3) {
      const mines = t >= 4 ? 3 : 2;
      for (let i = 0; i < mines; i++) {
        this.scene.time.delayedCall(140 + i * 110, () => {
          if (this.state === "dead") return;
          const d2 = this.rollDamage(1.0, true);
          this.scene.firePlayerProj({
            x: this.x, y: this.y - 10,
            angle: angle + (i - (mines - 1) / 2) * 0.22, speed: 520, pierce: 2, dmg: d2.dmg, crit: d2.crit,
            tint: 0xffffff, knock: 180, scale: 0.95,
            anim: "fx-darkbolt", blend: "normal", rot: true, // v3.0.2 — 유도뢰는 다크 볼트로 구분 · v3.0.12 방향 회전
          });
        });
      }
    }
    this.scene.time.delayedCall(300, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  /* ================= v3.0.6 — 클래스 고유 주력기(Z) 신규 9종 (겹침 0 — 지시 #4) ================= */

  /** 도적 — 칼날 폭풍: 전방 부채꼴 단검 다연발 투척 (전사 회전베기와 완전 분리)
   *  3차+ 발수 증가 / 4차+ 명중 출혈 */
  private skill1BladeStorm() {
    const aim = this.aimDirFree();
    const base = Math.atan2(aim.y, aim.x);
    const t = this.sTier;
    const count = 5 + (t >= 3 ? 2 : 0);
    const spread = 0.62; // 부채꼴 전체 각 (rad)
    this.faceAtk(aim); // v1.0.12 — 공격 시트 우향 네이티브 정면화
    this.play(this.bodyKey("hero-atk"));
    this.scene.sfxSkill("knife", 1.05); // v3.0.24 — 도적 단검 다연발
    for (let i = 0; i < count; i++) {
      this.scene.time.delayedCall(60 + i * 55, () => {
        if (this.state === "dead") return;
        const { dmg, crit } = this.rollDamage(0.9 + 0.08 * t, true);
        if (crit) this.scene.sfxCrit();
        this.scene.firePlayerProj({
          x: this.x, y: this.y - 8,
          angle: base + (i - (count - 1) / 2) * (spread / Math.max(1, count - 1)),
          speed: 560, pierce: 1, dmg, crit,
          tint: 0xd8c8ff, knock: 140, scale: 0.85,
          tex: "x3_shuriken", blend: t >= 4 ? "add" : "normal", rot: true,
        });
        // 4차+ — 명중 대상 출혈은 투사체 판정 후 scene 측 추가타로 처리하기 어려워 즉발 부채꼴 근접 판정 병행
        if (t >= 4) this.checkMeleeHit(new Phaser.Math.Vector2(Math.cos(base), Math.sin(base)), 150, 140, 0.35, 60);
      });
    }
    this.scene.time.delayedCall(60 + count * 55 + 200, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  /** 가디언 — 성벽 강타: 전방 대형 참격 + 전방 지진파 + 자신 방어 버프 (회전베기와 완전 분리)
   *  3차+ 2연격 / 4차+ 방어 버프 강화 */
  private skill1WallSmash() {
    const dir = this.aimDir();
    const t = this.sTier;
    const hex = this.clsHex();
    const atkKey = dir.y > 0 ? this.bodyKey("hero-atk-down") : dir.y < 0 ? this.bodyKey("hero-atk-up") : this.bodyKey("hero-atk");
    this.play(atkKey);
    this.setFlipX(dir.y === 0 && dir.x > 0); // v1.0.16 — 좌향 네이티브 통일
    this.scene.sfxSkill("quake"); // v3.0.24 — 가디언 성벽 강타 (지진음)
    this.scene.spawnSlash(this.x, this.y, dir, this.slashAlt, 1.5, hex);
    // 방어 버프 — 성벽 정체성 (전장의 함성 공격 버프와 별개 축)
    /* v1.4.30 (#2) — 지속시간도 n차에 비례해 길어진다 (5s + 0.5s×t) */
    this.selfDefBuff = { add: 8 + 2 * t, until: this.scene.time.now + 5000 + 500 * t };
    const smash = (delay: number, mul: number) => {
      this.scene.time.delayedCall(delay, () => {
        if (this.state === "dead") return;
        this.checkMeleeHit(dir, 200 + 8 * t, 150, mul, 380);
        // 전방 지진파 — 참격 지점 폭발
        const px = this.x + dir.x * 120;
        const py = this.y + dir.y * 120;
        this.scene.spawnBurstAt(px, py, 12 + 2 * t, hex);
        if (t >= 3) this.scene.spawnCrack?.(px, py);
        for (const e of this.scene.getAllTargets()) {
          if (!e.active || this.hitSet.has(e)) continue;
          const d = Phaser.Math.Distance.Between(px, py, e.x, e.y);
          if (d <= 104 + 8 * t) {
            this.hitSet.add(e);
            const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
            const { dmg, crit } = this.rollDamage(1.0 + 0.1 * t, true);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 320, crit);
          }
        }
        this.scene.onMeleeConnect(1, "skill");
      });
    };
    smash(90, 2.2 + 0.15 * t);
    if (t >= 3) smash(260, 1.3);
    this.scene.cameras.main.shake(110, 0.006);
    this.scene.time.delayedCall(t >= 3 ? 460 : 300, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  /** 스나이퍼 — 매의 관통 화살: 즉발 히트스캔 저격 라인 (무한 관통 — 투사체 없음, 궁수 기본 화살과 분리)
   *  3차+ 데미지 상승 / 4차+ 라인 폭 2배 (2렬 판정) */
  private skill1Snipe() {
    const aim = this.aimDirFree();
    const base = Math.atan2(aim.y, aim.x);
    const t = this.sTier;
    const range = 560 + 40 * t;
    const halfW = t >= 4 ? 46 : 26;
    this.faceAtk(aim); // v1.0.12 — 공격 시트 우향 네이티브 정면화
    this.play(this.bodyKey("hero-atk"));
    this.scene.sfxSkill("arrowpierce"); // v3.0.24 — 스나이퍼 관통 저격음 (샤프 관통 화살)
    // 저격 라인 이펙트 — px 직선 (spawnSlash 대신 씬 그래픽 풀 활용: 라인 + 머즐 플래시)
    const ex = this.x + Math.cos(base) * range;
    const ey = this.y - 8 + Math.sin(base) * range;
    this.scene.spawnSnipeBeam(this.x, this.y - 8, ex, ey, this.clsHex());
    this.scene.spawnBurstAt(this.x + aim.x * 26, this.y - 8 + aim.y * 26, 6, 0xffffff);
    const sx = this.x + aim.x * 18;
    const sy = this.y - 8 + aim.y * 18;
    const fx = Math.cos(base);
    const fy = Math.sin(base);
    const dirv = new Phaser.Math.Vector2(fx, fy);
    let hits = 0;
    for (const e of this.scene.getAllTargets()) {
      if (!e.active) continue;
      // 점-선분 거리 판정 (시점→종점 라인, 폭 halfW)
      const rel = new Phaser.Math.Vector2(e.x - sx, e.y - sy);
      const proj = Phaser.Math.Clamp(rel.dot(dirv), 0, range);
      const closest = dirv.clone().scale(proj);
      const perp = rel.clone().subtract(closest);
      if (perp.length() <= halfW + 18) {
        hits++;
        const { dmg, crit } = this.rollDamage(2.4 + 0.4 * t, true); // v1.4.30 (#2) 사다리 0.25→0.4
        if (crit) this.scene.sfxCrit();
        e.takeDamage(dmg, dirv, 260, crit);
      }
    }
    if (hits > 0) this.scene.onMeleeConnect(hits, "crit");
    this.scene.time.delayedCall(240, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  /** 윈드러너 — 회오리 화살: 적을 끌어당기는 회오리 투사체 (스나이퍼 저격과 완전 분리)
   *  3차+ 2발 / 4차+ 끌어당김 강화 */
  private skill1GustArrow() {
    const aim = this.aimDirFree();
    const base = Math.atan2(aim.y, aim.x);
    const t = this.sTier;
    const hex = this.clsHex();
    this.faceAtk(aim); // v1.0.12 — 공격 시트 우향 네이티브 정면화
    this.play(this.bodyKey("hero-atk"));
    this.scene.sfxSkill("wind"); // v3.0.24 — 윈드러너 회오리 화살 (바람음)
    const shots = t >= 3 ? 2 : 1;
    for (let i = 0; i < shots; i++) {
      this.scene.time.delayedCall(i * 150, () => {
        if (this.state === "dead") return;
        const { dmg, crit } = this.rollDamage(1.5 + 0.15 * t, true);
        this.scene.fireGustTornado({
          x: this.x, y: this.y - 8,
          angle: base + (i - (shots - 1) / 2) * 0.3,
          speed: 300, dmg, crit, hex, pull: t >= 4 ? 0.5 : 0.34,
          radius: 120 + 10 * t, life: 1500,
        });
      });
    }
    this.scene.time.delayedCall(500, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  /** 아크메이지 — 아크 볼트: 착탄 광역 폭발 대형 볼트 (매직 볼트와 분리 — 첫 명중 지점에서 폭발)
   *  3차+ 폭발 반경↑ / 4차+ 2차 폭발 */
  private skill1ArcBolt() {
    const aim = this.aimDirFree();
    const angle = Math.atan2(aim.y, aim.x);
    const t = this.sTier;
    const hex = this.clsHex();
    this.faceAtk(aim); // v1.0.12 — 공격 시트 우향 네이티브 정면화
    this.play(this.bodyKey("hero-atk"));
    this.scene.sfxSkill("electron"); // v3.0.24 — 아크메이지 아크 볼트 (전자음)
    this.scene.spawnCast(this.x + aim.x * 14, this.y - 12 + aim.y * 8);
    const { dmg, crit } = this.rollDamage(2.4 + 0.45 * t, true); // v1.4.30 (#2) 사다리 0.3→0.45
    this.scene.fireExplodingBolt({
      x: this.x, y: this.y - 10, angle, speed: 440,
      dmg, crit, pierce: 2 + t, hex,
      blastRadius: 130 + 14 * t, blastMul: 1.1 + 0.08 * t,
      secondary: t >= 4, scale: 1.5,
    });
    this.scene.time.delayedCall(320, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  /** 세이지 — 정화의 파동: 확산 파동 링, 타격당 자힐 (볼트 계열과 분리 — 현자 히일 정체성)
   *  3차+ 파동 2연속 / 4차+ 힐량 증가 */
  private skill1Purify() {
    const t = this.sTier;
    const hex = this.clsHex();
    this.faceAtk(this.aimDir()); // v1.0.12 — 공격 시트 우향 네이티브 정면화
    this.play(this.bodyKey("hero-atk"));
    this.scene.sfxSkill("cure"); // v3.0.24 — 세이지 정화의 파동 (성스러운 회복음)
    const wave = (delay: number) => {
      this.scene.time.delayedCall(delay, () => {
        if (this.state === "dead") return;
        const radius = 150 + 18 * t;
        this.scene.spawnPurifyRing(this.x, this.y, radius, hex);
        let hits = 0;
        for (const e of this.scene.getAllTargets()) {
          if (!e.active || this.hitSet.has(e)) continue;
          const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
          if (d <= radius) {
            this.hitSet.add(e);
            hits++;
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = this.rollDamage(1.5 + 0.12 * t, true);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 200, crit);
          }
        }
        // 타격당 자힐 — 현자 계열 정체성
        // v3.0.7 — 힐러 정체성 강화: 자힐 상향(8+4t) + MP 회복(+4+2t) + 반경 내 원격 아군 치유 파동
        if (hits > 0) {
          const heal = (8 + 4 * t) * hits;
          this.hp = Math.min(this.maxHp, this.hp + heal);
          this.mp = Math.min(this.maxMp, this.mp + 4 + 2 * t);
          this.scene.spawnPickupText(this.x, this.y - 40, `+${heal} HP`, "#7dffa8");
          if (t >= 2) this.scene.spawnHealFx(this.x, this.y, 0x7dffa8);
          this.scene.onMeleeConnect(hits, "skill");
        }
        // v3.0.7 — 순수 힐러 지원: 파동이 닿는 아군(멀티 동접자)에게 치유 파동 연출
        this.scene.healRemotesPulse(this.x, this.y, radius, 8 + 4 * t);
      });
    };
    wave(80);
    if (t >= 3) wave(330);
    this.scene.time.delayedCall(t >= 3 ? 560 : 320, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  /** 어세신 — 그림자 참수: 최근접 적에게 즉시 점멸 + 출혈 강타 (회전베기/돌진과 완전 분리)
   *  3차+ 2대 연속 참수 / 4차+ 강타 배율 증가 */
  private skill1ShadowExec() {
    const t = this.sTier;
    const hex = this.clsHex();
    this.faceAtk(this.aimDir()); // v1.0.12 — 공격 시트 우향 네이티브 정면화
    this.play(this.bodyKey("hero-atk"));
    this.scene.sfxSkill("iainuki"); // v3.0.24 — 어세신 그림자 참수 (발도음)
    const targets = this.nearestTargets(t >= 3 ? 2 : 1, 260);
    if (targets.length === 0) {
      // 대상 없음 — 전방 참격으로 대체
      const dir = this.aimDir();
      this.scene.spawnSlash(this.x, this.y, dir, this.slashAlt, 1.1, hex);
      this.scene.time.delayedCall(65, () => this.state === "attack" && this.checkMeleeHit(dir, 170, 120, 2.0, 300));
      this.scene.time.delayedCall(260, () => {
        if (this.state === "attack") this.state = "idle";
      });
      return;
    }
    let lastDir = this.aimDir();
    targets.forEach((e, i) => {
      this.scene.time.delayedCall(70 + i * 240, () => {
        if (this.state === "dead" || !e.active) return;
        // 점멸 — 대상 바로 앞
        const wb = this.scene.physics.world.bounds;
        const dirTo = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y);
        lastDir = dirTo.lengthSq() > 0.001 ? dirTo.clone().normalize() : lastDir;
        const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
        if (d > 58) {
          const nx = Phaser.Math.Clamp(e.x - lastDir.x * 46, 40, wb.width - 40);
          const ny = Phaser.Math.Clamp(e.y - lastDir.y * 46, 40, wb.height - 40);
          this.scene.spawnBurstAt(this.x, this.y, 6, hex);
          (this.body as Phaser.Physics.Arcade.Body).reset(nx, ny);
          this.scene.spawnBurstAt(nx, ny, 8, hex);
        }
        this.setFlipX(lastDir.x > 0); // v1.0.16 — 좌향 네이티브 통일 (점멸 직후 참격 정면화)
        this.scene.spawnSlash(this.x, this.y, lastDir, i % 2 === 0, 1.2, hex);
        const { dmg, crit } = this.rollDamage(3.0 + 0.4 * t, true); // v1.4.30 (#2) 사다리 0.25→0.4
        if (crit) this.scene.sfxCrit();
        e.takeDamage(dmg, lastDir, 240, crit);
        // 출혈 추가타
        const eb = e;
        this.scene.time.delayedCall(200, () => {
          if (!eb.active) return;
          const { dmg: d2 } = this.rollDamage(0.6, true);
          eb.takeDamage(d2, new Phaser.Math.Vector2(0, 0.1).normalize(), 40, false);
          this.scene.spawnBurstAt(eb.x, eb.y, 4, 0xff4d4d);
        });
        this.scene.onMeleeConnect(1, "crit");
      });
    });
    this.scene.time.delayedCall(70 + targets.length * 240 + 220, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  /** 스와시버클러 — 연타 난무: 전방 5연속 속공 (회전베기/단검 투척과 완전 분리)
   *  3차+ 7연타 / 4차+ 타격당 흡혈 */
  private skill1FlurryDance() {
    const dir = this.aimDir();
    const t = this.sTier;
    const hex = this.clsHex();
    const hits = t >= 3 ? 7 : 5;
    this.play(this.bodyKey("hero-atk"));
    this.setFlipX(dir.y === 0 && dir.x > 0); // v1.0.16 — 좌향 네이티브 통일
    this.scene.sfxSkill("swift"); // v3.0.24 — 스와시버클러 연타 난무 (속공 베기)
    let total = 0;
    for (let i = 0; i < hits; i++) {
      this.scene.time.delayedCall(70 + i * 95, () => {
        if (this.state === "dead") return;
        this.scene.spawnSlash(this.x, this.y, dir, i % 2 === 0, 0.95, hex);
        const final = i === hits - 1;
        const before = this.hitSet.size;
        this.checkMeleeHit(dir, 165 + 6 * t, 120, final ? 1.8 : 0.85, final ? 380 : 120);
        total += this.hitSet.size - before;
        // 4차+ — 타격당 흡혈
        if (t >= 4 && total > 0 && i % 2 === 1) {
          const heal = 4 * total;
          this.hp = Math.min(this.maxHp, this.hp + heal);
        }
        this.scene.sfxSkill("swift", i % 2 === 0 ? 0.98 : 1.07); // v3.0.24 — 타격마다 교차 피치
      });
    }
    this.scene.time.delayedCall(70 + hits * 95 + 180, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  useSkill2() {
    if (this.state !== "idle" || this.skill2Cd > 0 || this.mp < 20) return;
    const move = this.scene.currentMoveVec();
    const auto = this.autoDashDir; // v3.0.1 — 자동 지정 방향 최우선 (1회 소모)
    this.autoDashDir = null;
    const dir =
      auto && auto.lengthSq() > 0.01
        ? auto.clone().normalize()
        : move.lengthSq() > 0.01
          ? move.clone().normalize()
          : this.aimDir();
    this.mp -= 20;
    this.skill2Cd = this.skill2MaxEff;
    this.state = "dash";
    this.dashDir.copy(dir);
    this.hitSet.clear();
    this.setFlipX(dir.x > 0); // v3.0.10 — 시트 왼쪽 기준
    this.netEmitAction("s2"); // v4.1.0

    // v3.0.6 — 기동기(C) 12종 클래스 고유 파라미터 (겹침 0 — 지시 #4)
    //  3차/4차는 계열 체인에서 2차기 승계(강화판)
    const kind = resolveSkill2Of(this.cls) ?? "dash";
    /* v3.0.24 — 기동기 직업별 사운드 (기존 전원 sfxDash 공용 → 클래스 정체성 분리)
     *  전사=질주 / 마법사=점멸(worp) / 도적=암흑 / 궁수=질풍 / 버서커·가디언=중장 돌진 / 어세신=암습 */
    const DASH_SND: Record<string, [string, number]> = {
      dash: ["sword", 0.92], // v4.2.0 — 1차 돌진기는 기존 기본공격 참격음 승계 (유저 지시)
      windstep: ["wind2", 1.05],
      blink: ["worp", 1],
      shadowveil: ["dark", 1.05],
      savagerush: ["heavydash", 1],
      bulwarkdash: ["heavydash", 0.82],
      falconwind: ["wind", 1.15],
      windslash: ["wind2", 1],
      grandblink: ["worp", 0.78],
      cycleblink: ["worp", 1.15],
      ambushdash: ["ambush", 1],
      flashydash: ["dash2", 1.12],
    };
    const ds = DASH_SND[kind] ?? DASH_SND.dash;
    this.scene.sfxSkill(ds[0], ds[1]);
    this.tutNotify("skill"); // v1.0.11 — 튜토리얼 스킬 학습 판정
    this.tierFlair(); // v1.0.11 — N차 기존 스킬 강화
    /* v1.0.11 — 기동기 대시 궤적: 혜성 코마트(gw_trail)를 진행 방향으로 신장해 잔상 강화 (2차+) */
    if (this.sTier >= 2 && this.scene.textures.exists("gw_trail")) {
      const tr = this.scene.add.image(this.x, this.y - 6, "gw_trail")
        .setDepth(23).setBlendMode(Phaser.BlendModes.ADD)
        .setRotation(dir.angle()).setTint(this.clsHex())
        .setScale(1.6, 1.1).setAlpha(0.7);
      this.scene.tweens.add({ targets: tr, alpha: 0, scaleX: 2.6, duration: 340, ease: "Sine.out", onComplete: () => tr.destroy() });
    }
    const t = this.sTier;
    const hex = this.clsHex();
    const DASH_CFG: Record<string, { time: number; speed: number }> = {
      dash: { time: 190, speed: 640 },
      windstep: { time: 160, speed: 700 },
      blink: { time: 130, speed: 760 },
      shadowveil: { time: 95, speed: 880 },
      savagerush: { time: 195, speed: 660 },
      bulwarkdash: { time: 205, speed: 600 },
      falconwind: { time: 170, speed: 720 },
      windslash: { time: 170, speed: 720 },
      grandblink: { time: 130, speed: 800 },
      cycleblink: { time: 130, speed: 780 },
      ambushdash: { time: 180, speed: 680 },
      flashydash: { time: 190, speed: 650 },
    };
    const cfg = DASH_CFG[kind] ?? DASH_CFG.dash;
    this.dashTime = cfg.time;
    this.dashSpeed = cfg.speed;
    this.dashKind = kind;

    /* v3.0.11 — 클래스별 이동 잔상 — 계열별 특색 돌진 (직업 특색 지시):
     *  마법사=블링크(룬 링+페이드) / 도적=그림자 잔상 / 궁수=질풍 바람꼬리 / 전사=대지 먼지 */
    const fam = familyOf(this.cls);
    if (kind === "blink" || kind === "grandblink" || kind === "cycleblink") {
      this.scene.spawnBurstAt(this.x, this.y, 10, 0x8fa6ff);
      this.scene.spawnRuneRing(this.x, this.y);
      this.scene.tweens.add({ targets: this, alpha: 0.12, duration: 70, yoyo: true, hold: 50 });
    } else if (kind === "shadowveil") {
      // 그림자 숨기 — 잔상 없이 사라졌다 나타남 + 다음 기본공격 강화 (도적 정체성)
      this.scene.spawnBurstAt(this.x, this.y, 5, 0xc08aff);
      this.scene.tweens.add({ targets: this, alpha: 0.05, duration: 60, yoyo: true, hold: 30 });
      this.nextAtkEmpowered = true;
      this.scene.time.delayedCall(3000, () => { this.nextAtkEmpowered = false; });
    } else {
      const trail = kind === "savagerush" ? 0xff5c3c
        : kind === "bulwarkdash" ? 0xffd29a
        : kind === "falconwind" ? 0x5cff8f
        : kind === "windslash" ? 0x9dffc4
        : kind === "ambushdash" ? 0xd89aff
        : kind === "flashydash" ? 0xf0c8ff
        : 0xff9a8a;
      if (fam === "ranger") {
        // 궁수 계열 — 질풍: 몸 뒤로 바람 꼬리 선 (참격 대신 바람)
        for (let i = 0; i < 5; i++) {
          this.scene.time.delayedCall(i * 34, () => {
            if (this.state === "dead") return;
            this.scene.spawnWindStreak(this.x, this.y, dir, trail);
          });
        }
        // 윈드러너(3차+ 템페스트 포함)만 경로 참격 잔상 유지 — 질풍 가르기 정체성
        if (kind === "windslash") {
          for (let i = 0; i < 2; i++) {
            this.scene.time.delayedCall(i * 80, () => {
              if (this.state === "dead") return;
              this.scene.spawnSlash(this.x, this.y, dir, i % 2 === 0, 0.7, trail);
            });
          }
        }
      } else if (fam === "thief") {
        // 도적 계열 — 어두운 그림자 잔상이 뒤따름
        for (let i = 0; i < 4; i++) {
          this.scene.time.delayedCall(i * 45, () => {
            if (this.state === "dead") return;
            this.scene.spawnShadowAfterimage(this, kind === "ambushdash" ? 0x2a1040 : 0x3a2050);
          });
        }
        // 스와시버클러(3차+ 듀얼리스트 포함)만 화려한 연타 스윕 유지 — 화려함 정체성
        if (kind === "flashydash") {
          for (let i = 0; i < 3; i++) {
            this.scene.time.delayedCall(i * 60, () => {
              if (this.state === "dead") return;
              this.scene.spawnSlash(this.x, this.y, dir, i % 2 === 0, 0.7, trail);
            });
          }
        }
      } else {
        // 전사 계열 — 대지 질주: 발밑 먼지 기둥 + 낮은 참격 잔상 2회
        for (let i = 0; i < 4; i++) {
          this.scene.time.delayedCall(i * 48, () => {
            if (this.state === "dead") return;
            this.scene.spawnDashDust(this.x, this.y, trail);
          });
        }
        for (let i = 0; i < 2; i++) {
          this.scene.time.delayedCall(i * 80, () => {
            if (this.state === "dead") return;
            this.scene.spawnSlash(this.x, this.y, dir, i % 2 === 0, 0.7, trail);
          });
        }
      }
      this.scene.spawnBurstAt(this.x, this.y, 6, trail);
    }

    // 돌진 중 연속 판정 — 이전 틱 위치→현재 위치 선분 스윕으로 터널링 방지
    // (돌진 640px/s: 40ms 틱 사이 약 26px 이동 — 프레임 드롭 시 구간이 더 벌어진다)
    let sweepFromX = this.x;
    let sweepFromY = this.y;
    const tick = this.scene.time.addEvent({
      delay: 40,
      repeat: 4,
      callback: () => {
        const toX = this.x;
        const toY = this.y;
        for (const e of this.scene.getAllTargets()) {
          if (!e.active || this.hitSet.has(e)) continue;
          const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
          // 현재 위치 원판 판정 + 이전 틱→현재 선분 스윕 판정 (둘 중 하나라도 닿으면 명중)
          const swept = sweptHitsTarget(sweepFromX, sweepFromY, toX, toY, e, 6);
          if (d <= 64 || swept) {
            this.hitSet.add(e);
            const { dmg, crit } = this.rollDamage(2.1 + 0.15 * t, true); // v3.0.4 — 전직마다 강화
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, dir, 360, crit);
            this.scene.onMeleeConnect(1, "skill");
            // v3.0.6 — 암습 돌진(어세신): 경로상 적 출혈 부여
            if (kind === "ambushdash") {
              const eb = e;
              this.scene.time.delayedCall(160, () => {
                if (!eb.active) return;
                const { dmg: d2 } = this.rollDamage(0.5, true);
                eb.takeDamage(d2, new Phaser.Math.Vector2(0, 0.1).normalize(), 40, false);
                this.scene.spawnBurstAt(eb.x, eb.y, 3, 0xff4d4d);
              });
            }
            // v3.0.6 — 순환 점멸(세이지): 경로상 마나 흡수 (명중당 MP +2)
            if (kind === "cycleblink") {
              this.mp = Math.min(this.maxMp, this.mp + 2);
              this.scene.spawnBurstAt(e.x, e.y, 3, 0xc3cfff);
            }
          }
        }
        // v3.0.6 — 질풍 가르기(윈드러너): 돌진 경로에 관통 화살 잔상 발사
        if (kind === "windslash") {
          const aim = this.aimDirFree();
          const ang = Math.atan2(aim.y, aim.x);
          const { dmg, crit } = this.rollDamage(0.8 + 0.06 * t, true);
          this.scene.firePlayerProj({
            x: this.x, y: this.y - 8, angle: ang, speed: 600, pierce: 3, dmg, crit,
            tint: 0x9dffc4, knock: 160, scale: 0.85,
          });
        }
        sweepFromX = toX;
        sweepFromY = toY;
      },
    });
    // v3.0.6 — 기동기별 종착 효과 12종 (클래스 고유 — 겹침 0)
    const endAt = cfg.time + 25;
    this.scene.time.delayedCall(endAt, () => {
      if (this.state === "dead") return;
      const targets = this.scene.getAllTargets();
      const burst = (r: number, mul: number, knock = 340) => {
        for (const e of targets) {
          if (!e.active || this.hitSet.has(e)) continue;
          const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
          if (d <= r) {
            this.hitSet.add(e);
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = this.rollDamage(mul, true);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, knock, crit);
          }
        }
      };
      switch (kind) {
        case "dash": {
          // 전사 — 돌진 종착 충격파 (반경 96+10t, 배율 0.9+0.12t)
          this.scene.spawnBurstAt(this.x, this.y, 12 + 2 * t, 0xff9a8a);
          if (t >= 3) this.scene.spawnCrack?.(this.x, this.y);
          burst(96 + 10 * t, 0.9 + 0.12 * t, 420);
          break;
        }
        case "savagerush": {
          // 버서커 — 종착 분노 폭발 + 공격 버프 (전사 충격파와 분리)
          this.scene.spawnBurstAt(this.x, this.y, 18 + 2 * t, 0xff5c3c);
          this.scene.spawnCrack?.(this.x, this.y);
          this.selfAtkBuff = { mult: 1.15 + 0.03 * t, until: this.scene.time.now + 4000 + 500 * t }; // v1.4.30 (#2) 지속 티어 스케일
          burst(110 + 10 * t, 1.1 + 0.1 * t, 300);
          this.scene.spawnPickupText(this.x, this.y - 44, "분노!", "#ff7a5c");
          break;
        }
        case "bulwarkdash": {
          // 가디언 — 종착 지진파 + 방어 버프 (성벽 강타의 방어 버프와 축 공유, 수치 별도)
          this.scene.spawnBurstAt(this.x, this.y, 14 + 2 * t, 0xffd29a);
          this.selfDefBuff = { add: 10 + 2 * t, until: this.scene.time.now + 5000 + 500 * t }; // v1.4.30 (#2) 지속 티어 스케일
          burst(100 + 10 * t, 0.8 + 0.1 * t, 380);
          this.scene.spawnPickupText(this.x, this.y - 44, "불굴!", "#ffd29a");
          break;
        }
        case "windstep": {
          // 궁수 — 종착 후퇴사격 (3차+ 3발 부채꼴)
          const aim = this.aimDir();
          const angle = Math.atan2(aim.y, aim.x);
          const n = t >= 3 ? 3 : 1;
          for (let i = 0; i < n; i++) {
            const { dmg, crit } = this.rollDamage(1.3 + 0.1 * t, true);
            if (crit) this.scene.sfxCrit();
            this.scene.firePlayerProj({
              x: this.x, y: this.y - 8,
              angle: angle + (i - (n - 1) / 2) * 0.16, speed: 640, pierce: 2, dmg, crit,
              tint: 0xbaf3ff, knock: 240, scale: 0.9,
            });
          }
          break;
        }
        case "falconwind": {
          // 스나이퍼 — 종착 3발 부채꼴 저격 (후퇴사격과 분리: 발수/배율/틴트 차등)
          const aim = this.aimDirFree();
          const angle = Math.atan2(aim.y, aim.x);
          for (let i = 0; i < 3; i++) {
            const { dmg, crit } = this.rollDamage(1.4 + 0.08 * t, true);
            if (crit) this.scene.sfxCrit();
            this.scene.firePlayerProj({
              x: this.x, y: this.y - 8,
              angle: angle + (i - 1) * 0.1, speed: 760, pierce: 4, dmg, crit,
              tint: 0x5cff8f, knock: 200, scale: 1.0,
            });
          }
          break;
        }
        case "blink": {
          // 마법사 — 양단 마나 폭발 (반경 104+10t) + 도착 룬 링
          this.scene.spawnBurstAt(this.x, this.y, 14 + 2 * t, 0x8fa6ff);
          this.scene.spawnRuneRing(this.x, this.y);
          burst(104 + 10 * t, 0.9 + 0.12 * t, 300);
          break;
        }
        case "grandblink": {
          // 아크메이지 — 양단 대폭발 (반경 1.4배, 배율 상향) + 도착 룬 링
          this.scene.spawnBurstAt(this.x, this.y, 22 + 2 * t, 0x8fa6ff);
          this.scene.spawnPillar(this.x, this.y, 0x8fa6ff, 80);
          this.scene.spawnRuneRing(this.x, this.y);
          burst(145 + 10 * t, 1.15 + 0.1 * t, 320);
          break;
        }
        case "cycleblink": {
          // 세이지 — 종착 MP 회복 + 소규모 정화 (마나 흡수는 경로상 처리) + 도착 룬 링
          this.mp = Math.min(this.maxMp, this.mp + 8 + 2 * t);
          this.scene.spawnBurstAt(this.x, this.y, 12, 0xc3cfff);
          this.scene.spawnRuneRing(this.x, this.y, 0xc3cfff);
          this.scene.spawnPickupText(this.x, this.y - 44, `+${8 + 2 * t} MP`, "#a5b9ff");
          break;
        }
        case "shadowveil":
        case "ambushdash":
        case "windslash":
        case "flashydash":
          // 종착 폭발 없음 — 그림자 숨기(다음 공격 강화)/암습(경로 출혈)/질풍(경로 화살)/화려함(연타 스윕)은 이동 중 처리
          break;
      }
    });
    this.scene.time.delayedCall(260, () => tick.remove());
    this.scene.emitHud();
  }

  /* ================= v3.0.3 — 3차기(V) / 4차기(B): 상위직 고유 메커니즘 =================
   *  사용자 지시 — "3차에는 스킬 3개, 4차는 4개", "세부 직업별로 다 다른 기능·이펙트·데미지"
   *  (예: 세이지/크로니컬 계열은 힐·빛 계열 정체성). 8가지 3차 메커니즘 + 8가지 4차 궁극기. */

  /** 근처 적 정렬 (가까운 순) — 3차/4차 다수 대상 스킬 공용 */
  private nearestTargets(n: number, maxD: number): (Enemy | Boss)[] {
    const list = this.scene
      .getAllTargets()
      .filter((e) => e.active && Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y) <= maxD)
      .sort((a, b) => Phaser.Math.Distance.Between(this.x, this.y, a.x, a.y) - Phaser.Math.Distance.Between(this.x, this.y, b.x, b.y));
    return list.slice(0, n);
  }

  /** 클래스 배지색 (이펙트 틴트) */
  private clsHex(): number {
    return classDef(this.cls)?.hex ?? 0xffffff;
  }

  useSkill3() {
    if (this.state !== "idle" || !this.skill3Unlocked || this.skill3Cd > 0 || this.mp < 25) return;
    const kind = SKILL3_KIND[this.cls ?? ""] as Skill3Kind | undefined;
    if (!kind) return;
    this.mp -= 25;
    this.skill3Cd = this.skill3MaxEff;
    this.state = "attack";
    this.hitSet.clear();
    this.setVelocity(0, 0);
    this.netEmitAction("s3"); // v4.1.0
    const hex = this.clsHex();
    /* v3.0.24 — 3차기 16종 직업별 사운드 (전원 공용 없음 — 클래스 정체성 배치) */
    const SND3: Record<Skill3Kind, [string, number]> = {
      warcry: ["warcry", 1], // 워로드 — 전장의 함성
      sanctuary: ["holy", 1], // 팔라딘 — 성역
      trueshot: ["arrowpierce", 1.22], // 이글아이 — 절사명중
      tornado: ["wind", 0.8], // 템페스트 — 폭풍의 눈
      thunder: ["thunder", 1], // 스톰브링어 — 낙뢰
      timewarp: ["slowmo", 1], // 크로니클 — 시간 왜곡
      shadowblad: ["dark", 0.88], // 나이트블레이드 — 그림자 칼날
      flurry: ["swift", 1.1], // 듀얼리스트 — 연격 무도
      bloodrage: ["rage", 0.9], // 워브링어 — 피의 격노
      holynova: ["holy", 0.8], // 크루세이더 — 성흔 폭발
      arrowrain: ["arrow", 0.75], // 데드아이 — 화살 폭우
      cyclone: ["wind2", 0.72], // 스카이로드 — 폭풍 소용돌이
      chainlight: ["chain", 1], // 아크로드 — 연쇄 번개
      gravity: ["gravity", 1], // 이터널 — 중력 붕괴
      shadowmine: ["dark", 1.2], // 섀도우로드 — 그림자 지뢰
      swordaura: ["bigsword", 1], // 블레이드마스터 — 파동 검기
    };
    this.scene.sfxSkill(...SND3[kind]);
    this.tutNotify("skill"); // v1.0.11 — 튜토리얼 스킬 학습 판정
    this.tierFlair(); // v1.0.11 — N차 기존 스킬 강화

    switch (kind) {
      /* 워로드 — 전장의 함성: 광역 외침 + 공격력 버프 (v3.0.4 — 임팩트 대폭 상향) */
      case "warcry": {
        const t = this.sTier; // v1.4.30 — 지속시간 티어 스케일용
        this.scene.spawnSpinSlash(this.x, this.y, 1);
        this.scene.spawnBurstAt(this.x, this.y, 26, hex);
        this.scene.spawnCrack?.(this.x, this.y);
        this.scene.cameras.main.shake(140, 0.009);
        this.scene.cameras.main.flash(90, 255, 120, 90);
        for (const e of this.getAllTargetsIn(280)) {
          const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
          const { dmg, crit } = this.rollDamage(2.0, true);
          if (crit) this.scene.sfxCrit();
          e.takeDamage(dmg, away, 380, crit);
        }
        this.selfAtkBuff = { mult: 1.35, until: this.scene.time.now + 8000 + 800 * t }; // v1.4.30 (#2) 지속 티어 스케일
        this.scene.spawnPickupText(this.x, this.y - 44, "전장의 함성! 공격력 크게 증가", "#ff9a8a");
        break;
      }
      /* 팔라딘 — 성역: 빛의 결계 필드 (적 지속 피해 + 결계 내 자힐) — v3.0.4 임팩트 상향 */
      case "sanctuary": {
        this.scene.spawnField({
          x: this.x, y: this.y + 12, radius: 190, dur: 10000,
          dps: Math.max(10, Math.round(this.atkTotal * 0.95)),
          kind: "light", owner: "player", heal: true,
        });
        this.scene.spawnPillar(this.x, this.y, 0xffe9a0, 160);
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2;
          this.scene.spawnPillar(this.x + Math.cos(ang) * 150, this.y + Math.sin(ang) * 150, 0xffe9a0, 100);
        }
        this.scene.cameras.main.flash(100, 255, 240, 190);
        this.scene.spawnPickupText(this.x, this.y - 44, "성역 — 빛의 결계 전개", "#ffd29a");
        break;
      }
      /* 이글아이 — 절사명중: 확정 크리 관통 저격 — v3.0.4 임팩트 상향 */
      case "trueshot": {
        const aim = this.aimDirFree();
        const angle = Math.atan2(aim.y, aim.x);
        this.scene.spawnBow(this.x + aim.x * 12, this.y - 8, angle);
        this.scene.spawnBurstAt(this.x + aim.x * 16, this.y - 8 + aim.y * 16, 12, 0xbaf3ff);
        this.scene.time.delayedCall(90, () => {
          if (this.state === "dead") return;
          const dmg = Math.round(this.atkTotal * 4.5 * this.clsBonus.skillMult);
          this.scene.firePlayerProj({
            x: this.x, y: this.y - 8, angle, speed: 980, pierce: 99,
            dmg, crit: true, tint: 0xbaf3ff, knock: 380, scale: 2.0,
            tex: "x2_arrow", blend: "add", rot: true,
          });
          this.scene.cameras.main.shake(100, 0.007);
          this.scene.cameras.main.flash(70, 160, 230, 255);
        });
        break;
      }
      /* 템페스트 — 폭풍의 눈: 다수 회오리 투사체 — v3.0.4 임팩트 상향 */
      case "tornado": {
        const aim = this.aimDirFree();
        const base = Math.atan2(aim.y, aim.x);
        const n = 5;
        for (let i = 0; i < n; i++) {
          this.scene.time.delayedCall(i * 90, () => {
            if (this.state === "dead") return;
            const { dmg, crit } = this.rollDamage(1.6, true);
            if (crit) this.scene.sfxCrit();
            this.scene.firePlayerProj({
              x: this.x, y: this.y - 8,
              angle: base + (i - (n - 1) / 2) * 0.36,
              speed: 470, pierce: 8, dmg, crit,
              tint: hex, knock: 300, scale: 1.9,
              anim: "fx-arcane", blend: "add", rot: true, // v3.0.12 — 회오리 볼트도 비행 방향 정렬
            });
          });
        }
        this.scene.cameras.main.shake(110, 0.006);
        break;
      }
      /* 스톰브링어 — 낙뢰: 하늘에서 다수 직격 — v3.0.4 임팩트 상향 (6타·기절 추가) */
      case "thunder": {
        const targets = this.nearestTargets(6, 460);
        targets.forEach((e, i) => {
          this.scene.time.delayedCall(i * 110, () => {
            if (!e.active || this.state === "dead") return;
            this.scene.spawnPillar(e.x, e.y, 0x9dd8ff, 200);
            this.scene.spawnBurstAt(e.x, e.y, 10, 0x9dd8ff);
            const { dmg, crit } = this.rollDamage(3.4, true);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, new Phaser.Math.Vector2(0, 0.1).normalize(), 220, crit);
            (e as Enemy).applyStun?.(400);
          });
        });
        this.scene.cameras.main.shake(130, 0.011);
        this.scene.cameras.main.flash(90, 170, 210, 255);
        break;
      }
      /* 크로니컬 — 시간 왜곡: 감속 필드 — v3.0.4 임팩트 상향 */
      case "timewarp": {
        this.scene.spawnField({
          x: this.x, y: this.y + 12, radius: 300, dur: 9000,
          dps: Math.max(8, Math.round(this.atkTotal * 0.7)),
          kind: "time", owner: "player", slow: true,
          /* v3.0.7 — 크로니컬 힐러 강화: 필드가 자신의 HP를 틱마다 회복 (시간이 상처를 되감음) */
          selfHealPerTick: Math.max(2, Math.round(this.maxHp * 0.01)),
        });
        this.scene.spawnBurstAt(this.x, this.y, 24, 0xb0a0ff);
        this.scene.spawnPillar(this.x, this.y, 0xb0a0ff, 130);
        this.scene.cameras.main.flash(80, 200, 180, 255);
        this.scene.spawnPickupText(this.x, this.y - 44, "시간 왜곡 — 적 감속 · 자신 회복", "#e2e8ff");
        break;
      }
      /* 나이트블레이드 — 그림자 칼날: 선회 오비트 — v3.0.4 임팩트 상향 */
      case "shadowblad": {
        this.scene.startOrbitBlades(1.8, hex, 9000);
        this.scene.spawnBurstAt(this.x, this.y, 18, hex);
        this.scene.cameras.main.shake(80, 0.004);
        break;
      }
      /* 듀얼리스트 — 연격 무도: 연속 급습 + 피해 흡수 — v3.0.4 임팩트 상향 (6연격) */
      case "flurry": {
        const target = this.nearestTargets(1, 280)[0];
        const hits = 6;
        for (let i = 0; i < hits; i++) {
          this.scene.time.delayedCall(i * 130, () => {
            if (this.state === "dead") return;
            const e = target && target.active ? target : null;
            const dir2 = e
              ? new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize()
              : this.aimDir();
            this.scene.spawnSlash(this.x, this.y, dir2, i % 2 === 0, i === hits - 1 ? 1.6 : 1.1, hex);
            if (e) {
              const { dmg } = this.rollDamage(1.2, true);
              e.takeDamage(dmg, dir2, 120, false);
              // 흡혈 — 피해의 35% 회복
              const healAmt = Math.max(1, Math.round(dmg * 0.35));
              this.hp = Math.min(this.maxHp, this.hp + healAmt);
              this.scene.spawnHealFx(this.x, this.y, 0x7dffa8);
            }
          });
        }
        this.scene.cameras.main.shake(90, 0.004);
        break;
      }
      /* ════════ v3.0.4 — 4차 전용 고유 3차기 (기존 3차 스킬과 완전 별개 — 겹침 0) ════════ */
      /* 워브링어 — 피의 격노: 광역 출혈 + 공격력·신속 동시 버프 */
      case "bloodrage": {
        const t = this.sTier; // v1.4.30 — 지속시간 티어 스케일용
        this.scene.spawnSpinSlash(this.x, this.y, 1);
        this.scene.spawnBurstAt(this.x, this.y, 26, 0xff2d2d);
        this.scene.cameras.main.shake(130, 0.008);
        this.scene.cameras.main.flash(90, 255, 60, 60);
        for (const e of this.getAllTargetsIn(250)) {
          const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
          const { dmg } = this.rollDamage(1.2, true);
          e.takeDamage(dmg, away, 120, false);
          // 출혈 — 3틱 지속 피해 (피의 격노 상징)
          const eb = e;
          for (const dl of [260, 520, 780]) {
            this.scene.time.delayedCall(dl, () => {
              if (!eb.active || this.state === "dead") return;
              const { dmg: d2 } = this.rollDamage(0.5, true);
              eb.takeDamage(d2, new Phaser.Math.Vector2(0, 0.1).normalize(), 40, false);
              this.scene.spawnBurstAt(eb.x, eb.y, 3, 0xff4d4d);
            });
          }
        }
        this.selfAtkBuff = { mult: 1.45, until: this.scene.time.now + 8000 + 600 * t }; // v1.4.30 (#2) 지속 티어 스케일
        this.selfSpdBuff = { mult: 1.25, until: this.scene.time.now + 9000 };
        this.recalcSpeed();
        this.scene.spawnPickupText(this.x, this.y - 44, "피의 격노! 공격·신속 상승 + 광역 출혈", "#ff5c3c");
        break;
      }
      /* 크루세이더 — 성흔 폭발: 즉발 광역 빛 폭발 + 성스러운 보호막 (성역 필드와 완전 별개) */
      case "holynova": {
        this.scene.spawnPillar(this.x, this.y, 0xffe9a0, 210);
        this.scene.spawnBurstAt(this.x, this.y, 34, 0xffe9a0);
        this.scene.cameras.main.flash(120, 255, 240, 190);
        this.scene.cameras.main.shake(150, 0.009);
        for (const e of this.getAllTargetsIn(280)) {
          const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
          const { dmg, crit } = this.rollDamage(2.6, true);
          if (crit) this.scene.sfxCrit();
          e.takeDamage(dmg, away, 380, crit);
        }
        this.selfDefBuff = { add: 22, until: this.scene.time.now + 8000 };
        this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.2));
        this.scene.spawnHealFx(this.x, this.y, 0xffe9a0);
        this.scene.spawnPickupText(this.x, this.y - 44, "성흔 폭발! 보호막 + 치유", "#ffe29a");
        break;
      }
      /* 데드아이 — 화살 폭우: 조준 지점 하늘에서 화살 쏟아짐 (유도 화살비와 완전 별개) */
      case "arrowrain": {
        const aim = this.aimDirFree().normalize();
        const wb = this.scene.physics.world.bounds;
        const cx = Phaser.Math.Clamp(this.x + aim.x * 190, 80, wb.width - 80);
        const cy = Phaser.Math.Clamp(this.y + aim.y * 190, 80, wb.height - 80);
        this.scene.spawnBurstAt(cx, cy, 12, hex);
        const N = 14;
        for (let i = 0; i < N; i++) {
          this.scene.time.delayedCall(80 + i * 70, () => {
            if (this.state === "dead") return;
            const ox = cx + Phaser.Math.Between(-110, 110);
            const oy = cy + Phaser.Math.Between(-110, 110);
            const { dmg, crit } = this.rollDamage(1.1, true);
            if (crit) this.scene.sfxCrit();
            this.scene.firePlayerProj({
              x: ox, y: oy - 320, angle: Math.PI / 2, speed: 720, pierce: 2,
              dmg, crit, tint: hex, knock: 160, scale: 1.2,
              tex: "x2_arrow", blend: "add", rot: true,
            });
          });
        }
        this.scene.cameras.main.shake(100, 0.004);
        this.scene.spawnPickupText(this.x, this.y - 44, "화살 폭우!", "#1cff5c");
        break;
      }
      /* 스카이로드 — 하늘의 희망: 대형 토네이도 2기 + 잔풍 소용돌이 4기 (폭풍의 눈과 완전 별개)
   *  v3.0.11 — 매직볼트 → 진짜 토네이도(fx-tornado 회전 스프라이트):
   *  이동하며 적을 빨아들이고 S자로 꿈틀대고, 소멸 시 폭발 마무리 */
      case "cyclone": {
        const aim = this.aimDirFree();
        const base = Math.atan2(aim.y, aim.x);
        // 대형 토네이도 2기 — 좌우로 살짝 벌려 전진, 강한 빨아들이기
        for (let i = 0; i < 2; i++) {
          this.scene.time.delayedCall(i * 180, () => {
            if (this.state === "dead") return;
            const { dmg, crit } = this.rollDamage(1.7, true);
            this.scene.fireCyclone({
              x: this.x, y: this.y - 8,
              angle: base + (i === 0 ? 0.12 : -0.12), speed: 250,
              dmg, crit, hex,
              pull: 0.55, radius: 100, life: 2400, scale: 2.6,
            });
          });
        }
        // 잔풍 소용돌이 4기 — 작은 회오리가 부채꼴로 빠르게
        for (let i = 0; i < 4; i++) {
          this.scene.time.delayedCall(120 + i * 90, () => {
            if (this.state === "dead") return;
            const { dmg } = this.rollDamage(0.9, true);
            this.scene.fireCyclone({
              x: this.x, y: this.y - 8,
              angle: base + (i - 1.5) * 0.3, speed: 330,
              dmg, crit: false, hex,
              pull: 0.3, radius: 56, life: 1200, scale: 1.2,
            });
          });
        }
        this.scene.cameras.main.shake(110, 0.006);
        this.scene.spawnPickupText(this.x, this.y - 44, "하늘의 희망!", "#ccffe8");
        break;
      }
      /* 아크로드 — 연쇄 번개: 적→적으로 최대 6회 도약 (낙뢰와 완전 별개) */
      case "chainlight": {
        const hitList: (Enemy | Boss)[] = [];
        const first = this.nearestTargets(1, 420)[0] ?? null;
        if (!first) {
          this.scene.spawnBurstAt(this.x, this.y, 10, hex);
          break;
        }
        this.scene.spawnPillar(this.x, this.y, 0x9dd8ff, 120);
        let cur: Enemy | Boss | null = first;
        let hop = 0;
        const strikeNext = () => {
          if (!cur || !cur.active || this.state === "dead" || hop >= 6) return;
          const e = cur;
          this.scene.spawnPillar(e.x, e.y, 0x9dd8ff, 200);
          this.scene.spawnBurstAt(e.x, e.y, 9, hex);
          const { dmg, crit } = this.rollDamage(2.4 - hop * 0.2, true);
          if (crit) this.scene.sfxCrit();
          e.takeDamage(dmg, new Phaser.Math.Vector2(0, 0.1).normalize(), 120, crit);
          hitList.push(e);
          hop++;
          const next =
            this.scene
              .getAllTargets()
              .filter((o) => o.active && !hitList.includes(o) && Phaser.Math.Distance.Between(e.x, e.y, o.x, o.y) <= 230)
              .sort((a, b) => Phaser.Math.Distance.Between(e.x, e.y, a.x, a.y) - Phaser.Math.Distance.Between(e.x, e.y, b.x, b.y))[0] ?? null;
          cur = next;
          if (cur) this.scene.time.delayedCall(120, strikeNext);
        };
        strikeNext();
        this.scene.cameras.main.shake(120, 0.008);
        this.scene.cameras.main.flash(80, 170, 210, 255);
        break;
      }
      /* 이터널 — 중력 붕괴: 적을 한 점으로 끌어모은 뒤 대폭발 (시간 왜곡과 완전 별개)
       *  v1.4.30 (#7) — 폭발 계수 2.8 고정 → 2.8+0.25·t 사다리 (5차 4.05배) + 끌어당김 반경 확대 */
      case "gravity": {
        const t = this.sTier;
        const aim = this.aimDirFree().normalize();
        const wb = this.scene.physics.world.bounds;
        const cx = Phaser.Math.Clamp(this.x + aim.x * 120, 60, wb.width - 60);
        const cy = Phaser.Math.Clamp(this.y + aim.y * 120, 60, wb.height - 60);
        const victims = this.getAllTargetsIn(320 + 24 * t);
        // 4단계 끌어당김 — 90ms 간격 35%씩 중심으로
        for (const e of victims) {
          const eb = e;
          for (let s = 1; s <= 4; s++) {
            this.scene.time.delayedCall(s * 90, () => {
              if (!eb.active) return;
              const nx = Phaser.Math.Clamp(eb.x + (cx - eb.x) * 0.35, 50, wb.width - 50);
              const ny = Phaser.Math.Clamp(eb.y + (cy - eb.y) * 0.35, 50, wb.height - 50);
              (eb as unknown as { body?: Phaser.Physics.Arcade.Body }).body?.reset?.(nx, ny);
              this.scene.spawnBurstAt(eb.x, eb.y, 2, 0xb0a0ff);
            });
          }
        }
        this.scene.spawnBurstAt(cx, cy, 16, 0xb0a0ff);
        // 420ms 후 — 대폭발
        this.scene.time.delayedCall(420, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(cx, cy, 0xb0a0ff, 190);
          this.scene.spawnBurstAt(cx, cy, 30, hex);
          this.scene.cameras.main.shake(150, 0.01);
          this.scene.cameras.main.flash(100, 200, 180, 255);
          for (const e of this.getAllTargetsIn(190 + 10 * t)) {
            const away = new Phaser.Math.Vector2(e.x - cx, e.y - cy).normalize();
            const { dmg, crit } = this.rollDamage(2.8 + 0.25 * t, true);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 300, crit);
          }
          void victims;
        });
        this.scene.spawnPickupText(this.x, this.y - 44, "중력 붕괴!", "#e2e8ff");
        break;
      }
      /* 섀도우로드 — 그림자 지뢰: 3기 설치, 접촉 시 출혈 폭발 (그림자 칼날과 완전 별개) */
      case "shadowmine": {
        const aim = this.aimDirFree().normalize();
        for (let i = 0; i < 3; i++) {
          const off = (i - 1) * 56;
          const mx = Phaser.Math.Clamp(this.x + aim.x * 90 + (aim.y !== 0 ? off : 0), 60, this.scene.physics.world.bounds.width - 60);
          const my = Phaser.Math.Clamp(this.y + aim.y * 90 + (aim.x !== 0 ? off : 0), 60, this.scene.physics.world.bounds.height - 60);
          const mine = this.scene.add.circle(mx, my, 13, 0x2a1040).setStrokeStyle(2, hex, 0.95).setDepth(10).setAlpha(0.85);
          this.scene.tweens.add({ targets: mine, alpha: 0.45, scale: 0.9, duration: 520, yoyo: true, repeat: -1 });
          let armed = false;
          this.scene.time.delayedCall(450, () => { armed = true; });
          const timer = this.scene.time.addEvent({
            delay: 90,
            repeat: 76, // 약 7초 후 자동 소멸
            callback: () => {
              if (this.state === "dead") {
                timer.remove();
                mine.destroy();
                return;
              }
              if (!armed) return;
              const near = this.scene
                .getAllTargets()
                .find((e) => e.active && Phaser.Math.Distance.Between(mx, my, e.x, e.y) <= 68);
              if (near) {
                timer.remove();
                mine.destroy();
                this.scene.spawnBurstAt(mx, my, 18, hex);
                this.scene.cameras.main.shake(80, 0.005);
                const targets2 = this.scene.getAllTargets().filter((e) => e.active && Phaser.Math.Distance.Between(mx, my, e.x, e.y) <= 110);
                for (const e of targets2) {
                  const away = new Phaser.Math.Vector2(e.x - mx, e.y - my).normalize();
                  const { dmg } = this.rollDamage(2.2, true);
                  e.takeDamage(dmg, away, 260, false);
                  // 출혈 2틱
                  const eb = e;
                  for (const dl of [240, 480]) {
                    this.scene.time.delayedCall(dl, () => {
                      if (!eb.active || this.state === "dead") return;
                      const { dmg: d2 } = this.rollDamage(0.45, true);
                      eb.takeDamage(d2, new Phaser.Math.Vector2(0, 0.1).normalize(), 40, false);
                      this.scene.spawnBurstAt(eb.x, eb.y, 3, 0xc08aff);
                    });
                  }
                }
              }
            },
          });
        }
        this.scene.spawnPickupText(this.x, this.y - 44, "그림자 지뢰 설치", "#c08aff");
        break;
      }
      /* 블레이드마스터 — 파동 검기: 전방 340px 전부 관통하는 검기 3연파 (연격 무도와 완전 별개) */
      case "swordaura": {
        const dir = this.aimDirFree().normalize();
        for (let i = 0; i < 3; i++) {
          this.scene.time.delayedCall(i * 80, () => {
            if (this.state === "dead") return;
            const px = this.x + dir.x * (70 + i * 90);
            const py = this.y - 6 + dir.y * (70 + i * 90);
            this.scene.spawnSlash(px, py, dir, i % 2 === 0, 1.7, hex);
            this.scene.spawnBurstAt(px, py, 8, hex);
            for (const e of this.getAllTargetsIn(999)) {
              if (this.hitSet.has(e)) continue;
              const d = Phaser.Math.Distance.Between(px, py, e.x, e.y);
              if (d <= 105) {
                this.hitSet.add(e);
                const { dmg, crit } = this.rollDamage(1.9, true);
                if (crit) this.scene.sfxCrit();
                e.takeDamage(dmg, dir, 280, crit);
              }
            }
          });
        }
        this.scene.cameras.main.shake(90, 0.005);
        this.scene.spawnPickupText(this.x, this.y - 44, "파동 검기!", "#ffaaff");
        break;
      }
    }
    const dur = kind === "flurry" ? 6 * 130 + 120 : 280;
    this.scene.time.delayedCall(dur, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  useSkill4() {
    if (this.state !== "idle" || !this.skill4Unlocked || this.skill4Cd > 0 || this.mp < 40) return;
    const kind = SKILL4_KIND[this.cls ?? ""] as Skill4Kind | undefined;
    if (!kind) return;
    this.mp -= 40;
    this.skill4Cd = this.skill4MaxEff;
    this.state = "attack";
    this.hitSet.clear();
    this.setVelocity(0, 0);
    this.netEmitAction("s4"); // v4.1.0
    this.tierFlair(true); // v1.4.30 (#6) — 4차기(중요 스킬)만 풀 패키지 기존 연출
    const hex = this.clsHex();
    const now = this.scene.time.now;
    /* v3.0.24 — 4차기 8종 직업별 사운드 (필살기 임팩트 배치) */
    const SND4: Record<Skill4Kind, [string, number]> = {
      doomsday: ["superhit", 1], // 워브링어 — 종언의 일격
      judgment: ["holy", 1.18], // 크루세이더 — 심판의 빛기둥
      godarrow: ["arrow", 1.25], // 데드아이 — 신의 화살비
      skystorm: ["skyflight", 1], // 스카이로드 — 천공의 폭풍
      manaburst: ["manaburst", 1], // 아크로드 — 마나 붕괴
      eternalloop: ["timestop", 1], // 이터널 — 영원의 고리 (시간 정지)
      shadowclon: ["dark", 0.7], // 섀도우로드 — 그림자 군주
      bladedance: ["swift", 1.2], // 블레이드마스터 — 검무
    };
    this.scene.sfxSkill(...SND4[kind]);

    switch (kind) {
      /* 워브링어 — 종언의 일격: 돌진 후 대폭발 — v3.0.4 임팩트 상향 */
      case "doomsday": {
        const dir = this.aimDirFree().normalize();
        this.state = "dash";
        this.dashDir.copy(dir);
        this.dashSpeed = 820;
        this.dashTime = 240;
        this.scene.spawnSlash(this.x, this.y, dir, false, 1.2, hex);
        this.scene.time.delayedCall(270, () => {
          if (this.state === "dead") return;
          this.scene.spawnCrack?.(this.x, this.y);
          this.scene.spawnBurstAt(this.x, this.y, 46, hex);
          this.scene.spawnPillar(this.x, this.y, hex, 170);
          /* v1.0.10 — GameStudio FX: 종언 대폭발 3중 합성 (화염 링+코어 플레어)
           *  vc149 (#14) — 마법진 금지(전사 계열): gv 불 서클 지면 연출로 대체 */
          spawnRingPop(this.scene, this.x, this.y, "vf_ring_fire", 0xffffff, 3.6, 560);
          spawnFlarePop(this.scene, this.x, this.y - 6, "vf_flare_fire", { scale: 1.6, duration: 520 });
          this.scene.driveFx?.gvFireCircle(this.x, this.y, 0xff8a4a, 820, 1.1);
          this.scene.cameras.main.shake(200, 0.014);
          this.scene.cameras.main.flash(120, 255, 90, 50);
          for (const e of this.getAllTargetsIn(300)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = this.rollDamage(4.8, true);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 520, crit);
          }
        });
        this.scene.time.delayedCall(560, () => {
          if (this.state === "dash") { this.state = "idle"; this.setVelocity(0, 0); }
        });
        break;
      }
      /* 크루세이더 — 심판의 빛기둥: 다수 빛 기둥 + 성스러운 방어/치유 — v3.0.4 임팩트 상향 */
      case "judgment": {
        const targets = this.nearestTargets(5, 480);
        targets.forEach((e, i) => {
          this.scene.time.delayedCall(i * 140, () => {
            if (!e.active || this.state === "dead") return;
            this.scene.spawnPillar(e.x, e.y, 0xffe9a0, 220);
            this.scene.spawnBurstAt(e.x, e.y, 12, 0xffe9a0);
            /* v1.0.10 — GameStudio FX: 기둥 하단 골드 링 (심판의 무게감)
             *  vc149 (#14) — 마법진 금지(전사 계열): gv 타격 삼각+화이트 플래시로 대체 */
            this.scene.driveFx?.gvHitTri(e.x, e.y, -Math.PI / 2, 0xffe9a0, 1.4);
            this.scene.driveFx?.gvFlash(e.x, e.y, 0xfff0c0, 0.9);
            spawnRingPop(this.scene, e.x, e.y, "vf_ring", 0xffe9a0, 2.2, 440);
            const { dmg, crit } = this.rollDamage(4.2, true);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, new Phaser.Math.Vector2(0, 0.1).normalize(), 300, crit);
          });
        });
        this.selfDefBuff = { add: 20, until: now + 7000 };
        this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.2));
        this.scene.spawnHealFx(this.x, this.y, 0xffe9a0);
        this.scene.spawnPillar(this.x, this.y, 0xffe9a0, 160);
        this.scene.cameras.main.shake(120, 0.007);
        this.scene.cameras.main.flash(100, 255, 240, 190);
        this.scene.spawnPickupText(this.x, this.y - 44, "심판의 빛! 방어력 상승 + 치유", "#ffd29a");
        break;
      }
      /* 데드아이 — 신의 화살비: 유도 화살 12발 — v3.0.4 임팩트 상향 */
      case "godarrow": {
        for (let i = 0; i < 12; i++) {
          this.scene.time.delayedCall(i * 70, () => {
            if (this.state === "dead") return;
            const ang = (i / 12) * Math.PI * 2;
            const { dmg, crit } = this.rollDamage(2.0, true);
            this.scene.firePlayerProj({
              x: this.x, y: this.y - 8, angle: ang, speed: 480, pierce: 2,
              dmg, crit, tint: hex, knock: 260, scale: 1.25,
              tex: "x2_arrow", blend: "add", rot: true, homing: true,
            });
          });
        }
        this.scene.spawnBurstAt(this.x, this.y, 16, hex);
        /* v1.0.10 — GameStudio FX: 시전 코어 플레어 (신의 화살비 발동 무게감)
         *  vc149 (#14) — 마법진 금지(궁수 계열): gv 바람 부채꼴로 대체 */
        this.scene.driveFx?.gvCone(this.x, this.y, this.aimDirFree().angle(), 0xffe9a0, 1.4);
        spawnFlarePop(this.scene, this.x, this.y - 8, "vf_flare_elec", { scale: 1.1, duration: 480 });
        this.scene.cameras.main.shake(80, 0.004);
        break;
      }
      /* 스카이로드 — 천공의 폭풍: 나선 미니 토네이도 12기 + 중심 대형 회오리 + 신속 버프
   *  v3.0.11 — 매직볼트 → 회오리 스프라이트 (시전 자리 대형 토네이도 = 폭풍의 눈) */
      case "skystorm": {
        for (let i = 0; i < 12; i++) {
          this.scene.time.delayedCall(i * 55, () => {
            if (this.state === "dead") return;
            const ang = (i / 12) * Math.PI * 2 + Math.random() * 0.2;
            const { dmg, crit } = this.rollDamage(1.8, true);
            this.scene.fireCyclone({
              x: this.x, y: this.y - 8, angle: ang, speed: 400,
              dmg, crit, hex,
              pull: 0.35, radius: 60, life: 1100, scale: 1.35,
            });
          });
        }
        // 중심 대형 토네이도 — 발동 자리에 세워지는 폭풍의 눈
        this.scene.fireCyclone({
          x: this.x, y: this.y - 8, angle: Math.atan2(0, 1), speed: 0,
          dmg: this.rollDamage(2.2, true).dmg, crit: true, hex,
          pull: 0.6, radius: 130, life: 1800, scale: 3.0,
        });
        this.selfSpdBuff = { mult: 1.3, until: now + 5000 };
        this.recalcSpeed();
        this.scene.spawnBurstAt(this.x, this.y, 22, hex);
        /* v1.0.10 — GameStudio FX: 폭풍의 눈에 자연 엠블럼(소용돌이)+플레어 궤도 */
        this.scene.driveFx?.gvRing(this.x, this.y - 4, "elec", 0x7ade8a, 1.6); this.scene.driveFx?.gvCone(this.x, this.y, this.aimDirFree().angle(), 0x7ade8a, 1.6); /* vc149 #14 마법진→gv 링(궁수) */
        for (let k = 0; k < 3; k++) {
          const a = (Math.PI * 2 * k) / 3;
          spawnFlarePop(this.scene, this.x + Math.cos(a) * 52, this.y - 8 + Math.sin(a) * 36, "vf_flare_nature", { scale: 0.75, duration: 900, angle: a });
        }
        this.scene.cameras.main.shake(100, 0.006);
        this.scene.spawnPickupText(this.x, this.y - 44, "천공의 폭풍! 신속 버프", "#ccffe8");
        break;
      }
      /* 아크로드 — 마나 붕괴: MP를 태워 대폭발 — v3.0.4 임팩트 상향 */
      case "manaburst": {
        const spent = Math.floor(this.mp * 0.6); // 추가 소모 — 남은 MP의 60%
        this.mp -= spent;
        const ratio = Math.min(1, spent / Math.max(1, this.maxMp));
        const mult = 3.2 + 4.2 * ratio;
        this.scene.spawnBurstAt(this.x, this.y, 42, hex);
        this.scene.spawnPillar(this.x, this.y, hex, 190);
        /* v1.0.10 — GameStudio FX: 마나 붕괴 전기 마법진+보이드 링+플레어 코어 */
        spawnPentacle(this.scene, this.x, this.y, 0x8ab0ff, { tex: "vf_penta_elec", scale: 1.45, duration: 820 });
        spawnRingPop(this.scene, this.x, this.y, "vf_ring_void", 0x8ab0ff, 3.2, 600);
        spawnFlarePop(this.scene, this.x, this.y - 6, "vf_flare_elec", { scale: 1.5, duration: 500 });
        this.scene.cameras.main.shake(180, 0.012);
        this.scene.cameras.main.flash(110, 120, 140, 255);
        for (const e of this.getAllTargetsIn(350)) {
          const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
          const { dmg, crit } = this.rollDamage(mult, true);
          if (crit) this.scene.sfxCrit();
          e.takeDamage(dmg, away, 460, crit);
        }
        this.scene.spawnPickupText(this.x, this.y - 44, `마나 붕괴! MP ${spent} 소모`, "#c3cfff");
        break;
      }
      /* 이터널 — 영원의 고리: 광역 기절(시간 정지) — v3.0.4 임팩트 상향
       *  v1.4.30 (#7) — 계수 2.6 고정 → 4.4+0.3·t 사다리 (전 4차기 꼴찌 2.6배가 4차 5.6배로).
       *  보스도 시간 잠금(최대 1.4초 경직 — Boss.applyStun)이 먹어 보스전 실성능 확보. */
      case "eternalloop": {
        const t = this.sTier;
        this.scene.spawnField({
          x: this.x, y: this.y + 10, radius: 380, dur: 1100,
          dps: 0, kind: "time", owner: "player",
        });
        for (const e of this.getAllTargetsIn(380)) {
          (e as Enemy).applyStun?.(3200);
          const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
          const { dmg } = this.rollDamage(4.4 + 0.3 * t, true);
          e.takeDamage(dmg, away, 60, false);
        }
        /* v3.0.7 — 영원(크로니컬 계열) 힐러 정점: 시간 정지 동안 자신 HP 25% + MP 50% 즉시 회복 */
        {
          const heal = Math.max(10, Math.round(this.maxHp * 0.25));
          const mana = Math.max(5, Math.round(this.maxMp * 0.5));
          this.hp = Math.min(this.maxHp, this.hp + heal);
          this.mp = Math.min(this.maxMp, this.mp + mana);
          this.scene.spawnHealFx(this.x, this.y, 0x7dffa8);
          this.scene.spawnPickupText(this.x, this.y - 66, `+${heal} HP · +${mana} MP`, "#7dffa8");
        }
        this.scene.spawnBurstAt(this.x, this.y, 30, 0xb0a0ff);
        this.scene.spawnPillar(this.x, this.y, 0xb0a0ff, 160);
        /* v1.0.10 — GameStudio FX: 시간 정지 디스크 (보이드 링+마법진 스핀+스파크) */
        spawnRingPop(this.scene, this.x, this.y + 8, "vf_ring_void", 0xb0a0ff, 4.4, 1000);
        spawnPentacle(this.scene, this.x, this.y, 0xb0a0ff, { scale: 1.8, duration: 1100, spin: true });
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI * 2 * k) / 6;
          const sx = this.x + Math.cos(a) * 40, sy = this.y + Math.sin(a) * 26;
          const texExists = this.scene.textures.exists("vf_star");
          if (!texExists) break;
          const sp = this.scene.add.image(sx, sy, "vf_star").setDepth(24).setBlendMode(Phaser.BlendModes.ADD).setTint(0xd8ccff).setScale(0.2).setAlpha(0.9);
          this.scene.tweens.add({ targets: sp, x: sx + Math.cos(a) * 90, y: sy + Math.sin(a) * 60, alpha: 0, scale: 0.04, duration: 700, ease: "Cubic.out", onComplete: () => sp.destroy() });
        }
        this.scene.cameras.main.flash(140, 220, 200, 255);
        this.scene.spawnPickupText(this.x, this.y - 44, "영원의 고리 — 시간 정지!", "#ffffff");
        break;
      }
      /* 섀도우로드 — 그림자 군주: 그림자 분신 자폭 — v3.0.4 임팩트 상향 (3분신) */
      case "shadowclon": {
        const targets = this.nearestTargets(3, 520);
        if (targets.length === 0) {
          this.scene.spawnBurstAt(this.x, this.y, 12, hex);
          break;
        }
        targets.forEach((e, i) => {
          this.scene.time.delayedCall(i * 150, () => {
            if (e.active && this.state !== "dead") {
              this.scene.fireShadowClone(e, hex, 3.0);
              /* v1.0.10 — GameStudio FX: 분신 소환 보이드 문양+암흑 플레어 */
              this.scene.driveFx?.gvVoidSpike(e.x, e.y, 0xb08aff, 0.9); /* vc149 #14 마법진→gv 그림자균열(도적) */
              spawnFlarePop(this.scene, e.x, e.y - 6, "vf_flare_dark", { scale: 0.95, duration: 460 });
            }
          });
        });
        this.scene.spawnBurstAt(this.x, this.y, 14, hex);
        break;
      }
      /* 블레이드마스터 — 검무: 적 사이를 점멸하는 연격 — v3.0.4 임팩트 상향 (6대상) */
      case "bladedance": {
        const targets = this.nearestTargets(6, 440);
        if (targets.length === 0) {
          this.scene.spawnSlash(this.x, this.y, this.aimDir(), false, 1.3, hex);
          break;
        }
        targets.forEach((e, i) => {
          this.scene.time.delayedCall(i * 160, () => {
            if (!e.active || this.state === "dead") return;
            // 점멸 — 대상 바로 옆으로 순간이동 후 참격
            const ang = Math.random() * Math.PI * 2;
            const nx = Phaser.Math.Clamp(e.x + Math.cos(ang) * 34, 40, this.scene.physics.world.bounds.width - 40);
            const ny = Phaser.Math.Clamp(e.y + Math.sin(ang) * 34, 40, this.scene.physics.world.bounds.height - 40);
            this.scene.spawnBurstAt(this.x, this.y, 7, hex);
            (this.body as Phaser.Physics.Arcade.Body).reset(nx, ny);
            this.setPosition(nx, ny);
            const dir2 = new Phaser.Math.Vector2(e.x - nx, e.y - ny).normalize();
            this.scene.spawnSlash(nx, ny, dir2, i % 2 === 0, 1.45, hex);
            /* v1.0.10 — GameStudio FX: 점멸 타격 임팩트+애니 참격 교차 (홀수번째) */
            spawnFlarePop(this.scene, e.x, e.y - 6, "vf_impact", { tint: hex, scale: 0.9, duration: 380 });
            if (i % 2 === 0) spawnFlarePop(this.scene, e.x, e.y - 6, "vf_slash", { tint: 0xffffff, scale: 1.05, duration: 360, angle: dir2.angle() });
            spawnRingPop(this.scene, nx, ny, "vf_ring", hex, 1.7, 360);
            const { dmg, crit } = this.rollDamage(2.4, true);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, dir2, 240, crit);
            this.facing.copy(dir2);
          });
        });
        this.scene.cameras.main.shake(110, 0.006);
        this.scene.time.delayedCall(targets.length * 160 + 120, () => {
          if (this.state === "attack") this.state = "idle";
        });
        break;
      }
    }
    // 블레이드마스터/돌진류는 자체 타이밍 — 기본 복귀 300ms (이미 지정된 경우 무해)
    this.scene.time.delayedCall(300, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  /* v1.0.16 (O9) — 스킬 판정마다 새 배열을 만들던 것을 스크래치 버퍼 재사용으로 바꾼다.
   *  getAllTargets()는 이미 프레임 캐시를 반환하므로(WorldScene), 남은 비용은 filter가 만드는
   *  중간 배열이었다. 스킬 판정 48곳에서 호출되고 전부 for...of로 즉시 소비하므로
   *  한 틱 안에서 버퍼를 재사용해도 안전하다(자동전투 autoLiveScratch와 같은 방식).
   *  ⚠️ 반환 배열을 보관하거나 다음 호출 뒤에 쓰면 덮어써진다 — 이번 틱에서만 유효. */
  private targetScratch: (Enemy | Boss)[] = [];

  /** 반경 내 대상 목록 — 3차/4차 광역 스킬 판정용 (반환 배열은 다음 호출까지 유효) */
  getAllTargetsIn(radius: number): (Enemy | Boss)[] {
    const out = this.targetScratch;
    out.length = 0;
    const cx = this.x, cy = this.y;
    const r2 = radius * radius; // 제곱 비교로 sqrt 제거
    for (const e of this.scene.getAllTargets()) {
      if (!e.active) continue;
      const dx = e.x - cx, dy = e.y - cy;
      if (dx * dx + dy * dy <= r2) out.push(e);
    }
    return out;
  }

  /* ---------------- v3.0.3 — 상태이상 (출혈/독/감속) ---------------- */

  /** 몬스터가 부여한 상태이상 */
  applyEnemyStatus(kind: "bleed" | "poison" | "slow", dps: number, durMs: number) {
    if (kind === "slow") {
      this.dots.slow = { mult: 0.55, until: this.scene.time.now + durMs };
      this.recalcSpeed();
      this.scene.spawnPickupText(this.x, this.y - 40, "이동 속도 감속!", "#a8d8fa");
    } else {
      this.applyDot(kind, dps, durMs);
      this.scene.spawnPickupText(this.x, this.y - 40, kind === "bleed" ? "출혈!" : "독!", kind === "bleed" ? "#ff8a8a" : "#7ade4a");
    }
    this.scene.emitHud();
  }

  applyDot(kind: "bleed" | "poison", dps: number, durMs: number) {
    this.dots[kind] = { dps, until: this.scene.time.now + durMs };
  }

  /** 장판 지속 피해 — 무적시간 무시(회피 가능한 지면 공격), 사망 처리 포함 */
  applyFieldDamage(v: number, kind: "poison" | "burn") {
    if (this.state === "dead") return;
    const dmg = Math.max(1, Math.round(v));
    this.hp -= dmg;
    this.scene.spawnDamageText(this.x, this.y - 34, dmg);
    if (kind === "poison") this.setTint(0x9ade8a);
    else this.setTint(0xffb08a);
    /* v1.0.19 — 외형 색조(lookTint) 보존: clearTint 대신 look 복원 경유 */
    this.scene.time.delayedCall(120, () => this.state !== "dead" && this.applyLookTint());
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = "dead";
      this.setVelocity(0, 0);
      this.scene.onPlayerDead();
    }
    this.scene.emitHud();
  }

  /** 도트/감속 틱 — update에서 호출 */
  private tickDots(ms: number) {
    const now = this.scene.time.now;
    let expired = false;
    if (this.dots.bleed && now >= this.dots.bleed.until) { this.dots.bleed = null; expired = true; }
    if (this.dots.poison && now >= this.dots.poison.until) { this.dots.poison = null; expired = true; }
    if (this.dots.slow && now >= this.dots.slow.until) { this.dots.slow = null; expired = true; this.recalcSpeed(); }
    if (expired) this.scene.emitHud();
    this.dotAcc += ms;
    if (this.dotAcc < 1000) return;
    this.dotAcc -= 1000;
    const total = (this.dots.bleed?.dps ?? 0) + (this.dots.poison?.dps ?? 0);
    if (total <= 0 || this.state === "dead") return;
    const dmg = Math.max(1, Math.round(total));
    this.hp -= dmg;
    this.scene.spawnDamageText(this.x, this.y - 34, dmg);
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = "dead";
      this.setVelocity(0, 0);
      this.scene.onPlayerDead();
    }
    this.scene.emitHud();
  }

  /* ---------------- v3.2.0 — 5차 궁극기 (Lv.200 · 쿨타임 60초 고정 · MP 100) ----------------
   *  유저 지시: "5차스킬(200렙), (쿨타임 1분) ㅈㄴ 강력하고 화려한 궁극기"
   *  · 계열(warrior/ranger/mage/thief)별 전용 연출 — 4차 궁극기의 2배 이상 피해
   *  · 시퀀스 전체에 화면 플래시/쉐이크/기둥/폭발/필드를 겹쳐 "궁극기"급 임팩트
   * v3.3.0 (지시 #2) — 4차 세부직업 8종 전부 "고유 궁극기"로 분리 (겹침 0).
   *  4차 미달 플레이어는 기존 계열 궁극기 폴백. */  useSkill5() {
    if (this.state !== "idle" || !this.skill5Unlocked || this.skill5Cd > 0 || this.mp < 100) return;
    this.mp -= 100;
    this.skill5Cd = this.skill5Max; // 60초 고정 (cdMult 미적용)
    this.state = "attack";
    this.hitSet.clear();
    this.setVelocity(0, 0);
    this.netEmitAction("s5"); // v4.1.0
    const hex = this.clsHex();
    const key5 = resolveSkill5Of(this.cls);
    const info = SKILL5_INFO[key5];
    const now = this.scene.time.now;

    /* vc147 (#18) — 1차 궁극기 피해 ×300% (FIFTH1_MULT): 궁극기 시전 중 rollDamage에
     *  슬롯 계수를 태워 n차 사다리/FIFTH_SKILL_MULT 중복 대신 요구치 그대로 3.0배 단일 배율 적용 */
    const rd = (m: number, forceCrit = false) => { this.ultSlot = 1; const r = this.rollDamage(m, true, forceCrit); this.ultSlot = 0; return r; };

    /* 공통 인트로 — 시간 정지 + 차원 균열 + 궁극기 발동 안내 */
    this.scene.sfxSkill("timestop", 1.06);
    this.scene.cameras.main.flash(140, 255, 255, 255);
    this.scene.spawnPickupText(this.x, this.y - 58, `★ ${info.name} ★`, "#ffe66a");
    /* v1.0.10 — GameStudio FX 궁극기 인트로: 프리렌더 3D 마법진(클래스 컬러 스핀)+이중 확장 링+
     *  임팩트 코어+4방향 스파크 합성 — "4차·5차 밋밋함" 지시의 대표 개선점 */
    /* v1.0.10 — GameStudio FX 궁극기 인트로 · vc147 (#14) — 지면 연출 계열 분화:
     *  마법사만 마법진, 전사=대지 균열 / 궁수=화살 부채꼴 / 도적=공허 섬광 / 해적=대폭발
     *  (전 직업 동일 펜타클 "마법진 우려먹기" 해소) */
    spawnUltIntroSig(this.scene, this.x, this.y, hex, (familyOf(this.cls) ?? "default") as FamKey | "pirate" | "default");
    /* v1.4.0 (Task 3-1 — 유저 지시 #13) — 직업별 고유 VFX2 시그니처 연출 (8직업 1:1 매핑) */
    spawnUltFlourish(this.scene, this.x, this.y, key5, hex);
    const ring = this.scene.add.circle(this.x, this.y, 34)
      .setStrokeStyle(3, hex, 0.95).setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: ring, scale: 3.4, alpha: 0, duration: 700, ease: "Cubic.out", onComplete: () => ring.destroy() });
    this.scene.spawnBurstAt(this.x, this.y, 34, hex);

    switch (key5) {
      /* 워브링어 — 천멸극: 참격 9연속 + 광역 출혈 + 분노의 대붕괴 종결일격 */
      case "warbringer": {
        for (let i = 0; i < 9; i++) {
          this.scene.time.delayedCall(260 + i * 210, () => {
            if (this.state === "dead") return;
            const dir = this.aimDirFree().normalize();
            const ox = this.x + dir.x * (i % 2 === 0 ? 52 : -52);
            const oy = this.y + dir.y * (i % 2 === 0 ? 34 : -34);
            this.scene.spawnSlash(ox, oy, dir, i % 2 === 0, 3.4 + i * 0.24, hex);
            this.scene.spawnSpinSlash(ox, oy, 1);
            this.scene.cameras.main.shake(120, 0.009 + i * 0.0012);
            this.scene.sfxSkill("bigsword", 0.9 + (i % 4) * 0.06);
            for (const e of this.getAllTargetsIn(440)) {
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(2.6);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 440, crit);
              this.applyEnemyStatus("bleed", Math.max(6, Math.round(this.atkTotal * 0.012)), 5000); // 전장에 출혈이 끊이지 않는다
            }
          });
        }
        /* 종결 일격 — 분노의 대붕괴 */
        this.scene.time.delayedCall(260 + 9 * 210 + 120, () => {
          if (this.state === "dead") return;
          this.scene.spawnCrack(this.x, this.y);
          this.scene.spawnPillar(this.x, this.y, hex, 300);
          this.scene.spawnBurstAt(this.x, this.y, 80, hex);
          /* v1.0.10 — GameStudio FX 종결 강화: 화염 링+대형 플레어+전투 엠블럼 (천멸의 각인) */
          spawnRingPop(this.scene, this.x, this.y, "vf_ring_fire", 0xffffff, 5.2, 720);
          spawnFlarePop(this.scene, this.x, this.y - 8, "vf_flare_fire", { scale: 2.3, duration: 640 });
          this.scene.driveFx?.gvFireCircle(this.x, this.y, 0xffa060, 950, 1.5); this.scene.driveFx?.gvCore(this.x, this.y, 0xffd0a0, 1.6); /* vc149 #14 마법진→gv 불서클(전사) */
          this.scene.cameras.main.shake(460, 0.022);
          this.scene.cameras.main.flash(170, 255, 110, 50);
          this.scene.sfxSkill("superhit", 0.82);
          for (const e of this.getAllTargetsIn(620)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(7.4);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 640, crit);
          }
        });
        this.selfAtkBuff = { mult: 1.65, until: now + 12000 };
        break;
      }

      /* 크루세이더 — 성흔극: 성스러운 빛기둥 9연타 + 성검 강림 + 완전 회복 */
      case "crusader": {
        for (let i = 0; i < 9; i++) {
          this.scene.time.delayedCall(280 + i * 200, () => {
            if (this.state === "dead") return;
            const t = this.nearestTargets(4, 700)[i % 4];
            const px = t ? t.x : this.x + (Math.random() - 0.5) * 460;
            const py = t ? t.y : this.y + (Math.random() - 0.5) * 340;
            this.scene.spawnPillar(px, py, 0xffe9a0, 250);
            this.scene.spawnBurstAt(px, py, 26, 0xffe9a0);
            this.scene.spawnRuneRing(px, py, 0xffe9a0);
            this.scene.cameras.main.shake(120, 0.009);
            this.scene.sfxSkill("holy", 0.95 + (i % 3) * 0.07);
            for (const e of this.getAllTargetsIn(300)) {
              if (Phaser.Math.Distance.Between(e.x, e.y, px, py) > 200) continue;
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(3.2);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 440, crit);
            }
          });
        }
        /* 종결 — 성검 강림 (전장 전체 정화 + 자신 완전 회복) */
        this.scene.time.delayedCall(280 + 9 * 200 + 140, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x, this.y, 0xffffff, 320);
          this.scene.spawnPurifyRing(this.x, this.y, 560, 0xffe9a0);
          this.scene.spawnBurstAt(this.x, this.y, 80, 0xffe9a0);
          /* v1.0.10 — GameStudio FX 종결 강화: 대형 골드 마법진 스핀+정화 링 */
          this.scene.driveFx?.gvFireCircle(this.x, this.y, 0xffe9a0, 1150, 1.8); this.scene.driveFx?.gvAura(this.x, this.y, 0xffe9a0, 1500, 1.6); /* vc149 #14 마법진→gv 성역(전사) */
          spawnRingPop(this.scene, this.x, this.y, "vf_ring", 0xffe9a0, 5.0, 800);
          this.scene.cameras.main.flash(200, 255, 245, 200);
          this.scene.cameras.main.shake(460, 0.02);
          this.scene.sfxSkill("holy", 0.72);
          this.scene.sfxSkill("superhit", 0.86);
          for (const e of this.getAllTargetsIn(580)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(6.2);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 620, crit);
          }
          const before = this.hp;
          this.hp = this.maxHp;
          this.mp = Math.min(this.maxMp, this.mp + 50);
          this.scene.spawnHealFx(this.x, this.y, 0xffe9a0);
          this.scene.driveFx?.healPuff(this.x, this.y - 8); // vc147 (#7) — Drive 팩 힐 이펙트 활성화
          this.scene.spawnPickupText(this.x, this.y - 70, `완전 회복 +${Math.round(this.maxHp - before)}`, "#ffe9a0");
          this.selfDefBuff = { add: 40, until: this.scene.time.now + 10000 };
        });
        break;
      }

      /* 데드아이 — 신시극: 확정 크리 유도 화살 32연발 + 신의 저격선 3연사 */
      case "deadeye": {
        for (let i = 0; i < 32; i++) {
          this.scene.time.delayedCall(240 + i * 80, () => {
            if (this.state === "dead") return;
            const t = this.nearestTargets(1, 820)[0];
            if (!t) return;
            const ang = Math.atan2(t.y - this.y, t.x - this.x) + (Math.random() - 0.5) * 0.85;
            const { dmg, crit } = rd(1.7, true); // 확정 크리티컬 — 절사명중
            this.scene.firePlayerProj({
              x: this.x, y: this.y - 8, angle: ang, speed: 950, pierce: 3,
              dmg, crit, tint: 0xffe08a, knock: 260, scale: 1.9,
              tex: "x2_arrow", blend: "add", rot: true, homing: true,
              trail: 0xffd76a,
            });
            if (i % 8 === 0) this.scene.sfxSkill("arrowpierce", 1.08);
          });
        }
        /* 종결 — 신의 저격선 3연사 (광역 관통) */
        for (let b = 0; b < 3; b++) {
          this.scene.time.delayedCall(240 + 32 * 80 + 120 + b * 220, () => {
            if (this.state === "dead") return;
            const dir = this.aimDirFree().normalize();
            this.scene.spawnSnipeBeam(this.x, this.y - 8, this.x + dir.x * 1400, this.y + dir.y * 1400, 0xffd76a);
            this.scene.cameras.main.shake(140, 0.012);
            this.scene.sfxSkill("snipe", 0.85);
            /* v1.0.10 — GameStudio FX: 저격선 발사 코어 플레어+스파크 */
            spawnFlarePop(this.scene, this.x, this.y - 8, "vf_flare_elec", { tint: 0xffd76a, scale: 1.15, duration: 420 });
            spawnFlarePop(this.scene, this.x + dir.x * 60, this.y - 8 + dir.y * 60, "vf_arrow", { tint: 0xffe9a0, scale: 1.2, duration: 460, angle: dir.angle() });
            for (const e of this.getAllTargetsIn(1400)) {
              const rel = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y);
              if (rel.normalize().dot(dir) < 0.92) continue; // 저격선 근처만
              const { dmg, crit } = rd(4.6, true);
              e.takeDamage(dmg, dir, 420, true);
            }
          });
        }
        break;
      }

      /* 스카이로드 — 천풍극: 초대형 회오리 14기 + 연쇄 낙뢰 + 신속 대버프 */
      case "skylord": {
        for (let i = 0; i < 14; i++) {
          this.scene.time.delayedCall(240 + i * 130, () => {
            if (this.state === "dead") return;
            const t = this.nearestTargets(1, 900)[0];
            const base = t
              ? Math.atan2(t.y - this.y, t.x - this.x)
              : Math.random() * Math.PI * 2;
            const { dmg, crit } = rd(1.9);
            this.scene.fireCyclone({
              x: this.x, y: this.y - 10, angle: base + (i - 7) * 0.16, speed: 520,
              dmg, crit, hex, pull: 150, radius: 120, life: 1500, scale: 2.1,
            });
            if (i % 4 === 0) this.scene.sfxSkill("wind", 0.9);
          });
        }
        /* 종결 — 연쇄 낙뢰 (전장을 씻는다) */
        this.scene.time.delayedCall(240 + 14 * 130 + 140, () => {
          if (this.state === "dead") return;
          const marks = this.nearestTargets(6, 800);
          const list = marks.length > 0 ? marks : [];
          list.forEach((t, i) => {
            this.scene.time.delayedCall(i * 110, () => {
              if (this.state === "dead" || !t.active) return;
              this.scene.spawnPillar(t.x, t.y, 0xaed8ff, 240);
              this.scene.spawnBurstAt(t.x, t.y, 24, 0xaed8ff);
              /* v1.0.10 — GameStudio FX: 낙뢰 3D 플레어+임팩트 (연쇄 낙뢰) */
              spawnFlarePop(this.scene, t.x, t.y - 10, "vf_lightning", { tint: 0xcfe8ff, scale: 1.3, duration: 420 });
              spawnRingPop(this.scene, t.x, t.y, "vf_ring", 0xaed8ff, 2.0, 420);
              this.scene.cameras.main.shake(110, 0.011);
              this.scene.sfxSkill("thunder", 0.82 + (i % 3) * 0.08);
              const away = new Phaser.Math.Vector2(0, 0.1).normalize();
              const { dmg, crit } = rd(3.4);
              if (crit) this.scene.sfxCrit();
              t.takeDamage(dmg, away, 420, crit);
            });
          });
          if (list.length === 0) {
            this.scene.spawnPillar(this.x, this.y, 0xaed8ff, 260);
            this.scene.cameras.main.flash(150, 190, 230, 255);
          }
          this.selfSpdBuff = { mult: 1.4, until: this.scene.time.now + 9000 };
          this.recalcSpeed();
          this.scene.spawnPickupText(this.x, this.y - 60, "신속 대버프!", "#aed8ff");
        });
        break;
      }
      /* 아크로드 — 종막극: 운석 12발 + MP를 태우는 마나 붕괴 3중 폭발 */
      case "arclord": {
        for (let i = 0; i < 12; i++) {
          this.scene.time.delayedCall(280 + i * 190, () => {
            if (this.state === "dead") return;
            const t = this.nearestTargets(3, 680)[i % 3];
            const px = t ? t.x + (Math.random() - 0.5) * 70 : this.x + (Math.random() - 0.5) * 560;
            const py = t ? t.y + (Math.random() - 0.5) * 70 : this.y + (Math.random() - 0.5) * 560;
            this.scene.spawnPillar(px, py, hex, 260);
            this.scene.spawnBurstAt(px, py, 30, hex);
            this.scene.cameras.main.shake(130, 0.01);
            this.scene.sfxSkill("thunder", 0.88 + (i % 3) * 0.08);
            for (const e of this.getAllTargetsIn(310)) {
              if (Phaser.Math.Distance.Between(e.x, e.y, px, py) > 200) continue;
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(3.0);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 460, crit);
            }
          });
        }
        /* 종결 — 마나 붕괴 3중 폭발 (잔여 MP를 전부 태운다 — 비례 대미지) */
        this.scene.time.delayedCall(280 + 12 * 190 + 140, () => {
          if (this.state === "dead") return;
          const ratio = Phaser.Math.Clamp(this.mp / Math.max(1, this.maxMp), 0, 1);
          this.mp = 0; // 오버로드 — 잔여 MP 전부 소모
          this.scene.spawnPillar(this.x, this.y, 0xffffff, 320);
          this.scene.spawnCrack(this.x, this.y);
          this.scene.spawnBurstAt(this.x, this.y, 90, hex);
          /* v1.0.10 — GameStudio FX 종결 강화: 전기 마법진+보이드 링 3중 합성 (마나 붕괴)
           *  vc149 (#11) — 밋밋했던 마지막 한 방 강화: gv 코어+스테이크+스펙스+쇼크 4중 합성
           *  + 백색 섬광으로 '마나 붕괴' 종결 임팩트를 확실히 전달 */
          spawnPentacle(this.scene, this.x, this.y, 0x8ab0ff, { tex: "vf_penta_elec", scale: 2.8, duration: 1000 });
          spawnRingPop(this.scene, this.x, this.y, "vf_ring_void", 0xaec6ff, 5.4, 820);
          spawnFlarePop(this.scene, this.x, this.y - 8, "vf_flare_elec", { scale: 2.4, duration: 620 });
          /* vc150 (#신규8) — 마법진 8장 방사: 붕괴의 충격으로 마법진들이 중심에서 주변으로
           *  튕겨 나가며 비행 경로(중간 50%+종착 100%)에서 적에게 피해를 준다 (유저 지시
           *  "아크로드 5차가 터질때 마법진들이 주변으로 튕겨 나가면서 딜이 들어가야함") */
          const arclordTargets = this.scene.getAllTargets();
          for (let ci = 0; ci < 8; ci++) {
            const cAng = (ci / 8) * Math.PI * 2 + Math.random() * 0.35;
            const cDist = 340 + Math.random() * 160;
            const cx = this.x + Math.cos(cAng) * cDist;
            const cy = this.y + Math.sin(cAng) * cDist;
            const circle = this.scene.add.image(this.x, this.y, "vf_penta_elec")
              .setTint(0x8ab0ff)
              .setBlendMode(Phaser.BlendModes.ADD)
              .setDepth(60)
              .setScale(0.85)
              .setRotation(Math.random() * Math.PI);
            this.scene.tweens.add({
              targets: circle,
              x: cx, y: cy, scale: 1.6, rotation: circle.rotation + 2.6, alpha: { from: 1, to: 0.85 },
              duration: 560,
              ease: "Cubic.easeOut",
              onComplete: () => {
                this.scene.spawnBurstAt(circle.x, circle.y, 22, 0x8ab0ff);
                this.scene.tweens.add({
                  targets: circle, alpha: 0, scale: 2.1, duration: 230,
                  onComplete: () => circle.destroy(),
                });
              },
            });
            for (const frac of [0.5, 1]) {
              this.scene.time.delayedCall(560 * frac + 30, () => {
                if (this.state === "dead") return;
                const hx = this.x + Math.cos(cAng) * cDist * frac;
                const hy = this.y + Math.sin(cAng) * cDist * frac;
                for (const e of arclordTargets) {
                  if (!e.active) continue;
                  if (Phaser.Math.Distance.Between(hx, hy, e.x, e.y) > 140) continue;
                  const away = new Phaser.Math.Vector2(e.x - hx, e.y - hy).normalize();
                  const { dmg, crit } = rd(1.8); // 마법진 1장당 피해
                  if (crit) this.scene.sfxCrit();
                  e.takeDamage(dmg, away, 520, crit);
                }
              });
            }
          }
          this.scene.driveFx?.gvCore(this.x, this.y, 0xcfe0ff, 2.4);
          this.scene.driveFx?.gvStreaks(this.x, this.y, 0xaec6ff, 2.2);
          this.scene.driveFx?.gvShock(this.x, this.y, 0x8ab0ff, 2.6, 860);
          this.scene.driveFx?.gvFlash(this.x, this.y, 0xffffff, 2.2);
          this.scene.driveFx?.gvSpecks(this.x, this.y, 0xcfe0ff, 18, 300);
          this.scene.spawnField({
            x: this.x, y: this.y, radius: 250, dur: 6000,
            dps: Math.max(18, Math.round(this.atkTotal * 1.7)),
            kind: "light", owner: "player",
          });
          this.scene.cameras.main.flash(220, 220, 200, 255);
          this.scene.cameras.main.shake(520, 0.024);
          this.scene.sfxSkill("manaburst", 0.72);
          this.scene.sfxSkill("superhit", 0.8);
          for (const e of this.getAllTargetsIn(650)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(6.0 + 3.0 * ratio); // MP 비례 최대 +3.0배
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 640, crit);
          }
        });
        break;
      }

      /* 이터널 — 영겁극: 시간 정지 + 7중 잔상 폭발 (잔상이 두 번 울린다)
       *  v1.4.30 (#7) — 기둥 3.4→4.0 · 잔상 1.7→2.2(상시) · 종결 6.4→8.0 —
       *  데드아이 신시극(68배)에 필적하는 63배급 종결기로 재조정.
       *  vc149 (#13) — 이터널 개성 강화: 별하늘 오버레이 + 에너지 웹 + 기절 3.2→4.5초
       *  (시간의 신 테마를 gv_* 3D 팩 텍스처로 체감 — 별이 흐르는 정지된 세계) */
      case "eternal": {
        this.scene.driveFx?.gvStarry(this.x, this.y, 2.6, 3400);
        this.scene.driveFx?.gvEnergyWeb(this.x, this.y, 0xb0a0ff, 2.2, 1600);
        /* 시간 정지 — 전장의 적 전원 4.5초 기절 + 시간 필드 */
        this.scene.spawnField({
          x: this.x, y: this.y + 10, radius: 460, dur: 2600,
          dps: 0, kind: "time", owner: "player",
        });
        for (const e of this.getAllTargetsIn(460)) {
          (e as Enemy).applyStun?.(4500);
        }
        this.scene.cameras.main.flash(200, 200, 190, 255);
        this.scene.spawnPickupText(this.x, this.y - 66, "시간이 붕괴된다...", "#d8ccff");
        for (let i = 0; i < 7; i++) {
          this.scene.time.delayedCall(300 + i * 220, () => {
            if (this.state === "dead") return;
            const t = this.nearestTargets(4, 700)[i % 4];
            const px = t ? t.x : this.x + (Math.random() - 0.5) * 480;
            const py = t ? t.y : this.y + (Math.random() - 0.5) * 380;
            this.scene.spawnPillar(px, py, 0xb0a0ff, 230);
            this.scene.spawnBurstAt(px, py, 26, 0xb0a0ff);
            this.scene.spawnRuneRing(px, py, 0xb0a0ff);
            this.scene.cameras.main.shake(120, 0.01);
            this.scene.sfxSkill("timestop", 1.1 + (i % 3) * 0.08);
            for (const e of this.getAllTargetsIn(300)) {
              if (Phaser.Math.Distance.Between(e.x, e.y, px, py) > 210) continue;
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(4.0);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 400, crit);
              /* 잔상 — 같은 피해가 두 번 울린다 (상시) */
              this.scene.time.delayedCall(170, () => {
                if (!e.active) return;
                const { dmg: echo } = rd(2.2);
                e.takeDamage(echo, away, 120, false);
              });
            }
          });
        }
        /* 종결 — 영겁의 균열 */
        this.scene.time.delayedCall(300 + 7 * 220 + 150, () => {
          if (this.state === "dead") return;
          this.scene.spawnCrack(this.x, this.y);
          this.scene.spawnPillar(this.x, this.y, 0xd8ccff, 300);
          this.scene.spawnBurstAt(this.x, this.y, 76, 0xb0a0ff);
          /* v1.0.10 — GameStudio FX 종결 강화: 영겁의 균열 — 시간 마법진 스핀+보이드 링
           *  vc149 (#13) — gv 충격파+스펙스로 균열 잔향 강화 */
          spawnPentacle(this.scene, this.x, this.y, 0xb0a0ff, { scale: 2.8, duration: 1150, spin: true });
          spawnRingPop(this.scene, this.x, this.y + 6, "vf_ring_void", 0xffffff, 5.0, 860);
          this.scene.driveFx?.gvShock(this.x, this.y, 0xd8ccff, 2.4, 800);
          this.scene.driveFx?.gvSpecks(this.x, this.y, 0xe8e0ff, 16, 260);
          this.scene.driveFx?.gvCore(this.x, this.y, 0xd8ccff, 2.0);
          this.scene.cameras.main.flash(200, 216, 204, 255);
          this.scene.cameras.main.shake(480, 0.02);
          this.scene.sfxSkill("superhit", 0.84);
          for (const e of this.getAllTargetsIn(580)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(8.0); // v1.4.30 (#7) 6.4→8.0
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 620, crit);
          }
        });
        break;
      }

      /* 섀도우로드 — 심연극: 그림자 군주 강림 — 10연속 참수 + 분신 3기 + 심연 뉴클리어 */
      case "shadowlord": {
        const marks = this.nearestTargets(10, 780);
        marks.forEach((t, i) => {
          this.scene.time.delayedCall(260 + i * 160, () => {
            if (this.state === "dead" || !t.active) return;
            const ang = Math.random() * Math.PI * 2;
            this.setPosition(t.x - Math.cos(ang) * 26, t.y - Math.sin(ang) * 26);
            this.scene.spawnSlash(t.x, t.y, new Phaser.Math.Vector2(Math.cos(ang), Math.sin(ang)), i % 2 === 0, 2.9, 0x1a1030);
            this.scene.spawnBurstAt(t.x, t.y, 18, 0x8a4aff);
            this.scene.sfxSkill("iainuki", 0.9 + (i % 4) * 0.05);
            const { dmg, crit } = rd(3.4);
            if (crit) this.scene.sfxCrit();
            t.takeDamage(dmg, new Phaser.Math.Vector2(0, 0.1).normalize(), 300, crit);
          });
        });
        /* 그림자 분신 3기 — 살아남은 적을 추적해 자폭 */
        for (let c = 0; c < 3; c++) {
          this.scene.time.delayedCall(260 + marks.length * 160 + 100 + c * 200, () => {
            if (this.state === "dead") return;
            const t = this.nearestTargets(1, 700)[0];
            if (t) this.scene.fireShadowClone(t, 0x8a4aff, 3.4);
          });
        }
        /* 종결 — 심연 뉴클리어 */
        this.scene.time.delayedCall(260 + marks.length * 160 + 760, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x, this.y, 0x8a4aff, 290);
          this.scene.spawnBurstAt(this.x, this.y, 80, 0x8a4aff);
          this.scene.spawnCrack(this.x, this.y);
          /* v1.0.10 — GameStudio FX 종결 강화: 심연 각인 (보이드 엠블럼+암흑 플레어+보이드 링) */
          this.scene.driveFx?.gvVoidSpike(this.x, this.y, 0xc090ff, 1.8); this.scene.driveFx?.gvSkull(this.x, this.y, 0xc090ff, 1.4); /* vc149 #14 마법진→gv 심연(도적) */
          spawnFlarePop(this.scene, this.x, this.y - 8, "vf_flare_dark", { scale: 2.2, duration: 640 });
          spawnRingPop(this.scene, this.x, this.y, "vf_ring_void", 0xffffff, 4.8, 780);
          this.scene.cameras.main.flash(190, 90, 40, 160);
          this.scene.cameras.main.shake(500, 0.022);
          this.scene.sfxSkill("dark", 0.66);
          this.scene.sfxSkill("superhit", 0.8);
          for (const e of this.getAllTargetsIn(560)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(6.9);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 600, crit);
            this.applyEnemyStatus("bleed", Math.max(8, Math.round(this.atkTotal * 0.014)), 6000);
          }
        });
        break;
      }

      /* 블레이드마스터 — 극의: 무한 검무 오십연타 (v1.0.13 피드백#4 — 유저 지시 "무한 검무 50연타로 바꾸고 좀더 강하게")
       *  · 데모(死 스킬 데모) 연출 차용: 붉은 死 한자 블룸 + 가속 연타 + HIT 카운터 + 시네마 레터박스
       *  · 가속 리듬: 시작 96ms 간격 → 베기마다 ~1.55ms씩 단축 → 마지막 20ms (50베기 총 ≈3.1초)
       *  · 화력 상향: 기존 100×0.36 + 7.0 = 43.0배 → 50×0.80 + 7.5 = 47.5배 (≈ +10% — 타수는 절반, 한 컷 한 컷은 크게)
       *  · 한자 블룸은 DeathSlash 본 연출보다 절제 톤(투명도 0.38·발광 반폭) — "한자 블룸이 너무 찐해" 반영
       *  · v1.0.14 (#11): 개전 풀 블랙아웃(0→200ms 완전 암전) → 死 한자·레터박스와 함께 절개,
       *    종결 일격 직전 순간 암전(≈140ms)→붉은 섬광 컷 — 암전은 Phaser Rectangle(카메라 고정·depth 최상단) 페이드 트윈
       *  · v1.0.14 (#13): 死 한자 옆 대형 콤보 카운터(매 베기 증가·스케일 펄스) + 종료 후 콤보 잔존 버그 수리
       *    (씬 셔다운·사망 경로 하드 클린업 — 예약 콜백이 오브젝트를 되살리지 못하게 차단) */
      case "blademaster": {
        const targets = this.nearestTargets(14, 820);
        const seq = targets.length > 0 ? targets : [];
        const CUTS = 50;
        const IV_START = 96, IV_MIN = 20;
        const decay = (IV_START - IV_MIN) / (CUTS - 1);
        /* 컷별 시작 시각 사전 계산 (가속 리듬) */
        const starts: number[] = [];
        let acc = 240;
        for (let i = 0; i < CUTS; i++) {
          starts.push(acc);
          acc += Math.max(IV_MIN, IV_START - decay * i);
        }
        const totalMs = acc; // 마지막 컷 종료 시각

        /* ── 시네마 오버레이 (DOM — DeathSlash와 동일 패턴, 절제 톤) ── */
        const ovParent = this.scene.game.canvas.parentElement;
        let kanji: HTMLDivElement | null = null;
        let hitBox: HTMLDivElement | null = null;
        const bars: HTMLDivElement[] = [];
        const ovTimers: number[] = [];
        const ovCalls: Phaser.Time.TimerEvent[] = []; // #13 — 시퀀스 예약 전량 추적 (하드 정리 시 회수)
        let ovGone = false; // #13 — 하드 정리 후 모든 예약 콜백 전면 차단 (오브젝트 되살리기 방지)
        /* #11 — 암전 오버레이: Phaser Rectangle (depth 최상단·스크롤 고정 = 카메라 고정) + 페이드 트윈.
         *  유지 시간은 짧게(개전 200ms/종결 140ms) — 모바일 저사양에서 프레임 드랍으로 오해되지 않게.
         *  depth 9000: 미니맵(95·96) 위, 튜토리얼 HUD(9100+) 아래. */
        let blackRect: Phaser.GameObjects.Rectangle | null = null;
        try {
          const cam = this.scene.cameras.main;
          blackRect = this.scene.add.rectangle(cam.width / 2, cam.height / 2, cam.width + 8, cam.height + 8, 0x000000)
            .setScrollFactor(0)
            .setDepth(9000);
          blackRect.setAlpha(1); // 개전 즉시 컷 — 풀 블랙아웃으로 시작
        } catch { blackRect = null; /* 헤들리스 등 — 암전 없이 전투만 */ }
        /* vc154 — 오버레이 시퀀스 타이밍은 전부 게임 시간(scene.time)으로 통일:
         *  컷 예약은 게임 시간인데 안전망·소산만 실시간(setTimeout)이면 저FPS 환경에서
         *  게임 시간이 늦어진 만큼 연출 도중 안전망이 먼저 뜯어진다 (헤들리스 9FPS 실측 재현).
         *  #11 암전 트윈도 게임 시간(scene.tweens) — 실시간/게임시간 혼용 금지 컨벤션 유지.
         *  window 실시간 타이머는 최후 유출 방지 백스톱(30초)만 둔다. */
        const ovAt = (ms: number, f: () => void) => {
          /* 게임 시간 기반 스케줄 — 씬이 죽으면 함께 정리된다 (유출 없음) */
          const te = this.scene.time.delayedCall(ms, () => { if (!ovGone) { try { f(); } catch { /* 오버레이 실패는 전투에 영향 없음 */ } } });
          ovCalls.push(te);
        };
        /* 최후 백스톱 — 어떤 경우에도 DOM 유출 없게 (실시간 30초) */
        ovTimers.push(window.setTimeout(() => { try { ovHardCleanup(); } catch { /* 무시 */ } }, 30000));
        try {
          if (ovParent) {
            /* 레터박스 — 상하 블랙바 (데모 연출, vc154) — #11: 블랙아웃 절개 시점에 함께 열린다 */
            for (const side of ["top", "bottom"]) {
              const bar = document.createElement("div");
              bar.style.cssText = `position:absolute;left:0;${side}:0;width:100%;height:0;background:#000;opacity:0.82;pointer-events:none;z-index:7;transition:height 300ms ease-out;`;
              ovParent.appendChild(bar);
              bars.push(bar);
            }
            /* 붉은 死 한자 — 절제 블룸 (블러 반폭·투명도 0.38 — DeathSlash 1.0 대비 소프트)
             *  #11: 블룸 트리거를 절개 시점(200ms)으로 이동 — 어둠 속에서 한자가 떠오르는 절개 */
            kanji = document.createElement("div");
            kanji.textContent = "死";
            kanji.style.cssText = [
              "position:absolute;left:50%;top:42%;transform:translate(-50%,-50%) scale(0.5)",
              "pointer-events:none;z-index:7",
              "font-family:'Noto Serif SC','Noto Serif KR',serif;font-weight:900",
              "font-size:min(30vh,30vw);line-height:1;color:#e01818",
              "text-shadow:0 0 10px #ff2a2a,0 0 22px #c80000",
              "opacity:0",
              "will-change:transform,opacity",
            ].join(";");
            ovParent.appendChild(kanji);
            /* #13 — 콤보 카운터: 死 한자 바로 옆(우측) 대형 표기 — 기존 우상단 30px 카운터를 이동·확대.
             *  매 베기마다 증가 + 스케일 펄스, 死 한자와 동일 붉은 톤. */
            hitBox = document.createElement("div");
            hitBox.style.cssText = [
              "position:absolute;left:calc(50% + min(23vh,23vw));top:42%;transform:translate(-50%,-50%)",
              "pointer-events:none;z-index:7;text-align:center",
              "font-family:'Noto Serif KR',serif;font-weight:900",
              "font-size:min(11vh,11vw);line-height:1",
              "color:#ff4a4a;text-shadow:0 0 12px #ff2a2a,0 0 26px #c80000,0 2px 3px #000",
              "opacity:0;will-change:transform,opacity",
            ].join(";");
            ovParent.appendChild(hitBox);
          }
        } catch { /* 오버레이 미지원 환경 — 연출 없이 전투만 */ }
        /* #11 — 절개: 200ms 풀 블랙아웃 뒤 死 한자·레터박스가 함께 뜨며 암전이 걷힌다 (게임 시간) */
        ovAt(200, () => {
          requestAnimationFrame(() => { if (!ovGone) bars.forEach((b) => { b.style.height = "42px"; }); });
          if (kanji) {
            kanji.style.transition = "transform 460ms cubic-bezier(0.16,1.2,0.3,1), opacity 300ms ease-out";
            kanji.style.opacity = "0.38";
            kanji.style.transform = "translate(-50%,-50%) scale(1.06)";
          }
          if (blackRect) this.scene.tweens.add({ targets: blackRect, alpha: 0, duration: 240, ease: "Quad.easeOut" });
        });
        const ovCleanup = () => {
          if (ovGone) return; // #13 — 하드 정리 뒤에는 소산 불필요 (제거된 요소 재제어 방지)
          for (const t of ovTimers) { try { window.clearTimeout(t); } catch { /* 무시 */ } }
          ovTimers.length = 0;
          try {
            for (const b of bars) { b.style.height = "0"; window.setTimeout(() => { try { b.remove(); } catch { /* 무시 */ } }, 380); }
            if (kanji) {
              kanji.style.transition = "opacity 480ms ease-out, transform 480ms ease-out";
              kanji.style.opacity = "0";
              kanji.style.transform = "translate(-50%,-50%) scale(1.3)";
              window.setTimeout(() => { try { kanji?.remove(); } catch { /* 무시 */ } }, 560);
            }
            /* #13 — 콤보는 종결 플래시 동안만 잔류 (hitKeep) — 즉시 소산 아님 */
            if (hitBox && !hitKeep) {
              hitBox.style.transition = "opacity 320ms ease-out";
              hitBox.style.opacity = "0";
              window.setTimeout(() => { try { hitBox?.remove(); } catch { /* 무시 */ } }, 400);
            }
          } catch { /* 무시 */ }
        };
        /* #13 — 하드 클린업: 사망·맵이동(씬 셔다운)·안전망 경로에서 즉시 전면 수거.
         *  시퀀스 예약 타이머를 전부 회수하고 ovGone 플래그로 이후 콜백이 오버레이를 되살리지 못하게 한다.
         *  DOM 오버레이는 씬 밖(document)에 살아남으므로 셔다운 훅이 유일한 확실한 수거점 (콤보 미소멸 버그 근본 수리). */
        const ovHardCleanup = () => {
          if (ovGone) return;
          ovGone = true;
          for (const c of ovCalls) { try { c.remove(false); } catch { /* 무시 */ } }
          ovCalls.length = 0;
          for (const t of ovTimers) { try { window.clearTimeout(t); } catch { /* 무시 */ } }
          ovTimers.length = 0;
          try { for (const b of bars) { b.remove(); } } catch { /* 무시 */ }
          try { kanji?.remove(); } catch { /* 무시 */ }
          try { hitBox?.remove(); } catch { /* 무시 */ }
          try { if (blackRect) { this.scene.tweens.killTweensOf(blackRect); blackRect.destroy(); } } catch { /* 무시 */ }
          blackRect = null;
        };
        /* 씬 셔다운(맵이동·씬 재시작) — DOM 유출 근본 차단 */
        this.scene.events.once("shutdown", ovHardCleanup);
        /* ── 50베기 예약 ── */
        let hitKeep = false; // 종결 플래시 동안 콤보 잔류 (테스트 관측창 + 연출 만족감)
        for (let i = 0; i < CUTS; i++) {
          ovCalls.push(this.scene.time.delayedCall(starts[i], () => {
            if (ovGone) return;
            if (this.state === "dead") { ovHardCleanup(); return; } // #13 — 사망 즉시 전면 수거 (연출 유령 방지)
            /* 대상 순환 — 죽었으면 살아있는 다음 대상으로 넘어간다 */
            let tgt = seq.length > 0 ? seq[i % seq.length] : null;
            if (tgt && !(tgt.active && tgt.alive)) tgt = seq.find((x) => x.active && x.alive) ?? null;
            const ang = Math.random() * Math.PI * 2;
            if (tgt) {
              this.setPosition(tgt.x - Math.cos(ang) * 22, tgt.y - Math.sin(ang) * 22);
              this.scene.spawnSlash(tgt.x, tgt.y, new Phaser.Math.Vector2(Math.cos(ang), Math.sin(ang)), i % 2 === 0, 2.1, hex);
              this.scene.spawnSlash(tgt.x, tgt.y - 6, new Phaser.Math.Vector2(-Math.cos(ang), -Math.sin(ang)), i % 2 === 1, 1.5, 0xffffff);
              this.scene.spawnBurstAt(tgt.x, tgt.y, i % 2 === 0 ? 10 : 6, hex);
              const { dmg, crit } = rd(0.80);
              if (crit) this.scene.sfxCrit();
              tgt.takeDamage(dmg, new Phaser.Math.Vector2(0, 0.1).normalize(), 240, crit);
            } else {
              /* 대상 부재 — 주변 공중 베기 (검무 자체는 유지) */
              const px = this.x + Math.cos(ang) * 46, py = this.y + Math.sin(ang) * 26;
              this.scene.spawnSlash(px, py, new Phaser.Math.Vector2(Math.cos(ang), Math.sin(ang)), i % 2 === 0, 1.8, hex);
            }
            /* 검격음 — 3컷마다 1회, 가속하며 피치 상승 (도플러 질감) */
            if (i % 3 === 0) this.scene.sfxSkill("iainuki", 0.92 + Math.min(0.55, i * 0.0055));
            /* 카메라 — 후반으로 갈수록 미세 진동 강화 */
            if (i % 12 === 0) this.scene.doShake(70, 0.002 + (i / CUTS) * 0.004);
            /* 마일스톤 — 15/30/45베기: 링 팝 + 한자 펄스 */
            if (i === 15 || i === 30 || i === 45) {
              spawnRingPop(this.scene, this.x, this.y, "vf_ring", hex, 2.4 + i * 0.012, 420);
              if (kanji) {
                kanji.style.transition = "transform 130ms ease-out";
                kanji.style.transform = "translate(-50%,-50%) scale(1.18)";
                ovAt(140, () => { if (kanji) { kanji.style.transform = "translate(-50%,-50%) scale(1.06)"; } });
              }
            }
            /* #13 — 콤보 카운터 — 매 베기마다 증가 + 스케일 펄스 (死 한자 옆 대형) */
            if (hitBox) {
              hitBox.innerHTML = `${i + 1}<span style="font-size:38%;letter-spacing:1px"> HIT</span>`;
              hitBox.style.transition = "none";
              hitBox.style.opacity = "1";
              hitBox.style.transform = "translate(-50%,-50%) scale(1.16)";
              ovAt(110, () => { if (hitBox && !ovGone) { hitBox.style.transition = "transform 150ms ease-out"; hitBox.style.transform = "translate(-50%,-50%) scale(1)"; } });
            }
          }));
        }

        /* 종결 — 교차하는 쌍검 극의 일격 (50베기 정점 직후) */
        /* #11 — 종결 직전 순간 암전: 마지막 베기 직후 즉시 컷to 블랙 → ≈140ms 뒤 종결과 함께 섬광 */
        ovCalls.push(this.scene.time.delayedCall(totalMs + 30, () => {
          if (ovGone) return;
          if (blackRect) blackRect.setAlpha(1);
        }));
        ovCalls.push(this.scene.time.delayedCall(totalMs + 170, () => {
          if (ovGone) return;
          if (this.state === "dead") { ovHardCleanup(); return; } // #13 — 사망 종결도 잔존 없이 즉시 수거
          /* #11 — 섬광 컷: 암전 해제와 동시에 붉은 플래시 (기존 flash 재사용) */
          if (blackRect) {
            this.scene.tweens.add({
              targets: blackRect, alpha: 0, duration: 150, ease: "Quad.easeOut",
              onComplete: () => { if (blackRect && !ovGone) { try { blackRect.destroy(); } catch { /* 무시 */ } blackRect = null; } },
            });
          }
          hitKeep = true; // 콤보 잔류 → 종결 연출 후 소산
          ovCleanup(); // 레터박스/한자 소산 → 종결 플래시
          ovAt(900, () => {
            if (hitBox) {
              hitBox.style.transition = "opacity 420ms ease-out";
              hitBox.style.opacity = "0";
              window.setTimeout(() => { try { hitBox?.remove(); } catch { /* 무시 */ } }, 480);
            }
          });
          const dir = this.aimDirFree().normalize();
          this.scene.spawnSlash(this.x + dir.x * 40, this.y, dir, false, 4.2, hex);
          this.scene.spawnSlash(this.x + dir.x * 40, this.y, dir, true, 4.2, 0xffffff);
          this.scene.spawnSpinSlash(this.x, this.y, 2);
          this.scene.spawnCrack(this.x, this.y);
          this.scene.spawnBurstAt(this.x, this.y, 70, hex);
          /* v1.0.10 — GameStudio FX 종결 강화: 교차 쌍검 애니 참격+링 (극의 일격) */
          spawnFlarePop(this.scene, this.x + dir.x * 44, this.y - 6, "vf_slash", { tint: hex, scale: 2.6, duration: 560, angle: dir.angle() });
          spawnFlarePop(this.scene, this.x + dir.x * 44, this.y - 6, "vf_slash", { tint: 0xffffff, scale: 2.2, duration: 500, angle: dir.angle() + 0.5 });
          spawnRingPop(this.scene, this.x, this.y, "vf_ring", hex, 4.6, 700);
          this.scene.cameras.main.flash(180, 255, 60, 60); // vc154 — 종결은 붉게 (死 한자 톤과 수렴)
          this.scene.cameras.main.shake(440, 0.021);
          this.scene.sfxSkill("iainuki", 0.6);
          this.scene.sfxSkill("superhit", 0.82);
          for (const e of this.getAllTargetsIn(560)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(7.5);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 620, crit);
          }
        }));
        /* 안전망 — 어떤 경우에도 오버레이가 남지 않게 (종결이 안 불려도 해제) */
        ovAt(totalMs + 4000, () => ovHardCleanup());
        /* #11 — 암전 Rect 최종 수거 (정상 종결 소산 뒤 — 모든 경로에서 파괴 보장) */
        ovAt(totalMs + 1500, () => {
          if (blackRect && !ovGone) { try { blackRect.destroy(); } catch { /* 무시 */ } blackRect = null; }
        });
        break;
      }

      /* 전사 계열 — 천멸: 대붕괴 검격. 하늘에서 6연속 초거대 참격 + 종결 일격 */
      case "warrior": {
        for (let i = 0; i < 6; i++) {
          this.scene.time.delayedCall(260 + i * 230, () => {
            if (this.state === "dead") return;
            const dir = this.aimDirFree().normalize();
            const ox = this.x + dir.x * (i % 2 === 0 ? 46 : -46);
            const oy = this.y + dir.y * (i % 2 === 0 ? 30 : -30);
            this.scene.spawnSlash(ox, oy, dir, i % 2 === 0, 3.1 + i * 0.22, hex);
            this.scene.spawnSpinSlash(ox, oy, 1);
            this.scene.cameras.main.shake(110, 0.008 + i * 0.001);
            this.scene.sfxSkill("bigsword", 0.9 + i * 0.05);
            for (const e of this.getAllTargetsIn(400)) {
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(2.4);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 420, crit);
            }
          });
        }
        /* 종결 일격 — 대붕괴 */
        this.scene.time.delayedCall(260 + 6 * 230 + 120, () => {
          if (this.state === "dead") return;
          this.scene.spawnCrack(this.x, this.y);
          this.scene.spawnPillar(this.x, this.y, hex, 260);
          this.scene.spawnBurstAt(this.x, this.y, 60, hex);
          this.scene.cameras.main.shake(420, 0.02);
          this.scene.cameras.main.flash(160, 255, 120, 60);
          this.scene.sfxSkill("superhit", 0.86);
          for (const e of this.getAllTargetsIn(560)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(6.5);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 620, crit);
          }
        });
        this.selfAtkBuff = { mult: 1.55, until: now + 12000 };
        break;
      }

      /* 궁수 계열 — 천강: 무한 화살비. 유도 26연발 + 관통 12발 + 화염 필드 */
      case "ranger": {
        for (let i = 0; i < 26; i++) {
          this.scene.time.delayedCall(240 + i * 85, () => {
            if (this.state === "dead") return;
            const t = this.nearestTargets(1, 760)[0];
            if (!t) return;
            const ang = Math.atan2(t.y - this.y, t.x - this.x) + (Math.random() - 0.5) * 0.7;
            const { dmg, crit } = rd(1.75);
            if (crit) this.scene.sfxCrit();
            this.scene.firePlayerProj({
              x: this.x, y: this.y - 8, angle: ang, speed: 900, pierce: 3,
              dmg, crit, tint: hex, knock: 260, scale: 1.8,
              tex: "x2_arrow", blend: "add", rot: true, homing: true,
              trail: hex,
            });
            if (i % 6 === 0) this.scene.sfxSkill("arrowpierce", 1.05);
          });
        }
        /* 관통 화우 12발 */
        this.scene.time.delayedCall(240 + 26 * 85 + 100, () => {
          if (this.state === "dead") return;
          const base = Math.atan2(this.aimDirFree().y, this.aimDirFree().x);
          for (let i = 0; i < 12; i++) {
            const { dmg, crit } = rd(2.2);
            this.scene.firePlayerProj({
              x: this.x, y: this.y - 8, angle: base + (i - 5.5) * 0.24, speed: 1050, pierce: 99,
              dmg, crit, tint: 0xffd76a, knock: 420, scale: 2.2,
              tex: "x2_arrow", blend: "add", rot: true,
            });
          }
          this.scene.spawnField({
            x: this.x, y: this.y, radius: 210, dur: 8000,
            dps: Math.max(14, Math.round(this.atkTotal * 1.3)),
            kind: "fire", owner: "player",
          });
          this.scene.cameras.main.flash(130, 255, 220, 140);
          this.scene.cameras.main.shake(240, 0.012);
          this.scene.sfxSkill("arrowpierce", 0.82);
          this.scene.sfxSkill("superhit", 0.94);
        });
        break;
      }

      /* 마법 계열 — 종막: 아르카나 대폭발. 운석 8발 + 종막 폭발 */
      case "mage": {
        for (let i = 0; i < 8; i++) {
          this.scene.time.delayedCall(280 + i * 240, () => {
            if (this.state === "dead") return;
            const t = this.nearestTargets(3, 620)[i % 3];
            const px = t ? t.x + (Math.random() - 0.5) * 60 : this.x + (Math.random() - 0.5) * 480;
            const py = t ? t.y + (Math.random() - 0.5) * 60 : this.y + (Math.random() - 0.5) * 480;
            this.scene.spawnPillar(px, py, hex, 240);
            this.scene.spawnBurstAt(px, py, 30, hex);
            this.scene.cameras.main.shake(130, 0.01);
            this.scene.sfxSkill("thunder", 0.9 + (i % 3) * 0.08);
            for (const e of this.getAllTargetsIn(300)) {
              if (Phaser.Math.Distance.Between(e.x, e.y, px, py) > 190) continue;
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(2.9);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 460, crit);
            }
          });
        }
        /* 종막 폭발 — 화면 전체급 */
        this.scene.time.delayedCall(280 + 8 * 240 + 140, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x, this.y, 0xffffff, 300);
          this.scene.spawnBurstAt(this.x, this.y, 80, hex);
          this.scene.spawnField({
            x: this.x, y: this.y, radius: 240, dur: 6000,
            dps: Math.max(18, Math.round(this.atkTotal * 1.6)),
            kind: "light", owner: "player",
          });
          this.scene.cameras.main.flash(220, 255, 255, 255);
          this.scene.cameras.main.shake(500, 0.022);
          this.scene.sfxSkill("manaburst", 0.8);
          this.scene.sfxSkill("superhit", 0.82);
          for (const e of this.getAllTargetsIn(600)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(7.5);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 640, crit);
          }
        });
        break;
      }

      /* 도적 계열 — 심연: 그림자 참수극. 적 사이 점멸 참수 + 심연 폭발 */
      default: {
        const marks = this.nearestTargets(8, 720);
        marks.forEach((t, i) => {
          this.scene.time.delayedCall(260 + i * 180, () => {
            if (this.state === "dead" || !t.active) return;
            /* 점멸 참수 — 적 옆으로 순이동 */
            const ang = Math.random() * Math.PI * 2;
            this.setPosition(t.x - Math.cos(ang) * 26, t.y - Math.sin(ang) * 26);
            this.scene.spawnSlash(t.x, t.y, new Phaser.Math.Vector2(Math.cos(ang), Math.sin(ang)), i % 2 === 0, 2.6, 0x1a1030);
            this.scene.spawnBurstAt(t.x, t.y, 16, 0x8a4aff);
            this.scene.sfxSkill("iainuki", 0.92 + (i % 4) * 0.05);
            const { dmg, crit } = rd(3.3);
            if (crit) this.scene.sfxCrit();
            t.takeDamage(dmg, new Phaser.Math.Vector2(0, 0.1).normalize(), 300, crit);
          });
        });
        /* 심연 종결 폭발 */
        this.scene.time.delayedCall(260 + marks.length * 180 + 140, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x, this.y, 0x8a4aff, 270);
          this.scene.spawnBurstAt(this.x, this.y, 70, 0x8a4aff);
          this.scene.spawnCrack(this.x, this.y);
          this.scene.cameras.main.flash(180, 90, 40, 160);
          this.scene.cameras.main.shake(480, 0.02);
          this.scene.sfxSkill("dark", 0.72);
          this.scene.sfxSkill("superhit", 0.84);
          for (const e of this.getAllTargetsIn(540)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(6.8);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 600, crit);
          }
        });
        break;
      }
    }

    /* 공통 마무리 — 시전 후 경직 해제 */
    this.scene.time.delayedCall(300, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  /* ---------------- v3.0.3 — GM 도구 (임시 운영자 NPC용) ---------------- */

  /* ================= vc146 (#2) — 5차 제2궁극기 (쿨타임 120초 · MP 150) =================
   *  유저 지시: "2번째 궁극기 = 쿨타임 2분(2분이라는 긴 시간에 맞는 엄청난 스킬)".
   *  1차 궁극기와 겹치지 않는 12종(계열 폴백 4 + 4차 세부직업 8) — 종결 계수 합산이
   *  1차 궁극기의 1.4~2배급. 광역 필드·시간 정지·무적 성역·피해 재현 등 2분다운 규모. */
  useSkill5b() {
    if (this.state !== "idle" || !this.skill5bUnlocked || this.skill5bCd > 0 || this.mp < 150) return;
    this.mp -= 150;
    this.skill5bCd = this.skill5bMax; // 120초 고정 (cdMult 미적용)
    this.state = "attack";
    this.hitSet.clear();
    this.setVelocity(0, 0);
    this.netEmitAction("s5b"); // vc146 — 원격 연출 동기화 (원격은 s5 연출로 재생)
    const hex = this.clsHex();
    const key5 = resolveSkill5Of(this.cls);
    const info = SKILL5B_INFO[key5];

    /* vc147 (#18) — 제2궁극기 피해 ×500% (FIFTH2_MULT) — 1차(rd×300%)와 동일 메커니즘 */
    const rd = (m: number, forceCrit = false) => { this.ultSlot = 2; const r = this.rollDamage(m, true, forceCrit); this.ultSlot = 0; return r; };

    /* 공통 인트로 — 제2의 궁극기: 붉은보라 차원 균열 + 이중 마법진 */
    this.scene.sfxSkill("timestop", 0.92);
    this.scene.cameras.main.flash(170, 220, 160, 255);
    this.scene.spawnPickupText(this.x, this.y - 58, `★★ ${info.name} ★★`, "#e0a8ff");
    /* 공통 인트로 — 제2의 궁극기: 붉은보라 차원 균열 + 계열별 지면 시그니처 (vc147 #14) */
    spawnUltIntroSig(this.scene, this.x, this.y, 0xb06aff, (familyOf(this.cls) ?? "default") as FamKey | "pirate" | "default");
    if (familyOf(this.cls) === "mage") spawnPentacle(this.scene, this.x, this.y, 0xd8a0ff, { scale: 2.4, duration: 950, spin: true });
    const ring = this.scene.add.circle(this.x, this.y, 34)
      .setStrokeStyle(3, 0xc08aff, 0.95).setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: ring, scale: 3.8, alpha: 0, duration: 760, ease: "Cubic.out", onComplete: () => ring.destroy() });
    this.scene.spawnBurstAt(this.x, this.y, 36, 0xb06aff);
    this.scene.vfx3dFx("spiral", this.x, this.y, 0xb06aff, 1.1);

    switch (key5) {
      /* 워브링어 — 천멸전격: 5회 관통 돌진(용암 균열 잔존) + 대지 분쇄 지진 종결 */
      case "warbringer": {
        for (let i = 0; i < 5; i++) {
          this.scene.time.delayedCall(280 + i * 430, () => {
            if (this.state === "dead") return;
            const t = this.nearestTargets(1, 900)[0];
            const ang = t ? Math.atan2(t.y - this.y, t.x - this.x) : Math.random() * Math.PI * 2;
            this.setPosition(this.x + Math.cos(ang) * 150, this.y + Math.sin(ang) * 150);
            const dir = new Phaser.Math.Vector2(Math.cos(ang), Math.sin(ang));
            this.scene.spawnSlash(this.x + dir.x * 30, this.y + dir.y * 30, dir, i % 2 === 0, 3.6, hex);
            this.scene.spawnCrack(this.x, this.y);
            this.scene.spawnBurstAt(this.x, this.y, 30, 0xff8a4a);
            this.scene.spawnField({ x: this.x, y: this.y, radius: 110, dur: 2600, dps: Math.max(16, Math.round(this.atkTotal * 0.9)), kind: "fire", owner: "player" });
            this.scene.cameras.main.shake(140, 0.012);
            this.scene.sfxSkill("bigsword", 0.82 + (i % 3) * 0.07);
            for (const e of this.getAllTargetsIn(260)) {
              const away = dir;
              const { dmg, crit } = rd(4.2);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 420, crit);
              this.applyEnemyStatus("bleed", Math.max(7, Math.round(this.atkTotal * 0.013)), 5000);
            }
          });
        }
        /* 종결 — 대지 분쇄: 전장이 들어 올려지는 지진 */
        this.scene.time.delayedCall(280 + 5 * 430 + 160, () => {
          if (this.state === "dead") return;
          this.scene.spawnCrack(this.x, this.y);
          this.scene.spawnPillar(this.x, this.y, hex, 320);
          this.scene.spawnBurstAt(this.x, this.y, 88, hex);
          spawnRingPop(this.scene, this.x, this.y, "vf_ring_fire", 0xffffff, 5.6, 760);
          this.scene.driveFx?.gvFireCircle(this.x, this.y, 0xffa060, 1050, 1.8); this.scene.driveFx?.gvCore(this.x, this.y, 0xffb080, 1.8); /* vc149 #14 마법진→gv 불서클(전사) */
          this.scene.cameras.main.shake(520, 0.026);
          this.scene.cameras.main.flash(180, 255, 120, 60);
          this.scene.sfxSkill("superhit", 0.76);
          for (const e of this.getAllTargetsIn(760)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(12.0);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 680, crit);
            (e as Enemy).applyStun?.(2000);
          }
        });
        this.selfAtkBuff = { mult: 1.75, until: this.scene.time.now + 14000 };
        break;
      }

      /* 크루세이더 — 성흔전격: 무적 성역 8초 + 심판 빛기둥 폭풍 12연 + 완전 회복 종결 */
      case "crusader": {
        this.iframes = Math.max(this.iframes, 8000); // 성역 무적 — "천국의 문" 개방 8초
        this.scene.spawnPurifyRing(this.x, this.y, 420, 0xffe9a0);
        this.scene.spawnField({ x: this.x, y: this.y, radius: 230, dur: 8000, dps: Math.max(14, Math.round(this.atkTotal * 1.1)), kind: "light", owner: "player", heal: true, selfHealPerTick: Math.max(4, Math.round(this.maxHp * 0.01)) });
        this.scene.spawnPickupText(this.x, this.y - 70, "천국의 문이 열린다 — 8초 무적 성역!", "#ffe9a0");
        for (let i = 0; i < 12; i++) {
          this.scene.time.delayedCall(300 + i * 640, () => {
            if (this.state === "dead") return;
            const t = this.nearestTargets(4, 760)[i % 4];
            const px = t ? t.x : this.x + (Math.random() - 0.5) * 520;
            const py = t ? t.y : this.y + (Math.random() - 0.5) * 420;
            this.scene.spawnPillar(px, py, 0xffe9a0, 270);
            this.scene.spawnBurstAt(px, py, 26, 0xffe9a0);
            this.scene.spawnRuneRing(px, py, 0xffe9a0);
            this.scene.sfxSkill("holy", 0.9 + (i % 3) * 0.07);
            for (const e of this.getAllTargetsIn(320)) {
              if (Phaser.Math.Distance.Between(e.x, e.y, px, py) > 210) continue;
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(3.6);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 460, crit);
            }
          });
        }
        /* 종결 — 성역 닫힘: 완전 회복 + 방어 대버프 + 정화 종결기 */
        this.scene.time.delayedCall(300 + 12 * 640 + 150, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x, this.y, 0xffffff, 320);
          this.scene.spawnPurifyRing(this.x, this.y, 560, 0xffffff);
          this.scene.driveFx?.gvFireCircle(this.x, this.y, 0xffe9a0, 1150, 1.9); this.scene.driveFx?.gvAura(this.x, this.y, 0xffe9a0, 1600, 1.7); /* vc149 #14 마법진→gv 성역(전사) */
          this.scene.cameras.main.flash(200, 255, 245, 200);
          this.scene.cameras.main.shake(480, 0.022);
          this.scene.sfxSkill("holy", 0.7);
          this.scene.sfxSkill("superhit", 0.84);
          for (const e of this.getAllTargetsIn(640)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(8.4);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 640, crit);
          }
          const before = this.hp;
          this.hp = this.maxHp;
          this.mp = Math.min(this.maxMp, this.mp + 80);
          this.scene.spawnHealFx(this.x, this.y, 0xffe9a0);
          this.scene.spawnPickupText(this.x, this.y - 70, `완전 회복 +${Math.round(this.maxHp - before)}`, "#ffe9a0");
          this.selfDefBuff = { add: 50, until: this.scene.time.now + 12000 };
        });
        break;
      }

      /* 데드아이 — 신시전격: 시간 정지 2.6초 + 무음 저격 100련 + 탄착 일제 폭발
       *  vc147 (#8) — "이펙트 안보임(화살 안보임)" 수정: 기존엔 데미지 판정만 있고
       *  화살 시각이 전혀 없었다. 매 탄 발사 위치→목표 저격 트레이서(초록 발광 화살,
       *  ADD 블렌드)를 쏘고 5연발마다 머즐 플래시 — 발사 라인이 눈에 보인다. */
      case "deadeye": {
        const struck = new Set<Enemy | Boss>();
        this.scene.spawnField({ x: this.x, y: this.y + 10, radius: 480, dur: 1200, dps: 0, kind: "time", owner: "player" });
        for (const e of this.getAllTargetsIn(480)) (e as Enemy).applyStun?.(2600);
        for (let i = 0; i < 100; i++) {
          this.scene.time.delayedCall(260 + i * 26, () => {
            if (this.state === "dead") return;
            const t = this.nearestTargets(1, 860)[0];
            if (!t) return;
            struck.add(t);
            /* vc147 (#8) — 저격 트레이서: 발사→탄착 90ms 직선 비행 (동시 노출 ~4발 예산) */
            {
              const sx = this.x + (Math.random() - 0.5) * 14;
              const sy = this.y - 10 + (Math.random() - 0.5) * 10;
              const ang = Math.atan2(t.y - 8 - sy, t.x - sx);
              const arr = this.scene.add.image(sx, sy, "x2_arrow_green")
                .setRotation(ang).setDepth(12).setBlendMode(Phaser.BlendModes.ADD)
                .setScale(1.5).setTint(0x9dffc4);
              this.scene.tweens.add({
                targets: arr,
                x: t.x, y: t.y - 8,
                alpha: 0.25,
                duration: 90,
                ease: "Linear",
                onComplete: () => arr.destroy(),
              });
              if (i % 5 === 0) this.scene.spawnBurstAt(sx, sy, 3, 0x7dffb0);
            }
            const { dmg, crit } = rd(1.15, true); // 전 탄 확정 크리 — 시간이 멈춘 사이
            t.takeDamage(dmg, new Phaser.Math.Vector2(0, 0.1).normalize(), 60, crit);
            if (i % 10 === 9) {
              this.scene.spawnHitSpark(t.x, t.y - 8);
              this.scene.sfxSkill("snipe", 1.06 + (i % 3) * 0.05);
            }
          });
        }
        /* 종결 — 시간이 되살아나는 순간, 모든 탄착이 한 번에 터진다 */
        this.scene.time.delayedCall(260 + 100 * 26 + 140, () => {
          if (this.state === "dead") return;
          this.scene.cameras.main.flash(160, 255, 240, 180);
          this.scene.cameras.main.shake(460, 0.022);
          this.scene.sfxSkill("superhit", 0.78);
          spawnRingPop(this.scene, this.x, this.y, "vf_ring", 0xffd76a, 5.4, 820);
          let n = 0;
          for (const t of struck) {
            if (!t.active) continue;
            this.scene.spawnBurstAt(t.x, t.y, 20, 0xffd76a);
            this.scene.spawnShockwave(t.x, t.y, 0xffd76a, 1.0);
            const away = new Phaser.Math.Vector2(t.x - this.x, t.y - this.y).normalize();
            const { dmg, crit } = rd(3.2, true);
            t.takeDamage(dmg, away, 480, crit);
            n++;
            if (n >= 12) break; // 연출 예산 — 최대 12기
          }
        });
        break;
      }

      /* 스카이로드 — 천풍전격: 회오리 군단 12기 + 낙뢰 폭풍 10연 + 대기권 종결 토네이도 */
      case "skylord": {
        for (let i = 0; i < 12; i++) {
          this.scene.time.delayedCall(260 + i * 200, () => {
            if (this.state === "dead") return;
            const t = this.nearestTargets(1, 900)[0];
            const base = t ? Math.atan2(t.y - this.y, t.x - this.x) : Math.random() * Math.PI * 2;
            const { dmg, crit } = rd(2.2);
            this.scene.fireCyclone({
              x: this.x, y: this.y - 10, angle: base + (i - 6) * 0.19, speed: 560,
              dmg, crit, hex, pull: 210, radius: 130, life: 1600, scale: 2.4,
            });
            if (i % 4 === 0) this.scene.sfxSkill("wind", 0.86);
          });
        }
        for (let b = 0; b < 10; b++) {
          this.scene.time.delayedCall(260 + 12 * 200 + b * 220, () => {
            if (this.state === "dead") return;
            const t = this.nearestTargets(3, 820)[b % 3] ?? this.nearestTargets(1, 820)[0];
            if (!t || !t.active) return;
            this.scene.spawnPillar(t.x, t.y, 0xaed8ff, 250);
            this.scene.spawnBurstAt(t.x, t.y, 24, 0xaed8ff);
            spawnFlarePop(this.scene, t.x, t.y - 10, "vf_lightning", { tint: 0xcfe8ff, scale: 1.4, duration: 430 });
            this.scene.cameras.main.shake(110, 0.011);
            this.scene.sfxSkill("thunder", 0.8 + (b % 3) * 0.08);
            const away = new Phaser.Math.Vector2(0, 0.1).normalize();
            const { dmg, crit } = rd(3.8);
            if (crit) this.scene.sfxCrit();
            t.takeDamage(dmg, away, 440, crit);
          });
        }
        /* 종결 — 대기권 돌파: 하늘이 무너지는 초대형 토네이도 + 신속 대버프 */
        this.scene.time.delayedCall(260 + 12 * 200 + 10 * 220 + 140, () => {
          if (this.state === "dead") return;
          const t = this.nearestTargets(1, 800)[0];
          const cx = t ? t.x : this.x;
          const cy = t ? t.y : this.y;
          const { dmg, crit } = rd(5.6);
          this.scene.fireCyclone({ x: cx, y: cy, angle: 0, speed: 0, dmg, crit, hex, pull: 320, radius: 220, life: 3200, scale: 4.2 });
          this.scene.spawnField({ x: cx, y: cy, radius: 260, dur: 6000, dps: Math.max(20, Math.round(this.atkTotal * 1.6)), kind: "light", owner: "player" });
          spawnRingPop(this.scene, cx, cy, "vf_ring", 0xaed8ff, 5.6, 860);
          this.scene.cameras.main.flash(180, 200, 230, 255);
          this.scene.cameras.main.shake(500, 0.024);
          this.scene.sfxSkill("wind", 0.62);
          this.scene.sfxSkill("superhit", 0.8);
          for (const e of this.getAllTargetsIn(560)) {
            const away = new Phaser.Math.Vector2(e.x - cx, e.y - cy).normalize();
            const { dmg: d2, crit: c2 } = rd(7.2);
            if (c2) this.scene.sfxCrit();
            e.takeDamage(d2, away, 600, c2);
          }
          this.selfSpdBuff = { mult: 1.5, until: this.scene.time.now + 10000 };
          this.recalcSpeed();
          this.scene.spawnPickupText(this.x, this.y - 60, "신속 대버프!", "#aed8ff");
        });
        break;
      }

      /* 아크로드 — 종막전격: 마성 진영 5기 봉쇄 + MP 전소 오버로드 합체 폭발 */
      case "arclord": {
        for (let i = 0; i < 5; i++) {
          const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          const px = this.x + Math.cos(a) * 180;
          const py = this.y + Math.sin(a) * 180;
          spawnPentacle(this.scene, px, py, 0x8ab0ff, { tex: "vf_penta_elec", scale: 1.7, duration: 4200, spin: i % 2 === 0 });
          this.scene.time.delayedCall(300 + i * 320, () => {
            if (this.state === "dead") return;
            this.scene.spawnBurstAt(px, py, 26, hex);
            this.scene.sfxSkill("manaburst", 0.9 + (i % 3) * 0.07);
            for (const e of this.getAllTargetsIn(300)) {
              if (Phaser.Math.Distance.Between(e.x, e.y, px, py) > 220) continue;
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(4.4);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 460, crit);
            }
          });
        }
        /* 종결 — 마성 오버로드: 진영이 하나로 합체, 잔여 MP를 전부 태운다 */
        this.scene.time.delayedCall(300 + 5 * 320 + 180, () => {
          if (this.state === "dead") return;
          const ratio = Phaser.Math.Clamp(this.mp / Math.max(1, this.maxMp), 0, 1);
          this.mp = 0;
          this.scene.spawnPillar(this.x, this.y, 0xffffff, 340);
          this.scene.spawnCrack(this.x, this.y);
          this.scene.spawnBurstAt(this.x, this.y, 96, hex);
          spawnPentacle(this.scene, this.x, this.y, 0x8ab0ff, { tex: "vf_penta_elec", scale: 3.2, duration: 1100 });
          spawnRingPop(this.scene, this.x, this.y, "vf_ring_void", 0xaec6ff, 5.8, 860);
          spawnFlarePop(this.scene, this.x, this.y - 8, "vf_flare_elec", { scale: 2.7, duration: 660 });
          /* vc149 (#11) — 오버로드 합체 폭발 gv 강화 (코어+충격파+광선+입자) */
          this.scene.driveFx?.gvCore(this.x, this.y, 0xcfe0ff, 2.8);
          this.scene.driveFx?.gvShock(this.x, this.y, 0x8ab0ff, 3.0, 900);
          this.scene.driveFx?.gvStreaks(this.x, this.y, 0xaec6ff, 2.6);
          this.scene.driveFx?.gvSpecks(this.x, this.y, 0xcfe0ff, 20, 340);
          this.scene.spawnField({ x: this.x, y: this.y, radius: 270, dur: 8000, dps: Math.max(22, Math.round(this.atkTotal * 1.9)), kind: "light", owner: "player" });
          this.scene.cameras.main.flash(220, 220, 200, 255);
          this.scene.cameras.main.shake(560, 0.026);
          this.scene.sfxSkill("manaburst", 0.66);
          this.scene.sfxSkill("superhit", 0.74);
          for (const e of this.getAllTargetsIn(700)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(7.5 + 3.5 * ratio);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 660, crit);
          }
        });
        break;
      }

      /* 이터널 — 영겁전격: 시간 역행(HP/MP 복원) + 최근 6초 피해 ×2 재현 종결
       *  vc149 (#13) — 별하늘+에너지 웹 오버레이로 '시간이 거스르는' 공간감 강화 */
      case "eternal": {
        this.scene.driveFx?.gvStarry(this.x, this.y, 2.8, 3200);
        this.scene.driveFx?.gvEnergyWeb(this.x, this.y, 0xb0a0ff, 2.4, 1500);
        this.scene.spawnField({ x: this.x, y: this.y + 10, radius: 470, dur: 2600, dps: 0, kind: "time", owner: "player" });
        for (const e of this.getAllTargetsIn(470)) (e as Enemy).applyStun?.(4200);
        this.scene.spawnPickupText(this.x, this.y - 66, "시간이 거스르기 시작한다...", "#d8ccff");
        /* 시간 역행 — 상처를 되돌린다 */
        const healed = Math.round(this.maxHp * 0.3);
        this.hp = Math.min(this.maxHp, this.hp + healed);
        this.mp = Math.min(this.maxMp, this.mp + Math.round(this.maxMp * 0.5));
        this.scene.spawnHealFx(this.x, this.y, 0xb0a0ff);
        this.scene.spawnPickupText(this.x, this.y - 84, `시간 역행 회복 +${healed}`, "#d8ccff");
        /* 재현 종결 — 최근 6초간 굴린 피해 로그의 합 ×2가 한 번에 터진다 */
        this.scene.time.delayedCall(1400, () => {
          if (this.state === "dead") return;
          const now = this.scene.time.now;
          let sum = 0;
          for (const r of this.recentDmgLog) if (now - r.t <= 6000) sum += r.v;
          const reenact = Math.max(Math.round(this.atkTotal * 6), sum * 2); // 바닥 6.0배 — 공백 방지
          this.scene.spawnCrack(this.x, this.y);
          this.scene.spawnPillar(this.x, this.y, 0xd8ccff, 320);
          this.scene.spawnBurstAt(this.x, this.y, 82, 0xb0a0ff);
          spawnPentacle(this.scene, this.x, this.y, 0xb0a0ff, { scale: 3.2, duration: 1200, spin: true });
          spawnRingPop(this.scene, this.x, this.y + 6, "vf_ring_void", 0xffffff, 5.6, 900);
          this.scene.cameras.main.flash(200, 216, 204, 255);
          this.scene.cameras.main.shake(540, 0.024);
          this.scene.sfxSkill("timestop", 0.86);
          this.scene.sfxSkill("superhit", 0.78);
          for (const e of this.getAllTargetsIn(620)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            /* 재현 배분 — 로그 합을 전 대상에 균등 분배(단일 보스에겐 전액) */
            const share = Math.max(1, Math.round(reenact / Math.max(1, this.getAllTargetsIn(620).length)));
            e.takeDamage(share, away, 640, true);
          }
          this.scene.spawnPickupText(this.x, this.y - 96, `거스르는 시간 — ${reenact.toLocaleString()} 재현!`, "#d8ccff");
        });
        break;
      }

      /* 섀도우로드 — 심연전격: 그림자 왕국 성역(분신 6기 10초) + 연속 참수 + 심연 처형 */
      case "shadowlord": {
        this.scene.spawnField({ x: this.x, y: this.y, radius: 250, dur: 10000, dps: Math.max(16, Math.round(this.atkTotal * 1.2)), kind: "light", owner: "player" });
        this.scene.driveFx?.gvVoidSpike(this.x, this.y, 0xc090ff, 2.0); this.scene.driveFx?.gvSkull(this.x, this.y, 0xc090ff, 1.6); /* vc149 #14 마법진→gv 심연(도적) */
        for (let c = 0; c < 6; c++) {
          this.scene.time.delayedCall(300 + c * 480, () => {
            if (this.state === "dead") return;
            const t = this.nearestTargets(1, 760)[0];
            if (t) this.scene.fireShadowClone(t, 0x8a4aff, 3.6);
          });
        }
        const marks = this.nearestTargets(10, 800);
        marks.forEach((t, i) => {
          this.scene.time.delayedCall(300 + i * 170, () => {
            if (this.state === "dead" || !t.active) return;
            const ang = Math.random() * Math.PI * 2;
            this.setPosition(t.x - Math.cos(ang) * 26, t.y - Math.sin(ang) * 26);
            this.scene.spawnSlash(t.x, t.y, new Phaser.Math.Vector2(Math.cos(ang), Math.sin(ang)), i % 2 === 0, 3.1, 0x1a1030);
            this.scene.spawnBurstAt(t.x, t.y, 18, 0x8a4aff);
            this.scene.sfxSkill("iainuki", 0.86 + (i % 4) * 0.05);
            const { dmg, crit } = rd(3.9);
            if (crit) this.scene.sfxCrit();
            t.takeDamage(dmg, new Phaser.Math.Vector2(0, 0.1).normalize(), 320, crit);
          });
        });
        /* 종결 — 왕국이 닫힌다: 심연 처형 */
        this.scene.time.delayedCall(300 + Math.max(marks.length, 6) * 170 + 900, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x, this.y, 0x8a4aff, 310);
          this.scene.spawnBurstAt(this.x, this.y, 86, 0x8a4aff);
          this.scene.spawnCrack(this.x, this.y);
          this.scene.driveFx?.gvVoidSpike(this.x, this.y, 0xc090ff, 1.9); this.scene.driveFx?.gvSkull(this.x, this.y, 0xc090ff, 1.5); /* vc149 #14 마법진→gv 심연(도적) */
          spawnFlarePop(this.scene, this.x, this.y - 8, "vf_flare_dark", { scale: 2.6, duration: 680 });
          spawnRingPop(this.scene, this.x, this.y, "vf_ring_void", 0xffffff, 5.2, 820);
          this.scene.cameras.main.flash(190, 90, 40, 160);
          this.scene.cameras.main.shake(540, 0.024);
          this.scene.sfxSkill("dark", 0.6);
          this.scene.sfxSkill("superhit", 0.74);
          for (const e of this.getAllTargetsIn(600)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(9.6);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 620, crit);
            this.applyEnemyStatus("bleed", Math.max(9, Math.round(this.atkTotal * 0.016)), 6500);
          }
        });
        break;
      }

      /* 블레이드마스터 — 극의전격: 만검의 진(하늘에서 검 100자루 — 25연 발동) + 교차 종결검 */
      case "blademaster": {
        for (let i = 0; i < 25; i++) {
          this.scene.time.delayedCall(260 + i * 95, () => {
            if (this.state === "dead") return;
            const cx = this.x + (Math.random() - 0.5) * 620;
            const cy = this.y + (Math.random() - 0.5) * 500;
            const dir = new Phaser.Math.Vector2(0, 1).rotate(Math.random() * Math.PI * 2);
            this.scene.spawnSlash(cx, cy, dir, i % 2 === 0, 2.2, hex);
            if (i % 3 === 0) this.scene.spawnBurstAt(cx, cy, 10, hex);
            if (i % 5 === 0) this.scene.sfxSkill("iainuki", 1.0 + (i % 4) * 0.04);
            for (const e of this.getAllTargetsIn(430)) {
              if (Phaser.Math.Distance.Between(e.x, e.y, cx, cy) > 130) continue;
              const away = dir;
              const { dmg, crit } = rd(1.5);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 160, crit);
            }
          });
        }
        /* 종결 — 교차하는 종결검: 만검의 진이 한 점으로 수렴 */
        this.scene.time.delayedCall(260 + 25 * 95 + 150, () => {
          if (this.state === "dead") return;
          const dir = this.aimDirFree().normalize();
          this.scene.spawnSlash(this.x + dir.x * 40, this.y, dir, false, 4.8, hex);
          this.scene.spawnSlash(this.x + dir.x * 40, this.y, dir, true, 4.8, 0xd8a0ff);
          this.scene.spawnSpinSlash(this.x, this.y, 2);
          this.scene.spawnCrack(this.x, this.y);
          this.scene.spawnBurstAt(this.x, this.y, 76, hex);
          spawnFlarePop(this.scene, this.x + dir.x * 44, this.y - 6, "vf_slash", { tint: hex, scale: 2.9, duration: 580, angle: dir.angle() });
          spawnRingPop(this.scene, this.x, this.y, "vf_ring", hex, 5.0, 760);
          this.scene.cameras.main.flash(180, 255, 255, 255);
          this.scene.cameras.main.shake(480, 0.023);
          this.scene.sfxSkill("iainuki", 0.56);
          this.scene.sfxSkill("superhit", 0.76);
          for (const e of this.getAllTargetsIn(600)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(9.4);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 640, crit);
          }
        });
        break;
      }

      /* 전사 계열 — 천멸이격: 낙검 4자루 + 지평선 참격 종결 */
      case "warrior": {
        for (let i = 0; i < 4; i++) {
          this.scene.time.delayedCall(280 + i * 420, () => {
            if (this.state === "dead") return;
            const t = this.nearestTargets(1, 860)[0];
            const px = t ? t.x + (Math.random() - 0.5) * 90 : this.x + (Math.random() - 0.5) * 520;
            const py = t ? t.y + (Math.random() - 0.5) * 80 : this.y + (Math.random() - 0.5) * 420;
            this.scene.spawnPillar(px, py, hex, 290);
            this.scene.spawnCrack(px, py);
            this.scene.spawnBurstAt(px, py, 34, hex);
            this.scene.cameras.main.shake(150, 0.013);
            this.scene.sfxSkill("bigsword", 0.78 + i * 0.06);
            for (const e of this.getAllTargetsIn(280)) {
              if (Phaser.Math.Distance.Between(e.x, e.y, px, py) > 200) continue;
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(5.2);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 460, crit);
            }
          });
        }
        /* 종결 — 지평선 참격 */
        this.scene.time.delayedCall(280 + 4 * 420 + 150, () => {
          if (this.state === "dead") return;
          const dir = this.aimDirFree().normalize();
          this.scene.spawnSlash(this.x + dir.x * 50, this.y, dir, false, 5.4, hex);
          this.scene.spawnSpinSlash(this.x, this.y, 2);
          this.scene.spawnCrack(this.x, this.y);
          this.scene.spawnBurstAt(this.x, this.y, 72, hex);
          spawnRingPop(this.scene, this.x, this.y, "vf_ring_fire", 0xffffff, 5.4, 820);
          this.scene.cameras.main.shake(500, 0.024);
          this.scene.cameras.main.flash(180, 255, 120, 60);
          this.scene.sfxSkill("superhit", 0.72);
          for (const e of this.getAllTargetsIn(700)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(10.5);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 660, crit);
          }
        });
        this.selfAtkBuff = { mult: 1.6, until: this.scene.time.now + 13000 };
        break;
      }

      /* 궁수 계열 — 천강이격: 8초 화우제(유도 화살 56연) + 강철 폭풍 5연사 종결 */
      case "ranger": {
        for (let v = 0; v < 14; v++) {
          this.scene.time.delayedCall(280 + v * 560, () => {
            if (this.state === "dead") return;
            for (let a = 0; a < 4; a++) {
              const t = this.nearestTargets(1, 820)[0];
              if (!t) return;
              const ang = Math.atan2(t.y - this.y, t.x - this.x) + (a - 1.5) * 0.2;
              const { dmg, crit } = rd(1.4);
              this.scene.firePlayerProj({
                x: this.x, y: this.y - 8, angle: ang, speed: 920, pierce: 1,
                dmg, crit, tint: 0xffe08a, knock: 240, scale: 1.8,
                tex: "x2_arrow", blend: "add", rot: true, homing: true,
                trail: 0xffd76a,
              });
            }
            if (v % 4 === 0) this.scene.sfxSkill("arrowpierce", 1.04);
          });
        }
        /* 종결 — 강철 폭풍 5연사 (전장 관통) */
        this.scene.time.delayedCall(280 + 14 * 560 + 140, () => {
          if (this.state === "dead") return;
          const base = Math.atan2(this.aimDirFree().y, this.aimDirFree().x);
          for (let i = 0; i < 5; i++) {
            const { dmg, crit } = rd(4.6, true);
            this.scene.firePlayerProj({
              x: this.x, y: this.y - 8, angle: base + (i - 2) * 0.14, speed: 1150, pierce: 99,
              dmg, crit, tint: 0xffffff, knock: 480, scale: 2.5,
              tex: "x2_arrow", blend: "add", rot: true,
            });
          }
          this.scene.spawnField({ x: this.x, y: this.y, radius: 240, dur: 9000, dps: Math.max(18, Math.round(this.atkTotal * 1.5)), kind: "fire", owner: "player" });
          spawnRingPop(this.scene, this.x, this.y, "vf_ring", 0xffd76a, 5.0, 780);
          this.scene.cameras.main.flash(150, 255, 220, 140);
          this.scene.cameras.main.shake(280, 0.014);
          this.scene.sfxSkill("arrowpierce", 0.78);
          this.scene.sfxSkill("superhit", 0.86);
        });
        break;
      }

      /* 마법 계열 — 종막이격: 대균열 블랙홀 (끌어당김 + 지속 피해 + 붕괴 종결) */
      case "mage": {
        const bx = this.x;
        const by = this.y;
        this.scene.driveFx?.gvVoidSpike(bx, by, 0xb06aff, 2.2); this.scene.driveFx?.gvAura(bx, by, 0xb06aff, 2600, 1.9); /* vc149 #14 마법진→gv 만검 거점(도적) */
        this.scene.spawnField({ x: bx, y: by, radius: 260, dur: 5200, dps: Math.max(20, Math.round(this.atkTotal * 1.5)), kind: "light", owner: "player" });
        /* 끌어당김 — 220ms마다 주위 적을 균열 중심으로 끌고 와 피해 */
        for (let i = 0; i < 22; i++) {
          this.scene.time.delayedCall(320 + i * 220, () => {
            if (this.state === "dead") return;
            for (const e of this.getAllTargetsIn(520)) {
              const toC = new Phaser.Math.Vector2(bx - e.x, by - e.y);
              const d = toC.length();
              if (d > 30) {
                toC.normalize();
                const { dmg } = rd(1.3);
                e.takeDamage(dmg, toC, 150, false); // knock 방향 = 균열 쪽 → 끌려들어감
              }
            }
            if (i % 5 === 4) this.scene.sfxSkill("manaburst", 1.02);
          });
        }
        /* 종결 — 균열 붕괴: 잿더미 없이 소멸 */
        this.scene.time.delayedCall(320 + 22 * 220 + 160, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(bx, by, 0xffffff, 320);
          this.scene.spawnCrack(bx, by);
          this.scene.spawnBurstAt(bx, by, 88, hex);
          spawnRingPop(this.scene, bx, by, "vf_ring_void", 0xffffff, 5.8, 880);
          spawnFlarePop(this.scene, bx, by - 8, "vf_flare_dark", { scale: 2.6, duration: 680 });
          this.scene.cameras.main.flash(220, 255, 255, 255);
          this.scene.cameras.main.shake(560, 0.026);
          this.scene.sfxSkill("manaburst", 0.6);
          this.scene.sfxSkill("superhit", 0.72);
          for (const e of this.getAllTargetsIn(680)) {
            const away = new Phaser.Math.Vector2(e.x - bx, e.y - by).normalize();
            const { dmg, crit } = rd(9.8);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 680, crit);
          }
        });
        break;
      }

      /* 도적 계열 — 심연이격: 처형 각인 + 그림자 사슬 끌어오기 + 연속 처형 종결 */
      default: {
        /* vc153 (#신규10 + 3D필살기) — 도적 계열 제2궁극기 개편: 「사(死)의 일섬」 3D 시네마틱.
         *  기존 "처형 각인제" 연전을 대체 — 붉은 한자 死 → 투명 Three.js 캔버스 독립 씬(낮은 기문 돌진·발도·초고속 참격·hitstop)
         *  → 즉발 450% 공격력 + 출혈 25% 공격력/1초 ×5초 (전부 DEATH_SLASH_CFG에서 설정 가능).
         *  · 피해는 기존 전투 시스템(rollDamage→takeDamage) 그대로 — 가짜 HP/적 복제 없음
         *  · 연출과 피해 분리: onStrike 콜백 1회(공격 고유 ID) — 연출 중단돼도 피해 데이터 불변
         *  · 종료 시 위치/HP/출혈 상태 유지 + 입력 해제 (예외 시 안전 복구 — DeathSlash.ts 자체 처리) */
        if (familyOf(this.cls) === "thief") {
          /* 시네마틱 동안 경직 유지 — 공통 마무리(300ms)가 먼저 풀지 못하게 잠금 */
          this.cineLock = true;
          const atk = this.atkTotal;
          const strike = () => {
            /* 유저 스펙 ④ — 즉발 450%(forceCrit: 큰 피해 숫자+크리티컬) + 출혈 장판(기존 필드 시스템 재사용) */
            for (const e of this.getAllTargetsIn(560)) {
              if (!e.active) continue;
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = this.rollDamage(DEATH_SLASH_CFG.instantMult, true, true);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 560, crit); // 하드히트 — 넉백 560
              /* 출혈 — 25% ATK / 1초 간격 × 5초 (필드 0.5초 틱 × 절반치 = 초당 25%와 동일 총량) */
              this.scene.spawnField({
                x: e.x, y: e.y, radius: 62,
                dur: DEATH_SLASH_CFG.bleedTicks * DEATH_SLASH_CFG.bleedIntervalMs,
                dps: Math.max(6, Math.round(atk * DEATH_SLASH_CFG.bleedMult)),
                kind: "fire", owner: "player",
              });
              this.scene.spawnBurstAt(e.x, e.y, 20, 0xff2a2a);
            }
          };
          runDeathSlashCinematic(
            { x: this.x, y: this.y, scene: this.scene, flipX: this.flipX },
            strike,
            () => {
              /* 유저 스펙 ⑤ — 복귀: 위치/HP/출혈 상태는 시네마틱이 건드리지 않았으므로 그대로. 입력 해제
               *  (세이브는 씬 주기 저장/다음 전투 이벤트에서 반영 — save는 씬 전용) */
              this.cineLock = false;
              if (this.state === "attack") this.state = "idle";
            }
          );
        } else {
          const marked = this.getAllTargetsIn(820);
          for (const e of marked) {
            (e as Enemy).applyStun?.(1200);
            const r = this.scene.add.circle(e.x, e.y, 16).setStrokeStyle(2, 0xc08aff, 0.9).setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
            this.scene.tweens.add({ targets: r, scale: 0.4, alpha: 0, duration: 900, onComplete: () => r.destroy() });
          }
          this.scene.spawnPickupText(this.x, this.y - 70, `처형 각인 ×${marked.length}`, "#c08aff");
          /* v1.0.16 (O9) — getAllTargetsIn이 스크래치 버퍼를 반환하므로, delayedCall 클로저에서
           *  나중에 참조할 값은 반드시 복사해 둔다(안 하면 다른 스킬 호출이 버퍼를 덮어써 오염). */
          const seq = marked.slice(0, 8);
          seq.slice(0, 8).forEach((t, i) => {
            this.scene.time.delayedCall(340 + i * 260, () => {
              if (this.state === "dead" || !t.active) return;
              const ang = Math.random() * Math.PI * 2;
              this.setPosition(t.x - Math.cos(ang) * 26, t.y - Math.sin(ang) * 26);
              this.scene.spawnSlash(t.x, t.y, new Phaser.Math.Vector2(Math.cos(ang), Math.sin(ang)), i % 2 === 0, 3.0, 0x1a1030);
              this.scene.spawnBurstAt(t.x, t.y, 18, 0x8a4aff);
              this.scene.sfxSkill("iainuki", 0.9 + (i % 4) * 0.05);
              const { dmg, crit } = rd(5.5, true); // 각인된 대상은 반드시 벤다
              t.takeDamage(dmg, new Phaser.Math.Vector2(0, 0.1).normalize(), 340, crit);
            });
          });
          /* 종결 — 심연 소화기 */
          this.scene.time.delayedCall(340 + Math.min(seq.length, 8) * 260 + 160, () => {
            if (this.state === "dead") return;
            this.scene.spawnPillar(this.x, this.y, 0x8a4aff, 290);
            this.scene.spawnBurstAt(this.x, this.y, 78, 0x8a4aff);
            this.scene.spawnCrack(this.x, this.y);
            spawnRingPop(this.scene, this.x, this.y, "vf_ring_void", 0xffffff, 5.4, 840);
            this.scene.cameras.main.flash(180, 90, 40, 160);
            this.scene.cameras.main.shake(520, 0.024);
            this.scene.sfxSkill("dark", 0.64);
            this.scene.sfxSkill("superhit", 0.78);
            for (const e of this.getAllTargetsIn(580)) {
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(8.8);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 620, crit);
              this.applyEnemyStatus("bleed", Math.max(8, Math.round(this.atkTotal * 0.015)), 6000);
            }
          });
        }
        break;
      }
    }

    /* vc149 (#12) — 제2궁극기 여운: 전 직업 공통 30초 잔존 필드.
     *  '지속딜이면 30초 이상' 피드백 반영 — 발화형이라도 잔여 검기/마나가 30초간
     *  남아 지속 딜링 + 존재감을 보장한다 (계열별 필드 속성 상이). */
    this.scene.time.delayedCall(1500, () => {
      if (this.state === "dead") return;
      const fam = familyOf(this.cls);
      const kind = fam === "warrior" ? "fire" : fam === "mage" ? "time" : fam === "thief" ? "poison" : "light";
      this.scene.spawnField({
        x: this.x, y: this.y, radius: 240, dur: 30000,
        dps: Math.max(12, Math.round(this.atkTotal * 0.55)), kind, owner: "player",
      });
      this.scene.driveFx?.gvAura(this.x, this.y, hex, 2600, 1.5);
      this.scene.spawnPickupText(this.x, this.y - 92, "여운 — 잔존 필드 30초", "#e0a8ff");
    });

    /* 공통 마무리 — 시전 후 경직 해제 (1차 궁극기와 동일 게이트)
     *  vc153 — 3D 시네마틱(사(死)의 일섬) 재생 중엔 cineLock이 해제를 막는다 (종료 시 onEnd에서 해제) */
    this.scene.time.delayedCall(300, () => {
      if (this.state === "attack" && !this.cineLock) this.state = "idle";
    });
    this.scene.emitHud();
  }

  /** GM 자유전직 — 검증 없이 어떤 클래스로든 즉시 전직 (HP/MP 가산 재계산) */
  gmSetClass(key: ClassKey): boolean {
    const d = classDef(key);
    if (!d) return false;
    const prev = this.clsBonus;
    this.cls = key;
    this.clsBonus = bonusOf(key);
    this.maxHp = Math.max(60, this.maxHp - prev.hpAdd + this.clsBonus.hpAdd);
    this.maxMp = Math.max(40, this.maxMp - prev.mpAdd + this.clsBonus.mpAdd);
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    this.skill1Cd = 0;
    this.skill2Cd = 0;
    this.skill3Cd = 0;
    this.skill4Cd = 0;
    this.skill5Cd = 0; // v3.2.0 — 궁극기 쿨 리셋
    this.skill5bCd = 0; // vc146 (#2) — 제2궁극기 쿨 리셋
    this.recalcSpeed();
    this.scene.emitHud();
    return true;
  }

  /** GM 레벨 설정 — 레벨업 증분(HP+18/MP+6/ATK+3/AP+5)을 등가 적용 */
  gmSetLevel(n: number) {
    const target = Phaser.Math.Clamp(Math.round(n), 1, 200);
    while (this.lv < target) {
      this.lv++;
      this.maxHp += 18;
      this.maxMp += 6;
      this.atk += 3;
      this.ap += 5;
    }
    while (this.lv > target) {
      this.lv--;
      this.maxHp = Math.max(100, this.maxHp - 18);
      this.maxMp = Math.max(60, this.maxMp - 6);
      this.atk = Math.max(1, this.atk - 3);
      this.ap = Math.max(0, this.ap - 5);
    }
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    this.scene.spawnLevelUpFx(this.x, this.y);
    this.scene.emitHud();
  }

  /** v3.3.0 (지시 #3) — GM 5차전직(임시) 부여/해제 — 레벨 검증 없이 5차 각성 상태 토글.
   *  부여 시: 궁극기 즉시 해금 + 스킬 1~4 전체 강화(sTier=5) + 풀회복 + 쿨 리셋 */
  gmGrantFifth(on: boolean) {
    this.fifth = on;
    if (on) {
      this.hp = this.maxHp;
      this.mp = this.maxMp;
      this.skill5Cd = 0;
      this.skill5bCd = 0; // vc146 — 제2궁극기 쿨 리셋
      this.scene.spawnLevelUpFx(this.x, this.y);
      this.scene.spawnPillar(this.x, this.y, 0xffe66a, 260);
      this.scene.spawnBurstAt(this.x, this.y, 60, 0xffe66a);
      this.scene.cameras.main.flash(180, 255, 230, 120);
      this.scene.sfxLevelUp();
    } else {
      this.skill5Cd = 0;
      this.skill5bCd = 0; // vc146 — 제2궁극기 쿨 리셋
    }
    this.scene.emitHud();
  }

  /* ---------------- 피격 / 사망 / 성장 ---------------- */

  /** v3.0.6 — hpPct(0~1): maxHP % 고정 피해 하한 (몬스터/보스 전용 — 후반 탱킹 방지)
   *  v3.3.0 (지시 #5) — 챕터 4(알프헤임)부터 % 고정 피해 적용, 그 전은 순수 수치 피해만
   *  (초보 마을 느낌: 초반 맵은 방어/레벨로 데미지를 0까지 깎을 수 있고, 후반은 %로 고정 방어 무시) */
  takeDamage(dmg: number, fromDir: Phaser.Math.Vector2, pierce = 0, hpPct = 0, trueDmg = false) {
    if (this.iframes > 0 || this.state === "dead") return;
    /* v4.2.0 — trueDmg: 방어력/피해 하한 무시 고정 피해 (식인초 최대체력 10% 고정데미지 전용) */
    const pctFloor = trueDmg ? 0 : hpPct > 0 && this.stageCh >= 4 ? Math.round(this.maxHp * hpPct) : 0;
    const final = trueDmg ? dmg : Math.max(this.applyDefense(dmg, pierce), pctFloor);
    this.hp -= final;
    this.iframes = 600;
    this.scene.sfxHurt();
    this.scene.cameras.main.shake(70, 0.004);
    /* v1.1.3 (#개편 연출) — 피격 방향 표시.
     *  화면 전체가 흔들리기만 하면 "어디서 맞았는지"를 모른다. 특히 자동사냥 중이거나
     *  몬스터가 뒤에서 붙었을 때 대응이 늦는다. 화면 가장자리에 붉은 호를 띄워 알린다.
     *  주의: fromDir은 넉백 방향(맞은 반대쪽)이다 — 공격자는 그 반대편에 있으므로
     *  각도에 π를 더해 표시한다. 오브젝트 풀 없이 원호 1개만 그리고 즉시 소멸. */
    try {
      const cam = this.scene.cameras.main;
      const ang = Math.atan2(fromDir.y, fromDir.x) + Math.PI; // 공격자가 있는 방향
      const cx = cam.width / 2, cy = cam.height / 2;
      const radius = Math.min(cam.width, cam.height) * 0.42;
      const gfx = this.scene.add.graphics().setDepth(8800).setScrollFactor(0);
      gfx.lineStyle(9, 0xff3b3b, 0.85);
      gfx.beginPath();
      gfx.arc(cx, cy, radius, ang - 0.42, ang + 0.42, false);
      gfx.strokePath();
      this.scene.tweens.add({
        targets: gfx,
        alpha: 0,
        duration: 340,
        ease: "Quad.out",
        onComplete: () => gfx.destroy(),
      });
    } catch { /* 연출 실패는 피해 처리에 영향 없음 */ }
    /* v1.4.8 (#5 그래픽) — 위험 피격 연출: HP 30% 이하 피격 시 암적색 플래시로 위험 상태를 즉각 인지 */
    if (this.hp > 0 && this.hp / Math.max(1, this.maxHp) <= 0.3) this.scene.cameras.main.flash(160, 70, 0, 0);
    this.setVelocity(fromDir.x * 200, fromDir.y * 200);
    this.lungeTime = 0; // 피격 넉백이 러지에 덮이지 않게
    this.scene.spawnDamageText(this.x, this.y - 30, final);
    this.scene.tweens.add({
      targets: this,
      alpha: 0.35,
      duration: 90,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.setAlpha(1),
    });
    this.scene.emitHud();
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = "dead";
      this.setVelocity(0, 0);
      this.scene.onPlayerDead();
    }
  }

  healFull() {
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    this.scene.emitHud();
  }

  gainExp(v: number) {
    // 지혜의 물약 — 경험치 +50% 버프 (v1.9 BM)
    let gain = this.hasBuff("buff_exp") ? Math.round(v * 1.5) : v;
    /* v1.0.18 — 유니온 훈련 명령 버프 (경험치 +20%) — 씬이 주입하는 훅으로 계산 */
    if (this.expBonusPct) gain = Math.round(gain * (1 + this.expBonusPct() / 100));
    this.exp += gain;
    let leveled = false;
    /* v1.4.30 (#1 프리즈 방지) — 대량 EXP(파티 레이드 보상 등)가 한 번에 들어오면
     *  while 루프가 수백 회 돌며 같은 프레임에서 sfx/FX를 수백 번 트리거해
     *  저사양 기기에서 렌더 정지처럼 보이는 사례 방지. 레벨당 1회 연산으로 보장하고
     *  루프 상한(200회)을 둔다 — 잔여 EXP는 남아 다음 처치 때 이어서 레벨업된다. */
    let guard = 0;
    while (this.exp >= this.expNext() && guard++ < 200) {
      this.exp -= this.expNext();
      this.lv++;
      leveled = true;
      this.maxHp += 18;
      this.maxMp += 6; // 레벨업 MP 성장
      this.atk += 3;
      this.ap += 5; // AP 스탯 포인트 (v1.9 — 메이플식 레벨업 5포인트)
      this.hp = this.maxHp;
      this.mp = this.maxMp;
    }
    if (leveled) {
      this.scene.sfxLevelUp();
      this.scene.spawnLevelUpFx(this.x, this.y);
      this.scene.onLevelUp(); // v2.4 — 레벨 목표 퀘스트 즉시 판정
    }
    this.scene.emitHud();
  }

  expNext() {
    /* v1.0.15 (피드백 #1 — "심연의탑 경험치 아직도 너무 잘올라"):
     *  나무위키 "메이플스토리/레벨" 문서 4.1~4.3 목차의 레벨별 경험치표
     *  (2026-03-19 업데이트 이후 기준, 1~299레벨 전 구간)를 그대로 적용.
     *  v3.0.2 자체 공식(40×lv^1.45·누진 폐기) 대신 원작처럼 레벨이 오를수록
     *  요구 경험치가 계단식 누진한다 — 초반 9~14평평 밴드 → 구간별 ×1.2 → 190+ 급등.
     *  테이블은 expTable.ts 참고, 300레벨 이후는 ×1.1 연장. */
    return expToNext(this.lv);
  }

  /* ---------------- 전직 (v1.8 다차원 트리 — 메이플 모험가 구조 참고) ---------------- */

  /** 전직/승격 실행 — 티어 순서·부모 경로 검증. HP/MP 증분 가산 + 풀회복 + 속도 재계산 */
  applyClass(key: ClassKey): boolean {
    const d = classDef(key);
    if (!d) return false;
    const next = nextTierOf(this.cls); // 3차 완료면 null
    if (!next || d.tier !== next || d.parent !== this.cls) return false;
    this.cls = key;
    this.clsBonus = bonusOf(key);
    this.maxHp += d.hpAdd;
    this.maxMp += d.mpAdd;
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    this.recalcSpeed();
    this.scene.emitHud();
    return true;
  }

  /** 자유 전직 (메이플 자유전직 재현) — 같은 단계·같은 계열 반대 경로로 전환. 골드 소모는 씬에서 검사.
   *  전직과 달리 풀회복 없음 — HP/MP는 새 상한으로 클램프 */
  switchClass(key: ClassKey): boolean {
    const alt = freeJobOption(this.cls);
    if (!alt || alt.key !== key) return false;
    const prev = this.clsBonus;
    const d = classDef(key)!;
    this.cls = key;
    this.clsBonus = bonusOf(key);
    this.maxHp += d.hpAdd - prev.hpAdd;
    this.maxMp += d.mpAdd - prev.mpAdd;
    this.hp = Math.min(this.hp, this.maxHp);
    this.mp = Math.min(this.mp, this.maxMp);
    this.recalcSpeed();
    this.scene.emitHud();
    return true;
  }

  /** 세이브 복원용 — HP/MP 가산은 세이브 maxHp에 이미 포함, 여기선 클래스+속도만 재적용 */
  applySavedClass(key: string | null | undefined) {
    if (!isClassKey(key) || this.cls) return;
    this.cls = key;
    this.clsBonus = bonusOf(key);
    this.recalcSpeed();
  }

  /** v1.0.18 — 시작(스타트) 클래스 적용 — 환생·캐릭터 생성용.
   *  applySavedClass는 "비어 있을 때만" 세팅이라 초기화/재적용에 쓸 수 없어 별도 경로.
   *  1차 클래스(티어 1)만 유효 — 상위 키는 체인 최상위로 강등 후 적용. */
  applyStartClass(key: ClassKey | null) {
    const first = key ? (chainOf(key)[0]?.key ?? null) : null;
    if (first) {
      this.cls = first;
      this.clsBonus = bonusOf(first);
    } else {
      this.cls = null;
      this.clsBonus = bonusOf(null);
    }
    this.skill1Cd = 0;
    this.skill2Cd = 0;
    this.skill3Cd = 0;
    this.skill4Cd = 0;
    this.recalcSpeed();
  }

  /** v1.0.16 — 환생용 직업 완전 초기화: 클래스/계열 보너스/스킬 슬롯을 무직 상태로 되돌린다.
   *  v1.0.18 — 5차 각성(fifth)·각성 시련 완료(fifthStoryDone)도 함께 리셋
   *  (기존엔 fifth가 남아 스킬·기본공격이 "·극" 5차 강화 상태로 남는 버그).
   *  시작 클래스 복원은 doRebirth에서 applyStartClass(startCls)로 이어서 한다. */
  resetClass() {
    this.cls = null;
    this.clsBonus = bonusOf(null);
    this.skill1Cd = 0;
    this.skill2Cd = 0;
    this.skill3Cd = 0;
    this.skill4Cd = 0;
    this.skill5Cd = 0;
    this.skill5bCd = 0; // vc146 — 제2궁극기 쿨 리셋
    this.fifth = false;
    this.fifthStoryDone = false;
    this.recalcSpeed();
  }

  /** 세이브 로드 후 속도 재계산 (버프 포함 — recalcSpeed 공개 래퍼) */
  recalcSpeedForLoad() {
    this.recalcSpeed();
  }

  /* ---------------- AP 스탯 (v1.9 — 메이플식 4스탯) ---------------- */

  /** 스탯 배분 — 즉시 효과 적용 (힘=공격/민첽=크리는 getter에서 반영, 지력=MP/행운=HP는 여기서 가산) */
  allocateStat(k: "str" | "dex" | "int" | "luk", n: number): boolean {
    if (n <= 0 || this.ap < n) return false;
    this.ap -= n;
    this.stats[k] += n;
    if (k === "int") {
      this.maxMp += 4 * n;
      this.mp = Math.min(this.maxMp, this.mp + 4 * n);
    } else if (k === "luk") {
      this.maxHp += 5 * n;
      this.hp = Math.min(this.maxHp, this.hp + 5 * n);
    }
    this.scene.emitHud();
    return true;
  }

  /** v3.0.15 (#2) — 레벨업 AP 자동배분: 계열 주스탯 80% + 행운 20%.
   *  지력→MP/행운→HP는 allocateStat에서 즉시 가산되므로 그대로 이득. */
  allocateAutoPoints(): boolean {
    if (this.ap < 1) return false;
    const fam = familyOf(this.cls);
    const main: "str" | "dex" | "int" = fam === "mage" ? "int" : fam === "ranger" || fam === "thief" ? "dex" : "str";
    const total = this.ap;
    const mainN = Math.ceil(total * 0.8);
    const subN = total - mainN;
    if (mainN > 0) this.allocateStat(main, mainN);
    if (subN > 0) this.allocateStat("luk", subN);
    return true;
  }

  /* ---------------- 버프 (v1.9 BM — 지속시간 효과) ---------------- */

  hasBuff(key: BuffKey): boolean {
    return this.buffs.some((b) => b.key === key);
  }

  addBuffItem(key: BuffKey, n = 1) {
    this.buffItems[key] = (this.buffItems[key] ?? 0) + n;
    this.scene.emitHud();
  }

  /** 버프 물약 사용 — 소지품 차감 + 활성 버프 갱신 */
  useBuffItem(key: BuffKey): boolean {
    const def = BUFF_DEFS[key];
    if (!def || (this.buffItems[key] ?? 0) <= 0) return false;
    this.buffItems[key] = (this.buffItems[key] ?? 0) - 1;
    const existing = this.buffs.find((b) => b.key === key);
    if (existing) {
      existing.remain = def.duration; // 같은 버프 재사용 — 시간 갱신
      existing.total = def.duration;
    } else {
      this.buffs.push({ key, remain: def.duration, total: def.duration });
    }
    this.recalcSpeed(); // 신속 물약 반영
    this.scene.sfxPotion();
    this.scene.spawnPickupText(this.x, this.y - 34, `${def.name}! ${def.desc}`, def.color);
    this.scene.emitHud();
    return true;
  }

  /** 버프 틱 — update에서 매 프레임 호출, 만료 시 해제 */
  private tickBuffs(ms: number) {
    if (this.buffs.length === 0) return;
    const before = this.buffs.length;
    for (const b of this.buffs) b.remain -= ms;
    const expired = this.buffs.filter((b) => b.remain <= 0);
    this.buffs = this.buffs.filter((b) => b.remain > 0);
    if (expired.length > 0) {
      for (const b of expired) {
        if (b.key === "buff_spd") this.recalcSpeed();
        const def = BUFF_DEFS[b.key];
        this.scene.spawnPickupText(this.x, this.y - 30, `${def.name} 효과 종료`, "#ffffff");
      }
      this.scene.emitHud();
    } else if (before > 0) {
      // 남은 시간 HUD 갱신 — 초 단위 변화 시에만 emit (프레임 부담 절감)
      this.buffEmitAcc += ms;
      if (this.buffEmitAcc >= 500) {
        this.buffEmitAcc = 0;
        this.scene.emitHud();
      }
    }
  }
  private buffEmitAcc = 0;

  /** 기본 속도 × 경로 누적 속도 보너스 × 신속 버프 × 천공 신속 × 감속 (합산 → 곱) */
  private recalcSpeed() {
    const buff = this.hasBuff("buff_spd") || this.hasBuff("buff_king") ? 1.25 : 1;
    const sky = this.selfSpdBuff ? this.selfSpdBuff.mult : 1;
    const slow = this.dots.slow ? this.dots.slow.mult : 1;
    /* v3.0.24 — 이속 성장 연동: 기본 225 + 민첩 0.5%/점(최대 +60%) + 강화(무기+방어구 별 합계) 0.5%/성(최대 +15%)
     *  "강화 및 스텟을 올려야 빨라진다" — 성장 재화의 가치 확대
     *  v4.0.0 — 배지 이속 + 게이트 인런 카드 이속 */
    const dexPct = Math.min(60, this.stats.dex * 0.5);
    const starPct = Math.min(15, (this.weaponStars + this.armorStars) * 0.5);
    this.speed = Math.round(Player.BASE_SPEED * (1 + (this.clsBonus.speedPct + dexPct + starPct + this.extBonus.speedPct + this.runBuffs.speedPct) / 100) * buff * sky * slow);
  }

  /* ---------------- RPG 기본 요소 ---------------- */

  /** 장비+강화+클래스 경로+직업 주스탯 포함 실제 공격력 (v1.9: 힘 +0.3/점, 분노 버프 +25%)
   *  v3.0.5 — 스타포스 마일스톤(★5/10/15) 공격 보너스 반영
   *  v1.4.14 (#3 직업 주스탯 → ATK) — 전사 STR/궁수 DEX/마법사 INT/도적 LUK 1점당 공격력 +0.5
   *  기존 str*0.3에서 직업 주스탯은 0.8/점으로 상향 (주스탯 1점 = 공격력 약 0.8 증가) */
  get atkTotal(): number {
    /* v3.0.15 (#13) — 무기 잠재옵션 공격력 합산 */
    const potAtk = sumPotLines([this.potentials[this.weapon]]).atk;
    /* v3.0.20 (#8) — 별 1개마다 즉시 상승: +2 + 무기 기본 공격력의 8% (마일스톤은 별도) */
    const perStar = starPerStarAtk(ITEMS[this.weapon].atk ?? 0) * this.weaponStars;
    /* v1.3.1 (#3) — 장신구 스타포스 atk 가산 (atk 장신구도 별이 실제 공격력을 올린다) */
    let accStarAtk = 0;
    for (const k of this.accessories) accStarAtk += starAccBonus(this.accUp[k] ?? 0, ITEMS[k]).atk;
    /* v4.0.0 — 등급업 큐브 승급 배율 (무기 기본 스탯 강화) */
    const tierMul = this.tierUpMult("weapon");
    /* v1.4.14 (#3) — 직업 주스탯 → ATK 가산:
     *  전사(warrior) → STR 0.8/점
     *  궁수(ranger) → DEX 0.8/점
     *  마법사(mage) → INT 0.8/점
     *  도적(thief) → LUK 0.8/점
     *  기존 str*0.3은 모든 캐릭터에 그대로 유지 (전사는 주스탯 보너스로 추가 가산)
     *  미전직 상태는 전사 취급 (STR) */
    const fam = familyOf(this.cls) ?? "warrior";
    const mainStatVal =
      fam === "warrior" ? this.stats.str :
      fam === "ranger" ? this.stats.dex :
      fam === "mage" ? this.stats.int :
      fam === "thief" ? this.stats.luk :
      this.stats.str;
    const mainStatAtk = mainStatVal * 0.8;
    const base =
      this.atk + (ITEMS[this.weapon].atk ?? 0) * tierMul + perStar + accStarAtk +
      starWeaponBonus(this.weaponStars).atk + this.stats.str * 0.3 + mainStatAtk + potAtk +
      this.extBonus.atk + this.critOverflowAtk; // vc145 (#12) — 크리 100% 초과분만큼 공격력 평가산
    const buff = this.hasBuff("buff_atk") || this.hasBuff("buff_king") ? 1.25 : 1;
    const king = this.hasBuff("buff_king") ? 1.3 / 1.25 : 1; // v3.0.6 — 왕의 가호 공격 +30%
    /* v3.0.16 — 세트 아이템 효과 + 몬스터 컬렉션 공격 % 보너스
     *  v3.0.22 (#50) — 세계수의 가호: 평ATK +20·공격 +3% (결정 전부 수집 보너스)
     *  v4.0.0 — 피규어/성좌 atkPct + 게이트 인런 카드 atkPct */
    const setPct = this.activeSet?.bonus.atkPct ?? 0;
    const colPct = collectionBonus(this.collectionRegistered).atkPct;
    const blessFlat = this.worldtreeBlessing ? WORLDTREE_BLESSING.atk : 0;
    const blessPct = this.worldtreeBlessing ? WORLDTREE_BLESSING.atkPct : 0;
    return Math.round((base + blessFlat) * (1 + (this.clsBonus.atkPct + setPct + colPct + blessPct + this.extBonus.atkPct + this.runBuffs.atkPct) / 100) * buff * king);
  }

  /* ---------------- v3.0.16 — 세트 아이템 효과 (메이플 세트 아이템) ---------------- */
  /** 활성 세트 — 무기+방어구+장신구 반지 3종이 같은 챕터 테마면 보너스 활성 */
  get activeSet(): ReturnType<typeof activeSetBonus> {
    return activeSetBonus(this.weapon, this.armor, this.accessories);
  }

  /** 장비+강화+클래스 경로 포함 실제 방어력 (v1.9: 수호 버프 +8)
   *  v3.0.5 — 스타포스 마일스톤 방어 보너스 반영 */
  get defTotal(): number {
    const kingDef = this.hasBuff("buff_king") ? 10 : 0; // v3.0.6 — 왕의 가호 방어 +10
    const buff = this.hasBuff("buff_def") ? 8 : 0;
    /* v3.0.15 (#13) — 방어구 잠재옵션 방어력 합산 */
    const potDef = sumPotLines([this.potentials[this.armor]]).def;
    /* v3.0.16 — 세트 방어력 보너스 */
    const setDef = this.activeSet?.bonus.defAdd ?? 0;
    /* v3.0.22 (#50) — 세계수의 가호 방어 +8 */
    const blessDef = this.worldtreeBlessing ? WORLDTREE_BLESSING.def : 0;
    /* v3.0.20 (#8) — 별 1개마다 즉시 상승: +1 + 기본 방어의 6%
     *  v4.0.0 — 등급업 배율 + 피규어/배지/룬/성좌/스킨 flat 방어 */
    const perStar = starPerStarDef(ITEMS[this.armor].def ?? 0).def * this.armorStars;
    /* v1.3.1 (#3) — 장신구 스타포스 def 가산 (def 장신구도 별이 실제 방어력을 올린다) */
    let accStarDef = 0;
    for (const k of this.accessories) accStarDef += starAccBonus(this.accUp[k] ?? 0, ITEMS[k]).def;
    return ((
      (ITEMS[this.armor].def ?? 0) * this.tierUpMult("armor") + perStar + accStarDef +
      starArmorBonus(this.armorStars).def + this.clsBonus.defAdd + buff + potDef + setDef + blessDef +
      this.extBonus.def
    )) + kingDef;
  }

  /** v3.0.5 — 방어구 스타포스 마일스톤 최대 HP 보너스 (실제 적용치 추적) */
  private sfHpApplied = 0;

  /* ================= v4.0.0 — 이세카이 업데이트 외부 보너스 =================
   *  피규어/배지/룬/성좌/스킨 보너스 — 씬에서 setExtBonus()로 주입, 즉시 반영.
   *  HP는 syncBonusHp()의 target에 extBonus.hp가 합산된다 (델타 패턴 재사용). */
  extBonus: ExtBonus = { ...ZERO_EXT };
  /** 게이트 인런 전용 카드 버프 (런 종료 시 clearRunBuffs) */
  runBuffs: { atkPct: number; skillPct: number; crit: number; lifesteal: number; silverPct: number; speedPct: number } = {
    atkPct: 0, skillPct: 0, crit: 0, lifesteal: 0, silverPct: 0, speedPct: 0,
  };
  /** 인런 HP% 카드로 가산된 maxHp 총액 (런 종료 시 회수) */
  runHpFlat = 0;

  /** 외부 보너스 주입 — 피규어/배지/룬/성좌/스킨 변동 시 씬에서 호출 */
  setExtBonus(b: ExtBonus) {
    this.extBonus = b;
    this.syncBonusHp();
    this.recalcSpeed();
  }

  /** 게이트 인런 카드 버프 합산 적용 (선택 누적) */
  applyRunCard(cards: GateCard[]) {
    for (const c of cards) {
      this.runBuffs.atkPct += c.stat.atkPct ?? 0;
      this.runBuffs.skillPct += c.stat.skillPct ?? 0;
      this.runBuffs.crit += c.stat.crit ?? 0;
      this.runBuffs.lifesteal += c.stat.lifesteal ?? 0;
      this.runBuffs.silverPct += c.stat.silverPct ?? 0;
      this.runBuffs.speedPct += c.stat.speedPct ?? 0;
      if (c.stat.hpPct) {
        const flat = Math.round((this.maxHp - this.runHpFlat) * (c.stat.hpPct / 100));
        if (flat > 0) {
          this.runHpFlat += flat;
          this.maxHp += flat;
          this.hp = Math.min(this.maxHp, this.hp + flat);
        }
      }
    }
    this.recalcSpeed();
  }

  /** 게이트 런 종료 — 카드 버프/런 HP 회수 */
  clearRunBuffs() {
    this.runBuffs = { atkPct: 0, skillPct: 0, crit: 0, lifesteal: 0, silverPct: 0, speedPct: 0 };
    if (this.runHpFlat > 0) {
      this.maxHp = Math.max(60, this.maxHp - this.runHpFlat);
      this.hp = Math.min(this.hp, this.maxHp);
      this.runHpFlat = 0;
    }
    this.recalcSpeed();
  }

  /** v4.0.0 — 경험치 책 사용 (레벨 스케일 경험치 지급) */
  useExpBook(): number {
    if (!this.owned.includes("exp_book")) return 0;
    this.consumeConsumable("exp_book");
    const exp = expBookExp(this.lv);
    this.gainExp(exp);
    return exp;
  }

  /* v1.2.0 (#15 경험치책 3종 — 메이플 성장책 오마주 · v1.2.1 (#5) 비약→책:
   *  고급 성장의 책   — 현재 레벨 필요 EXP의 60% 획득
   *  태풍 성장의 책   — 필요 EXP의 150% (1.5레벨어치) 획득
   *  극한 성장의 책   — 즉시 +1레벨 (Lv200 이상에선 사용 불가 — 환생 루프 보호)
   *  반환값: 실제 획득 EXP(표시용) — 극한은 다음 레벨까지 남은 EXP 정산치로 표기 */
  useExpPotion(key: "exp_book_s" | "exp_book_m" | "exp_book_l"): { ok: boolean; exp: number; msg?: string } {
    if (!this.owned.includes(key)) return { ok: false, exp: 0, msg: "성장의 책이 없습니다" };
    if (key === "exp_book_l" && this.lv >= 200) {
      return { ok: false, exp: 0, msg: "극한 성장의 책은 Lv 200 이상에선 사용할 수 없다" };
    }
    this.consumeConsumable(key);
    if (key === "exp_book_l") {
      const need = this.expNext() - this.exp;
      this.gainExp(Math.max(1, need)); // 정확히 1레벨치 — 여분은 다음 레벨로 이월되지 않게 필요치만
      return { ok: true, exp: Math.max(1, need) };
    }
    const pct = key === "exp_book_m" ? 1.5 : 0.6;
    const exp = Math.round(this.expNext() * pct);
    this.gainExp(exp);
    return { ok: true, exp };
  }

  /** v4.0.0 — 등급업 큐브: 장착 무기/방어구 티어 승급 (common→rare→epic→legend)
   *  승급된 장비는 보유 목록에 유지되고, 아이템 자체의 atk/def가 등급 배율만큼 상승한다.
   *  실제 티어 승급은 아이템 교체 대신 TIER_UP_BOOST 승수로 반영 (인스턴스 없는 구조 유지). */
  tierUpBoost = 0; // 누적 승급 수 (무기+방어구 합계)
  tierUpTargets: { weapon: number; armor: number } = { weapon: 0, armor: 0 }; // 개별 승급 수
  upgradeTier(slot: "weapon" | "armor"): string | null {
    const cur = ITEMS[slot === "weapon" ? this.weapon : this.armor].tier;
    const ORDER: string[] = ["common", "rare", "epic", "legend"];
    const idx = ORDER.indexOf(cur);
    if (idx < 0 || idx >= ORDER.length - 1) return null; // 이미 전설
    if (!this.owned.includes("tier_cube")) return null;
    this.consumeConsumable("tier_cube");
    this.tierUpTargets[slot] = (this.tierUpTargets[slot] ?? 0) + 1;
    this.tierUpBoost = this.tierUpTargets.weapon + this.tierUpTargets.armor;
    const nextTier = ORDER[idx + 1];
    return nextTier;
  }
  /** 등급 승급 누적 배율 — 승급 1회당 해당 슬롯 기본 스탯 +12% */
  tierUpMult(slot: "weapon" | "armor"): number {
    return 1 + (this.tierUpTargets[slot] ?? 0) * 0.12;
  }
  /** 이미 maxHp에 가산된 스타포스 HP 총액 (세이브용) */
  get starHpApplied() { return this.sfHpApplied; }
  /** 세이브 복원 — 가산 이력만 선복원 (syncStarHp가 델타만 반영하게) */
  restoreStarHp(applied: number) { this.sfHpApplied = applied || 0; }
  /** 마일스톤 방어구 HP 보너스를 maxHp에 동기화 (로드/강화 후 호출)
   *  v3.0.20 (#8) — 본당 HP +12도 동기화 대상 */
  syncStarHp() {
    const target = starArmorBonus(this.armorStars).hp + starPerStarDef(ITEMS[this.armor].def ?? 0).hp * this.armorStars;
    const delta = target - this.sfHpApplied;
    if (delta === 0) return;
    this.maxHp = Math.max(60, this.maxHp + delta);
    this.sfHpApplied = target;
    if (delta > 0) this.hp = Math.min(this.maxHp, this.hp + delta);
  }

  /* ---------------- v3.0.16 — 세트/컬렉션 보너스 HP 동기화 ----------------
   *  세트 maxHp + 컬렉션 hpAdd를 하나의 델타로 추적 (syncStarHp/syncPotentialsHp 동일 패턴) */
  private bonusHpApplied = 0;
  get bonusHpAppliedVal() { return this.bonusHpApplied; }
  /** 세이브 복원 — 가산 이력 선복원 */
  restoreBonusHp(applied: number) { this.bonusHpApplied = applied || 0; }
  /** 장착 세트 maxHp + 컬렉션 hpAdd를 maxHp에 동기화 (장착/해제/로드/컬렉션 등록 후 호출) */
  syncBonusHp() {
    const col = collectionBonus(this.collectionRegistered);
    const target = (this.activeSet?.bonus.maxHp ?? 0) + col.hpAdd +
      (this.worldtreeBlessing ? WORLDTREE_BLESSING.hpAdd : 0) + // v3.0.22 (#50) 가호 HP +200
      this.extBonus.hp; // v4.0.0 — 피규어/배지/룬/성좌/스킨 maxHP
    const delta = target - this.bonusHpApplied;
    if (delta === 0) return;
    this.maxHp = Math.max(60, this.maxHp + delta);
    this.bonusHpApplied = target;
    if (delta > 0) this.hp = Math.min(this.maxHp, this.hp + delta);
    this.scene.emitHud();
  }
  /** 몬스터 컬렉션 등록 종수 — 씬에서 최초 처치/로드 시 갱신 */
  collectionRegistered = 0;

  /* ---------------- v3.0.22 (#50) — 세계수의 가호 ---------------- */
  /** 결정 전부 수집 보너스 활성 여부 (세이브) */
  worldtreeBlessing = false;
  /** 세계수의 가호 설정/해제 — atkTotal/defTotal/syncBonusHp에 즉시 반영 */
  setWorldtreeBlessing(on: boolean) {
    if (this.worldtreeBlessing === on) return;
    this.worldtreeBlessing = on;
    this.syncBonusHp();
  }
  /** 컬렉션 등록 수 갱신 — 마일스톤 도달로 HP 보너스가 변하면 동기화 */
  setCollection(n: number) {
    if (n === this.collectionRegistered) return;
    this.collectionRegistered = n;
    this.syncBonusHp();
  }

  /* ---------------- v3.0.15 (#13) — 잠재옵션 maxHp 동기화 ---------------- */
  /** 이미 maxHp에 가산된 잠재 maxHp 총액 (세이브용) */
  private potHpApplied = 0;
  get potHpAppliedVal() { return this.potHpApplied; }
  /** 세이브 복원 — 가산 이력만 선복원 */
  restorePotHp(applied: number) { this.potHpApplied = applied || 0; }
  /** 장착 장비 잠재 maxHp를 maxHp에 동기화 (로드/장착/해제/eert 리롤 후 호출) */
  syncPotentialsHp() {
    const target = sumPotLines([
      this.potentials[this.weapon], this.potentials[this.armor],
      ...this.accessories.map((k) => this.potentials[k]),
    ]).maxHp;
    const delta = target - this.potHpApplied;
    if (delta === 0) return;
    this.maxHp = Math.max(60, this.maxHp + delta);
    this.potHpApplied = target;
    if (delta > 0) this.hp = Math.min(this.maxHp, this.hp + delta);
    this.scene.emitHud();
  }

/** eert 큐브 리롤 — 큐브 소모 후 잠재 재추첨. 결과를 반환 (씬에서 연출)
   *  v1.1.0 (#6) — 현재 등급 미만으로 떨어지지 않는다 (레어→레어 / 에픽 ≠> 레어 / 에픽 → 유니크) */
  rerollPotentials(key: ItemKey): Potentials | null {
    const item = ITEMS[key];
    if (!item || (item.kind !== "weapon" && item.kind !== "armor" && item.kind !== "accessory")) return null;
    // 장비는 보유 중이어야 (장착 중이든 가방이든) / 큐브 보유 확인
    if (!this.owned.includes(key) && this.weapon !== key && this.armor !== key && !this.accessories.includes(key)) return null;
    if (!this.owned.includes("eert_cube")) return null;
    this.consumeConsumable("eert_cube");
    /* v1.0.8 — 잠재 천장: 유니크 미달 연속 카운터 (10회째 롤은 유니크+ 확정 — UI 공시)
     *  v1.1.0 (#6) — minGrade 하한: 현재 등급 아래 굴림은 폐기하고 현재 등급 이상으로만 재추첨 */
    const curGrade = this.potentials[key]?.grade ?? 0;
    const pot = rollPotentials(this.potPity, curGrade);
    this.potPity = pot.grade >= 2 ? 0 : Math.min(POT_PITY_MAX - 1, this.potPity + 1);
    this.potentials[key] = pot;
    this.syncPotentialsHp();
    return pot;
  }

  /** 크리티컬 확률 (%) — 기본 8% + 장신구(반지/펜던트 합산) + 클래스 경로 누적 + 민첽 0.4%p/점
   *  v3.0.5 — 무기 스타포스 마일스톤 치명 보너스(★5+2/★10+3/★15+5) 반영
   *  v3.0.7 — 장신구 스타포스 마일스톤 치명 보너스(★5+2/★10+6/★15+12) 반영 */
  get critRate(): number {
    let acc = 0;
    for (const k of this.accessories) {
      acc += (ITEMS[k].crit ?? 0) + starAccBonus(this.accUp[k] ?? 0, ITEMS[k]).crit;
    }
    acc += starWeaponBonus(this.weaponStars).crit;
    /* v3.0.15 (#13) — 장착 장비 잠재옵션 치명 합산 (무기/방어구/장신구) */
    acc += sumPotLines([
      this.potentials[this.weapon], this.potentials[this.armor],
      ...this.accessories.map((k) => this.potentials[k]),
    ]).crit;
    /* v3.0.16 — 세트 치명 + 컬렉션 치명 보너스
     *  v4.0.0 — 피규어/배지/룬/성좌/스킨 치명 + 게이트 인런 카드 치명 */
    acc += this.activeSet?.bonus.critAdd ?? 0;
    acc += collectionBonus(this.collectionRegistered).critAdd;
    acc += this.extBonus.crit + this.runBuffs.crit;
    /* v4.3.0 — 질풍의 물약 (BM 버프): 치명 +12%p */
    if (this.hasBuff("buff_crit")) acc += 12;
    return Math.round((Player.BASE_CRIT + acc + this.clsBonus.critAdd + this.stats.dex * 0.4) * 10) / 10;
  }

  /** v3.0.15 (#16) — 공격 원소 (계열 고정: 전사 화염/궁수 자연/마법사 냉기/도적 어둠, 미전직 무속성) */
  get attackElem(): ElemKey {
    const fam = familyOf(this.cls);
    return fam ? (FAMILY_ELEM[fam] ?? "none") : "none";
  }

  /** 펫 골드 보너스 (%) — 소환 중인 펫의 효과 */
  get petGoldBonusPct(): number {
    return this.pet ? PET_DEFS[this.pet].bonusGoldPct : 0;
  }

  /** 데미지 굴림 — 크리티컬 판정 포함 (스킬은 skillMult 곱, 전장의 함성 공증 반영 v3.0.3)
   *  v3.0.6 — 크리티컬 확률 100% 캡 (초과분 확률 미반영)
   *  vc145 (#12 궁수 너프) — 크리 100% 초과분의 크리뎀% 전환 폐지:
   *  초과분은 atkTotal의 평공격력 가산(critOverflowAtk)으로 변경 — 예: 크리 135% → +35 공격력
   *  v1.0.19 (B-2 유니온) — 유니온 도적 계열 크리티컬 데미지 보너스(extBonus.critDmg %p) 가산 */
  get critDmg(): number {
    return Player.CRIT_MULT + (this.extBonus.critDmg ?? 0) / 100;
  }

  /** vc145 (#12) — 크리 확률 100% 초과분 → 공격력 평가산 (135%면 +35 ATK).
   *  %뎀 무증식 대신 스탯 수치로 환산 — 후반 크리 스택(궁수) 과도 기대값 절제 */
  get critOverflowAtk(): number {
    return Math.max(0, this.critRate - 100);
  }

  private rollDamage(mult: number, isSkill = false, forceCrit = false): { dmg: number; crit: boolean } {
    const chance = Math.min(this.critRate, 100); // 초과분은 확률에 불반영 — vc145 (#12) 공격력 평가산으로 전환
    const crit = forceCrit || Math.random() * 100 < chance;
    const rage = this.selfAtkBuff ? this.selfAtkBuff.mult : 1;
    /* v3.3.0 (지시 #1) — 5차 각성 시 스킬 피해 +12% (기본공격 제외 — 스킬 강화 컨셉)
     *  v4.0.0 — 게이트 인런 카드 스킬 피해 배율
     *  vc147 (#18) — 궁극기 시전 중(ultSlot)엔 고정 배율(×300%/×500%) 하나로 계산:
     *  기존 FIFTH_SKILL_MULT+n차 사다리×SKILL_PWR의 다중 중첩(약 ×3.2)을 대체해 요구치 그대로 3.0/5.0배 */
    const isUlt = this.ultSlot > 0;
    const fifth = isSkill && this.isFifth && !isUlt ? FIFTH_SKILL_MULT : 1;
    const ultMult = this.ultSlot === 1 ? FIFTH1_MULT : this.ultSlot === 2 ? FIFTH2_MULT : 1;
    const runSkl = isSkill && this.runBuffs.skillPct > 0 ? 1 + this.runBuffs.skillPct / 100 : 1;
    /* v1.4.30 (#2) — n차 스킬 사다리: 거듭할수록 스킬이 훨씬 쎄진다 (전 스킬 공통 ×계수)
     *  vc145 (#9 스킬 강화) — 계수 0.12 → 0.22로 상향 + 전 스킬 공통 ×1.25 (SKILL_PWR):
     *  "높은 차수 스킬이 평타보다 약하다" 해소 — 평타 대비 스킬 격차를 차수마다 확대
     *  1차 ×1.25 / 2차 ×1.53 / 3차 ×1.80 / 4차 ×2.08 / 5차 ×2.36 (×skillMult 곱) */
    const tierScl = isSkill && !isUlt ? (1 + 0.22 * Math.max(0, this.sTier - 1)) * Player.SKILL_PWR : 1;
    const m = (isSkill ? mult * this.clsBonus.skillMult * fifth * runSkl * tierScl * ultMult : mult) * rage;
    const dmg = Math.round(this.atkTotal * m * (crit ? this.critDmg : 1));
    /* vc146 (#2) — 시간 역행 로그 적산 (최근 6초 유지 — 이터널 제2궁극기가 재현 배수로 사용)
     *  v1.0.16 — 링 버퍼 기록 (cap 도달 전까지는 growth, 이후 슬롯 재사용 — 할당 0) */
    const now = this.scene.time.now;
    const log = this.recentDmgLog;
    if (log.length < Player.DMG_LOG_CAP) {
      log.push({ t: now, v: dmg });
      this.dmgLogIdx = log.length % Player.DMG_LOG_CAP;
    } else {
      const slot = log[this.dmgLogIdx];
      slot.t = now;
      slot.v = dmg;
      this.dmgLogIdx = (this.dmgLogIdx + 1) % Player.DMG_LOG_CAP;
    }
    return { dmg, crit };
  }

  /* v1.4.30 (#2 사냥/보스 밸런스) — 직업 특화 피해 가산 (Enemy/Boss.takeDamage에서 참조)
   *  보스 특화 직업은 보스전, 사냥 특화 직업은 필드 사냥에서 체감 차등이 생긴다 */
  get bossDmgBonus(): number { return this.clsBonus.bossDmgPct ?? 0; }
  get mobDmgBonus(): number { return this.clsBonus.mobDmgPct ?? 0; }

  /** 피격 판정 — v3.0.6: pierce(0~1)만큼 방어력을 무시 (보스 공격 전용 — 방어 스택으로 보스가 무력화되는 것 방지) */
  applyDefense(raw: number, pierce = 0): number {
    const buff = this.selfDefBuff ? this.selfDefBuff.add : 0;
    const effDef = Math.round((this.defTotal + buff) * (1 - Phaser.Math.Clamp(pierce, 0, 1)));
    return Math.max(1, Math.round(raw - effDef));
  }

  /** v3.0.15 — 물약 쿨다운 잔여 ms (씬에서 자동물약 판정용) */
  get potionCd(): number { return this.potCd; }

  /** v1.3.0 (#6 수량 사용) — 기본 물약 일괄 사용: 쿨다운(0.8s)을 우회해 n회 연속 회복.
   *  실제 회복에 성공한 횟수를 반환(0 = 전부 실패). 배치 종료 후 쿨다운은 원래 값 유지 —
   *  단발 사용과 동일한 연사 제한을 유지하기 위함. */
  usePotionBatch(kind: "hp" | "mp", n: number): number {
    let used = 0;
    const savedCd = this.potCd;
    this.potCd = 0;
    for (let i = 0; i < n; i++) {
      if (this.usePotion(kind)) used++;
      else break; // 소모/회복 불가(보유 0·풀피 등) — 잔여 회차 무의미, 즉시 중단
    }
    this.potCd = savedCd;
    return used;
  }

  /** 물약 사용 (퀵슬롯) — 0.8초 쿨다운.
   *  v3.0.15 (#7) — 퀵슬롯에 장착된 물약(기본/상급)을 사용. 슬롯 지정이 없으면 기본 물약. */
  usePotion(kind: "hp" | "mp"): boolean {
    if (this.potCd > 0 || this.state === "dead") return false;
    const slotKey = (this.quickPots[kind] ?? (kind === "hp" ? "potion_hp" : "potion_mp")) as ItemKey;
    const item = ITEMS[slotKey];
    if (!item) return false;
    const isHp = kind === "hp";
    // 슬롯에 지정한 물약 보유 확인 (기본 물약은 potions 카운터, 상급은 owned)
    let have: boolean;
    if (slotKey === "potion_hp") have = this.potions.hp > 0;
    else if (slotKey === "potion_mp") have = this.potions.mp > 0;
    else have = this.owned.includes(slotKey);
    /* v1.1.0 (#5) — 운영자는 보유와 무관하게 회복되고 소모되지 않는다 (무한 물약/엘릭서) */
    if (!have && !this.gmInfinite) return false;
    /* v3.0.20 (#7) — 엘릭서(healFull)는 HP/MP 전부 100% 회복 */
    const used = item.healFull ? this.restoreAll() : isHp ? this.heal(item.heal ?? 0) : this.restore(item.restore ?? 0);
    if (!used) return false;
    if (slotKey === "potion_hp") { if (this.potions.hp > 0) this.potions.hp--; }
    else if (slotKey === "potion_mp") { if (this.potions.mp > 0) this.potions.mp--; }
    /* vc146 (#1) — GM 무한 엘릭서 소모 버그 근본 수정: gmInfinite면 보유 여부와 무관하게
     *  절대 차감하지 않는다. 기존엔 GM이 [GM] 완전 엘릭서를 "보유 중"이면 have=true 경로로
     *  consumeConsumable이 돼 마실 때마다 사라졌다 (운영자 무한 물약 설계 위반). */
    else if (have && !this.gmInfinite) this.consumeConsumable(slotKey);
    this.potCd = 800;
    this.scene.sfxPotion();
    this.scene.spawnPickupText(
      this.x, this.y - 30,
      item.healFull ? "HP/MP 전부 회복!" : isHp ? `+${item.heal} HP` : `+${item.restore} MP`,
      item.healFull ? "#ffd76a" : "#7dffa8",
    );
    this.scene.emitHud();
    this.tutNotify("pot"); // v1.0.11 — 튜토리얼 물약 학습 판정
    return true;
  }

  /** v3.0.20 (#7) — HP/MP 동시 전체 회복 (엘릭서 전용 — 기존 healFull()과 이름 충돌 피함). 둘 다 만험이면 실패 */
  private restoreAll(): boolean {
    if (this.hp >= this.maxHp && this.mp >= this.maxMp) return false;
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    return true;
  }

  /** v4.0.0 — public 승격 (게이트 흡혈 카드/실버 상점에서 회복 호출) */
  heal(v: number): boolean {
    if (this.hp >= this.maxHp) return false;
    this.hp = Math.min(this.maxHp, this.hp + v);
    return true;
  }

  private restore(v: number): boolean {
    if (this.mp >= this.maxMp) return false;
    this.mp = Math.min(this.maxMp, this.mp + v);
    return true;
  }

  addGold(v: number) {
    /* v4.3.0 — 탐욕의 물약 (BM 버프): 골드 획득 +40% */
    if (this.hasBuff("buff_gold")) v = Math.round(v * 1.4);
    this.gold = Math.max(0, this.gold + v);
    this.scene.emitHud();
  }

  addPotion(kind: "hp" | "mp") {
    this.potions[kind]++;
    this.scene.emitHud();
  }

  /* ---------------- 소지품 기반 소모품 (v2.5 — 상급 물약/스크롤) ---------------- */

  /** 소지품 보유 확인 */
  hasConsumable(key: ItemKey): boolean {
    return this.owned.includes(key);
  }

  /** 소지품 차감 — 스크롤 사용 성공 후 씬에서 호출 */
  consumeConsumable(key: ItemKey): boolean {
    const i = this.owned.indexOf(key);
    if (i < 0) return false;
    this.owned.splice(i, 1);
    this.scene.emitHud();
    return true;
  }

  /** 상급 물약/엘릭서 사용 — 즉시 효과 + 차감 (v3.0.20 — 엘릭서 추가) */
  /* v4.4.0 — 전 티어 물약 사용 (hp3~10·mp3~10 포함 — v4.3.0 물약 확장분의 사용 경로 누락 수정) */
  useConsumablePotion(key: ItemKey): boolean {
    if (this.state === "dead") return false;
    const item = ITEMS[key];
    if (!item || item.kind !== "consumable" || !this.owned.includes(key)) return false;
    if (!item.healFull && !item.heal && !item.restore) return false;
    const used = item.healFull ? this.restoreAll() : item.heal ? this.heal(item.heal) : this.restore(item.restore ?? 0);
    if (!used) return false;
    /* vc146 (#1) — GM 무한: 인벤 직접 사용 경로도 차감 금지 (퀵슬롯 usePotion과 동일 정책) */
    if (!this.gmInfinite) this.consumeConsumable(key);
    this.scene.sfxPotion();
    this.scene.spawnPickupText(
      this.x, this.y - 30,
      item.healFull ? "HP/MP 전부 회복!" : item.heal ? `+${item.heal} HP` : `+${item.restore} MP`,
      item.healFull ? "#ffd76a" : "#7dffa8"
    );
    this.scene.emitHud();
    return true;
  }

  /** v3.0.20 (#7) — 물약 판매: 기본 물약은 카운터 차감, 상급/엘릭서는 owned 차감 (상점가 40%)
   *  v3.1.0 (#판매포기) — 수량 지정 판매 (qty·MAX). 실제 판매된 개수를 반환 (0 = 실패) */
  sellPotion(
    key: "potion_hp" | "potion_mp" | "potion_hp2" | "potion_mp2" | "potion_elixir",
    qty = 1
  ): number {
    const item = ITEMS[key];
    if (!item) return 0;
    const value = sellValue(item);
    if (value <= 0) return 0;
    let sold = 0;
    let gold = 0;
    for (let i = 0; i < qty; i++) {
      if (key === "potion_hp") {
        if (this.potions.hp <= 0) break;
        this.potions.hp--;
      } else if (key === "potion_mp") {
        if (this.potions.mp <= 0) break;
        this.potions.mp--;
      } else {
        if (!this.consumeConsumable(key)) break;
      }
      sold++;
      gold += value;
    }
    if (sold <= 0) return 0;
    this.gold += gold;
    audio.sfx.sell();
    this.scene.spawnPickupText(this.x, this.y - 30, sold > 1 ? `${item.name} 판매 ×${sold} +${gold}G` : `${item.name} 판매 +${value}G`, "#ffd76a");
    this.scene.emitHud();
    return sold;
  }

  /** 장비/장신구 장착 (인벤토리에서) */
  equip(key: ItemKey): boolean {
    const item = ITEMS[key];
    if (!item || !this.owned.includes(key)) return false;
    if (item.kind === "weapon") {
      this.weapon = key;
      /* vc145 (#16 긴급) — 새 무기의 자체 성으로 미러 갱신 (이전 무기의 성 유출 차단) */
      this.upgrades.weapon = this.weaponStars;
    } else if (item.kind === "armor") {
      this.armor = key;
      /* vc145 (#16) — 새 방어구의 자체 성 미러 갱신 + HP 마일스톤 재동기화
       *  (기존엔 장착 시 syncStarHp가 없어 이전 방어구의 HP 보너스가 유지됐다) */
      this.upgrades.armor = this.armorStars;
      this.syncStarHp();
    } else if (item.kind === "accessory") {
      /* v2.9 (#8) — 중복 장착: 반지 4개/펜던트 2개 슬롯.
       * v1.0.3 (#반지중첩) — 유저 지시 "고대왕의 반지 2개 사니까 효과가 2배로 중첩되는 버그":
       *  같은 아이템 키는 1개만 장착 가능(보유 수와 무관). 서로 다른 반지는 기존대로 4+2 슬롯 자유 조합. */
      const slot = item.slot ?? "ring";
      const cap = slot === "ring" ? Player.RING_SLOTS : Player.PENDANT_SLOTS;
      const same = (k: ItemKey) => (ITEMS[k].slot ?? "ring") === slot;
      const wornSame = this.accessories.filter(same);
      const wornCount = wornSame.filter((k) => k === key).length;
      if (wornCount >= 1) return false; // 같은 장신구 중복 장착 금지 (스탯 중첩 방지)
      if (wornSame.length >= cap) {
        // 슬롯이 꽉 참 — 같은 슬롯 종류의 첫 번째를 교체
        const victim = wornSame[0];
        this.removeAccessory(victim);
      }
      this.accessories.push(key);
      if (item.maxHp) {
        this.maxHp += item.maxHp;
        this.hp = Math.min(this.maxHp, this.hp + item.maxHp);
      }
      this.syncAccStarHp(); // v3.0.7 — 장신구 스타포스 HP 마일스톤 동기화
    } else return false;
    this.syncBonusHp(); // v3.0.16 — 세트 효과 활성/해제 HP 동기화
    this.scene.sfxEquip();
    this.scene.spawnPickupText(this.x, this.y - 30, `${item.name} 장착!`, "#ffd76a");
    this.scene.emitHud();
    return true;
  }

  /** v2.9 (#8) — 장신구 해제 (슬롯 클릭). 보너스 회수 포함 */
  unequipAccessory(key: ItemKey): boolean {
    const idx = this.accessories.indexOf(key);
    if (idx < 0) return false;
    this.removeAccessory(key);
    this.syncAccStarHp(); // v3.0.7 — 스타포스 HP 마일스톤 회수
    this.syncBonusHp(); // v3.0.16 — 세트 해제 HP 회수
    this.scene.emitHud();
    return true;
  }

  private removeAccessory(key: ItemKey) {
    const idx = this.accessories.indexOf(key);
    if (idx < 0) return;
    this.accessories.splice(idx, 1);
    const it = ITEMS[key];
    if (it?.maxHp) {
      this.maxHp = Math.max(1, this.maxHp - it.maxHp);
      this.hp = Math.min(this.hp, this.maxHp);
    }
  }

  /* ---------------- v3.0.7 — 장신구 스타포스 ---------------- */

  /** 장신구 HP 마일스톤 총액 (현재 장착 중 장신구 기준) */
  private accHpTarget(): number {
    let hp = 0;
    for (const k of this.accessories) hp += starAccBonus(this.accUp[k] ?? 0, ITEMS[k]).hp;
  return hp;
  }
  /** 장착 변경/강화 후 maxHp 동기화 — 방어구 syncStarHp와 동일 패턴 (델타만 가산) */
  syncAccStarHp() {
    const target = this.accHpTarget();
    const delta = target - this.accHpApplied;
    if (delta === 0) return;
    this.maxHp = Math.max(60, this.maxHp + delta);
    this.accHpApplied = target;
    if (delta > 0) this.hp = Math.min(this.maxHp, this.hp + delta);
  }
  private accHpApplied = 0;
  /** 세이브 복원 — 가산 이력 선복원 (syncAccStarHp가 델타만 반영) */
  restoreAccHp(applied: number) { this.accHpApplied = applied || 0; }
  get accHpAppliedVal() { return this.accHpApplied; }

  /** v3.0.7 — 장신구 스타포스 강화 시도. 비용/성공률 체계는 무기·방어구와 동일, 실패 ★9+ 하락 */
  tryUpgradeAcc(key: ItemKey): "ok" | "fail" | "max" | "poor" | "none" {
    const item = ITEMS[key];
    if (!item || item.kind !== "accessory") return "none";
    const cur = this.accUp[key] ?? 0;
    if (cur >= this.upMax) return "max";
    const cost = upgradeCost("weapon", cur);
    if (this.gold < cost) return "poor";
    this.gold -= cost;
    const ok = Math.random() * 100 < (UPGRADE_RATES[cur] ?? 0);
    if (ok) {
      this.accUp[key] = cur + 1;
      const next = cur + 1;
      const milestone = (STAR_MILESTONES as readonly number[]).includes(next);
      this.scene.sfxUpgradeOk();
      if (milestone) {
        this.scene.spawnStarForceBreakthrough(this.x, this.y, "weapon", next);
        this.scene.spawnPickupText(this.x, this.y - 58, `${item.name} ★${next} 돌파!`, "#ffd76a");
      } else {
        this.scene.spawnStarForceBurst(this.x, this.y, next, true);
        this.scene.spawnPickupText(this.x, this.y - 44, `${item.name} 강화 성공! ★${next}`, "#ffd76a");
      }
      this.syncAccStarHp();
    } else if (cur >= UPGRADE_FALLBACK_FROM) {
      this.accUp[key] = cur - 1;
      this.scene.sfxUpgradeFail();
      this.scene.spawnStarForceBurst(this.x, this.y, cur, false);
      this.scene.spawnPickupText(this.x, this.y - 44, `강화 실패… ★${cur - 1} 하락`, "#ff9a9a");
      this.syncAccStarHp();
    } else {
      this.scene.sfxUpgradeFail();
      this.scene.spawnStarForceBurst(this.x, this.y, cur, false);
      this.scene.spawnPickupText(this.x, this.y - 44, "강화 실패…", "#ff9a9a");
    }
    this.scene.emitHud();
    return ok ? "ok" : "fail";
  }

  /** 상점 구매 — 골드 차감/인벤토리 반영. 실패 시 false
   *  v3.0.24 (#수량) — 소모품/버프는 qty 지정 구매 지원 (장비·펫·치장은 1개 고정) */
  buy(key: ItemKey, qty = 1): boolean {
    const item = ITEMS[key];
    // v3.0.6 (지시 #9) — 보스 전용 아이템은 상점 구매 불가 (유저 거래소 예정)
    // v3.0.6 (지시 #1) — BM 전용 아이템은 골드 상점 구매 불가
    if (!item || item.tradeLock || item.bmOnly) return false;
    const n = Math.max(1, Math.floor(qty));
    if (item.kind === "consumable") {
      const cost = item.price * n;
      if (this.gold < cost) return false;
      this.gold -= cost;
      if (key === "potion_hp") {
        for (let i = 0; i < n; i++) this.addPotion("hp");
      } else if (key === "potion_mp") {
        for (let i = 0; i < n; i++) this.addPotion("mp");
      } else {
        for (let i = 0; i < n; i++) this.owned.push(key); // v2.5 — 상급 물약/스크롤류는 소지품 기반
      }
      return true;
    }
    // BM (v1.9): 버프는 개수 누적, 펫/치장은 1회 구매
    if (item.kind === "buff") {
      const cost = item.price * n;
      if (this.gold < cost) return false;
      this.gold -= cost;
      this.addBuffItem(key as BuffKey, n);
      return true;
    }
    if (item.kind === "pet") {
      if (this.pets.includes(key as PetKey)) return false;
      this.gold -= item.price;
      this.pets.push(key as PetKey);
      this.pet = key as PetKey; // 구매 즉시 소환
      return true;
    }
    if (item.kind === "cosmetic") {
      if (this.cosmetics.includes(key as CosmeticKey)) return false;
      this.gold -= item.price;
      this.cosmetics.push(key as CosmeticKey);
      /* v1.0.7 — 슬롯별 즉시 착용 (코스튬/헤어는 오라 슬롯을 침범하지 않는다)
       *  v1.1.1 (#6 왕관 착용) — acc(어태치 장식)도 전용 슬롯으로: 기존엔 else 폴백이라
       *  왕관이 오라(틴트 글로우)로 착용돼 왕관 스프라이트가 안 보였다 */
      const slot = COSMETIC_DEFS[key as CosmeticKey]?.slot ?? "aura";
      if (slot === "outfit") this.outfit = key as CosmeticKey;
      else if (slot === "hair") this.hair = key as CosmeticKey;
      else if (slot === "acc") this.accessory = key as CosmeticKey;
      else this.cosmetic = key as CosmeticKey;
      return true;
    }
    if (this.owned.includes(key)) return false; // 이미 보유한 장비
    this.gold -= item.price;
    this.owned.push(key);
    // 구매 즉시 장착 (더 좋은 티어면 자연스러운 흐름)
    if (item.kind === "weapon") this.weapon = key;
    else if (item.kind === "armor") this.armor = key;
    else if (item.kind === "accessory") this.equip(key);
    return true;
  }

  /* ---------------- v3.0.6 — 판매 / BM 구매 / 자동 사용 ---------------- */

  /** 아이템 판매 (지시 #4) — 상점가 40% (보스 전용 고정가). 장착 중 무기/방어구는 판매 금지
   *  v3.1.0 (#판매포기) — 수량 지정 판매 (qty·MAX). 실제 판매된 개수를 반환 (0 = 실패) */
  sell(key: ItemKey, qty = 1): number {
    const item = ITEMS[key];
    if (!item) return 0;
    if (item.kind === "weapon" && this.weapon === key) return 0;
    if (item.kind === "armor" && this.armor === key) return 0;
    const value = sellValue(item);
    if (value <= 0) return 0;
    let sold = 0;
    let gold = 0;
    for (let i = 0; i < qty; i++) {
      const idx = this.owned.indexOf(key);
      if (idx < 0) break;
      this.owned.splice(idx, 1);
      sold++;
      gold += value;
    }
    if (sold <= 0) return 0;
    // 장신구는 장착 슬롯에서도 제거 (v3.0.7 — 스타포스 HP 마일스톤 회수 포함)
    if (item.kind === "accessory") {
      /* 초과 보유분을 남기고 전량 판매한 경우에도 장착분은 유지 — 보유 수만큼만 정리 */
      const remain = this.owned.filter((k) => k === key).length;
      let worn = this.accessories.filter((k) => k === key).length;
      while (worn > remain) {
        this.removeAccessory(key);
        worn--;
      }
      this.syncAccStarHp();
    }
    this.gold += gold;
    audio.sfx.sell();
    this.scene.spawnPickupText(this.x, this.y - 30, sold > 1 ? `${item.name} 판매 ×${sold} +${gold}G` : `${item.name} 판매 +${value}G`, "#ffd76a");
    this.scene.emitHud();
    return sold;
  }

  /* ---------------- v3.0.7 — 유저 거래소 / 강화 주문서 ---------------- */

  /** 거래소 구매 (에메랄드) — 보스 드롭 9종 전용. 상점(buy)은 여전히 tradeLock 차단 */
  tradeBuy(key: ItemKey): boolean {
    const item = ITEMS[key];
    const price = TRADE_PRICES[key];
    if (!item || !item.tradeLock || !price) return false;
    if (this.emerald < price) return false;
    if (this.owned.includes(key)) return false; // 중복 보유 금지 (장신구 1개 한정)
    this.emerald -= price;
    this.owned.push(key);
    this.equip(key); // 즉시 장착 (슬롯 넘치면 기존 교체)
    this.syncAccStarHp();
    audio.sfx.shop();
    this.scene.spawnPickupText(this.x, this.y - 30, `거래소 구매 ${item.name}`, "#8ff2d8");
    this.scene.emitHud();
    return true;
  }

  /** 거래소 판매 (에메랄드) — 구매가의 60% 환급 (tradeValue) */
  tradeSell(key: ItemKey): boolean {
    const item = ITEMS[key];
    if (!item || !item.tradeLock) return false;
    const idx = this.owned.indexOf(key);
    if (idx < 0) return false;
    const value = tradeValue(key);
    if (value <= 0) return false;
    this.owned.splice(idx, 1);
    if (item.kind === "accessory") {
      this.removeAccessory(key);
      this.syncAccStarHp();
    }
    this.emerald += value;
    audio.sfx.sell();
    this.scene.spawnPickupText(this.x, this.y - 30, `거래소 판매 +${value} 에메랄드`, "#8ff2d8");
    this.scene.emitHud();
    return true;
  }

  /** 강화 주문서 사용 — 충전 1 증가 (최대 3). 다음 강화 시도 시 소모되어 성공률 +15%p/장 */
  useStarScroll(): boolean {
    const idx = this.owned.indexOf("scroll_star");
    if (idx < 0) return false;
    if (this.starBless >= STAR_BLESS_MAX) return false;
    this.owned.splice(idx, 1);
    this.starBless += 1;
    audio.sfx.potion(); // 사용음 — 물약과 동일 계열 (주문서 소모)
    this.scene.spawnPickupText(this.x, this.y - 36, `강화 주문서 충전 ${this.starBless}/${STAR_BLESS_MAX} (+${this.starBless * STAR_BLESS_RATE}%p)`, "#d29dff");
    this.scene.emitHud();
    return true;
  }

  /** BM 상점 구매 (지시 #1) — 에메랄드 전용 화폐 (골드 상점과 분리)
   *  v3.0.24 (#버그/#수량) — ① 소모품(eert 큐브)이 owned 포함 판정에 걸려 1개만 구매되던 버그 수정
   *   ② 소모품/버프는 qty 지정 구매 지원 (장비·펫·치장은 1개 고정)
   *  v4.6.0 (#버그) — 펫/치장/장비 분기에 잔액 검사가 없어 에메랄드가 음수가 되고
   *   무료로 구매되던 버그 수정 — 전 분기에서 반드시 잔액 ≥ 비용 검사 후 차감 */
  buyBm(key: ItemKey, qty = 1, unitPay?: number): boolean {
    const item = ITEMS[key];
    if (!item || item.bmPrice === undefined) return false;
    /* v4.3.0 — 일일 특가 할인가 오버라이드 (WorldScene onBmBuy에서 전달) */
    const unit = unitPay ?? item.bmPrice;
    const n = Math.max(1, Math.floor(qty));
    if (item.kind === "buff") {
      const cost = unit * n;
      if (this.emerald < cost) return false;
      this.emerald -= cost;
      this.addBuffItem(key as BuffKey, n);
      return true;
    }
    if (item.kind === "consumable") {
      // 소모품은 누적 구매 (보유 여부 무관 — eert 큐브 여러 개 소지 가능)
      const cost = unit * n;
      if (this.emerald < cost) return false;
      this.emerald -= cost;
      for (let i = 0; i < n; i++) this.owned.push(key);
      return true;
    }
    if (item.kind === "pet") {
      if (this.pets.includes(key as PetKey)) return false;
      if (this.emerald < unit) return false; // v4.6.0 — 잔액 검사 누락 (음수 구매 버그)
      this.emerald -= unit;
      this.pets.push(key as PetKey);
      this.pet = key as PetKey;
      return true;
    }
    if (item.kind === "cosmetic") {
      if (this.cosmetics.includes(key as CosmeticKey)) return false;
      if (this.emerald < unit) return false; // v4.6.0 — 잔액 검사 누락 (음수 구매 버그)
      this.emerald -= unit;
      this.cosmetics.push(key as CosmeticKey);
      /* v1.0.7 — 슬롯별 즉시 착용 · v1.1.1 (#6) — acc도 전용 슬롯 (buy와 동일) */
      const slot = COSMETIC_DEFS[key as CosmeticKey]?.slot ?? "aura";
      if (slot === "outfit") this.outfit = key as CosmeticKey;
      else if (slot === "hair") this.hair = key as CosmeticKey;
      else if (slot === "acc") this.accessory = key as CosmeticKey;
      else this.cosmetic = key as CosmeticKey;
      return true;
    }
    if (this.owned.includes(key)) return false;
    if (this.emerald < unit) return false; // v4.6.0 — 잔액 검사 누락 (음수 구매 버그)
    this.emerald -= unit;
    this.owned.push(key);
    if (item.kind === "accessory") this.equip(key);
    return true;
  }

  /** 자동 사용 설정 변경 (지시 #5) — v3.0.20 (#3) MP도 % 지정 가능 (mpOn 부울 대체) */
  setAutoUse(cfg: Partial<{ hpPct: number; mpPct: number; mpOn: boolean; buffs: BuffKey[] }>) {
    if (cfg.hpPct !== undefined) this.autoUse.hpPct = cfg.hpPct;
    if (cfg.mpPct !== undefined) this.autoUse.mpPct = cfg.mpPct;
    if (cfg.mpOn !== undefined) this.autoUse.mpOn = cfg.mpOn;
    if (cfg.buffs !== undefined) this.autoUse.buffs = [...cfg.buffs];
  }

  /** 자동 물약/버프 틱 — update에서 호출 (지시 #5) */
  private tickAutoUse() {
    const cfg = this.autoUse;
    /* v3.0.15 (#6/#7) — 퀵슬롯에 지정된 물약(기본/상급) 기준으로 자동 사용 판정 */
    const hpKey = (this.quickPots.hp ?? "potion_hp") as ItemKey;
    const mpKey = (this.quickPots.mp ?? "potion_mp") as ItemKey;
    const hpHave = this.gmInfinite || (hpKey === "potion_hp" ? this.potions.hp > 0 : this.owned.includes(hpKey)); // v1.1.0 (#5) — GM 무한
    const mpHave = this.gmInfinite || (mpKey === "potion_mp" ? this.potions.mp > 0 : this.owned.includes(mpKey));
    if (cfg.hpPct > 0 && this.hp <= this.maxHp * (cfg.hpPct / 100) && hpHave && this.potCd <= 0) {
      this.usePotion("hp");
    } else {
      /* v3.0.20 (#3) — MP 자동 사용도 % 지정 (기존 mpOn=true는 25% 고정 → 마이그레이션: mpPct 기본 25) */
      const mpPct = cfg.mpPct > 0 ? cfg.mpPct : cfg.mpOn ? 25 : 0;
      if (mpPct > 0 && this.mp <= this.maxMp * (mpPct / 100) && mpHave && this.potCd <= 0) {
        this.usePotion("mp");
      }
    }
    this.autoBuffAcc += 1;
    if (this.autoBuffAcc < 12) return; // ~0.2초마다 버프 체크 (저사율 기기 배려)
    this.autoBuffAcc = 0;
    for (const key of cfg.buffs) {
      if ((this.buffItems[key] ?? 0) > 0 && !this.hasBuff(key)) {
        this.useBuffItem(key);
      }
    }
  }

  /* ---------------- 펫 / 치장 (v1.9 BM) ---------------- */

  /** 펫 소환/해제 (가방에서) */
  setPet(key: PetKey | null): boolean {
    if (key && !this.pets.includes(key)) return false;
    if (this.pet === key) return false;
    this.pet = key;
    this.scene.onPetChanged();
    this.scene.emitHud();
    return true;
  }

/** 치장 착용/해제 (가방에서) — 오라 연출만, 전투 능력 없음
   *  v1.0.7 — 슬롯 분기: 코스튬/헤어 키가 오면 대응 슬롯에 착용 (기존 emit 경로 재사용)
   *  v1.1.0 (#4 해제 버그) — key=null이면 "해제" 의도인데 오라 슬롯으로만 처리돼 코스튬/헤어가 안 벗겨졌다.
   *  착용 중인 슬롯을 추론해 무엇이든 벗는다 (정확한 슬롯 해제는 setCosmeticSlot 사용) */
  setCosmetic(key: CosmeticKey | null): boolean {
    if (key && !this.cosmetics.includes(key)) return false;
    if (!key) {
      if (this.outfit) return this.setOutfit(null);
      if (this.hair) return this.setHair(null);
      if (this.accessory) return this.setAccessory(null);
      if (this.cosmetic) {
        this.cosmetic = null;
        this.scene.onCosmeticChanged();
        return true;
      }
      return false;
    }
    return this.setCosmeticSlot(key, COSMETIC_DEFS[key]?.slot ?? "aura");
  }

  /** v1.1.0 (#4) — 슬롯 지정 착용/해제: UI가 클릭한 아이템의 슬롯을 정확히 전달한다.
   *  해제(key=null) 시 대상 슬롯만 벗는다 — 코스튬+헤어 동시 착용 중에도 원하는 것만 해제 */
  setCosmeticSlot(key: CosmeticKey | null, slot: "aura" | "outfit" | "hair" | "acc"): boolean {
    if (key && !this.cosmetics.includes(key)) return false;
    if (slot === "outfit") return this.setOutfit(key);
    if (slot === "hair") return this.setHair(key);
    if (slot === "acc") return this.setAccessory(key);
    if (this.cosmetic === key) return false;
    this.cosmetic = key;
    this.scene.onCosmeticChanged();
    return true;
  }

/* v1.0.7 — 코스튬(의상) 착용/해제 — v1.1.0부터 스프라이트 "완전 교체"(applyBodyLook).
   *  기존: hero 위에 재색상 오버레이 겹치기 → 유저 지시 "겹치지 말고 아예 바뀌는 형식으로" */
  setOutfit(key: CosmeticKey | null): boolean {
    if (key && !this.cosmetics.includes(key)) return false;
    if (this.outfit === key) return false;
    this.outfit = key;
    this.applyBodyLook();
    this.scene.onCosmeticChanged();
    return true;
  }

/* v1.0.7 — 헤어 착용/해제 (포니테일 등 — WorldScene 레이어 동기화) */
  setHair(key: CosmeticKey | null): boolean {
    if (key && !this.cosmetics.includes(key)) return false;
    if (this.hair === key) return false;
    this.hair = key;
    this.scene.onCosmeticChanged();
    return true;
  }

  /* v1.1.0 (#1 장식) — 어태치 악세서리 (왕관/리본/후광/날개 — WorldScene이 캐릭터에 고정 + 실시간 동기화) */
  accessory: CosmeticKey | null = null;
  setAccessory(key: CosmeticKey | null): boolean {
    if (key && !this.cosmetics.includes(key)) return false;
    if (this.accessory === key) return false;
    this.accessory = key;
    this.scene.onCosmeticChanged();
    return true;
  }

  /* v1.0.19 (B-1 외형) — 색조 적용/복원. 상태 이상 틴트와 충돌하지 않게 단일 진입점 사용.
   *  tint가 null/0xffffff면 clearTint. 세이브 로드 후 씬에서 호출. */
  applyLookTint() {
    if (this.lookTint && this.lookTint !== 0xffffff) this.setTint(this.lookTint);
    else this.clearTint();
  }

/* ---------------- v1.1.0 외형 시스템 (#1/#21/#22) ---------------- */

  /** v1.5.0 — 동적 외형 로드 완료 감지·재적용 (WorldScene.update에서 매 프레임 호출).
   *  이벤트 경합/누락과 무관한 게임 루프 폴링 — 로드 성공 즉시 100% 전환 보장.
   *  로딩은 Phaser 로더를 우회한 네이티브 Image 로딩(textures.loadBodyPrefix)이므로
   *  로더 상태와 무관 — 미완료면 1초 스로틀 재시도(8회 한도), 실패 시 기본 외형 유지. */
  tickBodyPending() {
    if (!this.bodyPending) return;
    const wanted = this.bodyPending;
    if (this.scene.textures.exists(`${wanted}_idle0`)) {
      this.bodyPending = null;
      if (this.bodyPrefix !== wanted) {
        this.bodyPrefix = wanted;
        this.applyBodyLook();
      }
      return;
    }
    const now = this.scene.time.now;
    if (!this.bodyKickAt || now - this.bodyKickAt > 1000) {
      this.bodyKickAt = now;
      this.bodyKickCount++;
      if (this.bodyKickCount > 8) {
        /* 재시도 한도 초과 — 로드 불가(파일 손상 등). 폴백 유지하고 대기 해제 */
        this.bodyPending = null;
        console.warn("[SERTZ] 외형 동적 로드 재시도 한도 초과 — 기본 외형 유지:", wanted);
        return;
      }
      void loadBodyPrefix(this.scene, wanted);
    }
  }

  /** hero_* 텍스처 / hero-* 애님 키를 현재 외형 시트로 매핑.
   *  "" 프리픽스(기본 남성·기본피부)면 원본 키 그대로 — 기존 동작과 100% 동일 */
  bodyKey(k: string): string {
    if (!this.bodyPrefix) return k;
    if (k.startsWith("hero_")) return `${this.bodyPrefix}_${k.slice(5)}`;
    if (k.startsWith("hero-")) return `${this.bodyPrefix}-${k.slice(5)}`;
    return k;
  }

  /** 성별+피부(+코스튬) → 스프라이트 시트 전환. 코스튬이 최우선 (SPUM식 완전 교체 — 겹치기 아님)
   *  v1.1.1 (#7 성별 치장 분리) — 같은 코스튬 키도 성별에 따라 여성형(cost_*)/남성형(costm_*) 시트 분기
   *  v1.2.0 (#13 8직업 외형) — 코스튬 미착용 + 2차 이상 직업이면 jobf_/jobm_ 시트로 완전 교체
   *  (전직하면 외형 자체가 바뀐다 — 버서커는 붉은 머리 광전사로, 아크메이지는 제비꽃 로브 대마법사로).
   *  3·4차는 계열 2차 외형 승계. v1.2.0 (#7 GM 외형) — gmSkin 플래그가 최우선 (GM 계정 전용) */
  applyBodyLook() {
    const prevAnim = this.anims?.currentAnim?.key ?? "";
    const playing = this.anims?.isPlaying ?? false;
    const outfitKey = this.outfit?.replace("outfit_", "") ?? null;
    const jobRoot = tier2RootOf(this.cls);
    const jobPrefix = jobRoot ? (this.gender === "m" ? `jobm_${jobRoot}` : `jobf_${jobRoot}`) : null;
    this.bodyPrefix = this.gmSkin && this.gmApproved
      ? "gm"
      : outfitKey
        ? this.gender === "m" ? `costm_${outfitKey}` : `cost_${outfitKey}`
        : jobPrefix
          ?? (this.gender === "f" || this.skinIdx !== 2 ? `ch${this.gender}${this.skinIdx}` : "");
    /* v1.5.0 — 타이틀 37종 일괄 지연 로드 폐지(캐릭터 선택 후 진입 프리징 근본 수정)의 후속 방어:
     *  게임 중 전직/GM 승인 등으로 미로드 외형 시트가 필요해지면 그 시트만 로드 후 재적용.
     *  로드 완료까지 bodyPrefix를 비워둔다 — bodyKey가 hero_*(부트 로드분)를 가리켜
     *  미로드 창 동안 setTexture(__MISSING) 깨짐 없이 기본 외형으로 안전하게 보인다.
     *  재적용은 preUpdate 폴링이 담당 (이벤트 경합 무관). */
    if (this.bodyPrefix && !this.scene.textures.exists(`${this.bodyPrefix}_idle0`)) {
      const wanted = this.bodyPrefix;
      this.bodyPrefix = "";
      this.bodyPending = wanted;
      if (this.bodyLoadTried !== wanted) {
        this.bodyLoadTried = wanted;
        void loadBodyPrefix(this.scene, wanted);
      }
    } else {
      this.bodyPending = null;
    }
    const wantTex = this.bodyKey("hero_idle0");
    if (this.texture.key !== wantTex) this.setTexture(wantTex);
    // 진행 중이던 애니를 새 시트로 이어 재생 (프레임 리셋 방지)
    if (prevAnim && playing) {
      const mapped = this.bodyKey(prevAnim);
      if (this.scene.anims.exists(mapped)) this.play(mapped, true);
    }
    this.applyLookTint();
  }

  /** 로비 생성 시 고른 외형 색조 설정 (소유권 검사 불요 — 외형은 무료 커스텀) */
  setLookTint(tint: number | null) {
    this.lookTint = tint;
    this.applyLookTint();
  }

  /* ---------------- 장비 강화 (2D MMORPG 기본 요소) ---------------- */

  readonly upMax = UPGRADE_MAX; // v2.0 — +12 (메이플 스타포스식, 구 세이브 +5 호환)

  /* ================= vc145 (#16 긴급) — 아이템 단위 스타포스 =================
   *  weaponStars/armorStars는 "현재 장착 중인 아이템의 성". 장비를 갈아끼우면
   *  새 아이템 자신의 성(없으면 0)이 적용된다 — 이전 장비의 성 유출 원천 차단.
   *  upgrades{weapon,armor}는 아래 미러 갱신 헬퍼로 항상 동기화된다(구 코드/세이브 호환). */
  get weaponStars(): number {
    const v = this.starMap[this.weapon] ?? 0;
    return Math.max(0, Math.min(this.upMax, typeof v === "number" && isFinite(v) ? Math.floor(v) : 0));
  }
  get armorStars(): number {
    const v = this.starMap[this.armor] ?? 0;
    return Math.max(0, Math.min(this.upMax, typeof v === "number" && isFinite(v) ? Math.floor(v) : 0));
  }
  starsOfSlot(slot: "weapon" | "armor"): number {
    return slot === "weapon" ? this.weaponStars : this.armorStars;
  }
  /** 성 변경 + upgrades 미러 동기화 (유일한 쓰기 경로 — tryUpgrade/세이브 마이그레이션/거래) */
  private setStars(slot: "weapon" | "armor", v: number) {
    const key = slot === "weapon" ? this.weapon : this.armor;
    const clamped = Math.max(0, Math.min(this.upMax, Math.floor(v)));
    this.starMap[key] = clamped;
    this.upgrades[slot] = clamped; // 구 세이브 필드(upWea/upArm) 호환 미러
  }

  /** 다음 강화 비용 — 단계별 눈덩이 곡선 (v2.0 밸런스) */
  upgradeCost(slot: "weapon" | "armor"): number {
    return upgradeCost(slot, this.starsOfSlot(slot));
  }

  /** 다음 강화 성공률 (%) */
  upgradeRate(slot: "weapon" | "armor"): number {
    return UPGRADE_RATES[this.starsOfSlot(slot)] ?? 0;
  }

  /** 강화 시도 — 결과 타입 반환 (골드는 성공/실패 모두 소모)
   *  v3.0.5 — 스타포스: 티어별 연출 + ★5/10/15 돌파 대형 연출 + 마일스톤 HP 동기화 */
  tryUpgrade(slot: "weapon" | "armor"): "ok" | "fail" | "max" | "poor" {
    const cur = this.starsOfSlot(slot); // vc145 (#16) — 장착 중 아이템 자신의 성 기준
    if (cur >= this.upMax) return "max";
    const cost = this.upgradeCost(slot);
    if (this.gold < cost) return "poor";
    this.gold -= cost;
    // v3.0.7 — 강화 주문서 충전분 성공률 가산 후 1회 소모 (성공/실패 무관)
    const bless = Math.min(this.starBless, STAR_BLESS_MAX);
    if (bless > 0) this.starBless -= 1;
    /* v1.0.8 — 강화 실패 가산(천장): ★10+ 실패 연적만큼 +5%p (최대 +15%p)
     *  공시된 곡선 외 보장 — "주작"이 아닌 완화 시스템. 성공 시 리셋 */
    const pity = Math.min(this.starPity, STAR_PITY_MAX);
    const rate = (UPGRADE_RATES[cur] ?? 0) + bless * STAR_BLESS_RATE + pity;
    const ok = Math.random() * 100 < rate;
    if (ok) this.starPity = 0;
    else if (cur >= STAR_PITY_FROM) this.starPity = Math.min(STAR_PITY_MAX, this.starPity + STAR_PITY_STEP);
    const slotName = slot === "weapon" ? "무기" : "방어구";
    const blessTag = bless > 0 ? ` · 주문서 +${bless * STAR_BLESS_RATE}%p` : "";
    const pityTag = pity > 0 ? ` · 실패가산 +${pity}%p` : "";
    if (ok) {
      this.setStars(slot, cur + 1); // vc145 (#16) — 성은 아이템에 기록 + upgrades 미러 동기
      const next = cur + 1;
      const milestone = (STAR_MILESTONES as readonly number[]).includes(next);
      this.scene.sfxUpgradeOk();
      if (milestone) {
        this.scene.spawnStarForceBreakthrough(this.x, this.y, slot, next);
        this.scene.spawnPickupText(this.x, this.y - 58, `${slotName} ★${next} 돌파!${blessTag}${pityTag}`, "#ffd76a");
      } else {
        this.scene.spawnStarForceBurst(this.x, this.y, cur + 1, true);
        this.scene.spawnPickupText(this.x, this.y - 44, `강화 성공! ★${next}${blessTag}${pityTag}`, "#ffd76a");
      }
      if (slot === "armor") this.syncStarHp();
    } else if (cur >= UPGRADE_FALLBACK_FROM) {
      // +9 이상 실패 시 1성 하락 (스타포스식 리스크)
      this.setStars(slot, cur - 1); // vc145 (#16) — 하락분도 해당 아이템에 기록
      this.scene.sfxUpgradeFail();
      this.scene.spawnStarForceBurst(this.x, this.y, cur, false);
      this.scene.spawnPickupText(this.x, this.y - 44, `강화 실패… ★${cur - 1} 하락${blessTag}${pityTag}`, "#ff9a9a");
      if (slot === "armor") this.syncStarHp();
    } else {
      this.scene.sfxUpgradeFail();
      this.scene.spawnStarForceBurst(this.x, this.y, cur, false);
      this.scene.spawnPickupText(this.x, this.y - 44, `강화 실패…${blessTag}${pityTag}`, "#ff9a9a");
    }
    this.scene.emitHud();
    return ok ? "ok" : "fail";
  }

  revive(x: number, y: number) {
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    this.state = "idle";
    this.iframes = 2200; // 부활 무적 2.2초 — 캠핑 몬스터 즉사 루프 방지
    this.setPosition(x, y);
    this.setAlpha(1);
    this.setFlipX(false);
    this.play(this.bodyKey("hero-idle"));
    this.scene.emitHud();
  }
}
