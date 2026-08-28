import Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import { BOSS_DEF } from "../data";
import { EventBus } from "../../components/game/EventBus";

/**
 * 보스: 심연의 수호자
 * F4 최적화 핵심:
 *  - 투사체는 24발 고정 풀 재사용 (런타임 생성/파괴 없음)
 *  - 텔레그래프는 미리 만든 텍스처 스프라이트 트윈 (매 프레임 Graphics 그리기 없음)
 *  - 파티클은 씬의 공유 이미터 explode() 재사용
 */
type BossMode = "idle" | "slamTele" | "chargeTele" | "charging" | "volley" | "stagger" | "dead";

export class Boss extends Phaser.Physics.Arcade.Sprite {
  declare scene: WorldScene;

  hp = BOSS_DEF.hp;
  maxHp = BOSS_DEF.hp;
  alive = true;
  enraged = false;
  // 근접 판정용 목표 크기 — 커다란 보스 스프라이트에 맞춰 넉넉하게
  hitW = 104;
  hitH = 108;

  private mode: BossMode = "idle";
  private modeTimer = 1200;
  private nextAttackCd = 1600;
  private knockVec = new Phaser.Math.Vector2();
  private chargeDir = new Phaser.Math.Vector2();
  private teleRing: Phaser.GameObjects.Image | null = null;
  private teleRings: Phaser.GameObjects.Image[] = [];
  private chargeTarget = new Phaser.Math.Vector2();
  private volleyCount = 0;
  private volleyTimer: Phaser.Time.TimerEvent | null = null;
  private chargeHitDone = false;

  // F4: 투사체 고정 풀
  private orbPool: Phaser.Physics.Arcade.Image[] = [];
  private orbIdx = 0;

  constructor(scene: WorldScene, x: number, y: number) {
    super(scene, x, y, "boss_idle0");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(11);
    // 111x126 캔버스 (sotrak 보스) — 스프라이트가 크므로 히트박스도 넉넉하게
    this.body!.setSize(76, 92);
    this.body!.setOffset(17, 30);
    this.play("boss-idle");

    for (let i = 0; i < 24; i++) {
      const orb = scene.physics.add.image(0, 0, "orb");
      // 외부 에셋 구슬(Kenney circle_05) — 보라 발광 에너지탄
      orb.setTint(0x9d7aff).setBlendMode(Phaser.BlendModes.ADD);
      orb.setActive(false).setVisible(false);
      orb.setData("dmg", BOSS_DEF.atk);
      (orb.body as Phaser.Physics.Arcade.Body).setCircle(7);
      this.orbPool.push(orb);
    }
  }

  tick(dt: number, player: PlayerLike2) {
    if (!this.alive) return;
    this.modeTimer -= dt;
    this.knockVec.scale(Math.pow(0.002, dt / 1000));

    const toPlayer = new Phaser.Math.Vector2(player.x - this.x, player.y - this.y).normalize();
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    // 투사체-플레이어 충돌 (풀 순회, 24개 고정 — 저렴함)
    for (const orb of this.orbPool) {
      if (!orb.active) continue;
      if (Phaser.Math.Distance.Between(orb.x, orb.y, player.x, player.y) < 26) {
        player.takeDamage(
          orb.getData("dmg"),
          new Phaser.Math.Vector2(orb.body!.velocity.x, orb.body!.velocity.y).normalize()
        );
        this.killOrb(orb);
      }
      if (orb.active && (orb.x < 0 || orb.x > this.scene.stageW || orb.y < 0 || orb.y > this.scene.stageH)) {
        this.killOrb(orb);
      }
    }

    switch (this.mode) {
      case "idle": {
        // 추격하며 접근
        this.setVelocity(toPlayer.x * BOSS_DEF.speed + this.knockVec.x, toPlayer.y * BOSS_DEF.speed + this.knockVec.y);
        this.nextAttackCd -= dt;
        if (this.nextAttackCd <= 0 && dist < 520 && player.hp > 0) {
          const r = Math.random();
          if (dist < 150) this.startSlam(player);
          else if (r < 0.5) this.startCharge(player);
          else if (r < 0.8) this.startVolley();
          else this.startSlam(player);
        }
        break;
      }
      case "slamTele": {
        this.setVelocity(this.knockVec.x, this.knockVec.y);
        if (this.modeTimer <= 0) this.doSlam(player);
        break;
      }
      case "chargeTele": {
        this.setVelocity(this.knockVec.x, this.knockVec.y);
        this.setTint(0xff9060);
        if (this.modeTimer <= 0) {
          this.clearTint();
          this.chargeDir.set(player.x - this.x, player.y - this.y).normalize();
          this.chargeTarget.set(player.x, player.y);
          this.setMode("charging", 520);
          this.chargeHitDone = false;
          this.scene.sfxDash();
        }
        break;
      }
      case "charging": {
        this.setVelocity(this.chargeDir.x * 520 + this.knockVec.x, this.chargeDir.y * 520 + this.knockVec.y);
        if (!this.chargeHitDone && dist < 64) {
          this.chargeHitDone = true;
          player.takeDamage(Math.round(BOSS_DEF.atk * 0.9), this.chargeDir.clone());
        }
        if (this.modeTimer <= 0) this.endAttack(1400);
        break;
      }
      case "volley": {
        this.setVelocity(this.knockVec.x, this.knockVec.y);
        break;
      }
      default:
        break;
    }

    if (Math.abs(this.body!.velocity.x) > 8) this.setFlipX(this.body!.velocity.x < 0);
  }

  private setMode(m: BossMode, t: number) {
    this.mode = m;
    this.modeTimer = t;
  }

  /* ---------- 스킬 1: 강타 (AOE) ---------- */

