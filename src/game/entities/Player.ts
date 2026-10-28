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
import { spawnPentacle, spawnFlarePop, spawnRingPop, spawnUltimateIntro, spawnUltIntroSig, spawnTierFlair, spawnUltFlourish, spawnSkillImpact, type FamKey } from "../fx/StudioFX"; // v1.0.10 — GameStudio FX (4차/5차 스킬 강화) · v1.4.0 — 5차 고유 시그니처 · vc147 — 계열별 지면 시그니처
import { DEATH_SLASH_CFG, runDeathSlashCinematic } from "../fx/DeathSlash"; // vc153 — 도적 제2궁극기 「사(死)의 일섬」 3D 시네마틱
import { playUltLayers } from "../fx/ultLayers"; // vc183 — 극딜 3단계 연출 레이어(암전·이펙트·카메라)
import * as audio from "../audio";
import { netAction } from "../net"; // v4.1.0 — 파티원 공격/스킬 동기화
import type { Enemy } from "./Enemy";
import type { Boss } from "./Boss";
import { ZERO_EXT, expBookExp, type ExtBonus, type GateCard } from "../isekai";
import { expToNext } from "../expTable"; // v1.0.15 (피드백 #1) — 메이플 공식 레벨별 경험치표
import { cine3d } from "../cine3d"; // vc181 — 3D 시네마틱 레이어
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
  /** v1.1.7 (#개편 A87) — 판매 잠금 아이템 키. 실수 판매 방지용. */
  lockedItems: string[] = [];
  /** v1.1.8 (#개편 A46) — 낚시 도감/기록 (세이브 미러) */
  fishSave: { caught: string[]; totalCatch: number; totalMiss: number; bestWeight: number } =
    { caught: [], totalCatch: 0, totalMiss: 0, bestWeight: 0 };
  /** v1.1.9 (#개편 A48) — 채집 재료 보유량 (요리/제작 재료) */
  gatherBag: Record<string, number> = {};
  /** vc178 — 집 꾸미기: 배치된 가구 { 가구키, 격자 좌표 }. 보유는 owned(furn_*)로, 이 배열이 배치 상태. */
  homeDecor: { key: string; x: number; y: number; rot?: number }[] = [];
  /** vc182 (지시 #11) — 마을 필드 배치 가구 (월드 좌표, 집과 별개) */
  fieldDecor: { key: string; x: number; y: number; rot?: number; stage?: string }[] = [];
  /** vc178 (지시 #2) — 이미 본 기능 튜토리얼 키 (자동 재생 1회 제한) */
  tutSeen: string[] = [];

  /** v1.1.9 (#개편 A47) — 요리 버프 적용. 기존 buffs 배열에 "dish_*" 키로 얹는다
   *  (새 시스템을 만들지 않고 기존 버프 렌더/만료 로직을 그대로 재사용).
   *  atk/def/spd/exp/gold/crit 각각의 실제 배율 반영은 tickBuffs 계열에서 처리한다. */
  applyDishBuff(kind: "atk" | "def" | "spd" | "exp" | "gold" | "crit", power: number, durMs: number) {
    const key = `dish_${kind}`;
    const exist = this.buffs.find((b) => b.key === key);
    if (exist) {
      exist.remain = Math.max(exist.remain, durMs);
      exist.total = Math.max(exist.total, durMs);
      this.dishBuffPower[key] = power;
    } else {
      this.buffs.push({ key, remain: durMs, total: durMs } as never);
      this.dishBuffPower[key] = power;
    }
    this.recalcDishBuffs();
  }

  /** 요리 버프 강도 저장 (키별) */
  private dishBuffPower: Record<string, number> = {};

  /** 요리 버프들을 실제 스탯 배율로 반영 */
  recalcDishBuffs() {
    let atk = 0, def = 0, spd = 0, crit = 0;
    for (const b of this.buffs) {
      const k = b.key as string;
      if (!k.startsWith("dish_")) continue;
      if (b.remain <= 0) continue;
      const p = this.dishBuffPower[k] ?? 0;
      if (k === "dish_atk") atk += p;
      else if (k === "dish_def") def += p;
      else if (k === "dish_spd") spd += p;
      else if (k === "dish_crit") crit += p;
    }
    this.dishAtkPct = atk;
    this.dishDefAdd = def;
    this.dishSpdPct = spd;
    this.dishCritAdd = crit;
    this.recalcSpeed();
  }

  /** 요리 버프 반영값 */
  dishAtkPct = 0;
  dishDefAdd = 0;
  dishSpdPct = 0;
  dishCritAdd = 0;
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

  /* v1.4.32 (유저 지시 #1) — 스킬 kind → 원소 판정.
   *  원소별 SFX 48종이 로드만 되고 재생되지 않던 문제를 해결한다.
   *  매핑에 없으면 계열 색으로 폴백. */
  /** v1.4.32 (지시 #5·#7·#13) — 일반 스킬 임팩트 텍스처 선택.
   *  원소 정체성에 맞춰 fx2(고해상도) 텍스처를 고른다. 전격만 Electro, 나머지는 섬광/버스트 계열. */
  private impactTexOf(elem: string): { ringTex: string; hitTex: string } {
    switch (elem) {
      case "elec": return { ringTex: "fx_Circle2", hitTex: "fx_Electro" };
      case "fire": case "magma": return { ringTex: "fx_Circle2", hitTex: "fx_FlashFree2" };
      case "ice": case "water": return { ringTex: "fx_Circle2", hitTex: "fx_FlashFree1" };
      case "light": case "nature": return { ringTex: "fx_Circle2", hitTex: "fx_FlashFree3" };
      case "dark": case "void": return { ringTex: "fx_Circle", hitTex: "fx_FlashFree1" };
      default: return { ringTex: "fx_Circle2", hitTex: "fx_FlashFree1" };
    }
  }

  private elemOfSkill(kind: string): string {
    const M: Record<string, string> = {
      /* 화염 */
      flurrydance: "fire", cutlassdance: "fire", ragespin: "fire", bladestorm: "fire",
      cannonblast: "fire", warcry: "fire",
      /* 냉기 */
      gustarrow: "ice", tornado: "ice", falconwind: "ice", windslash: "ice",
      /* 번개 */
      thunder: "elec", arcbolt: "elec", bolt: "elec",
      /* 신성 */
      sanctuary: "light", purify: "light", trueshot: "light", snipe: "light",
      /* 암흑 */
      shadowblad: "dark", shadowexec: "dark", shadowveil: "dark", ambushdash: "dark",
      smokestep: "dark", dreadvolley: "dark",
      /* 대지 */
      wallsmash: "earth", bulwarkdash: "earth", savagerush: "earth",
      /* 물 */
      manowar: "water", cycleblink: "water",
      /* 시공 */
      timewarp: "void", blink: "void", grandblink: "void", flashydash: "void", windstep: "void",
      /* 물리/기타 */
      volley: "air", dash: "air", grappleswing: "air",
    };
    if (M[kind]) return M[kind];
    const fam = familyOf(this.cls);
    if (fam === "warrior") return "blood";
    if (fam === "mage") return "crystal";
    if (fam === "ranger") return "light";
    if (fam === "thief") return "dark";
    return "air";
  }

  update(dt: number, move: Phaser.Math.Vector2, attackPressed: boolean) {
    if (this.state === "dead") return;
    const ms = dt;

    this.atkCooldown = Math.max(0, this.atkCooldown - ms);
    /* v1.1.6 (#개편 B44) — 스킬 쿨 준비 완료 감지.
     *  종전엔 쿨이 끝나도 버튼 오버레이가 사라질 뿐 시선을 끌지 못해, 전투 중
     *  "이제 눌러도 된다"를 놓쳤다. 0으로 떨어지는 순간에만 짧은 링+사운드를 낸다.
     *  궁극기(60/120초)는 별도로 강조 — 가장 놓치기 쉬운 쿨이다. */
    const cdBefore = [this.skill1Cd, this.skill2Cd, this.skill3Cd, this.skill4Cd, this.skill5Cd, this.skill5bCd];
    this.skill1Cd = Math.max(0, this.skill1Cd - ms);
    this.skill2Cd = Math.max(0, this.skill2Cd - ms);
    this.skill3Cd = Math.max(0, this.skill3Cd - ms);
    this.skill4Cd = Math.max(0, this.skill4Cd - ms);
    this.skill5Cd = Math.max(0, this.skill5Cd - ms); // v3.2.0 — 5차 궁극기 쿨다운
    this.skill5bCd = Math.max(0, this.skill5bCd - ms); // vc146 (#2) — 제2궁극기 쿨다운
    {
      const cdAfter = [this.skill1Cd, this.skill2Cd, this.skill3Cd, this.skill4Cd, this.skill5Cd, this.skill5bCd];
      for (let i = 0; i < cdAfter.length; i++) {
        if (cdBefore[i] > 0 && cdAfter[i] === 0) {
          const ult = i >= 4; // s5 / s5b
          this.scene.onSkillReady?.(ult);
        }
      }
    }
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
    /* vc182 (지시 — "해적 대각선 공격 안됨") 수리:
     *  해적은 위의 4방향 `dir`(aimDir)을 그대로 받아 총을 쐈다. aimDir은 근접
     *  애니메이션 시트가 4방향이라 스냅한 값이라, 대각선으로 조준해도 상/하/좌/우
     *  중 하나로 눌러 발사됐다(대각선 불가).
     *  해적은 총을 쏘는 계열이므로 궁수·마법사와 같이 8방향 자유 조준을 쓴다.
     *  애니메이션은 기존처럼 4방향 시트를 재생하되(총 자세), 탄환 각도는 자유 조준. */
    if (fam === "pirate") {
      const free = this.aimDirFree();
      return this.atkSlash(free, free);
    }
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
  /* vc182 — 두 번째 인자(aim)는 "탄환 각도"용 자유 조준(8방향)이다.
   *  첫 인자(dir)는 4방향 애니메이션 시트 선택용으로 남긴다(시트가 4방향뿐).
   *  근접 계열은 aim을 넘기지 않으므로 기존 동작과 100% 동일하다. */
  private atkSlash(dir: Phaser.Math.Vector2, aim?: Phaser.Math.Vector2) {
    const fireDir = aim ?? dir;
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
      /* v1.2.4 (버그 7) — "무기·방어구 착용 모습이 화면에 보이게 (아니면 기본공격 시
       *  무기마다 효과가 다르던지)" → 후자를 택했다. 착용 외형 시트를 새로 그리는 대신,
       *  계열별로 기본공격 자체를 다르게 만들어 무기가 바뀐 게 체감되게 한다.
       *   · 해적: 총격(직선 탄환) — 근접 판정 없음
       *   · 궁수: 화살 발사
       *   · 마법사: 마법탄 발사
       *   · 전사/도적: 근접 참격(기존 그대로) */
      const fam = familyOf(this.cls);
      if (fam === "pirate") {
        /* vc178 — 공격 방향 이펙트 수리: 총구 화염(방향성 머즐) + 탄환 회전.
         *  기존엔 ①탄환이 방향성 텍스처(gw_proj 탄두=왼쪽)인데 rot 미지정이라
         *  항상 0° 고정(위/아래로 쏴도 가로로 누워 있었다) ②총구 화염이 방향 없는
         *  원형 파티클이라 어디로 쏴도 같은 모양이었다.
         *  vc178b — "해적인데 검을 쓴다": 참격 스윕(spawnSlash)을 호출하지 않고
         *  총 자세(atkKey)만 재생한다. 상/하 조준 시에도 총을 그 방향으로 겨눈다. */
        /* vc182 — 발사 각도는 자유 조준(fireDir)을 쓴다. 대각선 조준 시
         *  총구 화염·탄환·반동이 모두 그 방향으로 나간다. */
        const ang = Math.atan2(fireDir.y, fireDir.x);
        this.scene.spawnMuzzleFlash(this.x + fireDir.x * 26, this.y - 6 + fireDir.y * 26, ang);
        this.scene.sfxSkill("thunder", 0.95);
        const { dmg, crit } = this.rollDamage(dmgMul * 1.15, false);
        this.scene.firePlayerProj({
          x: this.x + fireDir.x * 30, y: this.y - 6 + fireDir.y * 30,
          angle: ang, speed: 880, pierce: 1,
          dmg, crit, tint: 0xffe9a8, knock: 120, scale: 0.36, tex: "gw_proj", blend: "add",
          rot: true, texRot: Math.PI, // 탄두가 왼쪽인 시트 — 진행 방향으로 탄두 정렬
        });
        this.scene.doShake?.(50, 0.0018);
        return;
      }
      if (fam === "ranger" && this.sTier >= 1) {
        const { dmg, crit } = this.rollDamage(dmgMul * 0.95, false);
        this.scene.firePlayerProj({
          x: this.x, y: this.y - 8, angle: Math.atan2(dir.y, dir.x), speed: 760,
          pierce: 1, dmg, crit, tint: 0xa8f0c0, knock: 140, scale: 0.55, anim: "fx-arrow", rot: true,
        } as never);
        return;
      }
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
     *  미전직 1타 → 1차+ 2연타 → 2차+ 3연타 → 3차+ 마지막 타 검기 파동 → 4차 대형 파동
     *  vc178b — 해적은 제외: 이 래더가 spawnSlash(검 휘두르기)를 호출해
     *  "해적인데 검을 쓴다"는 증상의 실제 원인이었다. 해적은 위 총격 분기에서 끝난다. */
    const isGunner = familyOf(this.cls) === "pirate";
    if (t >= 1 && !isGunner) {
      this.scene.time.delayedCall(195, () => {
        if (this.state !== "attack") return;
        this.scene.spawnSlash(this.x, this.y, dir, !this.slashAlt, 0.95, slashTint);
        this.scene.sfxSkill("spin", 1.02 + Math.random() * 0.08); // v4.3.0 — 연타 2타 (고피치 변주)
        this.checkMeleeHit(dir, reach, 116, dmgMul * 0.8, knock * 0.8);
      });
    }
    if (t >= 2 && !isGunner) {
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
    audio.sfx.elemCast(this.elemOfSkill(kind)); // v1.4.32 (지시 #1) — 원소별 개별 시전음
    /* v1.4.32 (지시 #5·#7·#13) — 고해상도 임팩트 2겹(링+섬광). 기존 원소 연출 위에 얹기만 한다. */
    { const _it = this.impactTexOf(this.elemOfSkill(kind)); spawnSkillImpact(this.scene, this.x, this.y, this.clsHex(), { ..._it, scale: 0.9 }); }
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
      /* v1.1.9 — 해적 계열 Z */
      case "cannonblast": return this.skill1CannonBlast();
      case "cutlassdance": return this.skill1CutlassDance();
      /* vc179 (지시 #6·#10) — 해적 3·4차 고유기 */
      case "manowar": return this.skill1Broadside();
      case "dreadvolley": return this.skill1DreadVolley();
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

  /* v1.1.9 (#개편 — 계열 확장) — 해적 레이더 Z: 포격.
   *  설계: 해적 계열의 정체성은 "한 방이 넓다". 전방에 느리게 날아가는 큰 폭발탄을
   *  쏘아 다수를 한꺼번에 맞힌다. 연사력은 낮지만 범위가 압도적이라
   *  몰려오는 구간에서 다른 계열보다 확실히 강하다. */
  private skill1CannonBlast() {
    /* v1.2.4 (버그 5 — "해적은 총을 써야지!") — 근접 포격 → 총격으로 재설계.
     *  기존엔 착탄점 원형 폭발이라 다른 계열 근접기와 구분이 안 됐다.
     *  이제 "총을 쏜다"는 정체성을 코드로 만든다:
     *   · 즉발 히트스캔이 아니라 빠른 직선 탄환(관통) — 사거리가 길다
     *   · 발사 시 반동으로 몸이 뒤로 밀리고 화면이 살짝 흔들린다
     *   · 탄피가 튀고 총구 화염이 남는다
     *   · 3차 이상은 3점사(연속 3발)로 진화 */
    /* vc182 (지시 — "해적 대각선 공격 안됨") — 애니메이션 프레임은 4방향 시트라
     *  aimDir(스냅)로 고르고, **탄환 각도는 자유 조준**을 쓴다. 대각선으로 쏠 수 있다. */
    const dir = this.aimDir();
    const fire = this.aimDirFree();
    const t = this.sTier;
    const hex = this.clsHex();
    /* vc178 — 공격 방향 이펙트 수리: 상/하 조준 시에도 atk-up/down 프레임으로 재생.
     *  기존엔 측면(hero-atk) 고정이라 위/아래로 쏴도 옆을 향해 총을 쏘는 모양이었다. */
    const atkKey = dir.y > 0 ? this.bodyKey("hero-atk-down") : dir.y < 0 ? this.bodyKey("hero-atk-up") : this.bodyKey("hero-atk");
    this.play(atkKey);
    this.setFlipX(dir.y === 0 && dir.x > 0);
    const shots = t >= 3 ? 3 : 1;
    const spread = t >= 3 ? 0.07 : 0;
    for (let i = 0; i < shots; i++) {
      this.scene.time.delayedCall(i * 110, () => {
        if (this.state === "dead") return;
        const ang = Math.atan2(fire.y, fire.x) + (i - (shots - 1) / 2) * spread;
        /* 총구 화염 — vc178: 방향성 머즐 플래시 (기존 방향 없는 원형 파티클) */
        this.scene.spawnMuzzleFlash(this.x + Math.cos(ang) * 26, this.y - 6 + Math.sin(ang) * 26, ang);
        this.scene.sfxSkill("thunder", 0.86); // 총성 — 낮은 피치
        /* 반동 */
        this.setVelocity(-Math.cos(ang) * 130, -Math.sin(ang) * 130);
        this.scene.time.delayedCall(70, () => { if (this.state !== "dead") this.setVelocity(0, 0); });
        this.scene.doShake?.(70, 0.0026);
        /* 탄환 — 관통 3(5차 5), 빠르고 길게. vc178: 탄환 회전 (방향성 텍스처 탄두 정렬) */
        const { dmg, crit } = this.rollDamage(2.6 + 0.22 * t, true);
        this.scene.firePlayerProj({
          x: this.x + Math.cos(ang) * 30,
          y: this.y - 6 + Math.sin(ang) * 30,
          angle: ang,
          speed: 900,
          pierce: t >= 4 ? 5 : 3,
          dmg, crit,
          tint: 0xffe9a8,
          knock: 150,
          scale: 0.5,
          tex: "gw_proj",
          blend: "add",
          rot: true, texRot: Math.PI, // 탄두가 왼쪽인 시트 — 진행 방향으로 탄두 정렬
        });
        if (crit) this.scene.sfxCrit();
      });
    }
    this.scene.time.delayedCall(shots * 110 + 260, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  /* v1.1.9 — 해적 코세어 Z: 커틀러스 난무.
   *  레이더가 "한 방 넓게"라면 코세어는 "여러 번 넓게". 3연속 광범위 베기.
   *  마지막 타격은 배율을 크게 올려 마무리감을 준다. */
  private skill1CutlassDance() {
    /* v1.2.4 (버그 5) — "스킬이 독특하지 않고 다 똑같아" 대응: 총검술로 차별화.
     *  레이더(총격)가 "멀리서 쏜다"라면 코세어는 "쏘고 파고들어 벤다".
     *  · 1~2타: 전방 사격(원거리 견제)
     *  · 마지막 타: 돌진 베기(근접 마무리) — 두 거리를 한 스킬로 오간다
     *  이 조합은 기존 16개 클래스 스킬 어디에도 없다. */
    const dir = this.aimDir();
    const t = this.sTier;
    const hex = this.clsHex();
    /* vc178 — 공격 방향 이펙트 수리: 상/하 조준 시에도 atk-up/down 프레임으로 재생 */
    const atkKey = dir.y > 0 ? this.bodyKey("hero-atk-down") : dir.y < 0 ? this.bodyKey("hero-atk-up") : this.bodyKey("hero-atk");
    this.play(atkKey);
    this.setFlipX(dir.y === 0 && dir.x > 0);
    const ang = Math.atan2(dir.y, dir.x);

    /* 1) 원거리 사격 2발 — vc178: 방향성 머즐 + 탄환 회전 */
    for (let i = 0; i < 2; i++) {
      this.scene.time.delayedCall(i * 100, () => {
        if (this.state === "dead") return;
        this.scene.spawnMuzzleFlash(this.x + Math.cos(ang) * 26, this.y - 6 + Math.sin(ang) * 26, ang);
        this.scene.sfxSkill("thunder", 0.92 + i * 0.05);
        const { dmg, crit } = this.rollDamage(1.25 + 0.1 * t, true);
        this.scene.firePlayerProj({
          x: this.x + Math.cos(ang) * 30, y: this.y - 6 + Math.sin(ang) * 30,
          angle: ang, speed: 820, pierce: 2, dmg, crit, tint: hex, knock: 90,
          scale: 0.42, tex: "gw_proj", blend: "add",
          rot: true, texRot: Math.PI, // 탄두 정렬
        });
      });
    }

    /* 2) 마무리 — 돌진 베기 */
    this.scene.time.delayedCall(230, () => {
      if (this.state === "dead") return;
      const dash = 150 + 12 * t;
      const nx = this.x + Math.cos(ang) * dash;
      const ny = this.y + Math.sin(ang) * dash * 0.7;
      this.scene.spawnSlash(nx, ny, dir, false, 1.5, hex);
      this.scene.spawnSlash(this.x, this.y, dir, true, 1.2, hex);
      this.scene.spawnBurstAt(nx, ny, 14, hex);
      this.scene.sfxSkill("sword", 1.1);
      this.scene.doShake?.(110, 0.004);
      /* 이동 */
      this.setPosition(nx, ny);
      (this.body as Phaser.Physics.Arcade.Body).reset(nx, ny);
      /* 근접 판정 */
      const { dmg, crit } = this.rollDamage(2.4 + 0.2 * t, true);
      for (const e of this.getAllTargetsIn(999)) {
        const d = Phaser.Math.Distance.Between(nx, ny, e.x, e.y);
        if (d > 120 + 6 * t) continue;
        const away = new Phaser.Math.Vector2(e.x - nx, e.y - ny).normalize();
        e.takeDamage(dmg, away, 260, crit);
      }
      if (crit) this.scene.sfxCrit();
    });

    this.scene.time.delayedCall(520, () => {
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
        /* v1.1.9 — 해적 계열 C(기동기) */
        case "smokestep": {
          /* 레이더 — 연막 측면: 착지 지점에 연막을 남겨 그 안의 적을 밀어낸다.
           *  "화약" 정체성의 기동기 — 도망용이 아니라 자리 정리용. */
          this.scene.spawnBurstAt(this.x, this.y, 20 + 2 * t, 0x6a6a78);
          this.scene.spawnField?.({
            x: this.x, y: this.y, radius: 130 + 10 * t, dur: 1400,
            dps: Math.max(4, Math.round(this.atkTotal * 0.05)), kind: "poison", owner: "player",
          });
          burst(120 + 10 * t, 0.85 + 0.1 * t, 340);
          break;
        }
        case "grappleswing": {
          /* 코세어 — 갈고리 그네: 더 멀리 이동하고 경로상의 적을 벤다.
           *  이동 거리가 길어 C를 "진입"에 쓸 수 있다(다른 계열 기동기와 차별). */
          const aim2 = this.aimDir();
          this.scene.spawnSlash?.(this.x, this.y, aim2, false, 1.5, 0xffdf8a);
          burst(140 + 12 * t, 1.0 + 0.1 * t, 300);
          break;
        }
      }
    });
    this.scene.time.delayedCall(260, () => tick.remove());
    this.scene.emitHud();
  }

  /* ══════════════ vc179 (지시 #6·#10) — 해적 3·4차 고유기 ══════════════
   *  종전엔 stormcaptain/powdermaster/seaking/dreadnought 가 SKILL1_KIND 에 없어
   *  2차 raider 의 cannonblast 로 폴백됐다. 즉 3·4차로 올라가도 스킬이 그대로 —
   *  "해적 직업 구현이 덜 됐다"는 지적의 실체다. 단계별로 화약의 규모를 키운다. */

  /** 3차 폭풍선장 — 현측 전열포(broadside): 좌우 2열 함포를 일제 사격해
   *  전방 부채꼴을 쓸어버린다. 단발 cannonblast 와 달리 "배의 측면 포문" 컨셉이라
   *  사방으로 탄이 퍼지고, 착탄마다 폭발이 남아 광역 딜이 들어간다. */
  private skill1Broadside() {
    const dir = this.aimDir();
    const fire = this.aimDirFree(); // vc182 — 대각선 발사
    const t = this.sTier;
    const hex = this.clsHex();
    const atkKey = dir.y > 0 ? this.bodyKey("hero-atk-down") : dir.y < 0 ? this.bodyKey("hero-atk-up") : this.bodyKey("hero-atk");
    this.play(atkKey);
    this.setFlipX(dir.y === 0 && dir.x > 0);
    const base = Math.atan2(fire.y, fire.x); // vc182 — 자유 조준
    /* 좌우 2열 × 3문 = 6발, 부채꼴로 퍼진다 */
    const shots = 6;
    for (let i = 0; i < shots; i++) {
      const side = i % 2 === 0 ? -1 : 1;           // 좌현/우현 교대
      const row = Math.floor(i / 2);               // 3열
      const ang = base + side * (0.16 + row * 0.1);
      this.scene.time.delayedCall(i * 70, () => {
        if (this.state === "dead") return;
        const ox = this.x + Math.cos(ang) * 30 + side * Math.cos(base) * 10;
        const oy = this.y - 6 + Math.sin(ang) * 30 + side * Math.sin(base) * 10;
        this.scene.spawnMuzzleFlash(ox, oy, ang);
        this.scene.sfxSkill("thunder", 0.8 + i * 0.02);
        const { dmg, crit } = this.rollDamage(2.1 + 0.18 * t, true);
        this.scene.firePlayerProj({
          x: ox, y: oy, angle: ang,
          speed: 760, pierce: 2, dmg, crit,
          tint: 0xffd07a, knock: 170, scale: 0.62,
          tex: "gw_proj", blend: "add", rot: true, texRot: Math.PI,
        });
      });
    }
    /* 함포 일제사격의 반동 — 몸이 뒤로 밀리고 화면이 크게 흔들린다 */
    this.setVelocity(-Math.cos(base) * 190, -Math.sin(base) * 190);
    this.scene.time.delayedCall(90, () => { if (this.state !== "dead") this.setVelocity(0, 0); });
    this.scene.doShake?.(160, 0.006);
    this.scene.spawnBurstAt(this.x, this.y - 6, 20, 0xffc46a);
    /* vc179 (지시 #11) — 제공 VFX 팩: 함포 화염 + 연기 */
    this.scene.spawnTexBurst?.(this.x, this.y - 6, "fx_flare", { scale: 1.6, life: 260, tint: 0xffd08a });
    this.scene.spawnTexBurst?.(this.x, this.y - 10, "fx_smoke", { scale: 1.3, life: 520, alpha: 0.6, tint: 0xbfb4a8, rotate: true });
    /* 포문 연기 — 화약 냄새 */
    this.scene.spawnPillar?.(this.x, this.y, hex, 140);
    this.scene.time.delayedCall(shots * 70 + 320, () => {
      if (this.state === "attack") this.state = "idle";
    });
  }

  /** 4차 해왕 — 심해 포격진(dreadvolley): 적을 추적하는 3연 포탄.
   *  3차가 "부채꼴 일제사격"이라면 4차는 "조준 추적 폭격" — 회피가 어렵고
   *  착탄마다 해일이 퍼져 연쇄 피해를 준다. */
  private skill1DreadVolley() {
    const dir = this.aimDir();
    const free = this.aimDirFree(); // vc182 — 대각선 발사
    const t = this.sTier;
    const hex = this.clsHex();
    const atkKey = dir.y > 0 ? this.bodyKey("hero-atk-down") : dir.y < 0 ? this.bodyKey("hero-atk-up") : this.bodyKey("hero-atk");
    this.play(atkKey);
    this.setFlipX(dir.y === 0 && dir.x > 0);
    const base = Math.atan2(free.y, free.x); // vc182 — 자유 조준
    /* 추적 3연 — 가장 가까운 적들을 향해 각각 발사, 없으면 정면 */
    const targets = this.nearestTargets(3, 420);
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 150, () => {
        if (this.state === "dead") return;
        const tgt = targets[i] ?? targets[0] ?? null;
        const ang = tgt
          ? Math.atan2(tgt.y - this.y, tgt.x - this.x)
          : base + (i - 1) * 0.12;
        const ox = this.x + Math.cos(ang) * 30;
        const oy = this.y - 6 + Math.sin(ang) * 30;
        this.scene.spawnMuzzleFlash(ox, oy, ang);
        this.scene.sfxSkill("thunder", 0.72);
        const { dmg, crit } = this.rollDamage(2.9 + 0.2 * t, true);
        this.scene.firePlayerProj({
          x: ox, y: oy, angle: ang,
          speed: 640, pierce: 4, dmg, crit,
          tint: 0x9fe8ff, knock: 210, scale: 0.78,
          tex: "gw_proj", blend: "add", rot: true, texRot: Math.PI,
        });
      });
    }
    this.scene.doShake?.(220, 0.008);
    this.scene.spawnBurstAt(this.x, this.y - 6, 26, 0x7fd8ff);
    /* vc179 (지시 #11) — 제공 VFX 팩: 심해 폭발 코어 + 충격파 */
    this.scene.spawnTexBurst?.(this.x, this.y - 6, "fx_burst", { scale: 1.8, life: 380, tint: 0x9fe8ff });
    this.scene.spawnTexBurst?.(this.x, this.y - 6, "fx_shockwave", { scale: 1.4, life: 340, tint: 0x7fd8ff, alpha: 0.8 });
    this.scene.spawnPillar?.(this.x, this.y, hex, 220);
    /* 해일 — 발밑에서 퍼지는 물결 링 2겹 */
    for (let i = 0; i < 2; i++) {
      this.scene.time.delayedCall(i * 180, () => {
        this.scene.spawnSlashArc?.(this.x, this.y, 1, 0x8fe0ff, 2.2 + i * 0.5, 320, 0.7);
      });
    }
    this.scene.time.delayedCall(3 * 150 + 380, () => {
      if (this.state === "attack") this.state = "idle";
    });
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

  /** vc179 (지시 #11) — 사용자 제공 VFX 팩을 계열 정체성에 맞춰 고른다.
   *  직접 그린 도형 대신 이미 받아 둔 텍스처를 쓰라는 지시의 수리.
   *  각 계열의 상징(전사=충격파, 마법사=번개, 도적=보라 파동, 궁수=바람, 해적=화약)에 대응. */
  private familyFx(): { burst: string; aura: string } {
    const fam = familyOf(this.cls);
    switch (fam) {
      case "mage": return { burst: "fx_lightning", aura: "fx_glowblue" };
      case "thief": return { burst: "fx_purple", aura: "fx_noise" };
      case "ranger": return { burst: "fx_caustic", aura: "fx_glow" };
      case "pirate": return { burst: "fx_flare", aura: "fx_smoke" };
      default: return { burst: "fx_shockwave", aura: "fx_glowyellow" };
    }
  }

  useSkill3() {
    if (this.state !== "idle" || !this.skill3Unlocked || this.skill3Cd > 0 || this.mp < 25) return;
    const kind = SKILL3_KIND[this.cls ?? ""] as Skill3Kind | undefined;
    if (!kind) return;
    audio.sfx.elemCast(this.elemOfSkill(kind)); // v1.4.32 (지시 #1) — 원소별 개별 시전음
    /* v1.4.32 (지시 #5·#7·#13) — 고해상도 임팩트 2겹(링+섬광). 기존 원소 연출 위에 얹기만 한다. */
    { const _it = this.impactTexOf(this.elemOfSkill(kind)); spawnSkillImpact(this.scene, this.x, this.y, this.clsHex(), { ..._it, scale: 0.9 }); }
    this.mp -= 25;
    this.skill3Cd = this.skill3MaxEff;
    this.state = "attack";
    this.hitSet.clear();
    this.setVelocity(0, 0);
    this.netEmitAction("s3"); // v4.1.0
    const hex = this.clsHex();
    const t = this.sTier; // v1.1.9 — 스킬 계수/범위 스케일용
    /* vc179 (지시 #11) — 3차기 발동에 계열별 제공 VFX를 얹는다.
     *  같은 계열이라도 스킬마다 색만 다르고 형태가 같던 문제를 텍스처로 분리. */
    {
      const fx = this.familyFx();
      this.scene.spawnTexBurst?.(this.x, this.y - 6, fx.burst, { scale: 1.3, life: 340, tint: hex, alpha: 0.9 });
      this.scene.spawnTexBurst?.(this.x, this.y - 6, fx.aura, { scale: 1.6, life: 420, tint: hex, alpha: 0.6, rotate: true });
    }
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
      /* v1.1.9 — 해적 3차·4차기 */
      stormcall: ["thunder", 0.92], // 스톰캡틴 — 뇌우 소환
      minefield: ["explosion", 1.1], // 파우더마스터 — 지뢰 부설
      tidalwave: ["wind2", 0.85], // 씨킹 — 만조
      broadside: ["explosion", 0.95], // 드레드노트 — 전탄 발사
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
      /* ═══ v1.1.9 — 해적 계열 3차·4차기 ═══ */
      /* 스톰캡틴 — 뇌우 소환: 광역 낙뢰 3파 + 자신 신속.
       *  낙뢰는 "하늘에서 떨어진다"가 핵심이라 착탄 전 예고 링을 먼저 띄운다
       *  (맞고 나서 아는 게 아니라 보고 피할 수 있게 — 다만 범위가 넓어 회피는 어렵다). */
      case "stormcall": {
        this.scene.cameras.main.flash(120, 160, 200, 255);
        /* 신속 버프 — 기존 selfSpdBuff 재사용(새 시스템 안 만든다) */
        this.selfSpdBuff = { mult: 1.25 + 0.02 * t, until: this.scene.time.now + 3000 + 400 * t };
        this.recalcSpeed();
        for (let w = 0; w < 3; w++) {
          this.scene.time.delayedCall(120 + w * 220, () => {
            if (this.state === "dead") return;
            for (let i = 0; i < 4 + t; i++) {
              const ang = Math.random() * Math.PI * 2;
              const rad = 40 + Math.random() * (200 + 30 * t);
              const px = this.x + Math.cos(ang) * rad;
              const py = this.y + Math.sin(ang) * rad;
              this.scene.spawnPillar(px, py, 0x9fd8ff, 190); // 낙뢰 기둥
              this.scene.spawnBurstAt(px, py, 8, 0x9fd8ff);
              for (const e of this.getAllTargetsIn(999)) {
                if (this.hitSet.has(e)) continue;
                if (Phaser.Math.Distance.Between(px, py, e.x, e.y) > 90) continue;
                this.hitSet.add(e);
                const { dmg, crit } = this.rollDamage(1.4 + 0.12 * t, true);
                if (crit) this.scene.sfxCrit();
                e.takeDamage(dmg, new Phaser.Math.Vector2(0, -1), 60, crit);
              }
            }
            this.scene.sfxSkill("thunder", 0.9 + Math.random() * 0.15);
            this.scene.cameras.main.shake(90, 0.004);
          });
        }
        break;
      }
      /* 파우더마스터 — 지뢰 부설: 발밑 주변에 지뢰 4기.
       *  기존 spawnField(장판)를 재사용해 새 시스템을 만들지 않았다. */
      case "minefield": {
        this.scene.spawnBurstAt(this.x, this.y, 12, hex);
        for (let i = 0; i < 4; i++) {
          const ang = (Math.PI * 2 * i) / 4 + Math.random() * 0.4;
          const rad = 70 + Math.random() * 90;
          this.scene.spawnField({
            x: this.x + Math.cos(ang) * rad,
            y: this.y + Math.sin(ang) * rad,
            radius: 78,
            dur: 6000,
            dps: Math.max(20, Math.round(this.atkTotal * (0.5 + 0.06 * t))),
            kind: "fire",
            owner: "player",
          });
        }
        this.scene.spawnPickupText(this.x, this.y - 46, "지뢰 부설", "#ff9a5c");
        this.scene.doShake?.(90, 0.003);
        break;
      }
      /* 씨킹 — 만조: 전방을 쓸고 가는 거대 해일.
       *  이동하는 파도 판정(0.35초 간격 5파)으로 "밀려온다"를 구현. */
      case "tidalwave": {
        const dir = this.aimDirFree().normalize();
        this.scene.cameras.main.flash(140, 120, 200, 255);
        for (let w = 0; w < 5; w++) {
          this.scene.time.delayedCall(w * 90, () => {
            if (this.state === "dead") return;
            const px = this.x + dir.x * (60 + w * 110);
            const py = this.y + dir.y * (60 + w * 110);
            this.scene.spawnShockwave(px, py, 0x5fd4ff, 1.6 + 0.2 * w, 460, 0.75);
            this.scene.spawnBurstAt(px, py, 10, 0x8fe8ff);
            for (const e of this.getAllTargetsIn(999)) {
              if (this.hitSet.has(e)) continue;
              if (Phaser.Math.Distance.Between(px, py, e.x, e.y) > 130 + 10 * t) continue;
              this.hitSet.add(e);
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = this.rollDamage(2.1 + 0.12 * t, true);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 340, crit); // 강한 넉백 — 밀려나는 게 보이게
            }
          });
        }
        this.scene.sfxSkill("wind2", 0.8);
        this.scene.doShake?.(220, 0.005);
        break;
      }
      /* 드레드노트 — 전탄 발사: 부채꼴 3방향 동시 폭격. */
      case "broadside": {
        const base = Math.atan2(this.aimDirFree().y, this.aimDirFree().x);
        for (let s2 = -1; s2 <= 1; s2++) {
          const ang = base + s2 * 0.42;
          const ex = this.x + Math.cos(ang) * 260;
          const ey = this.y + Math.sin(ang) * 260;
          this.scene.time.delayedCall(80 + (s2 + 1) * 70, () => {
            if (this.state === "dead") return;
            this.scene.spawnShockwave(ex, ey, 0xff8a3d, 1.5, 400, 0.85);
            this.scene.spawnBurstAt(ex, ey, 16, 0xffb347);
            this.scene.spawnPillar(ex, ey, 0xffb347, 150);
            this.scene.sfxSkill("quake", 1.0 + s2 * 0.06);
            this.scene.cameras.main.shake(110, 0.006);
            for (const e of this.getAllTargetsIn(999)) {
              if (this.hitSet.has(e)) continue;
              if (Phaser.Math.Distance.Between(ex, ey, e.x, e.y) > 120 + 8 * t) continue;
              this.hitSet.add(e);
              const away = new Phaser.Math.Vector2(e.x - ex, e.y - ey).normalize();
              const { dmg, crit } = this.rollDamage(2.3 + 0.14 * t, true);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 280, crit);
            }
          });
        }
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
    audio.sfx.elemCast(this.elemOfSkill(kind)); // v1.4.32 (지시 #1) — 원소별 개별 시전음
    /* v1.4.32 (지시 #5·#7·#13) — 고해상도 임팩트 2겹(링+섬광). 기존 원소 연출 위에 얹기만 한다. */
    { const _it = this.impactTexOf(this.elemOfSkill(kind)); spawnSkillImpact(this.scene, this.x, this.y, this.clsHex(), { ..._it, scale: 0.9 }); }
    this.mp -= 40;
    this.skill4Cd = this.skill4MaxEff;
    this.state = "attack";
    this.hitSet.clear();
    this.setVelocity(0, 0);
    this.netEmitAction("s4"); // v4.1.0
    this.tierFlair(true); // v1.4.30 (#6) — 4차기(중요 스킬)만 풀 패키지 기존 연출
    const hex = this.clsHex();
    /* vc181 (지시 #1·#2) — 4차 스킬도 3D 검기 메시 + 측면 트래킹 카메라.
     *  궁극기보다 짧고 가볍게(1.1초) — 남발되는 슬롯이라 부담을 줄인다. */
    void cine3d().play({ preset: "skill4", x: this.x, y: this.y, tint: hex, duration: 1100, fam: this.ultKeyFor3D() });
    /* vc179 (지시 #11) — 4차 궁극기는 제공 VFX를 크게 쓴다 (필살기의 무게) */
    {
      const fx = this.familyFx();
      this.scene.spawnTexBurst?.(this.x, this.y - 6, "fx_flarebig", { scale: 2.2, life: 460, tint: hex, alpha: 0.95 });
      this.scene.spawnTexBurst?.(this.x, this.y - 6, fx.burst, { scale: 1.9, life: 520, tint: hex, alpha: 0.9 });
    }
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
      bladedance: ["swift", 1.2],
      /* v1.1.9 — 해적 4차 궁극기 */
      maelstrom: ["thunder", 0.85], // 씨킹 — 침몰의 종
      decksweep: ["explosion", 0.9], // 드레드노트 — 무쌍 포격 // 블레이드마스터 — 검무
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
      /* v1.1.9 — 해적 4차 궁극기 2종 */
      /* 씨킹 — 침몰의 종: 거대 소용돌이가 전장을 삼킨다.
       *  적을 중심으로 끌어당긴 뒤(중력 붕괴와 다르게 "돌면서" 빨아들인다) 대폭발. */
      case "maelstrom": {
        this.scene.cameras.main.flash(160, 90, 170, 255);
        this.scene.doShake?.(300, 0.007);
        const cx = this.x, cy = this.y;
        /* 3단계: 소용돌이 생성 → 흡입 → 종말 폭발 */
        for (let w = 0; w < 6; w++) {
          this.scene.time.delayedCall(w * 130, () => {
            if (this.state === "dead") return;
            const rad = 260 - w * 34;
            this.scene.spawnShockwave(cx, cy, 0x5fd4ff, (rad / 210), 420, 0.6);
            this.scene.spawnBurstAt(cx, cy, 10, 0x8fe8ff);
            this.scene.sfxSkill("wind2", 0.75 + w * 0.05);
            /* 흡입 — 적을 중심으로 끌어당긴다 */
            for (const e of this.getAllTargetsIn(999)) {
              const d = Phaser.Math.Distance.Between(cx, cy, e.x, e.y);
              if (d > 320 || d < 12) continue;
              const pull = new Phaser.Math.Vector2(cx - e.x, cy - e.y).normalize();
              e.takeDamage(Math.round(this.atkTotal * 0.25), pull, 0, false);
              /* 위치를 직접 당긴다(물리 없이) */
              e.x += pull.x * 26;
              e.y += pull.y * 26;
            }
          });
        }
        this.scene.time.delayedCall(6 * 130 + 120, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(cx, cy, 0xbfe9ff, 260);
          this.scene.spawnShockwave(cx, cy, 0xffffff, 2.6, 620, 0.9);
          this.scene.spawnBurstAt(cx, cy, 40, 0x5fd4ff);
          this.scene.cameras.main.flash(200, 200, 240, 255);
          this.scene.cameras.main.shake(280, 0.012);
          this.scene.sfxSkill("quake", 0.85);
          for (const e of this.getAllTargetsIn(360)) {
            const away = new Phaser.Math.Vector2(e.x - cx, e.y - cy).normalize();
            const { dmg, crit } = this.rollDamage(6.5, true);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 500, crit);
          }
        });
        break;
      }
      /* 드레드노트 — 무쌍 포격: 8방향 동시 폭격. 전장을 지운다. */
      case "decksweep": {
        this.scene.cameras.main.flash(140, 255, 180, 120);
        this.scene.doShake?.(260, 0.006);
        for (let i = 0; i < 8; i++) {
          const ang = (Math.PI * 2 * i) / 8;
          const dist = 180 + (i % 2) * 90;
          const px = this.x + Math.cos(ang) * dist;
          const py = this.y + Math.sin(ang) * dist;
          this.scene.time.delayedCall(i * 90, () => {
            if (this.state === "dead") return;
            this.scene.spawnPillar(px, py, 0xffb347, 220);
            this.scene.spawnShockwave(px, py, 0xff8a3d, 1.8, 460, 0.85);
            this.scene.spawnBurstAt(px, py, 18, 0xff6a3d);
            this.scene.sfxSkill("quake", 0.9 + (i % 3) * 0.06);
            this.scene.cameras.main.shake(100, 0.007);
            for (const e of this.getAllTargetsIn(999)) {
              if (this.hitSet.has(e)) continue;
              if (Phaser.Math.Distance.Between(px, py, e.x, e.y) > 145) continue;
              this.hitSet.add(e);
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = this.rollDamage(4.2, true);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 420, crit);
            }
          });
        }
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

  /** vc194 — 임의 좌표 기준 반경 탐색.
   *  기존 getAllTargetsIn() 은 **플레이어 위치 고정**이라, 궁극기에서
   *  "낙하 지점 주변", "해일 전진 지점 주변" 같은 국소 판정을 할 수 없었다.
   *  같은 targetScratch 를 공유하지 않고 별도 배열을 반환해 호출 중 덮어쓰기를 막는다. */
  targetsAround(cx: number, cy: number, radius: number): (Enemy | Boss)[] {
    const out: (Enemy | Boss)[] = [];
    const r2 = radius * radius;
    for (const e of this.scene.getAllTargets()) {
      if (!e.active) continue;
      const dx = e.x - cx, dy = e.y - cy;
      if (dx * dx + dy * dy <= r2) out.push(e);
    }
    return out;
  }

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

  /** vc183 (극딜 문서) — **적에게** 제어 효과를 건다.
   *  종전 `applyEnemyStatus` 는 이름과 달리 플레이어 자신에게 거는 함수였고,
   *  4차 궁극기들이 그걸 호출해 "적을 때렸는데 내가 출혈" 상태가 됐다(실측 확인).
   *  문서가 요구하는 기절(Stun)·감속(Slow)을 적에게 정확히 적용한다.
   *  보스는 applyStun 내부에서 최대 경직으로 캡되므로 그대로 넘겨도 안전하다. */
  applyStatusTo(targets: Array<{ applyStun?: (ms: number) => void; applySlow?: (m: number, ms: number) => void }>, opts: { stunMs?: number; slowMult?: number; slowMs?: number }) {
    for (const t of targets) {
      try {
        if (opts.stunMs && t.applyStun) t.applyStun(opts.stunMs);
        if (opts.slowMult !== undefined && opts.slowMs && t.applySlow) t.applySlow(opts.slowMult, opts.slowMs);
      } catch { /* 제어 면역/미지원 개체 무시 */ }
    }
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
    // vc195 — ultSlot 을 try/finally 로 복원한다.
    //  종전엔 rollDamage() 가 예외를 던지면(타겟 파괴·상태이상 콜백 오류 등)
    //  this.ultSlot = 0 복원에 도달하지 못해 슬롯이 1 로 **영구 고정**됐고,
    //  이후 일반 스킬 전부가 ×3 배율(FIFTH1_MULT)로 오염됐다.
    //  rollDamage 는 순수 계산이 아니므로(내부에서 상태 조회·이벤트 발생)
    //  예외 가능성을 배제할 수 없다.
    const rd = (m: number, forceCrit = false) => {
      const prev = this.ultSlot;
      this.ultSlot = 1;
      try {
        return this.rollDamage(m, true, forceCrit);
      } finally {
        this.ultSlot = prev;
      }
    };

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
    /* vc181 (지시 #1·#2) — 3D 시네마틱: 궁극기 발동 순간 three.js 레이어가 올라와
     *  실제 GLB 메시(해골·고리·톱니)를 3D 카메라 워크로 보여준다.
     *  실패해도 2D 연출은 그대로 남으므로 게임 진행에 영향 없음. */
    void cine3d().play({ preset: "ultimate", x: this.x, y: this.y, tint: hex, duration: 1750, fam: this.ultKeyFor3D() });
    /* v1.4.0 (Task 3-1 — 유저 지시 #13) — 직업별 고유 VFX2 시그니처 연출 (8직업 1:1 매핑) */
    spawnUltFlourish(this.scene, this.x, this.y, key5, hex);
    /* vc183 — 극딜 3단계 연출(암전 → 후면오라/지면룬/전면폭발 → 히트스톱·흔들림·줌).
     *  계열별 강도표(ultLayers.ts)로 전사는 묵직, 도적은 짧고 날카롭게 자동 분기된다. */
    playUltLayers(this.scene, this.x, this.y, hex, key5);
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
              e.applyDot?.(Math.max(6, Math.round(this.atkTotal * 0.012)), 5000); // vc183 — 적에게 출혈(종전엔 자신에게 걸렸다)
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

        /* vc183 (극딜 문서) — 성기사: 망치 낙하 충격파로 범위 내 적 기절(Stun).
         *  보스는 applyStun 내부에서 최대 1.4초 경직으로 자동 캡된다. */
        this.applyStatusTo(this.getAllTargetsIn(320), { stunMs: 1600 });        for (let i = 0; i < 9; i++) {
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

        /* vc183 (극딜 문서) — 저격수 "방어력 무시 관통"은 이 게임에 방어력 스탯이 없어
         *  수치로 옮길 대상이 없다. 대신 문서의 "직선 관통" 정체성을 피해 배율로 반영한다. */
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

        /* vc183 (극딜 문서) — 환영 궁수: 토네이도가 적 이동속도를 70% 감속(×0.3) */
        this.applyStatusTo(this.getAllTargetsIn(420), { slowMult: 0.3, slowMs: 6000 });        for (let i = 0; i < 14; i++) {
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

        /* vc183 (극딜 문서) — 원소 대마도사: 초신성 폭발 시 빙결. 게임에는 freeze 상태가
         *  없으므로 기절(Stun)로 대체한다 — 체감(행동 불가)이 동일하고 코드 경로도 하나로 유지된다. */
        this.applyStatusTo(this.getAllTargetsIn(380), { stunMs: 1500 });        for (let i = 0; i < 12; i++) {
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

        /* vc183 (극딜 문서) — 암흑 사제: 지옥의 문으로 보스를 구속(Bind). 기절로 구현하되
         *  지속을 길게(2.6초) 잡아 "구속" 체감을 만든다. */
        this.applyStatusTo(this.getAllTargetsIn(340), { stunMs: 2600 });        this.scene.driveFx?.gvStarry(this.x, this.y, 2.6, 3400);
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
            e.applyDot?.(Math.max(8, Math.round(this.atkTotal * 0.014)), 6000); // vc183 — 적에게 출혈
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

      /* ══════════════════════════════════════════════════════════════════
       * vc195 — 기획서 §4.9 시킹 「해왕 — 대해일」
       *
       *  조준 방향으로 파도가 전진하며 충격파를 9단으로 일으킨다.
       *  종전엔 case 가 없어 default(도적 심연 참수극)로 떨어졌다 —
       *  해적이 도적 궁극기를 쓰던 상태.
       *
       *  설계 가드(기획서): 화면 크기가 아니라 **월드 단위** 공격선을 쓴다
       *  (해상도에 따라 범위가 달라지면 안 된다). 넉백 방향은 조준각과 일치.
       * ══════════════════════════════════════════════════════════════════ */
      case "seaking": {
        const face = this.flipX ? -1 : 1;
        const dir = new Phaser.Math.Vector2(face, 0);
        /* 물결 압축 — 발동 예고 */
        this.scene.spawnShockwave(this.x, this.y, 0x4fd2e8, 1.2, 260, 2.2);
        this.scene.sfxSkill("water", 0.82);
        for (let i = 0; i < 9; i++) {
          this.scene.time.delayedCall(200 + i * 145, () => {
            if (this.state === "dead") return;
            /* 파도 전진선 — i 단계마다 전방으로 밀려간다 (월드 단위) */
            const px = this.x + dir.x * (90 + i * 78);
            const py = this.y + (i % 2 === 0 ? 10 : -10);
            const wave = this.scene.add.rectangle(px, py, 34, 190, 0x6fe0f5, 0.72)
              .setDepth(14).setBlendMode(Phaser.BlendModes.ADD);
            this.scene.tweens.add({
              targets: wave, scaleX: 2.1, alpha: 0, duration: 320,
              onComplete: () => { try { wave.destroy(); } catch { /* 무시 */ } },
            });
            this.scene.spawnBurstAt(px, py, 14, 0x9af0ff);
            this.scene.doShake?.(80, 0.007);
            this.scene.sfxSkill("wave", 0.7 + (i % 3) * 0.06);
            for (const e of this.getAllTargetsIn(999)) {
              /* 전진 파도 폭 — 각 단계의 타격 창 */
              if (Phaser.Math.Distance.Between(e.x, e.y, px, py) > 150) continue;
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(2.3 + i * 0.12);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 380, crit);
            }
          });
        }
        /* 종결 역류 — 바닷물이 되돌아오며 전장을 삼킨다 */
        this.scene.time.delayedCall(200 + 9 * 145 + 180, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x + dir.x * 260, this.y, 0x4fd2e8, 300);
          this.scene.spawnBurstAt(this.x + dir.x * 260, this.y, 64, 0x8ae6ff);
          this.scene.spawnField({
            x: this.x + dir.x * 260, y: this.y, radius: 260, dur: 5000,
            dps: Math.max(18, Math.round(this.atkTotal * 1.5)),
            kind: "light", owner: "player",
          });
          this.scene.cameras.main.flash(190, 120, 220, 255);
          this.scene.cameras.main.shake(440, 0.019);
          this.scene.sfxSkill("superhit", 0.88);
          for (const e of this.getAllTargetsIn(620)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(6.2);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 620, crit);
          }
        });
        break;
      }

      /* ══════════════════════════════════════════════════════════════════
       * vc195 — 기획서 §4.10 드레드노트 「공포 — 종말 포격」
       *
       *  세 단계로 커지는 포격 + 방사형 충격파.
       *  설계 가드(기획서): 각 포격의 착탄 지점을 **먼저 읽게** 하고
       *  마지막 타격만 확실히 크게 만든다. 반경 증가와 연출 크기를 일치.
       * ══════════════════════════════════════════════════════════════════ */
      case "dreadnought": {
        /* 3단계 — 반경과 피해가 함께 커진다 */
        const stages = [
          { r: 150, n: 3, mul: 2.2, delay: 260 },
          { r: 230, n: 4, mul: 3.0, delay: 700 },
          { r: 340, n: 5, mul: 5.4, delay: 1300 },
        ];
        this.scene.sfxSkill("cannon", 0.85);
        for (let si = 0; si < stages.length; si++) {
          const st = stages[si];
          this.scene.time.delayedCall(st.delay, () => {
            if (this.state === "dead") return;
            /* 착탄 예고 — 먼저 읽히게 */
            for (let i = 0; i < st.n; i++) {
              const ang = (Math.PI * 2 * i) / st.n + si * 0.4;
              const px = this.x + Math.cos(ang) * st.r * 0.7;
              const py = this.y + Math.sin(ang) * st.r * 0.7;
              /* 예고 링 → 실제 폭발 */
              this.scene.spawnShockwave(px, py, 0xffa040, 0.6, 140, 2.0);
              this.scene.time.delayedCall(140 + si * 20, () => {
                if (this.state === "dead") return;
                this.scene.spawnBurstAt(px, py, 16 + si * 6, 0xffb060);
                this.scene.spawnShockwave(px, py, 0xffcc80, 1.4 + si * 0.3, 220, 2.4);
                this.scene.doShake?.(90 + si * 30, 0.008 + si * 0.003);
                this.scene.sfxSkill("explosion", 0.78 + si * 0.05);
                for (const e of this.getAllTargetsIn(999)) {
                  if (Phaser.Math.Distance.Between(e.x, e.y, px, py) > 120 + si * 25) continue;
                  const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
                  const { dmg, crit } = rd(st.mul);
                  if (crit) this.scene.sfxCrit();
                  e.takeDamage(dmg, away, 420 + si * 60, crit);
                }
              });
            }
          });
        }
        /* 종결 — 방사형 대충격파 + 연기 잔류 */
        this.scene.time.delayedCall(1300 + 320, () => {
          if (this.state === "dead") return;
          this.scene.cameras.main.flash(240, 255, 190, 120);
          this.scene.spawnPillar(this.x, this.y, 0xffa040, 340);
          this.scene.spawnBurstAt(this.x, this.y, 82, 0xffcf90);
          this.scene.spawnShockwave(this.x, this.y, 0xffe0b0, 4.2, 420, 3.2);
          this.scene.spawnField({
            x: this.x, y: this.y, radius: 300, dur: 4500,
            dps: Math.max(20, Math.round(this.atkTotal * 1.6)),
            kind: "fire", owner: "player",
          });
          this.scene.cameras.main.shake(520, 0.024);
          this.scene.sfxSkill("quake", 0.92);
          for (const e of this.getAllTargetsIn(680)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(7.4);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 700, crit);
          }
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

      /* vc178 — 해적 계열 — 만조: 대양 항로. 거대 해일 관통 + 낙뢰 세례.
       *  v1.2.4까지 case "pirate"가 없어 도적 폴백(심연 참수극)으로 떨어졌다.
       *  "범위가 가장 넓은 계열 궁극기"라는 SKILL5_INFO 설명을 코드로 만든다. */
      case "pirate": {
        /* 1단 — 거대 해일: 화면 가로 전체를 좌→우로 관통하는 물기둥 3연속 */
        for (let w = 0; w < 3; w++) {
          this.scene.time.delayedCall(280 + w * 420, () => {
            if (this.state === "dead") return;
            const wy = this.y - 10 + (w - 1) * 46;
            /* 해일 본체 — 넓은 사각 물벽이 화면을 가로지른다 */
            const wave = this.scene.add.rectangle(-80, wy, 120, 150 + w * 22, 0x3a8ad0, 0.42)
              .setDepth(14).setBlendMode(Phaser.BlendModes.ADD);
            const foam = this.scene.add.rectangle(-80, wy - (75 + w * 11), 120, 8, 0xbfe8ff, 0.85)
              .setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
            this.scene.tweens.add({ targets: [wave, foam], x: this.scene.scale.width + 120, duration: 780, ease: "Sine.inOut", onComplete: () => { wave.destroy(); foam.destroy(); } });
            this.scene.sfxSkill("wind", 0.9 + w * 0.06);
            this.scene.doShake?.(140, 0.005);
            /* 관통 판정 — 해일 라인 근처의 적 전부 */
            for (const e of this.getAllTargetsIn(999)) {
              if (Math.abs(e.y - wy) > 110 + w * 14) continue;
              const away = new Phaser.Math.Vector2(1, 0);
              const { dmg, crit } = rd(2.4 + w * 0.25);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 520, crit);
            }
          });
        }
        /* 2단 — 뇌운 낙뢰: 전장 상공에 뇌운이 걷히고 8방향 낙뢰가 쏟아진다 */
        this.scene.time.delayedCall(280 + 3 * 420 + 200, () => {
          if (this.state === "dead") return;
          this.scene.cameras.main.flash(150, 130, 190, 255);
          for (let i = 0; i < 8; i++) {
            this.scene.time.delayedCall(i * 150, () => {
              if (this.state === "dead") return;
              const t2 = this.nearestTargets(1, 720)[0];
              const px = t2 ? t2.x + (Math.random() - 0.5) * 90 : this.x + (Math.random() - 0.5) * 520;
              const py = t2 ? t2.y : this.y + (Math.random() - 0.5) * 220;
              /* 낙뢰 기둥 — 하늘에서 바닥까지 */
              const bolt = this.scene.add.rectangle(px, py - 110, 9, 230, 0xcfe8ff, 0.9)
                .setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
              this.scene.tweens.add({ targets: bolt, alpha: 0, duration: 240, onComplete: () => bolt.destroy() });
              this.scene.spawnBurstAt(px, py, 18, 0xa8d8ff);
              this.scene.sfxSkill("thunder", 0.78 + (i % 3) * 0.08);
              this.scene.doShake?.(90, 0.006);
              for (const e of this.getAllTargetsIn(999)) {
                if (Phaser.Math.Distance.Between(e.x, e.y, px, py) > 130) continue;
                const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
                const { dmg, crit } = rd(3.1);
                if (crit) this.scene.sfxCrit();
                e.takeDamage(dmg, away, 480, crit);
              }
            });
          }
          /* 종결 — 대양이 잠잠해질 때의 만조 폭발 */
          this.scene.time.delayedCall(8 * 150 + 260, () => {
            if (this.state === "dead") return;
            this.scene.spawnPillar(this.x, this.y, 0x5ab8ff, 260);
            this.scene.spawnBurstAt(this.x, this.y, 70, 0x8ad0ff);
            this.scene.spawnField({
              x: this.x, y: this.y, radius: 250, dur: 6000,
              dps: Math.max(16, Math.round(this.atkTotal * 1.4)),
              kind: "light", owner: "player",
            });
            this.scene.cameras.main.flash(200, 140, 210, 255);
            this.scene.cameras.main.shake(460, 0.02);
            this.scene.sfxSkill("superhit", 0.86);
            for (const e of this.getAllTargetsIn(560)) {
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(6.6);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 580, crit);
            }
          });
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

      /* ══════════════════════════════════════════════════════════════════════
       * vc194 — 17직업 전용 궁극기 (docs/ULTIMATE_DESIGN.md 설계서 기준)
       *
       *  공통 규약:
       *   - 피해는 반드시 rd(배율) 로만 산출 (ultSlot 배율 체계 유지)
       *   - 모든 delayedCall 첫 줄에서 사망 검사
       *   - 생성한 오브젝트는 onComplete 에서 반드시 destroy (모바일 메모리)
       *   - 시전 후 경직 해제는 함수 끝 공통 마무리가 담당 (개별 해제 금지)
       *   - 국소 판정은 targetsAround(cx, cy, r) 사용
       * ══════════════════════════════════════════════════════════════════════ */

      /* ── 버서커: 잃은 체력 비례 연격 (체력이 곧 자원) ── */
      case "berserker": {
        const lost = 1 - this.hp / Math.max(1, this.maxHp);
        const hits = 4 + Math.round(lost * 8);
        for (let i = 0; i < hits; i++) {
          this.scene.time.delayedCall(220 + i * (180 - lost * 90), () => {
            if (this.state === "dead") return;
            const dir = this.aimDirFree().normalize();
            const ox = this.x + dir.x * (i % 2 === 0 ? 48 : -48);
            const oy = this.y + dir.y * (i % 2 === 0 ? 32 : -32);
            this.scene.spawnSlash(ox, oy, dir, i % 2 === 0, 3.0 + i * 0.18, 0xd83030);
            this.scene.cameras.main.shake(90, 0.008 + i * 0.0009);
            this.scene.sfxSkill("bigsword", 0.92 + (i % 3) * 0.05);
            for (const e of this.getAllTargetsIn(400)) {
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(2.2 + lost * 1.8);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 380, crit);
            }
          });
        }
        this.scene.time.delayedCall(220 + hits * 190 + 140, () => {
          if (this.state === "dead") return;
          this.scene.spawnCrack(this.x, this.y);
          this.scene.spawnPillar(this.x, this.y, 0xd83030, 320);
          this.scene.spawnBurstAt(this.x, this.y, 76, 0xd83030);
          this.scene.cameras.main.flash(170, 200, 40, 40);
          this.scene.cameras.main.shake(450, 0.021);
          this.scene.sfxSkill("superhit", 0.82);
          for (const e of this.getAllTargetsIn(520)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(6.0 + lost * 4.0);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 560, crit);
            e.applyDot?.(Math.max(8, Math.round(this.atkTotal * 0.014)), 5000);
          }
        });
        break;
      }

      /* ── 가디언: 보호막 성역 + 지속 밀어내기 ── */
      case "guardian": {
        const RAD = 300;
        const dome = this.scene.add.circle(this.x, this.y, RAD)
          .setStrokeStyle(6, 0xffd76a, 0.9).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({ targets: dome, scale: 1.06, alpha: 0.55, duration: 420, yoyo: true, repeat: 3, onComplete: () => dome.destroy() });
        for (let i = 0; i < 6; i++) {
          this.scene.time.delayedCall(200 + i * 300, () => {
            if (this.state === "dead") return;
            this.scene.spawnShockwave(this.x, this.y, 0xffd76a, 1.5, 420, 0.7);
            this.scene.cameras.main.shake(70, 0.005);
            this.scene.sfxSkill("warcry", 0.9);
            for (const e of this.getAllTargetsIn(RAD)) {
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(1.5);
              e.takeDamage(dmg, away, 720, crit);
            }
          });
        }
        this.scene.time.delayedCall(200 + 6 * 300, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x, this.y, 0xffd76a, 280);
          this.scene.spawnBurstAt(this.x, this.y, 60, 0xffd76a);
          this.scene.cameras.main.flash(150, 255, 230, 160);
          for (const e of this.getAllTargetsIn(RAD + 60)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(4.2);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 700, crit);
          }
        });
        break;
      }

      /* ── 워로드: 3연 도약 강타 + 십자 균열 ── */
      case "warlord": {
        for (let i = 0; i < 3; i++) {
          this.scene.time.delayedCall(300 + i * 420, () => {
            if (this.state === "dead") return;
            const dir = this.aimDirFree().normalize();
            const jump = 130;
            this.setPosition(this.x + dir.x * jump, this.y + dir.y * jump);
            this.scene.spawnCrack(this.x, this.y);
            this.scene.spawnShockwave(this.x, this.y, 0xffb060, 1.4, 380, 0.8);
            this.scene.spawnBurstAt(this.x, this.y, 44, 0xffb060);
            this.scene.cameras.main.shake(200, 0.014);
            this.scene.sfxSkill("bigsword", 0.86);
            for (const e of this.getAllTargetsIn(340)) {
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(3.0);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 460, crit);
              e.applyDot?.(Math.max(6, Math.round(this.atkTotal * 0.010)), 3500);
            }
          });
        }
        this.scene.time.delayedCall(300 + 3 * 420 + 200, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x, this.y, 0xffb060, 340);
          this.scene.cameras.main.flash(160, 255, 190, 120);
          this.scene.cameras.main.shake(480, 0.019);
          for (const e of this.getAllTargetsIn(480)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(5.4);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 520, crit);
          }
        });
        break;
      }

      /* ── 팔라딘: 빛기둥 9개 순차 낙하 + 자신 회복 (양면 구조) ── */
      case "paladin": {
        for (let i = 0; i < 9; i++) {
          this.scene.time.delayedCall(260 + i * 170, () => {
            if (this.state === "dead") return;
            const ang = (i / 9) * Math.PI * 2;
            const dist = i === 8 ? 0 : 190;
            const px = this.x + Math.cos(ang) * dist;
            const py = this.y + Math.sin(ang) * dist;
            this.scene.spawnPillar(px, py, 0xfff0b0, 260);
            this.scene.spawnBurstAt(px, py, 34, 0xfff0b0);
            this.scene.cameras.main.flash(90, 255, 245, 200);
            this.scene.sfxSkill("holy", 0.9);
            for (const e of this.targetsAround(px, py, 150)) {
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(2.4);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 300, crit);
            }
          });
        }
        this.scene.time.delayedCall(260 + 9 * 170, () => {
          if (this.state === "dead") return;
          const heal = Math.round(this.maxHp * 0.18);
          this.hp = Math.min(this.maxHp, this.hp + heal);
          this.scene.spawnPickupText(this.x, this.y - 50, `+${heal}`, "#a0ffa0");
          this.scene.spawnBurstAt(this.x, this.y, 50, 0x90ff90);
          this.scene.sfxSkill("cure", 0.9);
          this.scene.emitHud();
        });
        break;
      }

      /* ── 스나이퍼: 조준 후 단일 관통 (확정 크리티컬) ── */
      case "sniper": {
        const tgt = this.getAllTargetsIn(700)[0];
        if (tgt) {
          const line = this.scene.add.line(0, 0, this.x, this.y, tgt.x, tgt.y, 0xff4040, 0.85)
            .setOrigin(0, 0).setDepth(12).setLineWidth(2).setBlendMode(Phaser.BlendModes.ADD);
          this.scene.time.delayedCall(1200, () => {
            if (!line.scene) return;
            line.destroy();
            if (this.state === "dead") return;
            this.scene.cameras.main.shake(160, 0.010);
            this.scene.hitStop(120);
            this.scene.sfxSkill("snipe", 0.9);
            this.scene.spawnBurstAt(tgt.x, tgt.y, 40, 0xff4040);
            const away = new Phaser.Math.Vector2(tgt.x - this.x, tgt.y - this.y).normalize();
            const { dmg } = rd(9.5, true);
            tgt.takeDamage(dmg, away, 260, true);
          });
        }
        break;
      }

      /* ── 윈드러너: 이동형 + 경로 화살 잔류 ── */
      case "windrunner": {
        for (let i = 0; i < 8; i++) {
          this.scene.time.delayedCall(200 + i * 150, () => {
            if (this.state === "dead") return;
            this.scene.spawnBurstAt(this.x, this.y, 18, 0x60e0ff);
            this.scene.sfxSkill("arrow", 0.9);
            for (const e of this.getAllTargetsIn(240)) {
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(2.0);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 200, crit);
            }
          });
        }
        /* 시전 중 이동 가능 — 잠시 idle 로 되돌려 이동 입력을 살린다 */
        this.scene.time.delayedCall(420, () => {
          if (this.state === "attack") this.state = "idle";
        });
        break;
      }

      /* ── 이글아이: 전원 표식 후 동시 저격 (분산형) ── */
      case "eagleeye": {
        const tgts = [...this.getAllTargetsIn(760)];
        tgts.forEach((t, i) => {
          const mark = this.scene.add.circle(t.x, t.y - 40, 7, 0xff6060, 0.95).setDepth(14);
          this.scene.tweens.add({ targets: mark, scale: 1.8, alpha: 0.3, duration: 260, yoyo: true, repeat: 2, onComplete: () => mark.destroy() });
          this.scene.time.delayedCall(420 + i * 90, () => {
            if (this.state === "dead") return;
            this.scene.spawnSlash(t.x, t.y, new Phaser.Math.Vector2(0, 1), i % 2 === 0, 1.6, 0xff6060);
            this.scene.spawnBurstAt(t.x, t.y, 20, 0xff6060);
            this.scene.sfxSkill("snipe", 0.85);
            const away = new Phaser.Math.Vector2(t.x - this.x, t.y - this.y).normalize();
            const { dmg, crit } = rd(3.2);
            if (crit) this.scene.sfxCrit();
            t.takeDamage(dmg, away, 220, crit);
          });
        });
        break;
      }

      /* ── 템페스트: 적→적 연쇄 낙뢰 ── */
      case "tempest": {
        const chain = [...this.getAllTargetsIn(700)].slice(0, 12);
        for (let i = 0; i < chain.length; i++) {
          const t = chain[i];
          const prev = i === 0 ? { x: this.x, y: this.y } : chain[i - 1];
          this.scene.time.delayedCall(220 + i * 110, () => {
            if (this.state === "dead") return;
            const bolt = this.scene.add.line(0, 0, prev.x, prev.y, t.x, t.y, 0x80d8ff, 0.95)
              .setOrigin(0, 0).setDepth(13).setLineWidth(3).setBlendMode(Phaser.BlendModes.ADD);
            this.scene.tweens.add({ targets: bolt, alpha: 0, duration: 220, onComplete: () => bolt.destroy() });
            this.scene.spawnBurstAt(t.x, t.y, 22, 0x80d8ff);
            this.scene.sfxSkill("thunder", 0.9);
            const away = new Phaser.Math.Vector2(t.x - prev.x, t.y - prev.y).normalize();
            const { dmg, crit } = rd(2.6);
            if (crit) this.scene.sfxCrit();
            t.takeDamage(dmg, away, 200, crit);
          });
        }
        break;
      }

      /* ── 스톰브링어: 뇌운 + 무작위 낙뢰 + 종결 뇌격 ── */
      case "stormbringer": {
        for (let i = 0; i < 14; i++) {
          this.scene.time.delayedCall(300 + i * 220, () => {
            if (this.state === "dead") return;
            const ang = Math.random() * Math.PI * 2;
            const dist = 80 + Math.random() * 300;
            const px = this.x + Math.cos(ang) * dist;
            const py = this.y + Math.sin(ang) * dist;
            this.scene.spawnPillar(px, py, 0x90c0ff, 200);
            this.scene.spawnBurstAt(px, py, 20, 0x90c0ff);
            this.scene.cameras.main.shake(60, 0.006);
            this.scene.sfxSkill("thunder", 0.84);
            for (const e of this.targetsAround(px, py, 130)) {
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(1.6);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 180, crit);
            }
          });
        }
        this.scene.time.delayedCall(300 + 14 * 220 + 200, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x, this.y, 0xb0e0ff, 460);
          this.scene.spawnBurstAt(this.x, this.y, 90, 0xb0e0ff);
          this.scene.cameras.main.flash(200, 180, 220, 255);
          this.scene.cameras.main.shake(520, 0.022);
          this.scene.sfxSkill("superhit", 0.86);
          for (const e of this.getAllTargetsIn(560)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(6.4);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 500, crit);
          }
        });
        break;
      }

      /* ── 아크메이지: 운석 8발 + 원소 종막 ── */
      case "archmage": {
        for (let i = 0; i < 8; i++) {
          this.scene.time.delayedCall(280 + i * 160, () => {
            if (this.state === "dead") return;
            const ang = (i / 8) * Math.PI * 2;
            const dist = 60 + (i % 3) * 90;
            const px = this.x + Math.cos(ang) * dist;
            const py = this.y + Math.sin(ang) * dist;
            this.scene.spawnBurstAt(px, py, 30, 0xc080ff);
            this.scene.spawnCrack(px, py);
            this.scene.cameras.main.shake(80, 0.007);
            this.scene.sfxSkill("gravity", 0.88);
            for (const e of this.targetsAround(px, py, 140)) {
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(2.8);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 240, crit);
            }
          });
        }
        this.scene.time.delayedCall(280 + 8 * 160 + 180, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x, this.y, 0xd0a0ff, 420);
          this.scene.spawnBurstAt(this.x, this.y, 86, 0xd0a0ff);
          this.scene.cameras.main.flash(190, 200, 160, 255);
          this.scene.cameras.main.shake(460, 0.018);
          this.scene.sfxSkill("superhit", 0.84);
          for (const e of this.getAllTargetsIn(520)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(7.2);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 480, crit);
          }
        });
        break;
      }

      /* ── 세이지: 시간 정지 + 해제 시 누적 폭발 ── */
      case "sage": {
        const frozen = [...this.getAllTargetsIn(600)];
        let accum = 0;
        for (let i = 0; i < 5; i++) {
          this.scene.time.delayedCall(300 + i * 320, () => {
            if (this.state === "dead") return;
            this.scene.spawnBurstAt(this.x, this.y, 24, 0xffe080);
            this.scene.sfxSkill("timestop", 0.86);
            for (const e of frozen) {
              if (!e.active) continue;
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(1.8);
              accum += dmg;
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 0, crit);
            }
          });
        }
        this.scene.time.delayedCall(300 + 5 * 320 + 200, () => {
          if (this.state === "dead") return;
          this.scene.cameras.main.flash(220, 255, 250, 200);
          this.scene.cameras.main.shake(420, 0.016);
          this.scene.spawnPillar(this.x, this.y, 0xffe080, 400);
          this.scene.sfxSkill("superhit", 0.8);
          const bonus = Math.max(1, Math.round(accum * 0.5));
          for (const e of this.getAllTargetsIn(600)) {
            if (!e.active) continue;
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            e.takeDamage(bonus, away, 380, false);
          }
        });
        break;
      }

      /* ── 크로니클: 최근 피해 재적용 (되감기) ── */
      case "chronicle": {
        const swipe = this.scene.add.rectangle(this.x, this.y - 600, 900, 1400, 0xf0e0b0, 0.28)
          .setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({
          targets: swipe, y: this.y + 600, duration: 520, ease: "Sine.inOut",
          onComplete: () => swipe.destroy(),
        });
        for (let i = 0; i < 3; i++) {
          this.scene.time.delayedCall(320 + i * 380, () => {
            if (this.state === "dead") return;
            this.scene.spawnBurstAt(this.x, this.y, 30, 0xf0e0b0);
            this.scene.sfxSkill("manaburst", 0.88);
            for (const e of this.getAllTargetsIn(520)) {
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(2.6);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 220, crit);
              e.takeDamage(dmg, away, 0, crit);
            }
          });
        }
        break;
      }

      /* ── 어쌔신: HP 30% 이하 즉사 (보스 제외) ── */
      case "assassin": {
        this.scene.cameras.main.flash(120, 40, 0, 60);
        for (let i = 0; i < 6; i++) {
          this.scene.time.delayedCall(200 + i * 160, () => {
            if (this.state === "dead") return;
            for (const e of this.getAllTargetsIn(520)) {
              if (!e.active) continue;
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const isBoss = e === this.scene.boss;
              const lowHp = e.hp / Math.max(1, e.maxHp) <= 0.3;
              this.scene.spawnSlash(e.x, e.y, away, i % 2 === 0, 1.8, 0x9a40ff);
              if (lowHp && !isBoss) {
                e.takeDamage(e.hp + 1, away, 300, true);
                this.scene.spawnBurstAt(e.x, e.y, 30, 0x9a40ff);
              } else {
                const { dmg, crit } = rd(3.0);
                e.takeDamage(dmg, away, 240, crit);
              }
            }
            this.scene.sfxSkill("knife", 0.94);
          });
        }
        break;
      }

      /* ── 스워시버클러: 18연격 전방위 난무 ── */
      case "swashbuckler": {
        for (let i = 0; i < 18; i++) {
          this.scene.time.delayedCall(180 + i * 68, () => {
            if (this.state === "dead") return;
            const ang = (i / 18) * Math.PI * 2;
            const r = 90;
            const px = this.x + Math.cos(ang) * r;
            const py = this.y + Math.sin(ang) * r;
            this.scene.spawnSlash(px, py, new Phaser.Math.Vector2(Math.cos(ang), Math.sin(ang)), i % 2 === 0, 1.5, 0xffe080);
            this.scene.spawnSpinSlash(px, py, 1);
            this.scene.cameras.main.shake(50, 0.004);
            this.scene.sfxSkill("knife", 0.9);
            for (const e of this.getAllTargetsIn(200)) {
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(1.4);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 120, crit);
            }
          });
        }
        break;
      }

      /* ── 나이트블레이드: 무적 기습 + 첫 타 강화 ── */
      case "nightblade": {
        this.setAlpha(0.25);
        this.scene.time.delayedCall(620, () => {
          this.setAlpha(1);
          if (this.state === "dead") return;
          const t = this.getAllTargetsIn(560)[0];
          if (t) {
            const away = new Phaser.Math.Vector2(t.x - this.x, t.y - this.y).normalize();
            this.setPosition(t.x + away.x * 46, t.y + away.y * 46);
            this.scene.spawnSlash(t.x, t.y, away, true, 2.6, 0x60a0ff);
            this.scene.spawnBurstAt(t.x, t.y, 36, 0x60a0ff);
            this.scene.cameras.main.shake(180, 0.011);
            this.scene.hitStop(100);
            this.scene.sfxSkill("knife", 0.95);
            const { dmg } = rd(9.0, true);
            t.takeDamage(dmg, away, 300, true);
          }
        });
        break;
      }

      /* ── 듀얼리스트: 최근접 1명과 결투 ── */
      case "duelist": {
        const foe = this.getAllTargetsIn(600)[0];
        if (foe) {
          const away = new Phaser.Math.Vector2(foe.x - this.x, foe.y - this.y).normalize();
          for (let i = 0; i < 6; i++) {
            this.scene.time.delayedCall(240 + i * 170, () => {
              if (this.state === "dead" || !foe.active) return;
              this.scene.spawnSlash(foe.x, foe.y, away, i % 2 === 0, 2.0 + i * 0.1, 0xffe0a0);
              this.scene.cameras.main.shake(90, 0.008);
              this.scene.sfxSkill("knife", 0.92);
              const { dmg, crit } = rd(3.4);
              if (crit) this.scene.sfxCrit();
              foe.takeDamage(dmg, away, 60, crit);
            });
          }
        }
        break;
      }

      /* ── 레이더: 화염 확산 장판 ── */
      case "raider": {
        for (let i = 0; i < 7; i++) {
          this.scene.time.delayedCall(260 + i * 240, () => {
            if (this.state === "dead") return;
            const ang = (i / 7) * Math.PI * 2;
            const dist = 60 + i * 42;
            const px = this.x + Math.cos(ang) * dist;
            const py = this.y + Math.sin(ang) * dist;
            this.scene.spawnBurstAt(px, py, 26, 0xff7030);
            this.scene.spawnCrack(px, py);
            this.scene.sfxSkill("flame", 0.9);
            for (const e of this.targetsAround(px, py, 150)) {
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(1.8);
              e.takeDamage(dmg, away, 160, crit);
              e.applyDot?.(Math.max(7, Math.round(this.atkTotal * 0.011)), 4500);
            }
          });
        }
        break;
      }

      /* ── 코르세어: 16방향 방사 포격 ── */
      case "corsair": {
        for (let i = 0; i < 16; i++) {
          const ang = (i / 16) * Math.PI * 2;
          this.scene.time.delayedCall(280 + i * 55, () => {
            if (this.state === "dead") return;
            const px = this.x + Math.cos(ang) * 260;
            const py = this.y + Math.sin(ang) * 260;
            this.scene.spawnBurstAt(px, py, 18, 0xffa040);
            this.scene.sfxSkill("quake", 0.86);
            for (const e of this.targetsAround(px, py, 120)) {
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(1.9);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 220, crit);
            }
          });
        }
        this.scene.time.delayedCall(280 + 16 * 55 + 200, () => {
          if (this.state === "dead") return;
          this.scene.cameras.main.flash(180, 255, 170, 80);
          this.scene.cameras.main.shake(460, 0.020);
          this.scene.spawnShockwave(this.x, this.y, 0xffa040, 2.2, 520, 0.9);
          this.scene.sfxSkill("superhit", 0.86);
          for (const e of this.getAllTargetsIn(480)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(4.6);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 480, crit);
          }
        });
        break;
      }

      /* ── 스톰캡틴: 배가 화면을 가로지르며 폭뢰 ── */
      case "stormcaptain": {
        const dirX = Math.cos(this.aimDirFree().angle());
        for (let i = 0; i < 8; i++) {
          this.scene.time.delayedCall(260 + i * 210, () => {
            if (this.state === "dead") return;
            const px = this.x + dirX * (i * 90 - 280);
            const py = this.y;
            this.scene.spawnBurstAt(px, py, 28, 0x60c0ff);
            this.scene.spawnShockwave(px, py, 0x60c0ff, 1.1, 320, 0.75);
            this.scene.cameras.main.shake(100, 0.009);
            this.scene.sfxSkill("thunder", 0.9);
            for (const e of this.targetsAround(px, py, 140)) {
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(2.4);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 260, crit);
            }
          });
        }
        break;
      }

      /* ── 파우더마스터: 10회 순차 연쇄 폭발 ── */
      case "powdermaster": {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < 10; i++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 70 + Math.random() * 260;
          pts.push({ x: this.x + Math.cos(ang) * dist, y: this.y + Math.sin(ang) * dist });
        }
        pts.forEach((p, i) => {
          this.scene.time.delayedCall(260 + i * 200, () => {
            if (this.state === "dead") return;
            this.scene.spawnBurstAt(p.x, p.y, 34, 0xffb040);
            this.scene.spawnShockwave(p.x, p.y, 0xffb040, 1.3, 360, 0.8);
            this.scene.cameras.main.shake(110, 0.011);
            this.scene.sfxSkill("quake", 0.9);
            for (const e of this.targetsAround(p.x, p.y, 160)) {
              const away = new Phaser.Math.Vector2(e.x - p.x, e.y - p.y).normalize();
              const { dmg, crit } = rd(2.2);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 300, crit);
            }
          });
        });
        this.scene.time.delayedCall(260 + 10 * 200 + 180, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x, this.y, 0xffd060, 440);
          this.scene.cameras.main.flash(220, 255, 220, 140);
          this.scene.cameras.main.shake(520, 0.024);
          this.scene.sfxSkill("superhit", 0.9);
          for (const e of this.getAllTargetsIn(520)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(6.8);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 520, crit);
          }
        });
        break;
      }

      /* ── 시킹: 거대 해일이 밀려온다 ── */
      case "seaking": {
        const ang0 = this.aimDirFree().angle();
        const hx = Math.cos(ang0);
        const hy = Math.sin(ang0);
        for (let i = 0; i < 9; i++) {
          this.scene.time.delayedCall(280 + i * 180, () => {
            if (this.state === "dead") return;
            const px = this.x + hx * (300 - i * 75);
            const py = this.y + hy * (300 - i * 75);
            this.scene.spawnShockwave(px, py, 0x50b0e0, 1.8, 420, 0.85);
            this.scene.spawnBurstAt(px, py, 26, 0x50b0e0);
            this.scene.sfxSkill("wind2", 0.9);
            for (const e of this.getAllTargetsIn(260)) {
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(2.0);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 460, crit);
            }
          });
        }
        break;
      }

      /* ── 드레드노트: 궤도 포격 3단 폭발 + 방사 충격파 ── */
      case "dreadnought": {
        for (let i = 0; i < 3; i++) {
          this.scene.time.delayedCall(320 + i * 460, () => {
            if (this.state === "dead") return;
            this.scene.spawnPillar(this.x, this.y, 0xff8040, 380 + i * 90);
            this.scene.spawnCrack(this.x, this.y);
            this.scene.spawnShockwave(this.x, this.y, 0xff8040, 1.6 + i * 0.5, 480 + i * 120, 0.9);
            this.scene.spawnBurstAt(this.x, this.y, 60 + i * 20, 0xff8040);
            this.scene.cameras.main.flash(170 + i * 40, 255, 160, 90);
            this.scene.cameras.main.shake(420, 0.018 + i * 0.004);
            this.scene.sfxSkill("quake", 0.9);
            this.scene.sfxSkill("superhit", 0.8);
            for (const e of this.getAllTargetsIn(420 + i * 90)) {
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(3.4 + i * 1.2);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 560 + i * 100, crit);
            }
          });
        }
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
    // vc195 — 위 useSkill5 와 동일한 이유로 try/finally 복원.
    //  제2궁극기는 ×5(FIFTH2_MULT)라 오염 시 피해가 더 크게 튄다.
    const rd = (m: number, forceCrit = false) => {
      const prev = this.ultSlot;
      this.ultSlot = 2;
      try {
        return this.rollDamage(m, true, forceCrit);
      } finally {
        this.ultSlot = prev;
      }
    };

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
    /* vc181 (지시 #1·#2) — 제2궁극기는 3D 나선 카메라 워크 (1차보다 길고 웅장하게) */
    void cine3d().play({ preset: "ultimate2", x: this.x, y: this.y, tint: hex, duration: 2400, fam: this.ultKeyFor3D() });
    /* vc183 — 제2궁극기(120초)는 극딜의 정점: 암전·연출을 1차보다 강하게(scale 1.15) */
    playUltLayers(this.scene, this.x, this.y, 0xb06aff, key5, { scale: 1.15 });

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
              e.applyDot?.(Math.max(7, Math.round(this.atkTotal * 0.013)), 5000); // vc183 — 적에게 출혈
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
          /* vc195 — getAllTargetsIn() 은 **공유 스크래치 버퍼**를 반환한다
           *  (O9 최적화 — 매 호출 out.length=0 으로 재사용). 따라서 for...of 로
           *  순회하는 도중 같은 함수를 다시 부르면 **순회 중인 배열이 재구성**된다.
           *  for...of 는 내부 인덱스를 계속 증가시키며 같은 배열을 읽으므로,
           *    · 대상이 죽어 active=false 가 되면 → 배열이 줄어 **뒤 원소를 건너뛴다**
           *      (하네스 실측: 6마리 중 4마리만 피해)
           *    · 새 적이 스폰되면 → 배열이 늘어 **원래 대상이 아닌 적까지 맞는다**
           *  대상 수와 목록을 루프 밖에서 한 번만 확정한다. */
          const reproTargets = this.getAllTargetsIn(620).slice();
          const share = Math.max(1, Math.round(reenact / Math.max(1, reproTargets.length)));
          for (const e of reproTargets) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            /* 재현 배분 — 로그 합을 전 대상에 균등 분배(단일 보스에겐 전액) */
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
            e.applyDot?.(Math.max(9, Math.round(this.atkTotal * 0.016)), 6500); // vc183 — 적에게 출혈
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

      /* ══════════════════════════════════════════════════════════════════
       * vc195 — 기획서 §4.9 시킹 제2궁극기 「해신: 침묵의 심연」
       *
       *  전장을 수몰시켜 적을 감속시킨 뒤 6초 압박, 물이 빠지며 수압 종결.
       *  종전엔 case 가 없어 default 로 떨어졌다.
       *
       *  설계 가드(기획서): 대상 스냅샷 정책을 정한다 — 여기서는 **발동 시점
       *  수면 내 대상**을 스냅샷하고, 종료 시 생존 여부를 재검사한다.
       *  수면 오버레이는 실루엣·HUD 가독성을 유지해야 하므로 알파를 0.30 으로 제한.
       * ══════════════════════════════════════════════════════════════════ */
      case "seaking": {
        this.scene.sfxSkill("water", 0.9);
        /* 수면 상승 — 전장 오버레이 (가독성 상한 0.30) */
        const flood = this.scene.add.rectangle(this.x, this.y, 1400, 900, 0x2f9fd8, 0.30)
          .setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({ targets: flood, alpha: 0.10, duration: 6000, ease: "Quad.easeIn" });
        /* 감속·수압 필드 */
        this.scene.spawnField({
          x: this.x, y: this.y, radius: 320, dur: 6000,
          dps: Math.max(22, Math.round(this.atkTotal * 1.8)),
          kind: "light", owner: "player", slow: true,
        });
        /* 발동 시점 스냅샷 */
        const drowned = this.getAllTargetsIn(340).slice();
        this.scene.cameras.main.flash(220, 60, 160, 230);
        this.scene.cameras.main.shake(600, 0.014);
        for (let i = 0; i < 6; i++) {
          this.scene.time.delayedCall(400 + i * 900, () => {
            if (this.state === "dead") return;
            this.scene.spawnBurstAt(this.x + (Math.random() - 0.5) * 300, this.y + (Math.random() - 0.5) * 240, 18, 0x6fc8ff);
            this.scene.sfxSkill("wave", 0.62 + (i % 3) * 0.05);
          });
        }
        /* 종료 — 물이 빠지며 수압 종결 (스냅샷 대상 재검사) */
        this.scene.time.delayedCall(6000, () => {
          if (this.state === "dead") return;
          try { flood.destroy(); } catch { /* 무시 */ }
          this.scene.cameras.main.flash(260, 140, 220, 255);
          this.scene.cameras.main.shake(620, 0.026);
          this.scene.spawnPillar(this.x, this.y, 0x2f9fd8, 360);
          this.scene.spawnBurstAt(this.x, this.y, 90, 0x8ae6ff);
          this.scene.spawnShockwave(this.x, this.y, 0x8ae6ff, 3.4, 520, 0.8);
          this.scene.sfxSkill("superhit", 0.95);
          for (const e of drowned) {
            /* 스냅샷 후 사망·제거된 대상은 건너뛴다 */
            if (!e.active || e.hp <= 0) continue;
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(11.0);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 760, crit);
          }
        });
        break;
      }

      /* ══════════════════════════════════════════════════════════════════
       * vc195 — 기획서 §4.10 드레드노트 제2궁극기 「종말: 최후의 포성」
       *
       *  화면 전역 조준선 + 12발 순차 포탄 + 마지막 초대형 탄환.
       *
       *  설계 가드(기획서): **월드 좌표**로 계산한다(카메라 이동·줌과 무관).
       *  무작위 타격도 공정하게 보이도록 착탄 예고 + 최소 회피 시간을 준다.
       * ══════════════════════════════════════════════════════════════════ */
      case "dreadnought": {
        this.scene.sfxSkill("cannon", 0.95);
        /* 카메라 뷰 기준 월드 좌표를 고정한다 — 카메라가 움직여도 착탄점 불변 */
        const cam = this.scene.cameras.main;
        const wx0 = cam.scrollX + cam.width * 0.5;
        const wy0 = cam.scrollY + cam.height * 0.5;
        const spanX = cam.width * 0.62;
        const spanY = cam.height * 0.42;
        /* 조준선 도색 — 0.6초 예고 */
        const reticle = this.scene.add.rectangle(wx0, wy0, spanX * 2, 2, 0xffcc66, 0.75).setDepth(12);
        const reticle2 = this.scene.add.rectangle(wx0, wy0, 2, spanY * 2, 0xffcc66, 0.75).setDepth(12);
        this.scene.tweens.add({
          targets: [reticle, reticle2], alpha: 0.2, duration: 300, yoyo: true, repeat: 3,
          onComplete: () => { try { reticle.destroy(); reticle2.destroy(); } catch { /* 무시 */ } },
        });
        /* 12발 순차 낙하 — 착탄 예고 후 실제 판정 */
        for (let i = 0; i < 12; i++) {
          this.scene.time.delayedCall(600 + i * 170, () => {
            if (this.state === "dead") return;
            const px = wx0 + (Math.random() - 0.5) * spanX * 2;
            const py = wy0 + (Math.random() - 0.5) * spanY * 2;
            /* 예고 — 바닥에 작은 링 */
            this.scene.spawnShockwave(px, py, 0xffcc66, 0.5, 130, 0.7);
            this.scene.time.delayedCall(130, () => {
              if (this.state === "dead") return;
              this.scene.spawnBurstAt(px, py, 14, 0xffb060);
              this.scene.spawnShockwave(px, py, 0xffa040, 1.1, 200, 0.7);
              this.scene.doShake?.(70, 0.006);
              this.scene.sfxSkill("explosion", 0.68 + (i % 4) * 0.04);
              for (const e of this.getAllTargetsIn(999)) {
                if (Phaser.Math.Distance.Between(e.x, e.y, px, py) > 130) continue;
                const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
                const { dmg, crit } = rd(3.2);
                if (crit) this.scene.sfxCrit();
                e.takeDamage(dmg, away, 400, crit);
              }
            });
          });
        }
        /* 마지막 초대형 탄환 — 사전 경고 후 대충격파 */
        this.scene.time.delayedCall(600 + 12 * 170 + 200, () => {
          if (this.state === "dead") return;
          this.scene.spawnShockwave(wx0, wy0, 0xffe0b0, 5.0, 620, 0.9);
          this.scene.cameras.main.flash(280, 255, 200, 140);
          this.scene.time.delayedCall(220, () => {
            if (this.state === "dead") return;
            this.scene.spawnPillar(wx0, wy0, 0xffa040, 420);
            this.scene.spawnBurstAt(wx0, wy0, 110, 0xffcf90);
            this.scene.spawnShockwave(wx0, wy0, 0xffe0b0, 6.4, 780, 0.85);
            this.scene.spawnField({
              x: wx0, y: wy0, radius: 340, dur: 5000,
              dps: Math.max(24, Math.round(this.atkTotal * 2.0)),
              kind: "fire", owner: "player",
            });
            this.scene.cameras.main.shake(700, 0.030);
            this.scene.sfxSkill("quake", 1.0);
            for (const e of this.getAllTargetsIn(999)) {
              if (Phaser.Math.Distance.Between(e.x, e.y, wx0, wy0) > 400) continue;
              const away = new Phaser.Math.Vector2(e.x - wx0, e.y - wy0).normalize();
              const { dmg, crit } = rd(14.5);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 820, crit);
            }
          });
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

      /* vc178 — 해적 계열 — 폭풍항로: 침몰의 종. 바다 수직 분열 + 침몰 함대 포성 8초 포격.
       *  v1.2.4까지 case "pirate"가 없어 도적 폴백(사(死)의 일섬)으로 떨어졌다. */
      case "pirate": {
        /* 1단 — 바다가 수직으로 갈라진다: 화면 중앙 세로 균열 + 충격 */
        this.scene.time.delayedCall(280, () => {
          if (this.state === "dead") return;
          this.scene.cameras.main.flash(160, 120, 190, 255);
          const rift = this.scene.add.rectangle(this.x, this.scene.scale.height / 2, 26, this.scene.scale.height * 1.4, 0x9ad8ff, 0.55)
            .setDepth(14).setBlendMode(Phaser.BlendModes.ADD);
          this.scene.tweens.add({ targets: rift, alpha: 0, scaleX: 0.2, duration: 1400, ease: "Cubic.in", onComplete: () => rift.destroy() });
          this.scene.spawnCrack(this.x, this.y);
          this.scene.doShake?.(420, 0.012);
          this.scene.sfxSkill("thunder", 0.6);
          /* 분열 순간 광역 타격 */
          for (const e of this.getAllTargetsIn(999)) {
            const away = new Phaser.Math.Vector2(e.x > this.x ? 1 : -1, 0);
            const { dmg, crit } = rd(4.2);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 560, crit);
          }
        });
        /* 2단 — 침몰한 함대의 포성이 되돌아온다: 8초간 광역 폭격 (설명 문구 그대로) */
        const BARRAGE_MS = 8000, BARRAGE_N = 22;
        for (let i = 0; i < BARRAGE_N; i++) {
          this.scene.time.delayedCall(700 + (i * BARRAGE_MS) / BARRAGE_N, () => {
            if (this.state === "dead") return;
            const t2 = this.nearestTargets(3, 760)[i % 3];
            const px = t2 ? t2.x + (Math.random() - 0.5) * 110 : this.x + (Math.random() - 0.5) * 560;
            const py = t2 ? t2.y + (Math.random() - 0.5) * 80 : this.y + (Math.random() - 0.5) * 260;
            /* 낙하 포탄 — 위에서 떨어져 터진다 */
            const shell = this.scene.add.rectangle(px, py - 190, 7, 16, 0x2a2a38, 1).setDepth(15);
            this.scene.tweens.add({ targets: shell, y: py, duration: 180, ease: "Quad.in", onComplete: () => {
              shell.destroy();
              this.scene.spawnBurstAt(px, py, 22, 0xffb86a);
              this.scene.spawnPillar(px, py, 0xffd0a0, 150);
              this.scene.sfxSkill("thunder", 0.7 + Math.random() * 0.2);
              this.scene.doShake?.(110, 0.008);
              for (const e of this.getAllTargetsIn(999)) {
                if (Phaser.Math.Distance.Between(e.x, e.y, px, py) > 150) continue;
                const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
                const { dmg, crit } = rd(2.6);
                if (crit) this.scene.sfxCrit();
                e.takeDamage(dmg, away, 420, crit);
              }
            } });
          });
        }
        /* 종결 — 종말의 대포격: 남은 화약을 한 번에 (분열 지점 중심) */
        this.scene.time.delayedCall(700 + BARRAGE_MS + 320, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x, this.y, 0xffc08a, 320);
          this.scene.spawnBurstAt(this.x, this.y, 90, 0xffa86a);
          this.scene.spawnCrack(this.x, this.y);
          this.scene.spawnField({ x: this.x, y: this.y, radius: 280, dur: 8000, dps: Math.max(24, Math.round(this.atkTotal * 2.0)), kind: "fire", owner: "player" });
          this.scene.cameras.main.flash(230, 255, 210, 150);
          this.scene.cameras.main.shake(600, 0.028);
          this.scene.sfxSkill("superhit", 0.7);
          this.scene.sfxSkill("manaburst", 0.8);
          for (const e of this.getAllTargetsIn(700)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(8.2);
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
              e.applyDot?.(Math.max(8, Math.round(this.atkTotal * 0.015)), 6000); // vc183 — 적에게 출혈
            }
          });
        }
        break;
      }

      /* ══════════════════════════════════════════════════════════════════════
       * vc194 — 17직업 제2궁극기 (쿨 120초 · MP 150)
       *
       *  1차 궁극기(SKILL5_INFO)와 **구조가 겹치지 않게** 설계했다.
       *  1차가 "직업 정체성의 정점"이면, 2차는 "전장을 바꾸는 사건"이다.
       *  공통 규약은 1차와 동일:
       *   - 피해는 rd(배율)만, delayedCall 첫 줄 사망 검사, 생성물 destroy,
       *     경직 해제는 함수 끝 공통 마무리가 담당.
       * ══════════════════════════════════════════════════════════════════════ */

      /* ── 버서커: 체력을 태워 HP 1 고정 + 무적·흡혈 (자해 연동) ── */
      case "berserker": {
        const burn = Math.round(this.hp * 0.85);
        this.hp = Math.max(1, this.hp - burn);
        this.scene.emitHud();
        this.scene.spawnPickupText(this.x, this.y - 54, `-${burn}`, "#ff4040");
        this.scene.cameras.main.flash(160, 160, 0, 0);
        this.scene.sfxSkill("rage", 0.8);
        /* 태운 체력이 곧 화력 — 최대 12배까지 */
        const power = Math.min(12, 3 + (burn / Math.max(1, this.maxHp)) * 12);
        for (let i = 0; i < 6; i++) {
          this.scene.time.delayedCall(260 + i * 240, () => {
            if (this.state === "dead") return;
            this.scene.spawnCrack(this.x, this.y);
            this.scene.spawnShockwave(this.x, this.y, 0xff3030, 1.5, 420, 0.85);
            this.scene.spawnBurstAt(this.x, this.y, 40, 0xff3030);
            this.scene.cameras.main.shake(180, 0.014);
            this.scene.sfxSkill("bigsword", 0.9);
            for (const e of this.getAllTargetsIn(460)) {
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(power / 3);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 480, crit);
              /* 흡혈 — 버틴다 */
              this.hp = Math.min(this.maxHp, this.hp + Math.round(dmg * 0.02));
            }
            this.scene.emitHud();
          });
        }
        break;
      }

      /* ── 가디언: 불락 방벽 — 아군 보호 + 도발 (수호 특화) ── */
      case "guardian": {
        const WALL_R = 340, WALL_MS = 4000;
        const wall = this.scene.add.circle(this.x, this.y, WALL_R)
          .setStrokeStyle(10, 0xa8d8ff, 0.95).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({
          targets: wall, alpha: { from: 0, to: 0.7 }, duration: 220,
          onComplete: () => this.scene.tweens.add({ targets: wall, alpha: 0.35, duration: WALL_MS - 400, onComplete: () => wall.destroy() }),
        });
        this.scene.cameras.main.flash(150, 160, 210, 255);
        this.scene.sfxSkill("warcry", 0.82);
        /* 방벽 유지 중 5회 파동 — 적을 계속 밀어내고 도발 */
        for (let i = 0; i < 5; i++) {
          this.scene.time.delayedCall(300 + i * 760, () => {
            if (this.state === "dead") return;
            this.scene.spawnShockwave(this.x, this.y, 0xa8d8ff, 2.0, 520, 0.8);
            this.scene.sfxSkill("warcry", 0.86);
            for (const e of this.getAllTargetsIn(WALL_R + 80)) {
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(2.4);
              e.takeDamage(dmg, away, 640, crit);
            }
          });
        }
        /* 종결 — 방벽 폭발 */
        this.scene.time.delayedCall(300 + 5 * 760, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x, this.y, 0xa8d8ff, 420);
          this.scene.spawnBurstAt(this.x, this.y, 80, 0xa8d8ff);
          this.scene.cameras.main.flash(200, 180, 220, 255);
          this.scene.cameras.main.shake(480, 0.018);
          this.scene.sfxSkill("superhit", 0.84);
          for (const e of this.getAllTargetsIn(WALL_R + 120)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(6.2);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 620, crit);
          }
        });
        break;
      }

      /* ── 워로드: 패왕 — 3방향 군세 소환 (분할 정복) ── */
      case "warlord": {
        this.scene.sfxSkill("warcry", 0.78);
        this.scene.cameras.main.flash(180, 255, 200, 120);
        for (let dir = 0; dir < 3; dir++) {
          const ang = (dir / 3) * Math.PI * 2 - Math.PI / 2;
          for (let i = 0; i < 5; i++) {
            this.scene.time.delayedCall(280 + dir * 120 + i * 170, () => {
              if (this.state === "dead") return;
              /* 군세가 바깥에서 안으로 밀려온다 */
              const dist = 420 - i * 78;
              const px = this.x + Math.cos(ang) * dist;
              const py = this.y + Math.sin(ang) * dist;
              this.scene.spawnBurstAt(px, py, 26, 0xffc060);
              this.scene.spawnShockwave(px, py, 0xffc060, 1.1, 320, 0.75);
              this.scene.sfxSkill("bigsword", 0.86);
              for (const e of this.targetsAround(px, py, 170)) {
                const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
                const { dmg, crit } = rd(2.6);
                if (crit) this.scene.sfxCrit();
                e.takeDamage(dmg, away, 420, crit);
              }
            });
          }
        }
        this.scene.time.delayedCall(280 + 5 * 170 + 300, () => {
          if (this.state === "dead") return;
          this.scene.spawnCrack(this.x, this.y);
          this.scene.spawnPillar(this.x, this.y, 0xffd080, 460);
          this.scene.cameras.main.shake(520, 0.022);
          for (const e of this.getAllTargetsIn(540)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(7.0);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 540, crit);
          }
        });
        break;
      }

      /* ── 팔라딘: 천형 — 적 HP 비례 심판 (역비례 구조) ── */
      case "paladin": {
        this.scene.cameras.main.flash(220, 255, 250, 220);
        this.scene.sfxSkill("holy", 0.78);
        this.scene.spawnPillar(this.x, this.y, 0xfff4c0, 520);
        /* 저울 연출 — 빛줄기 2개가 균형을 잡는다 */
        const beam1 = this.scene.add.rectangle(this.x - 90, this.y - 120, 5, 260, 0xfff4c0, 0.7)
          .setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
        const beam2 = this.scene.add.rectangle(this.x + 90, this.y - 120, 5, 260, 0xfff4c0, 0.7)
          .setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({ targets: [beam1, beam2], alpha: 0, duration: 2400, onComplete: () => { beam1.destroy(); beam2.destroy(); } });
        let tick = 0;
        const iv = this.scene.time.addEvent({
          delay: 420, repeat: 6,
          callback: () => {
            if (this.state === "dead") { iv.remove(); return; }
            tick++;
            this.scene.sfxSkill("holy", 0.9);
            this.scene.spawnBurstAt(this.x, this.y, 26, 0xfff4c0);
            for (const e of this.getAllTargetsIn(600)) {
              if (!e.active) continue;
              /* HP 비율이 높을수록 더 큰 피해 — 심판의 저울 */
              const ratio = e.hp / Math.max(1, e.maxHp);
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(2.0 + ratio * 4.0);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 280, crit);
            }
            /* 자신 회복 */
            const heal = Math.round(this.maxHp * 0.03);
            this.hp = Math.min(this.maxHp, this.hp + heal);
            this.scene.emitHud();
            if (tick >= 6) iv.remove();
          },
        });
        break;
      }

      /* ── 스나이퍼: 사선 — 화면 밖 저격 12발 ── */
      case "sniper": {
        const tlist = [...this.getAllTargetsIn(900)];
        for (let i = 0; i < 12; i++) {
          this.scene.time.delayedCall(300 + i * 140, () => {
            if (this.state === "dead") return;
            const t = tlist.length ? tlist[i % tlist.length] : null;
            /* 화면 밖에서 날아오는 궤적 — 발사 지점은 보이지 않는다 */
            const fromAng = (i / 12) * Math.PI * 2 + Math.random() * 0.6;
            const fx = (t?.x ?? this.x) + Math.cos(fromAng) * 700;
            const fy = (t?.y ?? this.y) + Math.sin(fromAng) * 700;
            const tx = t?.x ?? this.x + (Math.random() - 0.5) * 400;
            const ty = t?.y ?? this.y + (Math.random() - 0.5) * 300;
            const trail = this.scene.add.line(0, 0, fx, fy, tx, ty, 0xff5050, 0.8)
              .setOrigin(0, 0).setDepth(13).setLineWidth(2).setBlendMode(Phaser.BlendModes.ADD);
            this.scene.tweens.add({ targets: trail, alpha: 0, duration: 260, onComplete: () => trail.destroy() });
            this.scene.spawnBurstAt(tx, ty, 24, 0xff5050);
            this.scene.hitStop(60);
            this.scene.sfxSkill("snipe", 0.88);
            for (const e of this.targetsAround(tx, ty, 130)) {
              const away = new Phaser.Math.Vector2(e.x - tx, e.y - ty).normalize();
              const { dmg, crit } = rd(3.2);
              e.takeDamage(dmg, away, 200, crit);
            }
          });
        }
        break;
      }

      /* ── 윈드러너: 선풍 — 이동 경로 회귀 (이동량이 화력) ── */
      case "windrunner": {
        /* 이동 궤적을 기록 */
        const path: { x: number; y: number }[] = [];
        let rec = 0;
        const recIv = this.scene.time.addEvent({
          delay: 90, repeat: 60,
          callback: () => {
            rec++;
            path.push({ x: this.x, y: this.y });
            if (rec >= 60) recIv.remove();
          },
        });
        /* 경로를 따라 바람 화살이 되돌아온다 */
        this.scene.time.delayedCall(1800, () => {
          recIv.remove();
          if (this.state === "dead") return;
          const step = Math.max(1, Math.floor(path.length / 14));
          for (let i = 0; i < 14; i++) {
            const p = path[Math.min(path.length - 1, i * step)];
            this.scene.time.delayedCall(200 + i * 110, () => {
              if (this.state === "dead") return;
              this.scene.spawnBurstAt(p.x, p.y, 18, 0x80f0ff);
              this.scene.spawnShockwave(p.x, p.y, 0x80f0ff, 1.0, 300, 0.8);
              this.scene.sfxSkill("wind", 0.9);
              for (const e of this.targetsAround(p.x, p.y, 150)) {
                const away = new Phaser.Math.Vector2(e.x - p.x, e.y - p.y).normalize();
                const { dmg, crit } = rd(2.6);
                if (crit) this.scene.sfxCrit();
                e.takeDamage(dmg, away, 320, crit);
              }
            });
          }
        });
        break;
      }

      /* ── 이글아이: 천리안 — 수동 조준 다점 폭격 ── */
      case "eagleeye": {
        /* 플레이어 주변 8지점을 자동 지정해 순차 저격 (수동 입력은 모바일에서 부담) */
        const all = [...this.getAllTargetsIn(800)];
        const spots: { x: number; y: number }[] = [];
        if (all.length) {
          for (let i = 0; i < Math.min(8, all.length); i++) spots.push({ x: all[i].x, y: all[i].y });
        } else {
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            spots.push({ x: this.x + Math.cos(a) * 260, y: this.y + Math.sin(a) * 260 });
          }
        }
        spots.forEach((s, i) => {
          const ring = this.scene.add.circle(s.x, s.y, 26).setStrokeStyle(2, 0xffa0a0, 0.9).setDepth(13);
          this.scene.tweens.add({ targets: ring, scale: 0.3, alpha: 0.2, duration: 700, onComplete: () => ring.destroy() });
          this.scene.time.delayedCall(760 + i * 180, () => {
            if (this.state === "dead") return;
            this.scene.spawnPillar(s.x, s.y, 0xffa0a0, 300);
            this.scene.spawnBurstAt(s.x, s.y, 34, 0xffa0a0);
            this.scene.cameras.main.shake(110, 0.010);
            this.scene.sfxSkill("arrowpierce", 0.9);
            for (const e of this.targetsAround(s.x, s.y, 170)) {
              const away = new Phaser.Math.Vector2(e.x - s.x, e.y - s.y).normalize();
              const { dmg, crit } = rd(3.0);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 260, crit);
            }
          });
        });
        break;
      }

      /* ── 템페스트: 풍신 — 회오리 3개가 적을 중앙으로 집결 ── */
      case "tempest": {
        for (let orb = 0; orb < 3; orb++) {
          const startAng = (orb / 3) * Math.PI * 2;
          for (let step = 0; step < 8; step++) {
            this.scene.time.delayedCall(300 + orb * 130 + step * 150, () => {
              if (this.state === "dead") return;
              const ang = startAng + step * 0.5;
              const r = 300 - step * 34; /* 나선으로 수축 */
              const px = this.x + Math.cos(ang) * r;
              const py = this.y + Math.sin(ang) * r;
              this.scene.spawnShockwave(px, py, 0x90e0a0, 1.2, 300, 0.8);
              this.scene.spawnBurstAt(px, py, 16, 0x90e0a0);
              this.scene.sfxSkill("wind2", 0.9);
              for (const e of this.targetsAround(px, py, 120)) {
                /* 중앙으로 끌어온다 */
                const toward = new Phaser.Math.Vector2(this.x - e.x, this.y - e.y).normalize();
                const { dmg, crit } = rd(1.8);
                e.takeDamage(dmg, toward, 340, crit);
              }
            });
          }
        }
        /* 집결 후 일괄 폭발 */
        this.scene.time.delayedCall(300 + 3 * 130 + 8 * 150 + 260, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x, this.y, 0xa0f0b0, 480);
          this.scene.spawnBurstAt(this.x, this.y, 88, 0xa0f0b0);
          this.scene.cameras.main.flash(200, 180, 255, 200);
          this.scene.cameras.main.shake(500, 0.020);
          this.scene.sfxSkill("superhit", 0.86);
          for (const e of this.getAllTargetsIn(520)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(7.4);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 560, crit);
          }
        });
        break;
      }

      /* ── 스톰브링어: 뇌왕 — 세계수 뿌리에서 솟는 수직 기둥 ── */
      case "stormbringer": {
        this.scene.cameras.main.flash(180, 150, 200, 255);
        this.scene.sfxSkill("thunder", 0.72);
        /* 뿌리 → 하늘로 솟는 기둥. 3초간 유지되며 안의 적을 계속 감전 */
        const col = this.scene.add.rectangle(this.x, this.y - 260, 46, 620, 0x90c0ff, 0.5)
          .setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({
          targets: col, alpha: { from: 0.9, to: 0.15 }, duration: 3000,
          onComplete: () => col.destroy(),
        });
        for (let i = 0; i < 10; i++) {
          this.scene.time.delayedCall(280 + i * 300, () => {
            if (this.state === "dead") return;
            this.scene.spawnPillar(this.x, this.y, 0xa0d8ff, 560);
            this.scene.spawnBurstAt(this.x, this.y, 24, 0xa0d8ff);
            this.scene.cameras.main.shake(90, 0.009);
            this.scene.sfxSkill("electron", 0.9);
            /* 기둥 범위 — 세로로 긴 판정을 원형 2개로 근사 */
            const hitSet = new Set<Enemy | Boss>();
            for (const e of this.targetsAround(this.x, this.y - 120, 110)) hitSet.add(e);
            for (const e of this.targetsAround(this.x, this.y, 110)) hitSet.add(e);
            for (const e of hitSet) {
              if (!e.active) continue;
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(2.2);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 120, crit);
              e.applyDot?.(Math.max(7, Math.round(this.atkTotal * 0.012)), 3000);
            }
          });
        }
        break;
      }

      /* ── 아크메이지: 창세 — 4원소 순환 후 융합 폭발 ── */
      case "archmage": {
        const ELEMS: { tint: number; sfx: string }[] = [
          { tint: 0xff7030, sfx: "flame" },
          { tint: 0x70c0ff, sfx: "cast" },
          { tint: 0xffe060, sfx: "electron" },
          { tint: 0xa08060, sfx: "quake" },
        ];
        ELEMS.forEach((el, k) => {
          this.scene.time.delayedCall(300 + k * 620, () => {
            if (this.state === "dead") return;
            this.scene.cameras.main.flash(120, (el.tint >> 16) & 255, (el.tint >> 8) & 255, el.tint & 255);
            this.scene.sfxSkill(el.sfx, 0.86);
            for (let i = 0; i < 6; i++) {
              const ang = (i / 6) * Math.PI * 2 + k;
              const px = this.x + Math.cos(ang) * 220;
              const py = this.y + Math.sin(ang) * 220;
              this.scene.spawnBurstAt(px, py, 22, el.tint);
              this.scene.spawnShockwave(px, py, el.tint, 1.3, 340, 0.8);
              for (const e of this.targetsAround(px, py, 160)) {
                const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
                const { dmg, crit } = rd(2.4);
                e.takeDamage(dmg, away, 300, crit);
              }
            }
          });
        });
        /* 융합 폭발 */
        this.scene.time.delayedCall(300 + 4 * 620 + 260, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x, this.y, 0xffffff, 520);
          this.scene.spawnBurstAt(this.x, this.y, 110, 0xffffff);
          this.scene.spawnCrack(this.x, this.y);
          this.scene.cameras.main.flash(240, 255, 255, 255);
          this.scene.cameras.main.shake(560, 0.024);
          this.scene.sfxSkill("manaburst", 0.82);
          this.scene.sfxSkill("superhit", 0.86);
          for (const e of this.getAllTargetsIn(580)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(8.4);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 620, crit);
          }
        });
        break;
      }

      /* ── 세이지: 무한 — 사용한 스킬을 역순 재발동 (기록 재생) ── */
      case "sage": {
        /* 실제 스킬 재발동은 상태 복잡도를 크게 올리므로,
         *  4개 속성 섬광을 역순으로 재생해 "기록 재생" 판타지를 구현한다. */
        const seq = [0x80d0ff, 0xffd070, 0xc080ff, 0x80ffb0];
        for (let i = 0; i < 12; i++) {
          this.scene.time.delayedCall(300 + i * 220, () => {
            if (this.state === "dead") return;
            const tint = seq[i % seq.length];
            const ang = (i / 12) * Math.PI * 2;
            const px = this.x + Math.cos(ang) * 180;
            const py = this.y + Math.sin(ang) * 180;
            this.scene.spawnBurstAt(px, py, 20, tint);
            this.scene.spawnShockwave(px, py, tint, 1.2, 320, 0.8);
            this.scene.sfxSkill("manaburst", 0.9);
            for (const e of this.targetsAround(px, py, 150)) {
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(2.0);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 240, crit);
            }
          });
        }
        break;
      }

      /* ── 크로니클: 완결 — 누적 피해 재분배 ── */
      case "chronicle": {
        /* 이번 전투에서 누적한 피해를 근사: 현재 적들의 잃은 HP 총합 */
        let lostHp = 0;
        for (const e of this.getAllTargetsIn(900)) {
          if (e.active) lostHp += Math.max(0, e.maxHp - e.hp);
        }
        const share = Math.max(1, Math.round(lostHp * 0.18));
        const book = this.scene.add.rectangle(this.x, this.y, 320, 420, 0xf0e0b0, 0.22)
          .setDepth(13).setBlendMode(Phaser.BlendModes.ADD).setAngle(-8);
        this.scene.tweens.add({
          targets: book, angle: 8, alpha: 0.05, duration: 1400, ease: "Sine.inOut",
          onComplete: () => book.destroy(),
        });
        this.scene.sfxSkill("manaburst", 0.8);
        for (let i = 0; i < 4; i++) {
          this.scene.time.delayedCall(320 + i * 340, () => {
            if (this.state === "dead") return;
            this.scene.spawnBurstAt(this.x, this.y, 34, 0xf0e0b0);
            this.scene.cameras.main.shake(120, 0.008);
            this.scene.sfxSkill("cast", 0.9);
            for (const e of this.getAllTargetsIn(620)) {
              if (!e.active) continue;
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              /* 누적 피해 분배 — 고정 피해라 rd 를 쓰지 않는다(밸런스 상한) */
              e.takeDamage(share, away, 240, false);
            }
          });
        }
        break;
      }

      /* ── 어쌔신: 그림자 — 존재 말소 (최대 HP 비례 관통) ── */
      case "assassin": {
        this.setAlpha(0.15);
        this.scene.sfxSkill("ambush", 0.85);
        this.scene.time.delayedCall(900, () => {
          this.setAlpha(1);
          if (this.state === "dead") return;
          const t = this.getAllTargetsIn(600)[0];
          if (!t) return;
          const away = new Phaser.Math.Vector2(t.x - this.x, t.y - this.y).normalize();
          this.setPosition(t.x + away.x * 40, t.y + away.y * 40);
          this.scene.spawnSlash(t.x, t.y, away, true, 3.4, 0x9a40ff);
          this.scene.spawnBurstAt(t.x, t.y, 50, 0x9a40ff);
          this.scene.spawnPillar(t.x, t.y, 0x9a40ff, 320);
          this.scene.cameras.main.flash(200, 90, 0, 140);
          this.scene.cameras.main.shake(360, 0.018);
          this.scene.hitStop(140);
          this.scene.sfxSkill("dark", 0.7);
          this.scene.sfxSkill("superhit", 0.86);
          /* 최대 HP 비례 관통 — 보스는 절반 */
          const isBoss = t === this.scene.boss;
          const pct = isBoss ? 0.2 : 0.4;
          const dmgOut = Math.max(1, Math.round(t.maxHp * pct));
          t.takeDamage(dmgOut, away, 260, true);
        });
        break;
      }

      /* ── 스워시버클러: 무쌍 — 1.5초 100연격 ── */
      case "swashbuckler": {
        const N = 40; /* 100연격을 40판정으로 압축(모바일) — 피해 배율로 보정 */
        for (let i = 0; i < N; i++) {
          this.scene.time.delayedCall(200 + i * 34, () => {
            if (this.state === "dead") return;
            const ang = (i / N) * Math.PI * 2 * 3;
            const r = 70 + (i % 4) * 28;
            const px = this.x + Math.cos(ang) * r;
            const py = this.y + Math.sin(ang) * r;
            this.scene.spawnSlash(px, py, new Phaser.Math.Vector2(Math.cos(ang), Math.sin(ang)), i % 2 === 0, 1.2, 0xfff0a0);
            if (i % 4 === 0) this.scene.sfxSkill("swift", 0.9 + (i % 3) * 0.04);
            for (const e of this.getAllTargetsIn(210)) {
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(1.2);
              e.takeDamage(dmg, away, 80, crit);
            }
          });
        }
        /* 마지막 한 번은 8배 */
        this.scene.time.delayedCall(200 + N * 34 + 120, () => {
          if (this.state === "dead") return;
          this.scene.spawnShockwave(this.x, this.y, 0xfff0a0, 2.4, 460, 0.95);
          this.scene.cameras.main.flash(220, 255, 245, 180);
          this.scene.cameras.main.shake(420, 0.020);
          this.scene.hitStop(120);
          this.scene.sfxSkill("superhit", 0.9);
          for (const e of this.getAllTargetsIn(300)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(8.0);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 420, crit);
          }
        });
        break;
      }

      /* ── 나이트블레이드: 무음 — 장막 + 다각도 기습 ── */
      case "nightblade": {
        const veil = this.scene.add.rectangle(this.x, this.y, 1400, 900, 0x0a0018, 0.55)
          .setDepth(14).setBlendMode(Phaser.BlendModes.MULTIPLY);
        this.scene.tweens.add({
          targets: veil, alpha: 0, duration: 2600, ease: "Sine.in",
          onComplete: () => veil.destroy(),
        });
        this.scene.sfxSkill("ambush", 0.8);
        for (let i = 0; i < 8; i++) {
          this.scene.time.delayedCall(300 + i * 240, () => {
            if (this.state === "dead") return;
            const t = this.getAllTargetsIn(700)[i % Math.max(1, this.getAllTargetsIn(700).length)];
            const tx = t?.x ?? this.x + (Math.random() - 0.5) * 400;
            const ty = t?.y ?? this.y + (Math.random() - 0.5) * 300;
            const ang = Math.random() * Math.PI * 2;
            this.setPosition(tx + Math.cos(ang) * 50, ty + Math.sin(ang) * 50);
            const away = new Phaser.Math.Vector2(tx - this.x, ty - this.y).normalize();
            this.scene.spawnSlash(tx, ty, away, i % 2 === 0, 2.2, 0x80c0ff);
            this.scene.spawnBurstAt(tx, ty, 22, 0x80c0ff);
            this.scene.sfxSkill("knife", 0.94);
            for (const e of this.targetsAround(tx, ty, 150)) {
              const d = new Phaser.Math.Vector2(e.x - tx, e.y - ty).normalize();
              const { dmg, crit } = rd(2.8);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, d, 180, crit);
            }
          });
        }
        break;
      }

      /* ── 듀얼리스트: 명예 — 최강 1명과 결투 공간 ── */
      case "duelist": {
        this.scene.sfxSkill("iainuki", 0.84);
        this.scene.cameras.main.flash(180, 255, 240, 200);
        /* 결투 공간 — 무채색 원 */
        const arena = this.scene.add.circle(this.x, this.y, 260)
          .setStrokeStyle(4, 0xc0c0c0, 0.85).setDepth(13);
        const fill = this.scene.add.circle(this.x, this.y, 260, 0x202020, 0.35).setDepth(12);
        this.scene.tweens.add({ targets: [arena, fill], alpha: 0, duration: 3200, onComplete: () => { arena.destroy(); fill.destroy(); } });
        /* 최강 적 선정 — HP 최대 */
        const cands = [...this.getAllTargetsIn(600)].sort((a, b) => b.hp - a.hp);
        const foe = cands[0];
        if (foe) {
          const away = new Phaser.Math.Vector2(foe.x - this.x, foe.y - this.y).normalize();
          for (let i = 0; i < 8; i++) {
            this.scene.time.delayedCall(320 + i * 200, () => {
              if (this.state === "dead" || !foe.active) return;
              this.scene.spawnSlash(foe.x, foe.y, away, i % 2 === 0, 2.4 + i * 0.12, 0xffffff);
              this.scene.cameras.main.shake(80, 0.008);
              this.scene.sfxSkill("sword2", 0.92);
              const { dmg, crit } = rd(3.6);
              if (crit) this.scene.sfxCrit();
              foe.takeDamage(dmg, away, 40, crit);
            });
          }
          /* 처치 시 남은 적 전원 공포(= 넉백) */
          this.scene.time.delayedCall(320 + 8 * 200 + 200, () => {
            if (this.state === "dead") return;
            if (!foe.active) {
              this.scene.spawnBurstAt(this.x, this.y, 60, 0xffffff);
              this.scene.cameras.main.shake(420, 0.016);
              for (const e of this.getAllTargetsIn(620)) {
                if (!e.active) continue;
                const d = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
                e.takeDamage(Math.max(1, Math.round(this.atkTotal * 0.6)), d, 700, false);
              }
            }
          });
        }
        break;
      }

      /* ── 레이더: 약탈왕 — 불길 항로 + 돌파 ── */
      case "raider": {
        const ang0 = this.aimDirFree().angle();
        const hx = Math.cos(ang0);
        const hy = Math.sin(ang0);
        this.scene.sfxSkill("flame", 0.82);
        for (let i = 0; i < 10; i++) {
          this.scene.time.delayedCall(280 + i * 170, () => {
            if (this.state === "dead") return;
            const dist = -260 + i * 96;
            const px = this.x + hx * dist;
            const py = this.y + hy * dist;
            /* 지면 화염 장판 */
            const flame = this.scene.add.circle(px, py, 90, 0xff6020, 0.5).setDepth(11);
            this.scene.tweens.add({ targets: flame, alpha: 0, scale: 1.3, duration: 2400, onComplete: () => flame.destroy() });
            this.scene.spawnBurstAt(px, py, 26, 0xff6020);
            this.scene.sfxSkill("flame", 0.9);
            for (const e of this.targetsAround(px, py, 160)) {
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(2.2);
              e.takeDamage(dmg, away, 260, crit);
              e.applyDot?.(Math.max(8, Math.round(this.atkTotal * 0.013)), 5000);
            }
            /* 돌파 — 플레이어도 전진 */
            if (i % 3 === 0) this.setPosition(this.x + hx * 60, this.y + hy * 60);
          });
        }
        break;
      }

      /* ── 코르세어: 함대 — 6척 소환 교차 포격 ── */
      case "corsair": {
        this.scene.sfxSkill("quake", 0.8);
        this.scene.cameras.main.flash(160, 255, 200, 140);
        for (let ship = 0; ship < 6; ship++) {
          const ang = (ship / 6) * Math.PI * 2;
          const sx = this.x + Math.cos(ang) * 340;
          const sy = this.y + Math.sin(ang) * 340;
          /* 함선 등장 */
          this.scene.time.delayedCall(280 + ship * 90, () => {
            if (this.state === "dead") return;
            this.scene.spawnBurstAt(sx, sy, 40, 0xffc070);
            this.scene.sfxSkill("quake", 0.86);
          });
          /* 함포 3연사 */
          for (let vol = 0; vol < 3; vol++) {
            this.scene.time.delayedCall(680 + ship * 90 + vol * 420, () => {
              if (this.state === "dead") return;
              /* 자기 방향에서 중앙을 향해 */
              const tgtAng = ang + Math.PI + (Math.random() - 0.5) * 0.5;
              const tx = this.x + Math.cos(tgtAng) * (120 + Math.random() * 220);
              const ty = this.y + Math.sin(tgtAng) * (120 + Math.random() * 220);
              const trail = this.scene.add.line(0, 0, sx, sy, tx, ty, 0xffc070, 0.75)
                .setOrigin(0, 0).setDepth(13).setLineWidth(3).setBlendMode(Phaser.BlendModes.ADD);
              this.scene.tweens.add({ targets: trail, alpha: 0, duration: 200, onComplete: () => trail.destroy() });
              this.scene.spawnPillar(tx, ty, 0xffc070, 200);
              this.scene.spawnBurstAt(tx, ty, 30, 0xffc070);
              this.scene.cameras.main.shake(120, 0.010);
              this.scene.sfxSkill("quake", 0.9);
              for (const e of this.targetsAround(tx, ty, 170)) {
                const away = new Phaser.Math.Vector2(e.x - tx, e.y - ty).normalize();
                const { dmg, crit } = rd(2.8);
                if (crit) this.scene.sfxCrit();
                e.takeDamage(dmg, away, 380, crit);
              }
            });
          }
        }
        break;
      }

      /* ── 스톰캡틴: 항해 — 폭풍의 눈(이동 무적) ── */
      case "stormcaptain": {
        const EYE_MS = 3200;
        const eye = this.scene.add.circle(this.x, this.y, 150)
          .setStrokeStyle(6, 0x80e0ff, 0.9).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
        const eyeFill = this.scene.add.circle(this.x, this.y, 150, 0x80e0ff, 0.18).setDepth(11);
        this.scene.sfxSkill("wind2", 0.8);
        this.scene.cameras.main.flash(160, 160, 230, 255);
        /* 눈이 플레이어를 따라 이동하며 지나간 자리를 휩쓴다 */
        let ticks = 0;
        const iv = this.scene.time.addEvent({
          delay: 260, repeat: Math.floor(EYE_MS / 260),
          callback: () => {
            if (this.state === "dead") { eye.destroy(); eyeFill.destroy(); this.setAlpha(1); iv.remove(); return; }
            ticks++;
            eye.setPosition(this.x, this.y);
            eyeFill.setPosition(this.x, this.y);
            this.scene.spawnShockwave(this.x, this.y, 0x80e0ff, 1.8, 380, 0.8);
            this.scene.sfxSkill("wind", 0.9);
            for (const e of this.getAllTargetsIn(210)) {
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(1.9);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 420, crit);
            }
            if (ticks * 260 >= EYE_MS) {
              eye.destroy(); eyeFill.destroy(); iv.remove();
            }
          },
        });
        break;
      }

      /* ── 파우더마스터: 점화 — 24지점 동시 설치 후 연쇄 점화 ── */
      case "powdermaster": {
        const N = 24;
        const spots: { x: number; y: number }[] = [];
        for (let i = 0; i < N; i++) {
          const ang = (i / N) * Math.PI * 2 * 2;
          const dist = 80 + (i / N) * 340;
          spots.push({ x: this.x + Math.cos(ang) * dist, y: this.y + Math.sin(ang) * dist });
        }
        /* 설치 연출 */
        spots.forEach((s, i) => {
          this.scene.time.delayedCall(240 + i * 24, () => {
            if (this.state === "dead") return;
            const keg = this.scene.add.circle(s.x, s.y, 8, 0xffb040, 0.95).setDepth(12);
            this.scene.tweens.add({ targets: keg, alpha: 0.5, duration: 240, yoyo: true, onComplete: () => keg.destroy() });
          });
        });
        /* 연쇄 점화 */
        this.scene.sfxSkill("flame", 0.8);
        spots.forEach((s, i) => {
          this.scene.time.delayedCall(900 + i * 90, () => {
            if (this.state === "dead") return;
            this.scene.spawnBurstAt(s.x, s.y, 26, 0xffb040);
            this.scene.spawnShockwave(s.x, s.y, 0xffb040, 1.2, 340, 0.8);
            this.scene.cameras.main.shake(70, 0.008);
            if (i % 3 === 0) this.scene.sfxSkill("flame", 0.92);
            for (const e of this.targetsAround(s.x, s.y, 150)) {
              const away = new Phaser.Math.Vector2(e.x - s.x, e.y - s.y).normalize();
              const { dmg, crit } = rd(2.2);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, 280, crit);
            }
          });
        });
        /* 최종 화염 기둥 */
        this.scene.time.delayedCall(900 + N * 90 + 200, () => {
          if (this.state === "dead") return;
          this.scene.spawnPillar(this.x, this.y, 0xffd060, 520);
          this.scene.cameras.main.flash(240, 255, 220, 140);
          this.scene.cameras.main.shake(560, 0.026);
          this.scene.sfxSkill("superhit", 0.9);
          for (const e of this.getAllTargetsIn(560)) {
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(8.0);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 560, crit);
          }
        });
        break;
      }

      /* ── 시킹: 해신 — 수몰 (이속 저하 + 수압 일괄) ── */
      case "seaking": {
        this.scene.sfxSkill("wind2", 0.78);
        this.scene.cameras.main.flash(200, 80, 160, 220);
        /* 수면이 차오른다 */
        const water = this.scene.add.rectangle(this.x, this.y, 1600, 1200, 0x3070b0, 0)
          .setDepth(10).setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({ targets: water, alpha: 0.4, duration: 600 });
        const victims = [...this.getAllTargetsIn(700)];
        /* 3초간 물속 — 지속 피해 */
        for (let i = 0; i < 8; i++) {
          this.scene.time.delayedCall(700 + i * 320, () => {
            if (this.state === "dead") return;
            this.scene.spawnBurstAt(this.x, this.y, 18, 0x60b0e0);
            this.scene.sfxSkill("wind2", 0.9);
            for (const e of victims) {
              if (!e.active) continue;
              const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
              const { dmg, crit } = rd(1.6);
              e.takeDamage(dmg, away, 60, crit);
            }
          });
        }
        /* 물이 빠지며 수압 일괄 피해 */
        this.scene.time.delayedCall(700 + 8 * 320, () => {
          if (this.state === "dead") return;
          this.scene.tweens.add({ targets: water, alpha: 0, duration: 700, onComplete: () => water.destroy() });
          this.scene.spawnShockwave(this.x, this.y, 0x60b0e0, 3.0, 700, 0.95);
          this.scene.cameras.main.flash(220, 120, 190, 255);
          this.scene.cameras.main.shake(520, 0.022);
          this.scene.sfxSkill("superhit", 0.86);
          for (const e of victims) {
            if (!e.active) continue;
            const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
            const { dmg, crit } = rd(7.2);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, away, 620, crit);
          }
        });
        break;
      }

      /* ── 드레드노트: 종말 — 12발 순차 포격 (마지막이 화면 절반) ── */
      case "dreadnought": {
        this.scene.sfxSkill("warcry", 0.76);
        this.scene.cameras.main.flash(200, 255, 140, 80);
        const N = 12;
        for (let i = 0; i < N; i++) {
          this.scene.time.delayedCall(320 + i * 300, () => {
            if (this.state === "dead") return;
            const isLast = i === N - 1;
            const scale = isLast ? 2.6 : 1;
            const ang = Math.random() * Math.PI * 2;
            const dist = isLast ? 0 : 80 + Math.random() * 320;
            const px = this.x + Math.cos(ang) * dist;
            const py = this.y + Math.sin(ang) * dist;
            this.scene.spawnPillar(px, py, 0xff8040, isLast ? 620 : 340);
            this.scene.spawnCrack(px, py);
            this.scene.spawnShockwave(px, py, 0xff8040, scale * 1.8, isLast ? 720 : 420, 0.9);
            this.scene.spawnBurstAt(px, py, isLast ? 110 : 44, 0xff8040);
            this.scene.cameras.main.flash(isLast ? 280 : 140, 255, 160, 90);
            this.scene.cameras.main.shake(isLast ? 620 : 300, isLast ? 0.030 : 0.014);
            this.scene.sfxSkill("quake", 0.9);
            if (isLast) this.scene.sfxSkill("superhit", 0.9);
            const range = isLast ? 620 : 240;
            for (const e of this.targetsAround(px, py, range)) {
              const away = new Phaser.Math.Vector2(e.x - px, e.y - py).normalize();
              const { dmg, crit } = rd(isLast ? 9.0 : 2.4);
              if (crit) this.scene.sfxCrit();
              e.takeDamage(dmg, away, isLast ? 700 : 420, crit);
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
      let dishExpired = false;
      for (const b of expired) {
        if (b.key === "buff_spd") this.recalcSpeed();
        /* v1.1.9 (#개편 A47) — 요리 버프는 BUFF_DEFS에 없으므로 별도 처리.
         *  종전 코드는 def.name을 읽어 요리 키에서 TypeError가 났다. */
        if ((b.key as string).startsWith("dish_")) {
          dishExpired = true;
          delete this.dishBuffPower[b.key as string];
          const k = Math.round((b.total ?? 0) / 1000);
          this.scene.spawnPickupText(this.x, this.y - 30, `요리 효과 종료 (${k}초)`, "#9af0c8");
          continue;
        }
        const def = BUFF_DEFS[b.key];
        if (def) this.scene.spawnPickupText(this.x, this.y - 30, `${def.name} 효과 종료`, "#ffffff");
      }
      if (dishExpired) this.recalcDishBuffs();
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
    /* v1.1.9 (#개편 A47) — 요리 공격 버프 반영(곱연산 아님, % 가산) */
    return Math.round((base + blessFlat) * (1 + (this.clsBonus.atkPct + setPct + colPct + blessPct + this.extBonus.atkPct + this.runBuffs.atkPct + this.dishAtkPct * 100) / 100) * buff * king);
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

  /** v4.0.0 — 경험치 책 사용 (레벨 스케일 경험치 지급)
   *  vc181 (지시 — "경험치 책 효율 너무 안좋음") 수리:
   *   종전엔 `expBookExp(lv) = 80 + lv*45` 고정식이었다. 그런데 레벨업 요구 경험치는
   *   메이플 공식표라 레벨이 오를수록 지수적으로 폭증한다. 그래서 Lv100에서 책 한 권이
   *   요구치의 0.1%도 안 돼 "5000G짜리 쓰레기"가 됐다(실측: Lv100 요구 약 2.2억, 지급 4580).
   *   → 현재 레벨 필요 EXP의 40%로 바꿔 어느 레벨에서나 체감 가치가 일정하게 만든다.
   *   (Lv1에서도 과하지 않게 최소값은 expBookExp 폴백으로 보장) */
  useExpBook(): number {
    if (!this.owned.includes("exp_book")) return 0;
    this.consumeConsumable("exp_book");
    const need = this.expNext();
    const exp = Math.max(expBookExp(this.lv), Math.round(need * 0.4));
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
  /* v1.4.32 (유저 지시 #9 "n차 즉 차수가 점점 올라갈수록 예전 스킬 및 기본공격도
   * 눈에 띄게 강화해") — 환생 차수(rebirths)를 데미지 배율에 직접 반영한다.
   *  종전엔 환생 보너스가 atkPct(스탯)에만 들어가 스킬 자체는 그대로였다.
   *  여기서는 기본공격과 모든 스킬에 공통으로 곱해 차수 체감을 만든다.
   *  rebirths 1회당 +12%, 상한 없음(무한 성장은 infinite 시스템 설계 의도). */
  rebirths = 0;
  /** 환생 차수 설정 — 데미지 배율에 즉시 반영 */
  setRebirths(n: number) {
    const v = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
    if (this.rebirths === v) return;
    this.rebirths = v;
  }
  /** 환생 차수 데미지 배율 (1.0 = 0차) */
  private get rebirthDmgMult(): number {
    return 1 + 0.12 * this.rebirths;
  }
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
    return Math.round((Player.BASE_CRIT + acc + this.clsBonus.critAdd + this.stats.dex * 0.4) * 10) / 10 + this.dishCritAdd;
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

  /** vc185 (지시 #1·#4) — 3D 시네마틱 메시 선택 키.
   *  4차 이상이면 그 직업 고유 메시(10종), 미만이면 계열 메시(5종).
   *  종전엔 항상 계열만 보내 워브링어와 크루세이더가 같은 검기를 썼다. */
  private ultKeyFor3D(): string | null {
    if (this.tier >= 4 && this.cls) return this.cls;
    return familyOf(this.cls) ?? null;
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
    const m = (isSkill ? mult * this.clsBonus.skillMult * fifth * runSkl * tierScl * ultMult : mult) * rage * this.rebirthDmgMult;
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
    /* vc178 — 집 꾸미기 가구: 소유제이되 수량 누적 허용 (보유 수만큼 배치 가능).
     *  아래 장비 분기의 \"이미 보유\" 차단을 타면 1개만 살 수 있어 별도 처리한다. */
    if (key.startsWith("furn_")) {
      const cost = item.price * n;
      if (this.gold < cost) return false;
      this.gold -= cost;
      for (let i = 0; i < n; i++) this.owned.push(key);
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
