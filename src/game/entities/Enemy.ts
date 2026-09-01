import Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import { DMG_PCT } from "../data";
import { ENEMIES, type EnemyDef, type EnemyKey } from "../data";
import { FSM, type FSMState } from "../ai/FSM";
/** 종별 물리/판정 크기 + 리스폰 버스트 색 */
const BODY_CFG: Record<EnemyKey, { bw: number; bh: number; hw: number; hh: number; burst: number }> = {
  wolf: { bw: 36, bh: 20, hw: 56, hh: 30, burst: 0x9aa0b4 },
  minion: { bw: 18, bh: 24, hw: 30, hh: 32, burst: 0xb08ae8 },
  spider: { bw: 26, bh: 16, hw: 38, hh: 26, burst: 0xe86a5a },
  golem: { bw: 22, bh: 24, hw: 36, hh: 36, burst: 0xd8a86a },
  frostwolf: { bw: 36, bh: 20, hw: 56, hh: 30, burst: 0xa8d8fa },
  icegolem: { bw: 22, bh: 24, hw: 36, hh: 36, burst: 0xa8d8fa },
  wraith: { bw: 18, bh: 24, hw: 30, hh: 32, burst: 0xbe96eb },
  swampbeast: { bw: 22, bh: 24, hw: 36, hh: 36, burst: 0x8ade7a },
  emberwolf: { bw: 36, bh: 20, hw: 56, hh: 30, burst: 0xffa05a },
  firespirit: { bw: 22, bh: 24, hw: 36, hh: 36, burst: 0xffc06a },
  runegolem: { bw: 22, bh: 24, hw: 36, hh: 36, burst: 0xffe08a },
  helhound: { bw: 36, bh: 20, hw: 56, hh: 30, burst: 0xe86a8a },
  // v3.0.2 — 신규 종 9종 (50 Monsters Pack, CC0)
  x2_frog: { bw: 22, bh: 18, hw: 34, hh: 30, burst: 0x6ab0c8 },
  x2_rat: { bw: 24, bh: 16, hw: 38, hh: 24, burst: 0xa8a0b8 },
  x2_bat: { bw: 24, bh: 16, hw: 36, hh: 24, burst: 0x9a6ad8 },
  x2_firebird: { bw: 24, bh: 20, hw: 36, hh: 30, burst: 0xffa05a },
  x2_frostfly: { bw: 20, bh: 16, hw: 32, hh: 24, burst: 0xa8e0fa },
  x2_snail: { bw: 24, bh: 18, hw: 36, hh: 26, burst: 0xc8b08a },
  x2_stonegolem: { bw: 24, bh: 24, hw: 38, hh: 38, burst: 0xb0a890 },
  x2_darkhound: { bw: 34, bh: 20, hw: 54, hh: 30, burst: 0x8a5aaa },
  x2_reeffish: { bw: 24, bh: 18, hw: 36, hh: 28, burst: 0x5ab0d8 },
  // v3.0.3 — 0x72 DungeonTileset II (itch.io, CC0) 신규 7종
  x3_swampy: { bw: 24, bh: 16, hw: 38, hh: 26, burst: 0x7ade4a },
  x3_imp: { bw: 20, bh: 18, hw: 34, hh: 30, burst: 0xff8a3a },
  x3_icezombie: { bw: 20, bh: 22, hw: 32, hh: 32, burst: 0xa8e0fa },
  x3_tinyzombie: { bw: 20, bh: 18, hw: 32, hh: 28, burst: 0x8ab07a },
  x3_ogre: { bw: 28, bh: 26, hw: 44, hh: 42, burst: 0xd8a86a },
  x3_chort: { bw: 20, bh: 20, hw: 34, hh: 34, burst: 0xe86450 },
  x3_necromancer: { bw: 20, bh: 22, hw: 34, hh: 34, burst: 0x9a6ad8 },
  // v3.0.4 — itch.io 0x72 팩 추가 6종
  x3_maskedorc: { bw: 22, bh: 22, hw: 36, hh: 36, burst: 0xc86a4a },
  x3_orcwarrior: { bw: 24, bh: 22, hw: 38, hh: 36, burst: 0x8aa85a },
  x3_orcshaman: { bw: 22, bh: 22, hw: 36, hh: 36, burst: 0x6ac8a8 },
  x3_wogol: { bw: 22, bh: 20, hw: 36, hh: 32, burst: 0xd86a8a },
  x3_goblin: { bw: 20, bh: 16, hw: 32, hh: 26, burst: 0x8ade6a },
  x3_bigzombie: { bw: 30, bh: 26, hw: 46, hh: 44, burst: 0x9ab08a },
};

