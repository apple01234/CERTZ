import Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import { ITEMS, UPGRADE_MAX, UPGRADE_RATES, UPGRADE_COST, type ItemKey } from "../data";

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
  private potCd = 0;

  /** 기본 크리티컬 확률 (%) — 장신구로 증가 */
  private static readonly BASE_CRIT = 8;
  private static readonly CRIT_MULT = 1.7;

  speed = 230;
  facing: Phaser.Math.Vector2 = new Phaser.Math.Vector2(1, 0);

  state: "idle" | "attack" | "dash" | "dead" = "idle";
  private atkCooldown = 0;
  private slashAlt = false; // 위/아래 교차 베기
  private hitSet: Set<unknown> = new Set();

  skill1Cd = 0; // 회전베기
  skill2Cd = 0; // 돌진베기
  readonly skill1Max = 4000;
  readonly skill2Max = 6000;
  private mpRegenAcc = 0;

  private iframes = 0;
  private dashTime = 0;
  private dashDir = new Phaser.Math.Vector2();

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

    // 마나 리젠
    this.mpRegenAcc += ms;
    if (this.mpRegenAcc >= 1000) {
      this.mp = Math.min(this.maxMp, this.mp + 5);
      this.mpRegenAcc -= 1000;
      this.scene.emitHud();
    }

    if (this.state === "dash") {
      this.dashTime -= ms;
      this.setVelocity(this.dashDir.x * 640, this.dashDir.y * 640);
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
        if (crit) this.scene.sfxCrit();
        e.takeDamage(dmg, dir, knock, crit);
      }
    }
    if (hits > 0) {
      this.scene.onMeleeConnect(hits);
    }
    return hits;
  }

  /* ---------------- 스킬 ---------------- */

  useSkill1() {
    if (this.state !== "idle" || this.skill1Cd > 0 || this.mp < 15) return;
    this.mp -= 15;
    this.skill1Cd = this.skill1Max;
    this.state = "attack";
    this.hitSet.clear();
    this.setVelocity(0, 0);
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
          const { dmg, crit } = this.rollDamage(1.6);
          if (crit) this.scene.sfxCrit();
          e.takeDamage(dmg, away, 300, crit);
        }
      }
      this.scene.onMeleeConnect(1);
    });
    this.scene.time.delayedCall(310, () => {
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
    this.skill2Cd = this.skill2Max;
    this.state = "dash";
    this.dashDir.copy(dir);
    this.dashTime = 190;
    this.hitSet.clear();
    this.setFlipX(dir.x < 0);
    this.scene.sfxDash();

    // 돌진 경로에 참격 잔상 3연발
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 55, () => {
        if (this.state === "dead") return;
        this.scene.spawnSlash(this.x, this.y, dir, i % 2 === 0, 0.7);
      });
    }

    // 돌진 중 연속 판정
    const tick = this.scene.time.addEvent({
      delay: 40,
      repeat: 4,
      callback: () => {
        for (const e of this.scene.getAllTargets()) {
          if (!e.active || this.hitSet.has(e)) continue;
          const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
          if (d <= 64) {
            this.hitSet.add(e);
            const { dmg, crit } = this.rollDamage(2.1);
            if (crit) this.scene.sfxCrit();
            e.takeDamage(dmg, dir, 360, crit);
            this.scene.onMeleeConnect(1);
          }
        }
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
    this.exp += v;
    let leveled = false;
    while (this.exp >= this.expNext()) {
      this.exp -= this.expNext();
      this.lv++;
      leveled = true;
      this.maxHp += 18;
      this.maxMp += 6; // 레벨업 MP 성장
      this.atk += 3;
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
    return Math.round(60 * Math.pow(this.lv, 1.35));
  }

  /* ---------------- RPG 기본 요소 ---------------- */

  /** 장비+강화 포함 실제 공격력 */
  get atkTotal(): number {
    return this.atk + (ITEMS[this.weapon].atk ?? 0) + this.upgrades.weapon * 2;
  }

  /** 장비+강화 포함 실제 방어력 */
  get defTotal(): number {
    return (ITEMS[this.armor].def ?? 0) + this.upgrades.armor;
  }

  /** 크리티컬 확률 (%) — 기본 8% + 힘의 반지 +7%p */
  get critRate(): number {
    const bonus = this.accessory ? ITEMS[this.accessory].crit ?? 0 : 0;
    return Player.BASE_CRIT + bonus;
  }

  /** 데미지 굴림 — 크리티컬 판정 포함 */
  private rollDamage(mult: number): { dmg: number; crit: boolean } {
    const crit = Math.random() * 100 < this.critRate;
    return { dmg: Math.round(this.atkTotal * mult * (crit ? Player.CRIT_MULT : 1)), crit };
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
    if (this.owned.includes(key)) return false; // 이미 보유한 장비
    this.gold -= item.price;
    this.owned.push(key);
    // 구매 즉시 장착 (더 좋은 티어면 자연스러운 흐름)
    if (item.kind === "weapon") this.weapon = key;
    else if (item.kind === "armor") this.armor = key;
    else if (item.kind === "accessory") this.equip(key);
    return true;
  }

  /* ---------------- 장비 강화 (2D MMORPG 기본 요소) ---------------- */

  readonly upMax = 5; // UPGRADE_MAX와 동일 값 (런타임 상수)

  /** 다음 강화 비용 */
  upgradeCost(slot: "weapon" | "armor"): number {
    const base = slot === "weapon" ? UPGRADE_COST.weapon : UPGRADE_COST.armor;
    return base * (this.upgrades[slot] + 1);
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
    this.iframes = 1200;
    this.setPosition(x, y);
    this.setAlpha(1);
    this.setFlipX(false);
    this.play("hero-idle");
    this.scene.emitHud();
  }
}