  private startSlam(player: PlayerLike2) {
    this.setMode("slamTele", 750);
    // 텔레그래프: 플레이어 현재 위치에 붉은 원 — 외부 에셋 링(Kenney CC0) 적색 틴트
    const ring = this.scene.add
      .image(player.x, player.y, "ring")
      .setDepth(5)
      .setTint(0xff5a5a)
      .setAlpha(0.4)
      .setScale(0.2);
    this.teleRings.push(ring);
    this.teleRing = ring;
    this.scene.tweens.add({ targets: ring, scale: 1, alpha: 0.9, duration: 720 });
    this.setTint(0xffb0a0);
  }

  private doSlam(player: PlayerLike2) {
    this.setTint(0xffffff);
    const ring = this.teleRing;
    if (ring) {
      const tx = ring.x;
      const ty = ring.y;
      this.scene.cameras.main.shake(90, 0.006);
      this.scene.spawnSlamBurst(tx, ty);
      this.scene.spawnCrack(tx, ty);
      if (Phaser.Math.Distance.Between(tx, ty, player.x, player.y) < 118) {
        const dir = new Phaser.Math.Vector2(player.x - tx, player.y - ty).normalize();
        player.takeDamage(Math.round(BOSS_DEF.atk * 1.2), dir);
      }
      this.scene.tweens.add({
        targets: ring,
        alpha: 0,
        duration: 160,
        onComplete: () => ring.destroy(),
      });
      this.teleRings = this.teleRings.filter((r) => r !== ring);
      this.teleRing = null;
    }
    this.clearTint();
    this.endAttack(1500);
  }

  /* ---------- 스킬 2: 돌진 ---------- */

  private startCharge(player: PlayerLike2) {
    void player;
    this.setMode("chargeTele", 550);
  }

  /* ---------- 스킬 3: 투사체 ---------- */

  private startVolley() {
    this.setMode("volley", 10);
    this.setTint(0x88a0ff);
    this.volleyCount = this.enraged ? 8 : 5;
    let remaining = this.volleyCount;
    this.volleyTimer?.remove();
    this.volleyTimer = this.scene.time.addEvent({
      delay: 130,
      repeat: this.volleyCount - 1,
      callback: () => {
        if (!this.alive) return;
        const target = this.scene.playerRef;
        if (!target) return;
        const base = Math.atan2(target.y - this.y, target.x - this.x);
        // 부채꼴 발사
        const spread = this.enraged ? 0.16 : 0.22;
        const n = this.enraged ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const a = base + (k === 0 ? 0 : k % 2 === 1 ? spread * k : -spread * (k - 1));
          this.fireOrb(a, 200);
        }
        this.scene.sfxSwing();
        remaining--;
        if (remaining <= 0) {
          this.clearTint();
          this.endAttack(1500);
        }
      },
    });
  }

  private fireOrb(angle: number, speed: number) {
    const orb = this.orbPool[this.orbIdx];
    this.orbIdx = (this.orbIdx + 1) % this.orbPool.length;
    orb.enableBody(true, this.x, this.y - 20, true, true);
    this.scene.physics.velocityFromRotation(angle, speed, orb.body!.velocity);
    orb.setScale(this.enraged ? 1.2 : 1);
    orb.setData("dmg", this.enraged ? Math.round(BOSS_DEF.atk * 0.75) : Math.round(BOSS_DEF.atk * 0.6));
    // 수명 후 자동 회수
    this.scene.time.delayedCall(3200, () => this.killOrb(orb));
  }

  private killOrb(orb: Phaser.Physics.Arcade.Image) {
    if (!orb.active) return;
    orb.disableBody(true, true);
  }

  private endAttack(cd: number) {
    this.mode = "idle";
    this.nextAttackCd = this.enraged ? cd * 0.55 : cd;
  }

  /* ---------- 피격/사망 ---------- */

  takeDamage(dmg: number, dir: Phaser.Math.Vector2, knock: number) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.knockVec.set(dir.x * knock * 0.12, dir.y * knock * 0.12); // 보스는 넉백 거의 안 됨
    // 타격감: 화이트 플래시
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.alive && this.active) this.clearTint();
    });
    this.scene.spawnDamageText(this.x + Phaser.Math.Between(-14, 14), this.y - 44, dmg);
    this.scene.spawnHitSpark(this.x, this.y - 30);
    EventBus.emit("boss:update", { hp: Math.max(0, this.hp), maxHp: this.maxHp });

    if (!this.enraged && this.hp <= this.maxHp * 0.5) {
      this.enraged = true;
      this.scene.sfxRoar();
      this.scene.cameras.main.shake(200, 0.008);
      this.scene.spawnEnrageBurst(this.x, this.y);
      this.scene.showBanner("심연의 수호자가 분노한다!");
      this.setTint(0xff7080);
      this.scene.time.delayedCall(500, () => this.alive && this.clearTint());
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.mode = "dead";
      this.volleyTimer?.remove();
      for (const orb of this.orbPool) this.killOrb(orb);
      for (const r of this.teleRings) r.destroy();
      this.teleRings = [];
      this.setVelocity(0, 0);
      EventBus.emit("boss:hide");
      this.scene.onBossDead();
      this.scene.time.delayedCall(900, () => this.destroy());
    }
  }

  destroyPool() {
    this.volleyTimer?.remove();
    for (const orb of this.orbPool) orb.destroy();
    for (const r of this.teleRings) r.destroy();
    this.orbPool = [];
    this.teleRings = [];
  }
}

export interface PlayerLike2 {
  x: number;
  y: number;
  hp: number;
  takeDamage(dmg: number, fromDir: Phaser.Math.Vector2): void;
}
