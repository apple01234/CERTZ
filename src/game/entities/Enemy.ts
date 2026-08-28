import Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import { ENEMIES, type EnemyDef, type EnemyKey } from "../data";

/** 종별 물리/판정 크기 + 리스폰 버스트 색 */
const BODY_CFG: Record<EnemyKey, { bw: number; bh: number; hw: number; hh: number; burst: number }> = {
  wolf: { bw: 36, bh: 20, hw: 56, hh: 30, burst: 0x9aa0b4 },
  minion: { bw: 18, bh: 24, hw: 30, hh: 32, burst: 0xb08ae8 },
  spider: { bw: 26, bh: 16, hw: 38, hh: 26, burst: 0xe86a5a },
  golem: { bw: 22, bh: 24, hw: 36, hh: 36, burst: 0xd8a86a },
  frostwolf: { bw: 36, bh: 20, hw: 56, hh: 30, burst: 0xa8d8fa },
  icegolem: { bw: 22, bh: 24, hw: 36, hh: 36, burst: 0xa8d8fa },
  wraith: { bw: 18, bh: 24, hw: 30, hh: 32, burst: 0xbe96eb },
};

/** 일반 몬스터 — 상태머신 AI, 풀링 친화적 단순 구조 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare scene: WorldScene;

  def: EnemyDef;
  hp: number;
  maxHp: number;
  alive = true;
  // 근접 판정용 목표 크기 (스프라이트 실제 크기 기준)
  hitW = 40;
  hitH = 30;

  private mode: "wander" | "chase" | "windup" | "cooldown" = "wander";
  private modeTimer = 0;
  private wanderDir = new Phaser.Math.Vector2();
  private knockVec = new Phaser.Math.Vector2();
  private homeX: number;
  private homeY: number;
  /** 리스폰용 원래 스폰 지점 (클래식 MMORPG — 죽은 자리가 아니라 스폰 지점에서 재생성) */
  get spawnX() {
    return this.homeX;
  }
  get spawnY() {
    return this.homeY;
  }
  private hpBar: Phaser.GameObjects.Rectangle | null = null;
  private hpBarBg: Phaser.GameObjects.Rectangle | null = null;
  private hitFlash = 0;

  constructor(scene: WorldScene, x: number, y: number, key: EnemyKey) {
    super(scene, x, y, `${key}_idle0`);
    this.def = ENEMIES[key];
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.homeX = x;
    this.homeY = y;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(9);
    const cfg = BODY_CFG[key];
    this.body!.setSize(cfg.bw, cfg.bh);
    this.body!.setOffset((this.width - cfg.bw) / 2, this.height - cfg.bh - 2);
    // 추격/넉백으로 맵 밖으로 밀려 나가지 않도록 경계 충돌
    (this.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.play(`${key}-idle`);
    // 스프라이트 크기에 맞춘 근접 판정 크기
    this.hitW = cfg.hw;
    this.hitH = cfg.hh;
  }

  /** 리스폰 버스트 색 (월드 씬에서 사용) */
  get burstTint() {
    return BODY_CFG[this.def.key].burst;
  }

  /** 씬에서 매 프레임 호출 */
  tick(dt: number, player: PlayerLike) {
    if (!this.alive) return;
    this.modeTimer -= dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.hitFlash <= 0 && this.tintTopLeft !== 0xffffff) this.clearTint();

    // 넉백 감쇠 (죽은 뒤 제외 — destroy 후 접근 방지)
    if (this.active) this.knockVec.scale(Math.pow(0.0016, dt / 1000));

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const toPlayer = new Phaser.Math.Vector2(player.x - this.x, player.y - this.y).normalize();

    let vx = 0;
    let vy = 0;

    switch (this.mode) {
      case "wander": {
        if (this.modeTimer <= 0) {
          this.modeTimer = Phaser.Math.Between(900, 2200);
          if (Math.random() < 0.45) this.wanderDir.set(0, 0);
          else
            this.wanderDir.set(
              Phaser.Math.Between(-1, 1),
              Phaser.Math.Between(-1, 1)
            ).normalize();
        }
        vx = this.wanderDir.x * this.def.speed * 0.35;
        vy = this.wanderDir.y * this.def.speed * 0.35;
        if (dist < this.def.aggro && player.hp > 0) this.setMode("chase", 400);
        break;
      }
      case "chase": {
        vx = toPlayer.x * this.def.speed;
        vy = toPlayer.y * this.def.speed;
        if (dist <= 44 && player.hp > 0) {
          this.setMode("windup", 340);
          this.setTint(0xffb0a0); // 예고 플래시
        } else if (dist > this.def.aggro * 1.5) {
          this.setMode("wander", 600);
        }
        break;
      }
      case "windup": {
        // 공격 예고: 제자리에서 부들부들
        vx = Math.sin(this.scene.time.now * 0.06) * 12;
        vy = 0;
        if (this.modeTimer <= 0) {
          if (dist <= 58) {
            player.takeDamage(this.def.atk, toPlayer);
          }
          this.setMode("cooldown", 620);
          this.clearTint();
        }
        break;
      }
      case "cooldown": {
        vx = -toPlayer.x * this.def.speed * 0.3; // 살짝 물러남
        vy = -toPlayer.y * this.def.speed * 0.3;
        if (this.modeTimer <= 0) this.setMode("chase", 0);
        break;
      }
    }

    this.setVelocity(vx + this.knockVec.x, vy + this.knockVec.y);

    // 애니메이션 & 방향
    const moving = Math.abs(vx) + Math.abs(vy) > 12;
    const runKey = `${this.def.key}-run`;
    const idleKey = `${this.def.key}-idle`;
    if (moving && this.anims.currentAnim?.key !== runKey) this.play(runKey);
    else if (!moving && this.anims.currentAnim?.key !== idleKey) this.play(idleKey);
    if (vx !== 0) this.setFlipX(vx < 0);

    // HP바
    if (this.hpBar && this.hpBarBg) {
      const show = this.hp < this.maxHp;
      this.hpBarBg.setVisible(show).setPosition(this.x, this.y - this.displayHeight / 2 - 8);
      this.hpBar.setVisible(show).setPosition(this.x, this.y - this.displayHeight / 2 - 8);
      this.hpBar.width = Math.max(1, (24 * this.hp) / this.maxHp);
    }
  }

  private setMode(m: typeof this.mode, t: number) {
    this.mode = m;
    this.modeTimer = t;
  }

  takeDamage(dmg: number, dir: Phaser.Math.Vector2, knock: number, crit = false) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.hitFlash = 90;
    // 타격감: 화이트 플래시 (기존 빨간 틴트보다 명확한 피격 피드백)
    this.setTintFill(0xffffff);
    this.knockVec.set(dir.x * knock, dir.y * knock);
    this.scene.spawnDamageText(this.x, this.y - 20, dmg, crit);
    this.scene.spawnHitSpark(this.x, this.y);
    if (this.hpBarBg === null) {
      this.hpBarBg = this.scene.add.rectangle(this.x, this.y, 26, 4, 0x22262e).setDepth(20);
      this.hpBar = this.scene.add.rectangle(this.x, this.y, 24, 2, 0xe84a5a).setDepth(21);
    }
    if (this.hp <= 0) this.die();
  }

  private die() {
    this.alive = false;
    this.scene.sfxEnemyDie();
    this.scene.spawnDeathBurst(this.x, this.y);
    // 2D MMORPG 기본 요소: 골드/물약 드롭
    this.scene.dropLoot(this.x, this.y, this.def);
    if (this.hpBar) this.hpBar.destroy();
    if (this.hpBarBg) this.hpBarBg.destroy();
    this.hpBar = null;
    this.hpBarBg = null;
    const exp = this.def.exp;
    const sx = this.spawnX;
    const sy = this.spawnY;
    // ⚠️ destroy()가 this.scene을 null로 만들므로 반드시 먼저 캡처
    //   (늑대 퀘스트가 끝까지 진행 안 되던 근본 원인)
    const scene = this.scene;
    scene.time.delayedCall(60, () => {
      if (!scene.scene.isActive()) return;
      scene.onEnemyKilled(this.def.key, exp, sx, sy);
      this.destroy();
    });
  }

  /** 부활 캠핑 방지 — 원래 스폰 지점 복귀 + 어그로 해제 (플레이어 부활 시 호출) */
  resetHome() {
    this.setPosition(this.homeX, this.homeY);
    this.knockVec.set(0, 0);
    this.setVelocity(0, 0);
    this.setMode("wander", 600);
    this.clearTint();
  }

  destroyAll() {
    if (this.hpBar) this.hpBar.destroy();
    if (this.hpBarBg) this.hpBarBg.destroy();
    this.destroy();
  }
}

/** 순환 import 회피용 최소 인터페이스 */
export interface PlayerLike {
  x: number;
  y: number;
  hp: number;
  takeDamage(dmg: number, fromDir: Phaser.Math.Vector2): void;
}