/**
 * FSM 문맥 — 매 프레임 거리 밴드 판정에 필요한 값 (객체 재사용 → GC 0)
 * 거리 밴드: LONG(어그로 밖) / MID(어그로 이내) / SHORT(근접 공격 범위)
 */
interface AICtx {
  enemy: Enemy;
  player: PlayerLike;
  dist: number;
  toPlayer: Phaser.Math.Vector2;
  vx: number;
  vy: number;
}

/**
 * 일반 몬스터 — 거리 기반 FSM 상태머신 AI (풀링 친화적 단순 구조)
 *
 *   wander(LONG: 배회) → chase(MID: 추격) → windup(SHORT: 예고 후 공격) → cooldown(물러남) → chase…
 *
 * 상태 전이 규칙과 모든 수치는 FSM 도입 전과 동일하다 (구조 개선 — 동작 보존).
 * 상태 추가 예시: 원거리형 몬스터라면 chase와 windup 사이에 "keepDistance(사거리 유지)" 상태를
 * FSM에 add() 한 줄로 끼워 넣으면 된다.
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare scene: WorldScene;

  def: EnemyDef;
  /** v3.0.6 — maxHP % 고정 피해 하한 (정예는 생성 후 상향 설정) */
  dmgPct: number = DMG_PCT.mob;
  hp: number;
  maxHp: number;
  alive = true;
  // 근접 판정용 목표 크기 (스프라이트 실제 크기 기준)
  hitW = 40;
  hitH = 30;

  /* v3.0.3 — 상태이상 (시간왜곡 필드 감속 / 이터널 루프 기절) */
  private slowUntil = 0;
  private slowMult = 1;
  private stunUntil = 0;
  /** 돌진형 전용 — 돌진 방향 캐시 */
  private chargeDir = new Phaser.Math.Vector2();

  applySlow(mult: number, durMs: number) {
    this.slowMult = Math.min(this.slowMult, mult);
    this.slowUntil = Math.max(this.slowUntil, this.scene.time.now + durMs);
  }

  applyStun(durMs: number) {
    this.stunUntil = Math.max(this.stunUntil, this.scene.time.now + durMs);
  }

  /** 감속 반영 실효 속도 */
  private get effSpeed(): number {
    return this.def.speed * (this.scene.time.now < this.slowUntil ? this.slowMult : 1);
  }

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

  private ai: FSM<AICtx>;
  private aiCtx: AICtx;

  /** 화면 표시명 (정예/시험 상대 등 변형 개체 — null이면 종명 사용) */
  displayName: string | null = null;

  /**
   * v2.0 — 챕터/구역 난이도 배율 opts 지원
   *   hp/atk/exp/gold: 기본 정의 대비 배율, scale: 스프라이트 확대, tint: 엘리트 틴트
   */
  constructor(
    scene: WorldScene,
    x: number,
    y: number,
    key: EnemyKey,
    opts?: { hp?: number; atk?: number; exp?: number; gold?: number; scale?: number; tint?: number; displayName?: string }
  ) {
    super(scene, x, y, `${key}_idle0`);
    const base = ENEMIES[key];
    if (opts && (opts.hp !== undefined || opts.atk !== undefined || opts.exp !== undefined || opts.gold !== undefined)) {
      this.def = {
        ...base,
        hp: Math.round(base.hp * (opts.hp ?? 1)),
        atk: Math.round(base.atk * (opts.atk ?? 1) * 10) / 10,
        exp: Math.round(base.exp * (opts.exp ?? 1)),
        gold: [
          Math.max(1, Math.round(base.gold[0] * (opts.gold ?? 1))),
          Math.max(1, Math.round(base.gold[1] * (opts.gold ?? 1))),
        ],
      };
    } else {
      this.def = base;
    }
    if (opts?.scale) this.setScale(opts.scale);
    if (opts?.tint !== undefined) this.setTint(opts.tint);
    if (opts?.displayName) this.displayName = opts.displayName;
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.homeX = x;
    this.homeY = y;

    /* ---------- 거리 기반 FSM 상태 등록 ---------- */
    /* v3.0.3 — profile.ranged/charge에 따라 같은 뼈대라도 전투 방식이 완전히 달라진다:
     *  근접형: chase → windup(예고) → 근접타
     *  원거리형: chase(사거리 밖 접근, 너무 붙으면 후퇴) → windup(주문 시전) → 투사체 발사
     *  돌진형: chase → windup(조준 예고) → chargeDash(직선 돌진) → cooldown */
    this.aiCtx = {
      enemy: this,
      player: null as unknown as PlayerLike,
      dist: 0,
      toPlayer: new Phaser.Math.Vector2(),
      vx: 0,
      vy: 0,
    };
    this.ai = new FSM<AICtx>(this.aiCtx);
    const prof = this.def.profile;
    const wanderState: FSMState<AICtx> = {
      name: "wander", // LONG — 어그로 밖: 배회
      update: (c) => {
        const e = c.enemy;
        if (e.modeTimer <= 0) {
          e.modeTimer = Phaser.Math.Between(900, 2200);
          if (Math.random() < 0.45) e.wanderDir.set(0, 0);
          else e.wanderDir.set(Phaser.Math.Between(-1, 1), Phaser.Math.Between(-1, 1)).normalize();
        }
        c.vx = e.wanderDir.x * e.effSpeed * 0.35;
        c.vy = e.wanderDir.y * e.effSpeed * 0.35;
        if (c.dist < e.def.aggro && c.player.hp > 0) {
          e.modeTimer = 400;
          return "chase";
        }
      },
    };
    const chaseState: FSMState<AICtx> = {
      name: "chase", // MID — 어그로 이내: 추격
      update: (c) => {
        const e = c.enemy;
        const rng = prof?.ranged;
        if (rng) {
          /* 원거리 캐스터 — 사거리 내 접근 시 시전, 너무 붙으면 뒤로 키팅 */
          if (c.dist <= rng.range && c.player.hp > 0) {
            e.modeTimer = 360;
            return "windup";
          }
          if (c.dist < rng.range * 0.4) {
            c.vx = -c.toPlayer.x * e.effSpeed;
            c.vy = -c.toPlayer.y * e.effSpeed;
            return;
          }
          c.vx = c.toPlayer.x * e.effSpeed;
          c.vy = c.toPlayer.y * e.effSpeed;
          if (c.dist > e.def.aggro * 1.5) {
            e.modeTimer = 600;
            return "wander";
          }
          return;
        }
        c.vx = c.toPlayer.x * e.effSpeed;
        c.vy = c.toPlayer.y * e.effSpeed;
        const meleeBand = prof?.charge ? 230 : 44;
        if (c.dist <= meleeBand && c.player.hp > 0) {
          e.modeTimer = prof?.charge ? 480 : 340;
          return "windup"; // SHORT — 근접/돌진 조준: 예고 동작 진입
        } else if (c.dist > e.def.aggro * 1.5) {
          e.modeTimer = 600;
          return "wander";
        }
      },
    };
    const windupState: FSMState<AICtx> = {
      name: "windup", // SHORT — 공격 예고: 제자리 부들부들 / 원거리는 주문 시전 / 돌진형은 조준 플래시
      enter: (c) => c.enemy.setTint(prof?.charge ? 0xffd0b0 : 0xffb0a0),
      update: (c) => {
        const e = c.enemy;
        c.vx = Math.sin(e.scene.time.now * 0.06) * 12;
        c.vy = 0;
        if (e.modeTimer > 0) return;
        const rng = prof?.ranged;
        if (rng) {
          // 원거리 — 투사체 발사 (사거리 이탈했으면 재추격)
          if (c.dist <= rng.range * 1.1 && c.player.hp > 0) {
            const ang = Math.atan2(c.player.y - e.y, c.player.x - e.x);
            e.scene.fireEnemyProj({
              x: e.x, y: e.y - 6,
              angle: ang, speed: rng.projSpeed,
              dmg: Math.round(e.def.atk * 1.1),
              anim: rng.projAnim,
              tint: e.burstTint,
            });
            e.modeTimer = 620;
            return "cooldown";
          }
          e.modeTimer = 300;
          return "chase";
        }
        if (prof?.charge) {
          // 돌진형 — 조준 후 직선 돌진 (돌진 경로 스윕 판정은 chargeDash에서)
          e.chargeDir.copy(c.toPlayer);
          e.modeTimer = prof.charge.time;
          return "chargeDash";
        }
        if (c.dist <= 58) {
          c.player.takeDamage(e.def.atk, c.toPlayer, 0, e.dmgPct); // v3.0.6 — maxHP % 하한
          /* v3.0.3 — 접촉 공격 상태이상 (출혈/독/감속) */
          const ap = prof?.apply;
          if (ap && Math.random() < ap.chance) {
            c.player.applyEnemyStatus(ap.kind, ap.dps, ap.dur);
          }
        }
        e.modeTimer = 620;
        return "cooldown";
      },
    };
    const chargeDashState: FSMState<AICtx> = {
      name: "chargeDash", // v3.0.3 — 돌진형 전용: 조준 방향 직선 돌진 (접촉 판정)
      enter: (c) => {
        c.enemy.setTint(0xff8060);
        c.enemy.scene.sfxDash?.();
      },
      update: (c) => {
        const e = c.enemy;
        const prof2 = e.def.profile?.charge;
        if (!prof2) return "chase";
        c.vx = e.chargeDir.x * prof2.speed;
        c.vy = e.chargeDir.y * prof2.speed;
        // 돌진 접촉 판정 — 플레이어 원판
        if (c.dist <= 40 && c.player.hp > 0) {
          c.player.takeDamage(e.def.atk * 1.3, e.chargeDir, 0, Math.min(0.09, e.dmgPct * 1.3)); // v3.0.6
          const ap = e.def.profile?.apply;
          if (ap && Math.random() < ap.chance) c.player.applyEnemyStatus(ap.kind, ap.dps, ap.dur);
          e.modeTimer = 700;
          e.scene.spawnBurstAt(e.x, e.y, 8, e.burstTint);
          return "cooldown";
        }
        if (e.modeTimer <= 0) {
          e.modeTimer = 700;
          return "cooldown";
        }
      },
    };
    const cooldownState: FSMState<AICtx> = {
      name: "cooldown", // 공격 후 — 살짝 물러남
      enter: (c) => c.enemy.clearTint(),
      update: (c) => {
        c.vx = -c.toPlayer.x * c.enemy.effSpeed * 0.3;
        c.vy = -c.toPlayer.y * c.enemy.effSpeed * 0.3;
        if (c.enemy.modeTimer <= 0) {
          c.enemy.modeTimer = 0;
          return "chase";
        }
      },
    };
    this.ai.add(wanderState, chaseState, windupState, cooldownState);
    if (prof?.charge) this.ai.add(chargeDashState);
    this.ai.set("wander");

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
    // v2.0 프롤로그 보호 — 인트로/입장 유예 중 어그로·공격 차단 (제자리 대기)
    if (this.scene.isPrologueSafe) {
      this.setVelocity(0, 0);
      if (this.anims.currentAnim?.key !== `${this.def.key}-idle`) this.play(`${this.def.key}-idle`);
      if (this.hpBar && this.hpBarBg) {
        const show = this.hp < this.maxHp;
        this.hpBarBg.setVisible(show).setPosition(this.x, this.y - this.displayHeight / 2 - 8);
        this.hpBar.setVisible(show).setPosition(this.x, this.y - this.displayHeight / 2 - 8);
      }
      return;
    }

    /* v3.0.3 — 기절(시간 정지): FSM 정지 + 애니 정지 + 반짝임 */
    if (this.scene.time.now < this.stunUntil) {
      this.setVelocity(0, 0);
      if (this.anims.isPlaying) this.anims.pause();
      this.setTint(0xb0a0ff);
      if (this.hpBar && this.hpBarBg) {
        this.hpBarBg.setPosition(this.x, this.y - this.displayHeight / 2 - 8);
        this.hpBar.setPosition(this.x, this.y - this.displayHeight / 2 - 8);
      }
      return;
    } else if (this.anims.isPaused) {
      this.anims.resume();
      this.clearTint();
    }

    // 넉백 감쇠 (죽은 뒤 제외 — destroy 후 접근 방지)
    if (this.active) this.knockVec.scale(Math.pow(0.0016, dt / 1000));

    // FSM 문맥 갱신 — 거리/방향을 1회 계산해 상태들과 공유
    const c = this.aiCtx;
    c.player = player;
    c.dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    c.toPlayer.set(player.x - this.x, player.y - this.y).normalize();
    c.vx = 0;
    c.vy = 0;

    this.ai.update(dt);

    this.setVelocity(c.vx + this.knockVec.x, c.vy + this.knockVec.y);

    // 애니메이션 & 방향
    const moving = Math.abs(c.vx) + Math.abs(c.vy) > 12;
    const runKey = `${this.def.key}-run`;
    const idleKey = `${this.def.key}-idle`;
    if (moving && this.anims.currentAnim?.key !== runKey) this.play(runKey);
    else if (!moving && this.anims.currentAnim?.key !== idleKey) this.play(idleKey);
    if (c.vx !== 0) this.setFlipX(c.vx > 0); // v3.0.10 — 몬스터 시트(32rogues/0x72 등) 기본 왼쪽 향함 → 오른쪽 이동 시 flip

    // HP바
    if (this.hpBar && this.hpBarBg) {
      const show = this.hp < this.maxHp;
      this.hpBarBg.setVisible(show).setPosition(this.x, this.y - this.displayHeight / 2 - 8);
      this.hpBar.setVisible(show).setPosition(this.x, this.y - this.displayHeight / 2 - 8);
      this.hpBar.width = Math.max(1, (24 * this.hp) / this.maxHp);
    }
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
    // v2.2 타격감 — 스쿼시(눌림) 반동: 맞은 순간 납작해졌다 복귀
    const sx = this.scaleX;
    const sy = this.scaleY;
    this.scene.tweens.killTweensOf(this);
    this.setScale(sx * 1.16, sy * 0.84);
    this.scene.tweens.add({ targets: this, scaleX: sx, scaleY: sy, duration: 110, ease: "Back.out" });
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
    /* v3.0.3 — 사망 장판 (늪지 독괴물 등 — 죽어도 독 구덩이를 남긴다) */
    const fod = this.def.profile?.fieldOnDeath;
    if (fod) {
      this.scene.spawnField({
        x: this.x, y: this.y, radius: fod.radius, dur: fod.dur, dps: fod.dps,
        kind: fod.kind, owner: "enemy",
      });
    }
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
    this.modeTimer = 600;
    this.ai.set("wander");
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
  /** v3.0.6 — hpPct: maxHP % 고정 피해 하한 (몬스터 공격 전용) */
  takeDamage(dmg: number, fromDir: Phaser.Math.Vector2, pierce?: number, hpPct?: number): void;
  /** v3.0.3 — 몬스터 상태이상 부여 (출혈/독/감속) */
  applyEnemyStatus(kind: "bleed" | "poison" | "slow", dps: number, durMs: number): void;
}
