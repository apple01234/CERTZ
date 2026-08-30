import Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import {
  ITEMS, BUFF_DEFS, PET_DEFS, COSMETIC_DEFS, UPGRADE_MAX, UPGRADE_RATES, UPGRADE_FALLBACK_FROM, upgradeCost,
  type ItemKey, type BuffKey, type PetKey, type CosmeticKey,
} from "../data";
import {
  classDef, isClassKey, bonusOf, nextTierOf, freeJobOption, familyOf,
  type ClassKey, type ClassBonus,
} from "../classes";
import { sweptHitsTarget } from "../collision/sweep";

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
  weapon: ItemKey = "weapon_1";
  armor: ItemKey = "armor_1";
  accessory: ItemKey | null = null; // 장신구 슬롯 (반지 1개)
  owned: ItemKey[] = ["weapon_1", "armor_1"];
  upgrades: { weapon: number; armor: number } = { weapon: 0, armor: 0 }; // 강화 단계 (+0~+5)
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

  speed = 230;
  /** 이동 기본값 — 클래스 속도 보너스는 이 값에 배율 (recalcSpeed) */
  static readonly BASE_SPEED = 230;
  facing: Phaser.Math.Vector2 = new Phaser.Math.Vector2(1, 0);

  state: "idle" | "attack" | "dash" | "dead" = "idle";
  private atkCooldown = 0;
  private slashAlt = false; // 위/아래 교차 베기
  private hitSet: Set<unknown> = new Set();

  skill1Cd = 0; // 계열별 주력기 (전사 회전베기 / 궁수 관통 화살 / 마법사 매직 볼트)
  skill2Cd = 0; // 계열별 기동기 (전사·궁수 돌진 / 마법사 점멸)
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
    this.iframes = Math.max(0, this.iframes - ms);
    this.potCd = Math.max(0, this.potCd - ms);
    this.tickBuffs(ms);

    // 마나 리젠
    this.mpRegenAcc += ms;
    if (this.mpRegenAcc >= 1000) {
      this.mp = Math.min(this.maxMp, this.mp + 5);
      this.mpRegenAcc -= 1000;
      this.scene.emitHud();
    }

    if (this.state === "dash") {
      this.dashTime -= ms;
      this.setVelocity(this.dashDir.x * this.dashSpeed, this.dashDir.y * this.dashSpeed);
      if (this.dashTime <= 0) {
        this.state = "idle";
        this.setVelocity(0, 0);
      }
      return;
    }

    // 공격 중 미세 러지 — 선형 감쇠로 "살짝" 전진 (총 이동 ~16px)
    if (this.state === "attack" && this.lungeTime > 0) {
      this.lungeTime -= ms;
      const k = Math.max(0, this.lungeTime / Player.LUNGE_MS);
      this.setVelocity(
        this.lungeDir.x * Player.LUNGE_SPEED * k,
        this.lungeDir.y * Player.LUNGE_SPEED * k
      );
      if (this.lungeTime <= 0) this.setVelocity(0, 0);
    }

    // 이동
    if (this.state === "idle") {
      if (move.lengthSq() > 0.01) {
        this.setVelocity(move.x * this.speed, move.y * this.speed);
        this.facing.copy(move).normalize();
        // 방향 우세 축 기준 실제 걷기 프레임 사용 (아래/위/측면)
        const horiz = Math.abs(move.x) >= Math.abs(move.y);
        const key = horiz ? "hero-walk-side" : move.y > 0 ? "hero-walk" : "hero-walk-up";
        if (this.anims.currentAnim?.key !== key) this.play(key);
        if (horiz) this.setFlipX(move.x < 0); // 시트 기본: 오른쪽 향함
      } else {
        this.setVelocity(0, 0);
        // 정지 시 마지막 바라본 방향 유지 (정면 idle로 튀는 문제 방지 — 사용자 피드백)
        const f = this.facing;
        let tex = "hero_idle0"; // 기본: 정면 (아래쪽 바라볼 때/초기)
        if (Math.abs(f.x) >= Math.abs(f.y) && f.x !== 0) {
          this.setFlipX(f.x < 0); // 측면 시트는 오른쪽 기준
          tex = "hero_walkside0";
        } else if (f.y < 0) {
          tex = "hero_walkup0"; // 위쪽 — 뒷모습 서있기
        }
        if (this.anims.isPlaying) this.anims.stop();
        if (this.texture.key !== tex) this.setTexture(tex);
      }
    } else if (this.state === "attack" && this.lungeTime <= 0 && move.lengthSq() > 0.01) {
      // v2.0 (지시 #4) — 공격 중에도 이동 허용 (55% 속도 캐스팅 취소 없는 부드러운 무빙샷)
      this.setVelocity(move.x * this.speed * 0.55, move.y * this.speed * 0.55);
      this.facing.copy(move).normalize();
      if (Math.abs(move.x) >= Math.abs(move.y)) this.setFlipX(move.x < 0);
    }

    // 기본 공격
    if (attackPressed && this.atkCooldown <= 0 && this.state === "idle") {
      this.doAttack();
    }
  }

  /* ---------------- 기본 공격 ---------------- */

  private doAttack() {
    this.state = "attack";
    this.atkCooldown = 330;
    this.slashAlt = !this.slashAlt;
    this.hitSet.clear();

    // 살짝 돌진 — 미세 러지 + 넉백 조합 (사용자 피드백: 타격감)
    const dir = this.aimDir();
    this.lungeDir.copy(dir);
    this.lungeTime = Player.LUNGE_MS;
    this.setVelocity(dir.x * Player.LUNGE_SPEED, dir.y * Player.LUNGE_SPEED);

    // 실제 방향별 베기 프레임 (측면/위/아래 4프레임 스윙)
    const atkKey = dir.y > 0 ? "hero-atk-down" : dir.y < 0 ? "hero-atk-up" : "hero-atk";
    this.setFlipX(dir.y === 0 && dir.x < 0); // 측면 시트는 오른쪽 기준
    this.play(atkKey);

    // 베기 타이밍: 65ms 후 판정+참격 스윕 (모션 2프레임 시점)
    this.scene.time.delayedCall(65, () => {
      if (this.state !== "attack") return;
      this.scene.spawnSlash(this.x, this.y, dir, this.slashAlt);
      this.scene.sfxSwing();
      // 참격 판정 확대 — 전방 160px x 폭 116px (사용자 지시: 히트박스 크게)
      this.checkMeleeHit(dir, 160, 116, 1.0, 280);
    });

    this.scene.time.delayedCall(200, () => {
      if (this.state === "attack") {
        this.state = "idle";
        // v2.0 — 공격 종료 후 이동 입력이 있으면 정지 처리하지 않음 (부드러운 이어 걷기)
        if (this.body && (this.body.velocity.x !== 0 || this.body.velocity.y !== 0)) return;
        this.setVelocity(0, 0);
      }
    });
  }

  /** 조준 방향: 마지막 이동 방향(4방향 스냅) */
  private aimDir(): Phaser.Math.Vector2 {
    const f = this.facing;
    if (Math.abs(f.x) >= Math.abs(f.y)) return new Phaser.Math.Vector2(f.x >= 0 ? 1 : -1, 0);
    return new Phaser.Math.Vector2(0, f.y >= 0 ? 1 : -1);
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

  /* ---------------- 스킬 (v1.8 — 계열별 전투 방식 차별화, 메이플 계열 정체성 참고) ---------------- */

  /** 주력기(Z) — 전사·미전직: 회전베기 / 궁수: 관통 화살 3연발 / 마법사: 매직 볼트(관통) */
  useSkill1() {
    if (this.state !== "idle" || this.skill1Cd > 0 || this.mp < 15) return;
    this.mp -= 15;
    this.skill1Cd = this.skill1MaxEff;
    this.state = "attack";
    this.hitSet.clear();
    this.setVelocity(0, 0);
    const fam = familyOf(this.cls);
    if (fam === "ranger") return this.skill1Arrows();
    if (fam === "mage") return this.skill1Bolt();
    this.skill1Spin();
  }

  /** 전사(+미전직) — 회전베기 360° */
  private skill1Spin() {
    this.scene.sfxSpin();

    // 회전 방향: 조준 측면 기준 (상하 조준 시 현재 플립 방향 따름)
    const aim = this.aimDir();
    const spin = aim.x !== 0 ? (aim.x > 0 ? 1 : -1) : this.flipX ? -1 : 1;

    // 360° 궤도 반달 + 충격파 + 스파크
    this.scene.spawnSpinSlash(this.x, this.y, spin);

    // 몸통(스프라이트) 360° 회전 — 검 뻗은 공격 프레임을 돌려 휘두르는 동작
    this.play("hero-atk");
    this.scene.tweens.add({
      targets: this,
      rotation: spin * Math.PI * 2,
      duration: 250,
      ease: "Cubic.inOut",
      onComplete: () => this.setRotation(0),
    });

    this.scene.time.delayedCall(90, () => {
      // 360° 전체 판정
      for (const e of this.scene.getAllTargets()) {
        if (!e.active || this.hitSet.has(e)) continue;
        const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
        if (d <= 118) {
          this.hitSet.add(e);
          const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
          const { dmg, crit } = this.rollDamage(1.6, true);
          if (crit) this.scene.sfxCrit();
          e.takeDamage(dmg, away, 300, crit);
        }
      }
      this.scene.onMeleeConnect(1, "skill");
    });
    this.scene.time.delayedCall(310, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  /** 궁수 — 관통 화살 3연발 (부채꼴, 각 화살 최대 2명 관통) */
  private skill1Arrows() {
    const aim = this.aimDir();
    const base = Math.atan2(aim.y, aim.x);
    this.play("hero-atk");
    this.scene.sfxSpin();
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 110, () => {
        if (this.state === "dead") return;
        const { dmg, crit } = this.rollDamage(1.2, true);
        if (crit) this.scene.sfxCrit();
        this.scene.firePlayerProj({
          x: this.x, y: this.y - 8,
          angle: base + (i - 1) * 0.09,
          speed: 580, pierce: 2, dmg, crit,
          tint: 0x7dffa8, knock: 220, scale: 0.8,
        });
      });
    }
    this.scene.time.delayedCall(360, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  /** 마법사 — 매직 볼트 (느리지만 대폭 관통·고배율) */
  private skill1Bolt() {
    const aim = this.aimDir();
    const angle = Math.atan2(aim.y, aim.x);
    this.play("hero-atk");
    this.scene.sfxSpin();
    const { dmg, crit } = this.rollDamage(2.0, true);
    if (crit) this.scene.sfxCrit();
    this.scene.firePlayerProj({
      x: this.x, y: this.y - 10,
      angle, speed: 430, pierce: 5, dmg, crit,
      tint: 0x8fa6ff, knock: 260, scale: 1.15,
    });
    this.scene.time.delayedCall(300, () => {
      if (this.state === "attack") this.state = "idle";
    });
    this.scene.emitHud();
  }

  useSkill2() {
    if (this.state !== "idle" || this.skill2Cd > 0 || this.mp < 20) return;
    const move = this.scene.currentMoveVec();
    const dir =
      move.lengthSq() > 0.01
        ? move.clone().normalize()
        : this.aimDir();
    this.mp -= 20;
    this.skill2Cd = this.skill2MaxEff;
    this.state = "dash";
    this.dashDir.copy(dir);
    this.hitSet.clear();
    this.setFlipX(dir.x < 0);
    this.scene.sfxDash();

    // 계열별 기동기 성격 — 전사: 묵직한 돌진 / 궁수: 짧고 날렵한 질풍 / 마법사: 점멸(즉발 이동)
    const fam = familyOf(this.cls);
    if (fam === "ranger") {
      this.dashTime = 160;
      this.dashSpeed = 700;
    } else if (fam === "mage") {
      this.dashTime = 130;
      this.dashSpeed = 760;
      this.scene.spawnBurstAt(this.x, this.y, 8, 0x8fa6ff);
    } else {
      this.dashTime = 190;
      this.dashSpeed = 640;
    }

    // 돌진 경로에 참격 잔상 3연발
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 55, () => {
        if (this.state === "dead") return;
        this.scene.spawnSlash(this.x, this.y, dir, i % 2 === 0, 0.7);
      });
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
            const { dmg, crit } = this.rollDamage(2.1, true);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, dir, 360, crit);
            this.scene.onMeleeConnect(1, "skill");
          }
        }
        sweepFromX = toX;
        sweepFromY = toY;
      },
    });
    this.scene.time.delayedCall(260, () => tick.remove());
    this.scene.emitHud();
  }

  /* ---------------- 피격 / 사망 / 성장 ---------------- */

  takeDamage(dmg: number, fromDir: Phaser.Math.Vector2) {
    if (this.iframes > 0 || this.state === "dead") return;
    const final = this.applyDefense(dmg);
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
    }
    this.scene.emitHud();
  }

  expNext() {
    // 장기 성장 곡선 — 30개 퀘스트 체인 + 보스 페이즈전 기준 체감 플레이타임 확장
    // (Lv1→2: 55, Lv5→6: 743, Lv10→11: 3,616, Lv15→16: 8,447, Lv20 총 누적 약 6만)
    return Math.round(55 * Math.pow(this.lv, 1.72));
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

  /** 기본 속도 × 경로 누적 속도 보너스 × 신속 버프 (합산 → 곱) */
  private recalcSpeed() {
    const buff = this.hasBuff("buff_spd") ? 1.25 : 1;
    this.speed = Math.round(Player.BASE_SPEED * (1 + this.clsBonus.speedPct / 100) * buff);
  }

  /* ---------------- RPG 기본 요소 ---------------- */

  /** 장비+강화+클래스 경로+힘 스탯 포함 실제 공격력 (v1.9: 힘 +0.3/점, 분노 버프 +25%) */
  get atkTotal(): number {
    const base = this.atk + (ITEMS[this.weapon].atk ?? 0) + this.upgrades.weapon * 2 + this.stats.str * 0.3;
    const buff = this.hasBuff("buff_atk") ? 1.25 : 1;
    return Math.round(base * (1 + this.clsBonus.atkPct / 100) * buff);
  }

  /** 장비+강화+클래스 경로 포함 실제 방어력 (v1.9: 수호 버프 +8) */
  get defTotal(): number {
    const buff = this.hasBuff("buff_def") ? 8 : 0;
    return (ITEMS[this.armor].def ?? 0) + this.upgrades.armor + this.clsBonus.defAdd + buff;
  }

  /** 크리티컬 확률 (%) — 기본 8% + 힘의 반지 +7%p + 클래스 경로 누적 + 민첽 0.4%p/점 */
  get critRate(): number {
    const acc = this.accessory ? ITEMS[this.accessory].crit ?? 0 : 0;
    return Math.round((Player.BASE_CRIT + acc + this.clsBonus.critAdd + this.stats.dex * 0.4) * 10) / 10;
  }

  /** 펫 골드 보너스 (%) — 소환 중인 펫의 효과 */
  get petGoldBonusPct(): number {
    return this.pet ? PET_DEFS[this.pet].bonusGoldPct : 0;
  }

  /** 데미지 굴림 — 크리티컬 판정 포함 (스킬은 skillMult 곱) */
  private rollDamage(mult: number, isSkill = false): { dmg: number; crit: boolean } {
    const crit = Math.random() * 100 < this.critRate;
    const m = isSkill ? mult * this.clsBonus.skillMult : mult;
    return { dmg: Math.round(this.atkTotal * m * (crit ? Player.CRIT_MULT : 1)), crit };
  }

  /** 피격 판정 — 방어력만큼 감쇄 (최소 1) */
  applyDefense(raw: number): number {
    return Math.max(1, Math.round(raw - this.defTotal));
  }

  /** 물약 사용 (퀵슬롯) — 0.8초 쿨다운 */
  usePotion(kind: "hp" | "mp"): boolean {
    if (this.potCd > 0 || this.state === "dead") return false;
    if (this.potions[kind] <= 0) return false;
    const item = kind === "hp" ? ITEMS.potion_hp : ITEMS.potion_mp;
    const used = kind === "hp" ? this.heal(item.heal ?? 0) : this.restore(item.restore ?? 0);
    if (!used) return false;
    this.potions[kind]--;
    this.potCd = 800;
    this.scene.sfxPotion();
    this.scene.spawnPickupText(this.x, this.y - 30, kind === "hp" ? `+${item.heal} HP` : `+${item.restore} MP`, "#7dffa8");
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

  /** 장비/장신구 장착 (인벤토리에서) */
  equip(key: ItemKey): boolean {
    const item = ITEMS[key];
    if (!item || !this.owned.includes(key)) return false;
    if (item.kind === "weapon") {
      this.weapon = key;
    } else if (item.kind === "armor") {
      this.armor = key;
    } else if (item.kind === "accessory") {
      if (this.accessory === key) return false;
      // 이전 장신구 보너스 회수 (최대 HP)
      const old = this.accessory ? ITEMS[this.accessory] : null;
      if (old?.maxHp) {
        this.maxHp -= old.maxHp;
        this.hp = Math.min(this.hp, this.maxHp);
      }
      this.accessory = key;
      // 새 장신구 보너스 적용 (초과분만큼 HP도 증가)
      if (item.maxHp) {
        this.maxHp += item.maxHp;
        this.hp = Math.min(this.maxHp, this.hp + item.maxHp);
      }
    } else return false;
    this.scene.sfxEquip();
    this.scene.spawnPickupText(this.x, this.y - 30, `${item.name} 장착!`, "#ffd76a");
    this.scene.emitHud();
    return true;
  }

  /** 상점 구매 — 골드 차감/인벤토리 반영. 실패 시 false */
  buy(key: ItemKey): boolean {
    const item = ITEMS[key];
    if (!item || this.gold < item.price) return false;
    if (item.kind === "consumable") {
      this.gold -= item.price;
      this.addPotion(key === "potion_hp" ? "hp" : "mp");
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

  /** 강화 시도 — 결과 타입 반환 (골드는 성공/실패 모두 소모) */
  tryUpgrade(slot: "weapon" | "armor"): "ok" | "fail" | "max" | "poor" {
    const cur = this.upgrades[slot];
    if (cur >= this.upMax) return "max";
    const cost = this.upgradeCost(slot);
    if (this.gold < cost) return "poor";
    this.gold -= cost;
    const ok = Math.random() * 100 < (UPGRADE_RATES[cur] ?? 0);
    if (ok) {
      this.upgrades[slot] = cur + 1;
      this.scene.sfxUpgradeOk();
      this.scene.spawnPickupText(this.x, this.y - 44, `강화 성공! +${cur + 1}`, "#ffd76a");
    } else if (cur >= UPGRADE_FALLBACK_FROM) {
      // v2.0 — +9 이상 실패 시 1단계 하락 (스타포스식 리스크)
      this.upgrades[slot] = cur - 1;
      this.scene.sfxUpgradeFail();
      this.scene.spawnPickupText(this.x, this.y - 44, `강화 실패… +${cur - 1} 하락`, "#ff9a9a");
    } else {
      this.scene.sfxUpgradeFail();
      this.scene.spawnPickupText(this.x, this.y - 44, "강화 실패…", "#ff9a9a");
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
