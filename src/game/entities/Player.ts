import Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import {
  ITEMS, BUFF_DEFS, PET_DEFS, COSMETIC_DEFS, UPGRADE_MAX, UPGRADE_RATES, UPGRADE_FALLBACK_FROM, upgradeCost, sellValue, type BuffKey as BuffKeyT,
  starWeaponBonus, starArmorBonus, STAR_MILESTONES,
  TRADE_PRICES, tradeValue, STAR_BLESS_RATE, STAR_BLESS_MAX, starAccBonus,
  sumPotLines, FAMILY_ELEM, rollPotentials, activeSetBonus, collectionBonus,
  type ItemKey, type BuffKey, type PetKey, type CosmeticKey, type ElemKey, type Potentials,
} from "../data";
import {
  classDef, isClassKey, bonusOf, nextTierOf, freeJobOption, familyOf, chainOf,
  resolveSkill1Of, resolveSkill2Of,
  type ClassKey, type ClassBonus, SKILL_LABELS, SKILL3_KIND, SKILL4_KIND,
  type Skill1Kind, type Skill2Kind, type Skill3Kind, type Skill4Kind,
} from "../classes";
import { sweptHitsTarget } from "../collision/sweep";
import * as audio from "../audio";
import type { Enemy } from "./Enemy";
import type { Boss } from "./Boss";

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
  upgrades: { weapon: number; armor: number } = { weapon: 0, armor: 0 }; // 강화 단계 (+0~+5)
  /** v3.0.7 — 장신구 스타포스 (itemKey → 성 0~15) — 장착/미장착 무관 보유 단위 유지 */
  accUp: Record<string, number> = {};
  /** v3.0.7 — 강화 주문서 충전 수 (다음 강화 성공률 +15%p/장, 최대 3) */
  starBless = 0;
  /** 전직 클래스 (v1.8 다차원 트리 — 1차/2차/3차 키, 미전직 null) */
  cls: ClassKey | null = null;
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

  /** 기본 크리티컬 확률 (%) — 장신구로 증가 */
  private static readonly BASE_CRIT = 8;
  private static readonly CRIT_MULT = 1.7;
  /* v3.0.6 (지시 #4 — 그림자 숨기) — 다음 기본공격 강화 플래그 */
  nextAtkEmpowered = false;
  /* v3.0.6 (지시 #5) — 자동 물약/자동 버프 설정 (hpPct 0=끝, mpOn, 버프 키 목록) */
  autoUse: { hpPct: number; mpOn: boolean; buffs: BuffKey[] } = { hpPct: 0, mpOn: false, buffs: [] };
  private autoBuffAcc = 0;
  /** v3.0.6 (지시 #8) — 보스 공격 방어 관통률 (Boss.takeDamage 호출 시 true) */
  bossPierceHit = false;

  speed = 300;
  /** 이동 기본값 — 클래스 속도 보너스는 이 값에 배율 (recalcSpeed)
   *  v3.0.16 — 230→265 (+15%)
   *  v3.0.18 — 265→300 (+13%): "이속이 ㅈㄴ 느림" 재피드백. 최속 적(150)의 2배로
   *  카이팅 여유 확대 + 공격 중 감삭 0.8→0.92로 전투 중 체감 속도 동반 상향 */
  static readonly BASE_SPEED = 300;
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
  readonly skill3Max = 9000;
  readonly skill4Max = 14000;
  get skill3MaxEff(): number {
    return Math.round(this.skill3Max * this.clsBonus.cdMult);
  }
  get skill4MaxEff(): number {
    return Math.round(this.skill4Max * this.clsBonus.cdMult);
  }
  /** 3차기 해금 — 3차 전직부터 (스킬 3개) */
  get skill3Unlocked(): boolean {
    return this.tier >= 3 && !!SKILL3_KIND[this.cls ?? ""];
  }
  /** 4차기 해금 — 4차 각성부터 (스킬 4개) */
  get skill4Unlocked(): boolean {
    return this.tier >= 4 && !!SKILL4_KIND[this.cls ?? ""];
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
  /** 클래스 cdMult 반영 실효 쿨다운 */
  get skill1MaxEff(): number {
    return Math.round(this.skill1Max * this.clsBonus.cdMult);
  }
  get skill2MaxEff(): number {
    return Math.round(this.skill2Max * this.clsBonus.cdMult);
  }
  private mpRegenAcc = 0;

  private iframes = 0;
  private dashTime = 0;
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
    this.play("hero-idle");
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
        const key = horiz ? "hero-walk-side" : this.dashDir.y > 0 ? "hero-walk" : "hero-walk-up";
        if (horiz) this.setFlipX(this.dashDir.x > 0); // v3.0.10 — 시트 왼쪽 기준
        if (!this.anims.isPlaying || this.anims.currentAnim?.key !== key) this.play(key);
      }
      if (this.dashTime <= 0) {
        this.state = "idle";
        this.setVelocity(0, 0);
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
        const key = horiz ? "hero-walk-side" : move.y > 0 ? "hero-walk" : "hero-walk-up";
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
        let tex = "hero_idle0"; // 기본: 정면 (아래쪽 바라볼 때/초기)
        if (Math.abs(f.x) >= Math.abs(f.y) && f.x !== 0) {
          this.setFlipX(f.x > 0); // v3.0.10 — 측면 시트는 왼쪽 기준
          tex = "hero_walkside0";
        } else if (f.y < 0) {
          tex = "hero_walkup0"; // 위쪽 — 뒷모습 서있기
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
          const key = horiz ? "hero-walk-side" : this.facing.y > 0 ? "hero-walk" : "hero-walk-up";
          if (!this.anims.isPlaying || this.anims.currentAnim?.key !== key) this.play(key); // v3.0.2 — 동일 버그
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

  /** 참격 (미전직 + 전사 공용 뼈대) — 전사는 2연타·확대 판정·강화 배율
   *  v3.0.6 (지시 #3 — 전직마다 기본공격 강화): 2차+ 3연타 / 3차+ 마지막 타 검기 파동 / 4차+ 대형 파동+출혈 */
  private atkSlash(dir: Phaser.Math.Vector2) {
    const fam = familyOf(this.cls);
    const warrior = fam === "warrior";
    const t = this.tier;
    const empowered = this.nextAtkEmpowered; // v3.0.6 — 그림자 숨기 강화 소모
    this.nextAtkEmpowered = false;
    const dmgMul = (warrior ? 1.1 : 1.0) + 0.05 * t + (empowered ? 0.5 : 0);
    const reach = warrior ? 176 : 160; // 전사 — 전방 판정 확대
    const knock = warrior ? 320 : 280;

    // 실제 방향별 베기 프레임 (측면/위/아래 4프레임 스윙)
    const atkKey = dir.y > 0 ? "hero-atk-down" : dir.y < 0 ? "hero-atk-up" : "hero-atk";
    this.setFlipX(dir.y === 0 && dir.x > 0); // v3.0.10 — 측면 시트는 왼쪽 기준
    this.play(atkKey);
    // v3.0.2 — 도적(단검)은 참격 검기를 보라색으로 (무기 정체성)
    const thiefTint = fam === "thief" ? 0xc08aff : undefined;

    // 베기 타이밍: 65ms 후 판정+참격 스윕 (모션 2프레임 시점)
    this.scene.time.delayedCall(65, () => {
      if (this.state !== "attack") return;
      this.swingDone = true;
      this.scene.spawnSlash(this.x, this.y, dir, this.slashAlt, warrior ? 1.15 : 1, thiefTint);
      this.scene.sfxSwing();
      // 참격 판정 확대 — 전방 160px x 폭 116px (사용자 지시: 히트박스 크게)
      this.checkMeleeHit(dir, reach, 116, dmgMul, knock);
    });

    /* v3.0.6 (지시 #3 — 전직마다 기본공격 강화) 티어 래더:
     *  미전직 1타 → 1차+ 2연타 → 2차+ 3연타 → 3차+ 마지막 타 검기 파동 → 4차 대형 파동 */
    if (t >= 1) {
      this.scene.time.delayedCall(195, () => {
        if (this.state !== "attack") return;
        this.scene.spawnSlash(this.x, this.y, dir, !this.slashAlt, 0.95, thiefTint);
        this.scene.sfxSwing();
        this.checkMeleeHit(dir, reach, 116, dmgMul * 0.8, knock * 0.8);
      });
    }
    if (t >= 2) {
      this.scene.time.delayedCall(300, () => {
        if (this.state !== "attack") return;
        this.scene.spawnSlash(this.x, this.y, dir, this.slashAlt, 0.9, thiefTint);
        this.scene.sfxSwing();
        this.checkMeleeHit(dir, reach, 116, dmgMul * 0.7, knock * 0.6);
        if (t >= 3) {
          // 검기 파동 — 관통 투사체 (3차: 관통 3 / 4차: 대형+관통 5)
          const angle = Math.atan2(dir.y, dir.x);
          const { dmg, crit } = this.rollDamage(0.9 + 0.1 * t, true);
          this.scene.firePlayerProj({
            x: this.x, y: this.y - 8,
            angle, speed: 520, pierce: t >= 4 ? 5 : 3, dmg, crit,
            tint: fam === "thief" ? 0xc08aff : 0xffb08a, knock: 220,
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
    const atkKey = dir.y > 0 ? "hero-atk-down" : dir.y < 0 ? "hero-atk-up" : "hero-atk";
    this.setFlipX(dir.y === 0 && dir.x > 0);
    this.play(atkKey);
    const angle0 = Math.atan2(dir.y, dir.x);
    this.scene.spawnBow(this.x + dir.x * 10, this.y - 8, angle0);

    const t = this.tier;
    const empowered = this.nextAtkEmpowered;
    this.nextAtkEmpowered = false;
    const shots = Math.max(1, t); // v3.0.15 (#4): N차 = N발
    const pierce = 1 + (t >= 2 ? 1 : 0);
    const deadeye = t >= 4;
    const arrowTex = deadeye ? "x2_arrow_green" : "x2_arrow"; // v3.0.16 — 데드아이 초록 화살
    const arrowTint = 0xffffff; // 텍스처 자체 색 사용 (초록 화살은 텍스처가 에메랄드)
    const trailHex = deadeye ? 0x53ff9a : t >= 2 ? this.clsHex() : 0xffd98a; // 잔상색: 4차 초록발광 / 2~3차 클래스색 / 그 외 골드
    const flashHex = deadeye ? 0x7dffb0 : t >= 2 ? this.clsHex() : 0xffe08a; // 머즐 플래시색
    const spread = 0.1 + 0.03 * t; // v3.0.16 — 부채꼴 확대 (1차 0.13°rad ~ 4차 0.22rad)

    const fireOne = (i: number) => {
      const { dmg, crit } = this.rollDamage(0.95 + 0.04 * t + (i === 0 && empowered ? 0.5 : 0), i > 0);
      if (crit) this.scene.sfxCrit();
      this.scene.firePlayerProj({
        x: this.x, y: this.y - 8,
        angle: angle0 + (shots > 1 ? (i - (shots - 1) / 2) * spread : 0),
        speed: 620 + Math.floor(Math.random() * 40) - 15, // 미세 속도 편차 — 화살비 유기적 느낌
        pierce, dmg, crit,
        tint: arrowTint, knock: 180, scale: 1.35 + 0.06 * t, // v3.0.15 (#15) 화살 크기 상향
        tex: arrowTex, blend: "normal", rot: true, // v3.0.16 — normal 블렌드: ADD는 밝은 배경에서 초록이 하얗게 씻김 (텍스처 자체가 에메랄드+발광 트레일)
        trail: trailHex, // v3.0.16 — 비행 잔상 (ADD 발광)
      });
      this.scene.spawnBurstAt(this.x + dir.x * 16, this.y - 8, 3, flashHex); // 머즐 플래시
    };

    this.scene.time.delayedCall(65, () => {
      if (this.state !== "attack") return;
      this.swingDone = true;
      this.scene.sfxSwing();
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
    const atkKey = dir.y > 0 ? "hero-atk-down" : dir.y < 0 ? "hero-atk-up" : "hero-atk";
    this.setFlipX(dir.y === 0 && dir.x > 0);
    this.play(atkKey);
    this.scene.spawnCast(this.x + dir.x * 12, this.y - 12);

    const t = this.tier;
    const empowered = this.nextAtkEmpowered;
    this.nextAtkEmpowered = false;
    const shots = Math.max(1, t); // v3.0.15 (#4): N차 = N발

    this.scene.time.delayedCall(65, () => {
      if (this.state !== "attack") return;
      this.swingDone = true;
      this.scene.sfxSwing();
      const angle = Math.atan2(dir.y, dir.x);
      for (let i = 0; i < shots; i++) {
        this.scene.time.delayedCall(i * 90, () => {
          if (this.state === "dead") return;
          const { dmg, crit } = this.rollDamage(1.0 + 0.04 * t + (i === 0 ? (empowered ? 0.5 : 0) : 0), true);
          this.scene.firePlayerProj({
            x: this.x, y: this.y - 10,
            angle: angle + (shots > 1 ? (i - (shots - 1) / 2) * 0.09 : 0),
            speed: 540, pierce: 2, dmg, crit,
            tint: 0xffffff, knock: 200, scale: 0.85 + 0.1 * t,
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
            tint: 0xffffff, knock: 150, scale: 0.85,
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
    const atkKey = dir.y > 0 ? "hero-atk-down" : dir.y < 0 ? "hero-atk-up" : "hero-atk";
    this.setFlipX(dir.y === 0 && dir.x > 0);
    this.play(atkKey);
    const t = this.tier;
    const empowered = this.nextAtkEmpowered;
    this.nextAtkEmpowered = false;
    this.scene.time.delayedCall(65, () => {
      if (this.state !== "attack") return;
      this.swingDone = true;
      this.scene.sfxSwing();
      const angle = Math.atan2(dir.y, dir.x);
      // v3.0.6 (지시 #3): 표창 발수 — 3차+ 2발 / 4차+ 3발 부채꼴
      const n = t >= 4 ? 3 : t >= 3 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const { dmg, crit } = this.rollDamage(1.05 + 0.05 * t + (i === 0 ? (empowered ? 0.5 : 0) : 0), true);
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

  /** 기본공격 이름 — 계열별 (HUD/터치 컨트롤 표기) */
  get attackName(): string {
    const t = this.tierLabels();
    if (t) return t[0];
    const fam = familyOf(this.cls);
    if (fam === "ranger") return "활쏘기";
    if (fam === "mage") return "마법탄";
    if (fam === "thief") return this.tier >= 1 ? "그림자 연타" : "단검 베기";
    if (fam === "warrior") return this.tier >= 1 ? "강화 참격" : "참격";
    return "참격";
  }

  /** 주력기(Z) 이름 — 계열별 */
  get skill1Name(): string {
    const t = this.tierLabels();
    if (t) return t[1];
    const fam = familyOf(this.cls);
    if (fam === "ranger") return "관통 화살";
    if (fam === "mage") return "매직 볼트";
    if (fam === "thief") return "그림자 회전베기";
    return "회전베기";
  }

  /** 기동기(C) 이름 — 계열별 */
  get skill2Name(): string {
    const t = this.tierLabels();
    if (t) return t[2];
    const fam = familyOf(this.cls);
    if (fam === "ranger") return "질풍 차지";
    if (fam === "mage") return "점멸";
    return "돌진베기";
  }

  /** v3.0.3 — 3차기(V) 이름 — 3차 클래스별 고유 스킬 (미해금 시 빈 문자열) */
  get skill3Name(): string {
    if (!this.skill3Unlocked) return "";
    const t = this.tierLabels();
    return t?.[3] || "";
  }

  /** v3.0.3 — 4차기(B) 이름 — 4차 클래스별 고유 스킬 (미해금 시 빈 문자열) */
  get skill4Name(): string {
    if (!this.skill4Unlocked) return "";
    const t = this.tierLabels();
    return t?.[4] || "";
  }

  /** 주력기(Z) — v3.0.6: 클래스 고유 메커니즘 12종 (겹침 0 — 지시 #4)
   *  3차/4차는 계열 체인에서 2차기 승계(강화판) — resolveSkill1Of */
  useSkill1() {
    if (this.state !== "idle" || this.skill1Cd > 0 || this.mp < 15) return;
    this.mp -= 15;
    this.skill1Cd = this.skill1MaxEff;
    this.state = "attack";
    this.hitSet.clear();
    this.setVelocity(0, 0);
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
    const t = this.tier; // 0(미전직)~4
    const dmgMul = 1.6 + 0.3 * t;
    const radius = 118 + 16 * t;
    this.scene.sfxSpin();

    // 회전 방향: 조준 측면 기준 (상하 조준 시 현재 플립 방향 따름)
    const aim = this.aimDir();
    /* v3.0.10 — flip 의미 반전(시트 왼쪽 기준)에 맞춰 회전 방향 부호도 반전 */
    const spin = aim.x !== 0 ? (aim.x > 0 ? 1 : -1) : this.flipX ? 1 : -1;
    const famHex = familyOf(this.cls) === "thief" ? 0xb98aff : 0xff9a8a;

    if (bleed) {
      /* ═══ 버서커 — 파괴의 회전베기 (전사 원판과 완전 별개 연출) ═══
       *  광전사 정체성: 서서 돌지 않고 전방으로 박면서 돈다. 붉은 광기가 몸을 감쌈. */
      const dir = aim.lengthSq() > 0.01 ? aim.clone().normalize() : new Phaser.Math.Vector2(this.flipX ? -1 : 1, 0);
      this.scene.spawnSpinSlash(this.x, this.y, spin);
      this.scene.spawnSpinSlash(this.x + dir.x * 52, this.y + dir.y * 52, -spin); // 전방 이중 참격판
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
      if (t >= 2) this.scene.spawnBurstAt(this.x, this.y, 10 + 3 * t, famHex);
      if (t >= 3) this.scene.spawnSpinSlash(this.x, this.y, -spin); // 이중 회전 잔상 (3차 강화)
    }

    // 몸통(스프라이트) 360° 회전 — 검 뻗은 공격 프레임을 돌려 휘두르는 동작
    this.play("hero-atk");
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
    const t = this.tier;
    const hex = this.clsHex();
    this.play("hero-atk");
    this.scene.sfxSpin();
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
            tex: "x2_arrow", blend: t >= 4 ? "add" : "normal", rot: true,
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
    this.play("hero-atk");
    this.scene.sfxSpin();
    this.scene.spawnCast(this.x + aim.x * 14, this.y - 12 + aim.y * 8); // v3.0.2 — 시전 이펙트
    const t = this.tier;
    if (t >= 4) this.scene.spawnPillar(this.x + aim.x * 14, this.y - 12 + aim.y * 8, 0xa5b9ff, 90); // 4차 강화 시전 이펙트
    const { dmg, crit } = this.rollDamage(2.0 + 0.35 * t, true);
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
    const t = this.tier;
    const count = 5 + (t >= 3 ? 2 : 0);
    const spread = 0.62; // 부채꼴 전체 각 (rad)
    this.play("hero-atk");
    this.scene.sfxSwing();
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
    const t = this.tier;
    const hex = this.clsHex();
    const atkKey = dir.y > 0 ? "hero-atk-down" : dir.y < 0 ? "hero-atk-up" : "hero-atk";
    this.play(atkKey);
    this.setFlipX(dir.y === 0 && dir.x > 0);
    this.scene.sfxSpin();
    this.scene.spawnSlash(this.x, this.y, dir, this.slashAlt, 1.5, hex);
    // 방어 버프 — 성벽 정체성 (전장의 함성 공격 버프와 별개 축)
    this.selfDefBuff = { add: 8 + 2 * t, until: this.scene.time.now + 6000 };
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
    const t = this.tier;
    const range = 560 + 40 * t;
    const halfW = t >= 4 ? 46 : 26;
    this.play("hero-atk");
    this.scene.sfxCrit(); // 샤프 저격음 — 기본 화살 sfxSwing과 구분
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
        const { dmg, crit } = this.rollDamage(2.4 + 0.25 * t, true);
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
    const t = this.tier;
    const hex = this.clsHex();
    this.play("hero-atk");
    this.scene.sfxSpin();
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
    const t = this.tier;
    const hex = this.clsHex();
    this.play("hero-atk");
    this.scene.sfxSpin();
    this.scene.spawnCast(this.x + aim.x * 14, this.y - 12 + aim.y * 8);
    const { dmg, crit } = this.rollDamage(2.4 + 0.3 * t, true);
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
    const t = this.tier;
    const hex = this.clsHex();
    this.play("hero-atk");
    this.scene.sfxSpin();
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
    const t = this.tier;
    const hex = this.clsHex();
    this.play("hero-atk");
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
        this.setFlipX(lastDir.x > 0); // v3.0.10 — 시트 왼쪽 기준
        this.scene.spawnSlash(this.x, this.y, lastDir, i % 2 === 0, 1.2, hex);
        const { dmg, crit } = this.rollDamage(3.0 + 0.25 * t, true);
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
    const t = this.tier;
    const hex = this.clsHex();
    const hits = t >= 3 ? 7 : 5;
    this.play("hero-atk");
    this.setFlipX(dir.y === 0 && dir.x > 0);
    this.scene.sfxSwing();
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
        this.scene.sfxSwing();
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
    this.scene.sfxDash();

    // v3.0.6 — 기동기(C) 12종 클래스 고유 파라미터 (겹침 0 — 지시 #4)
    //  3차/4차는 계열 체인에서 2차기 승계(강화판)
    const kind = resolveSkill2Of(this.cls) ?? "dash";
    const t = this.tier;
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
          this.selfAtkBuff = { mult: 1.15 + 0.03 * t, until: this.scene.time.now + 5000 };
          burst(110 + 10 * t, 1.1 + 0.1 * t, 300);
          this.scene.spawnPickupText(this.x, this.y - 44, "분노!", "#ff7a5c");
          break;
        }
        case "bulwarkdash": {
          // 가디언 — 종착 지진파 + 방어 버프 (성벽 강타의 방어 버프와 축 공유, 수치 별도)
          this.scene.spawnBurstAt(this.x, this.y, 14 + 2 * t, 0xffd29a);
          this.selfDefBuff = { add: 10 + 2 * t, until: this.scene.time.now + 6000 };
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
    const hex = this.clsHex();

    switch (kind) {
      /* 워로드 — 전장의 함성: 광역 외침 + 공격력 버프 (v3.0.4 — 임팩트 대폭 상향) */
      case "warcry": {
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
        this.selfAtkBuff = { mult: 1.35, until: this.scene.time.now + 10000 };
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
        this.selfAtkBuff = { mult: 1.45, until: this.scene.time.now + 9000 };
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
      /* 이터널 — 중력 붕괴: 적을 한 점으로 끌어모은 뒤 대폭발 (시간 왜곡과 완전 별개) */
      case "gravity": {
        const aim = this.aimDirFree().normalize();
        const wb = this.scene.physics.world.bounds;
        const cx = Phaser.Math.Clamp(this.x + aim.x * 120, 60, wb.width - 60);
        const cy = Phaser.Math.Clamp(this.y + aim.y * 120, 60, wb.height - 60);
        const victims = this.getAllTargetsIn(320);
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
          for (const e of this.getAllTargetsIn(190)) {
            const away = new Phaser.Math.Vector2(e.x - cx, e.y - cy).normalize();
            const { dmg, crit } = this.rollDamage(2.8, true);
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
    const hex = this.clsHex();
    const now = this.scene.time.now;

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
      /* 이터널 — 영원의 고리: 광역 기절(시간 정지) — v3.0.4 임팩트 상향 */
      case "eternalloop": {
        this.scene.spawnField({
          x: this.x, y: this.y + 10, radius: 380, dur: 1100,
          dps: 0, kind: "time", owner: "player",
        });
        for (const e of this.getAllTargetsIn(380)) {
          (e as Enemy).applyStun?.(3200);
          const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
          const { dmg } = this.rollDamage(2.6, true);
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
            if (e.active && this.state !== "dead") this.scene.fireShadowClone(e, hex, 3.0);
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

  /** 반경 내 대상 목록 — 3차/4차 광역 스킬 판정용 */
  getAllTargetsIn(radius: number): (Enemy | Boss)[] {
    return this.scene
      .getAllTargets()
      .filter((e) => e.active && Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y) <= radius);
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
    this.scene.time.delayedCall(120, () => this.state !== "dead" && this.clearTint());
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

  /* ---------------- v3.0.3 — GM 도구 (임시 운영자 NPC용) ---------------- */

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

  /* ---------------- 피격 / 사망 / 성장 ---------------- */

  /** v3.0.6 — hpPct(0~1): maxHP % 고정 피해 하한 (몬스터/보스 전용 — 후반 탱킹 방지) */
  takeDamage(dmg: number, fromDir: Phaser.Math.Vector2, pierce = 0, hpPct = 0) {
    if (this.iframes > 0 || this.state === "dead") return;
    const pctFloor = hpPct > 0 ? Math.round(this.maxHp * hpPct) : 0;
    const final = Math.max(this.applyDefense(dmg, pierce), pctFloor);
    this.hp -= final;
    this.iframes = 600;
    this.scene.sfxHurt();
    this.scene.cameras.main.shake(70, 0.004);
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
    const gain = this.hasBuff("buff_exp") ? Math.round(v * 1.5) : v;
    this.exp += gain;
    let leveled = false;
    while (this.exp >= this.expNext()) {
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
    /* v3.0.2 (사용자 지시 #13 — "레벨을 올릴수록 올리기 힘들어야지"):
     *  초반(v3.0 완화 곡선) 유지 + Lv20부터 눈에 띄게 가팔라지는 누진 계수 도입.
     *  Lv10: 1,128 (동일) / Lv30: 6,479 (+12%) / Lv50: 18,990 (+66%) / Lv80: 54,830 (+166%)
     *  → 초반 빠른 성장 유지, 후반 갈수록 체감 난이도 상승 */
    const steep = 1 + Math.max(0, this.lv - 20) * 0.022;
    return Math.round(40 * Math.pow(this.lv, 1.45) * steep);
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
    this.speed = Math.round(Player.BASE_SPEED * (1 + this.clsBonus.speedPct / 100) * buff * sky * slow);
  }

  /* ---------------- RPG 기본 요소 ---------------- */

  /** 장비+강화+클래스 경로+힘 스탯 포함 실제 공격력 (v1.9: 힘 +0.3/점, 분노 버프 +25%)
   *  v3.0.5 — 스타포스 마일스톤(★5/10/15) 공격 보너스 반영 */
  get atkTotal(): number {
    /* v3.0.15 (#13) — 무기 잠재옵션 공격력 합산 */
    const potAtk = sumPotLines([this.potentials[this.weapon]]).atk;
    const base =
      this.atk + (ITEMS[this.weapon].atk ?? 0) + this.upgrades.weapon * 2 +
      starWeaponBonus(this.upgrades.weapon).atk + this.stats.str * 0.3 + potAtk;
    const buff = this.hasBuff("buff_atk") || this.hasBuff("buff_king") ? 1.25 : 1;
    const king = this.hasBuff("buff_king") ? 1.3 / 1.25 : 1; // v3.0.6 — 왕의 가호 공격 +30%
    /* v3.0.16 — 세트 아이템 효과 + 몬스터 컬렉션 공격 % 보너스 */
    const setPct = this.activeSet?.bonus.atkPct ?? 0;
    const colPct = collectionBonus(this.collectionRegistered).atkPct;
    return Math.round(base * (1 + (this.clsBonus.atkPct + setPct + colPct) / 100) * buff * king);
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
    return ((
      (ITEMS[this.armor].def ?? 0) + this.upgrades.armor +
      starArmorBonus(this.upgrades.armor).def + this.clsBonus.defAdd + buff + potDef + setDef
    )) + kingDef;
  }

  /** v3.0.5 — 방어구 스타포스 마일스톤 최대 HP 보너스 (실제 적용치 추적) */
  private sfHpApplied = 0;
  /** 이미 maxHp에 가산된 스타포스 HP 총액 (세이브용) */
  get starHpApplied() { return this.sfHpApplied; }
  /** 세이브 복원 — 가산 이력만 선복원 (syncStarHp가 델타만 반영하게) */
  restoreStarHp(applied: number) { this.sfHpApplied = applied || 0; }
  /** 마일스톤 방어구 HP 보너스를 maxHp에 동기화 (로드/강화 후 호출) */
  syncStarHp() {
    const target = starArmorBonus(this.upgrades.armor).hp;
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
    const target = (this.activeSet?.bonus.maxHp ?? 0) + col.hpAdd;
    const delta = target - this.bonusHpApplied;
    if (delta === 0) return;
    this.maxHp = Math.max(60, this.maxHp + delta);
    this.bonusHpApplied = target;
    if (delta > 0) this.hp = Math.min(this.maxHp, this.hp + delta);
    this.scene.emitHud();
  }
  /** 몬스터 컬렉션 등록 종수 — 씬에서 최초 처치/로드 시 갱신 */
  collectionRegistered = 0;
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

  /** eert 큐브 리롤 — 큐브 소모 후 잠재 재추첨. 결과를 반환 (씬에서 연출) */
  rerollPotentials(key: ItemKey): Potentials | null {
    const item = ITEMS[key];
    if (!item || (item.kind !== "weapon" && item.kind !== "armor" && item.kind !== "accessory")) return null;
    // 장비는 보유 중이어야 (장착 중이든 가방이든) / 큐브 보유 확인
    if (!this.owned.includes(key) && this.weapon !== key && this.armor !== key && !this.accessories.includes(key)) return null;
    if (!this.owned.includes("eert_cube")) return null;
    this.consumeConsumable("eert_cube");
    const pot = rollPotentials();
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
    acc += starWeaponBonus(this.upgrades.weapon).crit;
    /* v3.0.15 (#13) — 장착 장비 잠재옵션 치명 합산 (무기/방어구/장신구) */
    acc += sumPotLines([
      this.potentials[this.weapon], this.potentials[this.armor],
      ...this.accessories.map((k) => this.potentials[k]),
    ]).crit;
    /* v3.0.16 — 세트 치명 + 컬렉션 치명 보너스 */
    acc += this.activeSet?.bonus.critAdd ?? 0;
    acc += collectionBonus(this.collectionRegistered).critAdd;
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
   *  v3.0.6 (지시 #5) — 크리티컬 확률 100% 초과분은 크리티컬 데미지로 1:1 전환:
   *  예: 크리 확률 130% → 항상 크리 + 크리 데미지 +30% (1.7 → 2.0배) */
  get critDmg(): number {
    const overflow = Math.max(0, this.critRate - 100);
    return Player.CRIT_MULT + overflow / 100;
  }

  private rollDamage(mult: number, isSkill = false): { dmg: number; crit: boolean } {
    const chance = Math.min(this.critRate, 100); // 초과분은 확률에 불반영 — 크뎀으로 전환
    const crit = Math.random() * 100 < chance;
    const rage = this.selfAtkBuff ? this.selfAtkBuff.mult : 1;
    const m = (isSkill ? mult * this.clsBonus.skillMult : mult) * rage;
    return { dmg: Math.round(this.atkTotal * m * (crit ? this.critDmg : 1)), crit };
  }

  /** 피격 판정 — v3.0.6: pierce(0~1)만큼 방어력을 무시 (보스 공격 전용 — 방어 스택으로 보스가 무력화되는 것 방지) */
  applyDefense(raw: number, pierce = 0): number {
    const buff = this.selfDefBuff ? this.selfDefBuff.add : 0;
    const effDef = Math.round((this.defTotal + buff) * (1 - Phaser.Math.Clamp(pierce, 0, 1)));
    return Math.max(1, Math.round(raw - effDef));
  }

  /** v3.0.15 — 물약 쿨다운 잔여 ms (씬에서 자동물약 판정용) */
  get potionCd(): number { return this.potCd; }

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
    if (!have) return false;
    const used = isHp ? this.heal(item.heal ?? 0) : this.restore(item.restore ?? 0);
    if (!used) return false;
    if (slotKey === "potion_hp") this.potions.hp--;
    else if (slotKey === "potion_mp") this.potions.mp--;
    else this.consumeConsumable(slotKey);
    this.potCd = 800;
    this.scene.sfxPotion();
    this.scene.spawnPickupText(this.x, this.y - 30, isHp ? `+${item.heal} HP` : `+${item.restore} MP`, "#7dffa8");
    this.scene.emitHud();
    return true;
  }

  private heal(v: number): boolean {
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

  /** 상급 물약 사용 — 즉시 효과 + 차감 */
  useConsumablePotion(key: "potion_hp2" | "potion_mp2"): boolean {
    if (this.state === "dead") return false;
    const item = ITEMS[key];
    if (!item || !this.owned.includes(key)) return false;
    const used = key === "potion_hp2" ? this.heal(item.heal ?? 0) : this.restore(item.restore ?? 0);
    if (!used) return false;
    this.consumeConsumable(key);
    this.scene.sfxPotion();
    this.scene.spawnPickupText(
      this.x, this.y - 30,
      key === "potion_hp2" ? `+${item.heal} HP` : `+${item.restore} MP`,
      "#7dffa8"
    );
    this.scene.emitHud();
    return true;
  }

  /** 장비/장신구 장착 (인벤토리에서) */
  equip(key: ItemKey): boolean {
    const item = ITEMS[key];
    if (!item || !this.owned.includes(key)) return false;
    if (item.kind === "weapon") {
      this.weapon = key;
    } else if (item.kind === "armor") {
      this.armor = key;
    } else if (item.kind === "accessory") {
      /* v2.9 (#8) — 중복 장착: 반지 4개/펜던트 2개 슬롯. 같은 아이템도 보유 수만큼 장착 가능 */
      const slot = item.slot ?? "ring";
      const cap = slot === "ring" ? Player.RING_SLOTS : Player.PENDANT_SLOTS;
      const same = (k: ItemKey) => (ITEMS[k].slot ?? "ring") === slot;
      const wornSame = this.accessories.filter(same);
      const ownedCount = this.owned.filter((k) => k === key).length;
      const wornCount = wornSame.filter((k) => k === key).length;
      if (wornCount >= ownedCount) return false; // 보유량 초과 중복 장착 금지
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

  /** 상점 구매 — 골드 차감/인벤토리 반영. 실패 시 false */
  buy(key: ItemKey): boolean {
    const item = ITEMS[key];
    // v3.0.6 (지시 #9) — 보스 전용 아이템은 상점 구매 불가 (유저 거래소 예정)
    // v3.0.6 (지시 #1) — BM 전용 아이템은 골드 상점 구매 불가
    if (!item || this.gold < item.price || item.tradeLock || item.bmOnly) return false;
    if (item.kind === "consumable") {
      this.gold -= item.price;
      if (key === "potion_hp") this.addPotion("hp");
      else if (key === "potion_mp") this.addPotion("mp");
      else this.owned.push(key); // v2.5 — 상급 물약/스크롤류는 소지품 기반
      return true;
    }
    // BM (v1.9): 버프는 개수 누적, 펫/치장은 1회 구매
    if (item.kind === "buff") {
      this.gold -= item.price;
      this.addBuffItem(key as BuffKey);
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
      this.cosmetic = key as CosmeticKey; // 구매 즉시 착용
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

  /** 아이템 판매 (지시 #4) — 상점가 40% (보스 전용 고정가). 장착 중 무기/방어구는 판매 금지 */
  sell(key: ItemKey): boolean {
    const item = ITEMS[key];
    if (!item) return false;
    if (item.kind === "weapon" && this.weapon === key) return false;
    if (item.kind === "armor" && this.armor === key) return false;
    const idx = this.owned.indexOf(key);
    if (idx < 0) return false;
    const value = sellValue(item);
    if (value <= 0) return false;
    this.owned.splice(idx, 1);
    // 장신구는 장착 슬롯에서도 제거 (v3.0.7 — 스타포스 HP 마일스톤 회수 포함)
    if (item.kind === "accessory") {
      this.removeAccessory(key);
      this.syncAccStarHp();
    }
    this.gold += value;
    audio.sfx.coin();
    this.scene.spawnPickupText(this.x, this.y - 30, `${item.name} 판매 +${value}G`, "#ffd76a");
    this.scene.emitHud();
    return true;
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
    audio.sfx.coin();
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
    audio.sfx.coin();
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

  /** BM 상점 구매 (지시 #1) — 에메랄드 전용 화폐 (골드 상점과 분리) */
  buyBm(key: ItemKey): boolean {
    const item = ITEMS[key];
    if (!item || item.bmPrice === undefined) return false;
    if (this.emerald < item.bmPrice) return false;
    if (item.kind === "buff") {
      this.emerald -= item.bmPrice;
      this.addBuffItem(key as BuffKey);
      return true;
    }
    if (item.kind === "pet") {
      if (this.pets.includes(key as PetKey)) return false;
      this.emerald -= item.bmPrice;
      this.pets.push(key as PetKey);
      this.pet = key as PetKey;
      return true;
    }
    if (item.kind === "cosmetic") {
      if (this.cosmetics.includes(key as CosmeticKey)) return false;
      this.emerald -= item.bmPrice;
      this.cosmetics.push(key as CosmeticKey);
      this.cosmetic = key as CosmeticKey;
      return true;
    }
    if (this.owned.includes(key)) return false;
    this.emerald -= item.bmPrice;
    this.owned.push(key);
    if (item.kind === "accessory") this.equip(key);
    return true;
  }

  /** 자동 사용 설정 변경 (지시 #5) */
  setAutoUse(cfg: Partial<{ hpPct: number; mpOn: boolean; buffs: BuffKey[] }>) {
    if (cfg.hpPct !== undefined) this.autoUse.hpPct = cfg.hpPct;
    if (cfg.mpOn !== undefined) this.autoUse.mpOn = cfg.mpOn;
    if (cfg.buffs !== undefined) this.autoUse.buffs = [...cfg.buffs];
  }

  /** 자동 물약/버프 틱 — update에서 호출 (지시 #5) */
  private tickAutoUse() {
    const cfg = this.autoUse;
    /* v3.0.15 (#6/#7) — 퀵슬롯에 지정된 물약(기본/상급) 기준으로 자동 사용 판정 */
    const hpKey = (this.quickPots.hp ?? "potion_hp") as ItemKey;
    const mpKey = (this.quickPots.mp ?? "potion_mp") as ItemKey;
    const hpHave = hpKey === "potion_hp" ? this.potions.hp > 0 : this.owned.includes(hpKey);
    const mpHave = mpKey === "potion_mp" ? this.potions.mp > 0 : this.owned.includes(mpKey);
    if (cfg.hpPct > 0 && this.hp <= this.maxHp * (cfg.hpPct / 100) && hpHave && this.potCd <= 0) {
      this.usePotion("hp");
    } else if (cfg.mpOn && this.mp <= this.maxMp * 0.25 && mpHave && this.potCd <= 0) {
      this.usePotion("mp");
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

  /** 치장 착용/해제 (가방에서) — 오라 연출만, 전투 능력 없음 */
  setCosmetic(key: CosmeticKey | null): boolean {
    if (key && !this.cosmetics.includes(key)) return false;
    if (this.cosmetic === key) return false;
    this.cosmetic = key;
    this.scene.onCosmeticChanged();
    this.scene.emitHud();
    return true;
  }

  /* ---------------- 장비 강화 (2D MMORPG 기본 요소) ---------------- */

  readonly upMax = UPGRADE_MAX; // v2.0 — +12 (메이플 스타포스식, 구 세이브 +5 호환)

  /** 다음 강화 비용 — 단계별 눈덩이 곡선 (v2.0 밸런스) */
  upgradeCost(slot: "weapon" | "armor"): number {
    return upgradeCost(slot, this.upgrades[slot]);
  }

  /** 다음 강화 성공률 (%) */
  upgradeRate(slot: "weapon" | "armor"): number {
    return UPGRADE_RATES[this.upgrades[slot]] ?? 0;
  }

  /** 강화 시도 — 결과 타입 반환 (골드는 성공/실패 모두 소모)
   *  v3.0.5 — 스타포스: 티어별 연출 + ★5/10/15 돌파 대형 연출 + 마일스톤 HP 동기화 */
  tryUpgrade(slot: "weapon" | "armor"): "ok" | "fail" | "max" | "poor" {
    const cur = this.upgrades[slot];
    if (cur >= this.upMax) return "max";
    const cost = this.upgradeCost(slot);
    if (this.gold < cost) return "poor";
    this.gold -= cost;
    // v3.0.7 — 강화 주문서 충전분 성공률 가산 후 1회 소모 (성공/실패 무관)
    const bless = Math.min(this.starBless, STAR_BLESS_MAX);
    if (bless > 0) this.starBless -= 1;
    const rate = (UPGRADE_RATES[cur] ?? 0) + bless * STAR_BLESS_RATE;
    const ok = Math.random() * 100 < rate;
    const slotName = slot === "weapon" ? "무기" : "방어구";
    const blessTag = bless > 0 ? ` · 주문서 +${bless * STAR_BLESS_RATE}%p` : "";
    if (ok) {
      this.upgrades[slot] = cur + 1;
      const next = cur + 1;
      const milestone = (STAR_MILESTONES as readonly number[]).includes(next);
      this.scene.sfxUpgradeOk();
      if (milestone) {
        this.scene.spawnStarForceBreakthrough(this.x, this.y, slot, next);
        this.scene.spawnPickupText(this.x, this.y - 58, `${slotName} ★${next} 돌파!${blessTag}`, "#ffd76a");
      } else {
        this.scene.spawnStarForceBurst(this.x, this.y, this.upgrades[slot], true);
        this.scene.spawnPickupText(this.x, this.y - 44, `강화 성공! ★${next}${blessTag}`, "#ffd76a");
      }
      if (slot === "armor") this.syncStarHp();
    } else if (cur >= UPGRADE_FALLBACK_FROM) {
      // +9 이상 실패 시 1성 하락 (스타포스식 리스크)
      this.upgrades[slot] = cur - 1;
      this.scene.sfxUpgradeFail();
      this.scene.spawnStarForceBurst(this.x, this.y, cur, false);
      this.scene.spawnPickupText(this.x, this.y - 44, `강화 실패… ★${cur - 1} 하락${blessTag}`, "#ff9a9a");
      if (slot === "armor") this.syncStarHp();
    } else {
      this.scene.sfxUpgradeFail();
      this.scene.spawnStarForceBurst(this.x, this.y, cur, false);
      this.scene.spawnPickupText(this.x, this.y - 44, `강화 실패…${blessTag}`, "#ff9a9a");
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
    this.play("hero-idle");
    this.scene.emitHud();
  }
}
