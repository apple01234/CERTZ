import Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";

/**
 * 주인공 세르츠.
 * F5 핵심 개선:
 *  - 3프레임 베기 모션(등뒤 준비 → 수평 베기 → 내려베기) + 참격 초승달 이펙트
 *  - X축 히트박스 대폭 확대(전방 130px) — 사용자 지적 사항
 *  - 전방 러지(전진 모멘텀) + 히트스톱 + 넉백으로 '베는 맛' 강화
 *  - 상하 공격도 지원 (마지막 이동 방향 기준 4방향)
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

  constructor(scene: WorldScene, x: number, y: number) {
    super(scene, x, y, "hero_idle0");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    // 96x64 캔버스 (몸 중심 x=48, 발 y=64) 기준 히트박스
    this.body!.setSize(20, 44);
    this.body!.setOffset(38, 20);
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
        if (this.anims.currentAnim?.key !== "hero-idle") this.play("hero-idle");
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

    // 전방 러지 — 베는 순간 살짝 전진해 타격감 부여
    const dir = this.aimDir();
    this.setVelocity(dir.x * 330, dir.y * 330);

    // 실제 방향별 베기 프레임 (측면/위/아래 4프레임 스윙)
    const atkKey = dir.y > 0 ? "hero-atk-down" : dir.y < 0 ? "hero-atk-up" : "hero-atk";
    this.setFlipX(dir.y === 0 && dir.x < 0); // 측면 시트는 오른쪽 기준
    this.play(atkKey);

    // 베기 타이밍: 70ms 후 판정+참격 (모션 2프레임 시점)
    this.scene.time.delayedCall(70, () => {
      if (this.state !== "attack") return;
      this.scene.spawnSlash(this.x, this.y, dir, this.slashAlt);
      this.scene.sfxSwing();
      this.checkMeleeHit(dir, 130, 76, 1.0, 230);
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

  /** 광역 근접 판정 — rect 방식으로 X축 사거리를 넉넉하게 */
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
      const ex = e.x - cx;
      const ey = (e.y - cy) * 1.15; // 조금 관대하게
      if (Math.abs(ex) <= halfW && Math.abs(ey) <= halfH) {
        this.hitSet.add(e);
        hits++;
        e.takeDamage(Math.round(this.atk * dmgMul), dir, knock);
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
    this.scene.sfxSpin();

    const ring = this.scene.spawnSpinRing(this.x, this.y);
    this.scene.time.delayedCall(90, () => {
      // 360° 전체 판정
      for (const e of this.scene.getAllTargets()) {
        if (!e.active || this.hitSet.has(e)) continue;
        const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
        if (d <= 118) {
          this.hitSet.add(e);
          const away = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
          e.takeDamage(Math.round(this.atk * 1.6), away, 300);
        }
      }
      this.scene.onMeleeConnect(1);
    });
    this.scene.time.delayedCall(260, () => {
      ring.destroy();
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
            e.takeDamage(Math.round(this.atk * 2.1), dir, 360);
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
    this.hp -= dmg;
    this.iframes = 600;
    this.scene.sfxHurt();
    this.scene.cameras.main.shake(70, 0.004);
    this.setVelocity(fromDir.x * 200, fromDir.y * 200);
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
      this.atk += 3;
      this.hp = this.maxHp;
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
