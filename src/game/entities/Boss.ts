import Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import type { BossDef, BossAttackKind } from "../data";
import { EventBus } from "../../components/game/EventBus";

/**
 * 보스 (3종 — 스테이지별 정의 주입):
 *  guardian: 심연의 수호자 (알프헤임) / behemoth: 눈보라의 거수 (니플헤임) / abysslord: 심연의 군주 (심연의 왕좌)
 * F4 최적화 핵심:
 *  - 투사체는 24발 고정 풀 재사용 (런타임 생성/파괴 없음)
 *  - 텔레그래프는 미리 만든 텍스처 스프라이트 트윈 (매 프레임 Graphics 그리기 없음)
 *  - 파티클은 씬의 공유 이미터 explode() 재사용
 */
type BossMode =
  | "idle"
  | "slamTele"
  | "chargeTele"
  | "charging"
  | "volley"
  | "ringTele"
  | "zonesTele"
  | "summonTele"
  | "dead";

export class Boss extends Phaser.Physics.Arcade.Sprite {
  declare scene: WorldScene;

  def: BossDef;
  hp: number;
  maxHp: number;
  alive = true;
  enraged = false;
  /** 현재 페이즈 (1: 100~66%, 2: 66~33%, 3: 33%~0) */
  phase = 1;
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
  /** 장판 패턴(존스)용 예고 링들 */
  private zoneRings: Phaser.GameObjects.Image[] = [];
  private chargeTarget = new Phaser.Math.Vector2();
  private volleyCount = 0;
  private volleyTimer: Phaser.Time.TimerEvent | null = null;
  private chargeHitDone = false;
  /** 직전 공격 종류 — 같은 패턴 연속 반복 방지 */
  private lastAttack: BossAttackKind | null = null;

  // F4: 투사체 고정 풀
  private orbPool: Phaser.Physics.Arcade.Image[] = [];
  private orbIdx = 0;

  constructor(scene: WorldScene, x: number, y: number, def: BossDef) {
    super(scene, x, y, `${def.tex}_idle0`);
    this.def = def;
    this.hp = def.hp;
    this.maxHp = def.hp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(11);
    // 보스 스프라이트 크기에 비례한 히트박스/근접 판정 (94x144 / 110x180 / 117x140 대응)
    const bw = Math.round(this.width * 0.66);
    const bh = Math.round(this.height * 0.6);
    this.body!.setSize(bw, bh);
    this.body!.setOffset((this.width - bw) / 2, this.height - bh - 6);
    this.hitW = Math.round(this.width * 0.92);
    this.hitH = Math.round(this.height * 0.92);
    // 돌진/넉백으로 아레나 밖으로 나가지 않도록 경계 충돌
    (this.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.play(`${def.tex}-idle`);

    for (let i = 0; i < 44; i++) {
      const orb = scene.physics.add.image(0, 0, "orb");
      // 외부 에셋 구슬(Kenney circle_05) — 보스별 테마색 발광 에너지탄
      orb.setTint(def.orbTint).setBlendMode(Phaser.BlendModes.ADD);
      orb.setActive(false).setVisible(false);
      orb.setData("dmg", def.atk);
      (orb.body as Phaser.Physics.Arcade.Body).setCircle(7);
      this.orbPool.push(orb);
    }
  }

  tick(dt: number, player: PlayerLike2) {
    if (!this.alive) return;
    this.modeTimer -= dt;
    this.knockVec.scale(Math.pow(0.002, dt / 1000));

    // v2.0 프롤로그 보호 — 인트로/입장 유예 중 보스 행동 정지 (투사체는 유지)
    if (this.scene.isPrologueSafe) {
      this.setVelocity(0, 0);
      if (this.anims.currentAnim?.key !== `${this.def.tex}-idle`) this.play(`${this.def.tex}-idle`);
      return;
    }

    const toPlayer = new Phaser.Math.Vector2(player.x - this.x, player.y - this.y).normalize();
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    this.updatePhase();

    // 투사체-플레이어 충돌 (풀 순회, 44개 고정 — 저렴함)
    // v3.0.6 — 보스 공격은 방어력 50% 관통 (pierce 0.5)
    for (const orb of this.orbPool) {
      if (!orb.active) continue;
      if (Phaser.Math.Distance.Between(orb.x, orb.y, player.x, player.y) < 26) {
        player.takeDamage(
          orb.getData("dmg"),
          new Phaser.Math.Vector2(orb.body!.velocity.x, orb.body!.velocity.y).normalize(),
          0.5,
          0.09 // v3.0.6 — 보스 탄막 maxHP % 하한
        );
        this.killOrb(orb);
      }
      if (orb.active && (orb.x < 0 || orb.x > this.scene.stageW || orb.y < 0 || orb.y > this.scene.stageH)) {
        this.killOrb(orb);
      }
    }
    // v3.0.6 — 격노 시 추격 속도 상승
    const chaseMul = this.enraged ? 1.18 : 1;

    switch (this.mode) {
      case "idle": {
        // 추격하며 접근 — v3.0.6: 페이즈별 속도 (격노 1.18배)
        this.setVelocity(toPlayer.x * this.def.speed * chaseMul + this.knockVec.x, toPlayer.y * this.def.speed * chaseMul + this.knockVec.y);
        this.nextAttackCd -= dt;
        if (this.nextAttackCd <= 0 && dist < 560 && player.hp > 0) {
          this.pickAttack(player, dist);
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
          player.takeDamage(Math.round(this.def.atk * 1.1), this.chargeDir.clone(), 0.5, 0.10); // v3.0.6 — 관통 + maxHP % 하한
        }
        if (this.modeTimer <= 0) this.endAttack(1400);
        break;
      }
      case "ringTele": {
        this.setVelocity(this.knockVec.x, this.knockVec.y);
        if (this.modeTimer <= 0) this.doRing();
        break;
      }
      case "zonesTele": {
        this.setVelocity(this.knockVec.x, this.knockVec.y);
        if (this.modeTimer <= 0) this.doZones(player);
        break;
      }
      case "summonTele": {
        this.setVelocity(this.knockVec.x, this.knockVec.y);
        if (this.modeTimer <= 0) this.doSummon();
        break;
      }
      case "volley": {
        this.setVelocity(this.knockVec.x, this.knockVec.y);
        break;
      }
      default:
        break;
    }

    if (Math.abs(this.body!.velocity.x) > 8) this.setFlipX(this.body!.velocity.x > 0); // v3.0.10 — 보스 시트 왼쪽 기준 → flip 반전
  }

  /* ---------- 페이즈 관리 ---------- */

  /** HP 비율 기준 페이즈 계산 — 전환 시 연출 + 패턴 풀 확장 */
  private updatePhase() {
    const r = this.hp / this.maxHp;
    const next = r > 0.66 ? 1 : r > 0.33 ? 2 : 3;
    if (next > this.phase) {
      this.phase = next;
      this.onPhaseChange();
    }
  }

  private onPhaseChange() {
    if (!this.alive) return;
    this.volleyTimer?.remove();
    this.clearTint();
    this.mode = "idle";
    this.nextAttackCd = 900;
    if (this.phase === 3) this.enraged = true;
    this.scene.sfxRoar();
    this.scene.cameras.main.shake(220, this.phase === 3 ? 0.01 : 0.007);
    this.scene.spawnBurstAt(this.x, this.y, 20, this.def.orbTint);
    this.scene.showBanner(
      this.phase === 3
        ? `${this.def.name} — 최후의 힘을 해방한다!`
        : `${this.def.name} — 2 페이즈!`
    );
    // 페이즈 전환 플래시
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(120, () => this.alive && this.clearTint());
  }

  /** 페이즈 패턴 풀에서 공격 선택 (직전 공격 제외 — 연속 반복 방지) */
  private pickAttack(player: PlayerLike2, dist: number) {
    const pool =
      this.phase === 1 ? this.def.patterns.p1 : this.phase === 2 ? this.def.patterns.p2 : this.def.patterns.p3;
    let candidates = pool.filter((k) => k !== this.lastAttack);
    if (candidates.length === 0) candidates = pool;
    const kind = Phaser.Utils.Array.GetRandom(candidates);
    this.lastAttack = kind;
    switch (kind) {
      case "slam":
        this.startSlam(player);
        break;
      case "charge":
        this.startCharge(player);
        break;
      case "volley":
        this.startVolley();
        break;
      case "ring":
        this.startRing();
        break;
      case "zones":
        this.startZones(player);
        break;
      case "summon":
        this.startSummon();
        break;
    }
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
        player.takeDamage(Math.round(this.def.atk * 1.35), dir, 0.5, 0.12); // v3.0.6 — 관통 + 강타 maxHP % 하한
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
  /** 페이즈별 탄 수 증가 (1:5 / 2:7 / 3:12) — v3.0.6: 보스 강화 */
    this.volleyCount = this.phase === 1 ? 5 : this.phase === 2 ? 7 : 12;
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
        // 부채꼴 발사 — 페이즈가 오를수록 좁고 촘촘
        const spread = this.phase === 3 ? 0.14 : 0.22;
        const n = this.phase >= 2 ? 2 : 1;
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

  /* ---------- 스킬 4: 원형 탄막 (링) ---------- */

  private startRing() {
    this.setMode("ringTele", 420);
    this.setTint(0xffe08a);
  }

  private doRing() {
    this.clearTint();
    // 보스를 중심으로 방사형 탄막 — 페이즈 3은 2연속 파동 (v3.0.6: 탄수 상향 12/16/20)
    const waves = this.phase === 3 ? 2 : 1;
    const count = this.phase === 1 ? 12 : this.phase === 2 ? 16 : 20;
    for (let w = 0; w < waves; w++) {
      this.scene.time.delayedCall(w * 340, () => {
        if (!this.alive) return;
        const offset = w * 0.19; // 두 번째 파동은 틀어진 각도 — 틈새 사격
        for (let i = 0; i < count; i++) {
          this.fireOrb(offset + (Math.PI * 2 * i) / count, 165 + w * 25, Math.round(this.def.atk * 0.5));
        }
        this.scene.sfxSwing();
      });
    }
    this.endAttack(1600);
  }

  /* ---------- 스킬 5: 바닥 장판 (존스) ---------- */

  private startZones(player: PlayerLike2) {
    this.setMode("zonesTele", 850);
    this.setTint(0xffa060);
    // 플레이어 위치 중심 3개 장판 예고 — 1개는 보스 근처 무작위
    const spots: [number, number][] = [
      [player.x, player.y],
      [
        Phaser.Math.Clamp(player.x + Phaser.Math.Between(-220, 220), 60, this.scene.stageW - 60),
        Phaser.Math.Clamp(player.y + Phaser.Math.Between(-180, 180), 60, this.scene.stageH - 60),
      ],
      [
        Phaser.Math.Clamp(this.x + Phaser.Math.Between(-160, 160), 60, this.scene.stageW - 60),
        Phaser.Math.Clamp(this.y + Phaser.Math.Between(-140, 140), 60, this.scene.stageH - 60),
      ],
    ];
    for (const [zx, zy] of spots) {
      const ring = this.scene.add
        .image(zx, zy, "ring")
        .setDepth(5)
        .setTint(0xff8848)
        .setAlpha(0.35)
        .setScale(0.2);
      this.zoneRings.push(ring);
      this.scene.tweens.add({ targets: ring, scale: 0.82, alpha: 0.9, duration: 820 });
    }
  }

  private doZones(player: PlayerLike2) {
    this.clearTint();
    this.scene.cameras.main.shake(110, 0.005);
    for (const ring of this.zoneRings) {
      this.scene.spawnSlamBurst(ring.x, ring.y);
      if (Phaser.Math.Distance.Between(ring.x, ring.y, player.x, player.y) < 95) {
        const dir = new Phaser.Math.Vector2(player.x - ring.x, player.y - ring.y).normalize();
        player.takeDamage(Math.round(this.def.atk * 0.9), dir);
      }
      this.scene.tweens.add({ targets: ring, alpha: 0, duration: 150, onComplete: () => ring.destroy() });
    }
    this.zoneRings = [];
    this.endAttack(1500);
  }

  /* ---------- 스킬 6: 소환 ---------- */

  private startSummon() {
    this.setMode("summonTele", 620);
    this.setTint(0xc070ff);
  }

  private doSummon() {
    this.clearTint();
    const key = this.def.summonKey;
    if (key) {
      this.scene.requestSummon(key, this.phase === 3 ? 2 : 1, this.x, this.y);
      this.scene.spawnBurstAt(this.x, this.y, 16, 0xc070ff);
      this.scene.showBanner(`${this.def.name}가 권속을 부른다!`);
    }
    this.endAttack(1700);
  }

  private fireOrb(angle: number, speed: number, dmgOverride?: number) {
    const orb = this.orbPool[this.orbIdx];
    this.orbIdx = (this.orbIdx + 1) % this.orbPool.length;
    orb.enableBody(true, this.x, this.y - 20, true, true);
    this.scene.physics.velocityFromRotation(angle, speed, orb.body!.velocity);
    orb.setScale(this.enraged ? 1.2 : 1);
    orb.setData(
      "dmg",
      dmgOverride ?? (this.enraged ? Math.round(this.def.atk * 0.75) : Math.round(this.def.atk * 0.6))
    );
    // 수명 후 자동 회수
    this.scene.time.delayedCall(3200, () => this.killOrb(orb));
  }

  private killOrb(orb: Phaser.Physics.Arcade.Image) {
    if (!orb.active) return;
    orb.disableBody(true, true);
  }

  /** 공격 종료 — 다음 공격까지 대기. v3.0.6: 페이즈별 태진 단축 (p1 0.85 / p2 0.7 / 격노 0.5) */
  private endAttack(cd: number) {
    this.mode = "idle";
    this.nextAttackCd = this.enraged ? cd * 0.5 : this.phase === 2 ? cd * 0.7 : cd * 0.85;
  }

  /* ---------- 피격/사망 ---------- */

  takeDamage(dmg: number, dir: Phaser.Math.Vector2, knock: number, crit = false) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.knockVec.set(dir.x * knock * 0.12, dir.y * knock * 0.12); // 보스는 넉백 거의 안 됨
    // 타격감: 화이트 플래시
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.alive && this.active) this.clearTint();
    });
    this.scene.spawnDamageText(this.x + Phaser.Math.Between(-14, 14), this.y - 44, dmg, crit);
    this.scene.spawnHitSpark(this.x, this.y - 30);
    EventBus.emit("boss:update", { hp: Math.max(0, this.hp), maxHp: this.maxHp });

    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.mode = "dead";
      this.volleyTimer?.remove();
      for (const orb of this.orbPool) this.killOrb(orb);
      for (const r of this.teleRings) r.destroy();
      this.teleRings = [];
      for (const r of this.zoneRings) r.destroy();
      this.zoneRings = [];
      this.setVelocity(0, 0);
      // 보스 격파 보상 — 대량 골드 + HP 물약 2개 (2D MMORPG 기본 요소)
      this.scene.dropLootGold(this.x, this.y, this.def.gold);
      this.scene.dropLootItem(this.x + 26, this.y, "potion_hp");
      this.scene.dropLootItem(this.x - 26, this.y, "potion_hp");
      EventBus.emit("boss:hide");
      this.scene.onBossDead();
      this.scene.time.delayedCall(900, () => this.destroy());
    }
  }

  destroyPool() {
    this.volleyTimer?.remove();
    for (const orb of this.orbPool) orb.destroy();
    for (const r of this.teleRings) r.destroy();
    for (const r of this.zoneRings) r.destroy();
    this.orbPool = [];
    this.teleRings = [];
    this.zoneRings = [];
  }
}

export interface PlayerLike2 {
  x: number;
  y: number;
  hp: number;
  /** v3.0.6 — pierce(0~1): 방어력 관통, hpPct(0~1): maxHP % 고정 피해 하한 (보스 공격 전용) */
  takeDamage(dmg: number, fromDir: Phaser.Math.Vector2, pierce?: number, hpPct?: number): void;
}
