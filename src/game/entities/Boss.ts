import Phaser from "phaser";
import type { WorldScene } from "../scenes/WorldScene";
import type { BossDef, BossAttackKind, BossDiffKey } from "../data";
import { elemAdvantage, elementReaction, ELEM_REACTION_META, ELEMENT_META, type ElemKey, CHAPTER_ELEM } from "../data";
import { parseStage } from "../stages";
import { registerBossAnims, loadBossFrames, bossSourceFrame, BOSS_ATLAS } from "../textures";
import { trackDamage } from "../classroom"; // v1.4.31 — 교실 공유 보스 딜 합산 (보스 대상 피해도 카운트)
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
  | "dead"
  // v4.1.4 — 보스 개성 패턴
  | "beamTele" // 스윕 빔 예고
  | "beaming" // 스윕 빔 발사중
  | "blinkTele" // 그림자 급습(순간이동 준비)
  | "counterTele" // 반격 카운터 창(로스트아크식)
  | "staggered" // 카운터 성공 → 기절/취약
  | "quakeCast"; // 연속 낙뢰 시전

export class Boss extends Phaser.Physics.Arcade.Sprite {
  declare scene: WorldScene;

  def: BossDef;
  hp: number;
  /** v3.0.15 (#16) — 챕터 테마 원소 */
  readonly elem: ElemKey;
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
  /** v1.0.12 — 스콜&하티 쌍랑 표현 ("스콜밖에 안보임" 리포트): 하티(달을 쫓는 늑대)
   *  쌍둥이 유령 스프라이트 — 판정 없는 비주얼 동반자(뒤 오프셋·플립 미러·달빛 틴트). */
  private twin: Phaser.GameObjects.Sprite | null = null;
  /** 장판 패턴(존스)용 예고 링들 */
  private zoneRings: Phaser.GameObjects.Image[] = [];
  private chargeTarget = new Phaser.Math.Vector2();
  private volleyCount = 0;
  private volleyTimer: Phaser.Time.TimerEvent | null = null;
  private chargeHitDone = false;
  /** 직전 공격 종류 — 같은 패턴 연속 반복 방지 */
  private lastAttack: BossAttackKind | null = null;

  /* ---- v4.1.4 — 난이도/신규 패턴 상태 ---- */
  /** 카오스 난이도 전용 메커니즘 활성화 (재림판에서만 선택 가능) */
  chaos = false;
  /** 돌진 연쇄 잔여 횟수 (fenrir 2연속 / skoll 3연속, 카오스 +1) */
  private chargeChainLeft = 0;
  private spiralAngle = 0;
  private spiralTimer: Phaser.Time.TimerEvent | null = null;
  private beamTimer: Phaser.Time.TimerEvent | null = null;
  private beamAngle = 0;
  private beamDir = 1;
  private quakeTimer: Phaser.Time.TimerEvent | null = null;
  /** 페이즈 3 카오스 지원군 타이머 */
  private supportTimer: Phaser.Time.TimerEvent | null = null;
  /** 카운터 창 텔레그래프 링 */
  private counterRing: Phaser.GameObjects.Image | null = null;
  /* v1.4.30 (#15) — 반격 창 라벨 (startCounter에서 생성, destroyCounterRing에서 소멸) */
  private counterLabel: Phaser.GameObjects.Text | null = null;
  private counterHintShown = 0;

  /* ---- v1.4.9 — 보스 생동감 애니메이션 (호흡·예동·낙하 등장) ---- */
  private baseSX = 1;
  private baseSY = 1;
  private breathT = Math.random() * 4000;
  private squashX = 0;
  private squashY = 0;
  private entranceDone = false;

  // F4: 투사체 고정 풀
  private orbPool: Phaser.Physics.Arcade.Image[] = [];
  private orbIdx = 0;

  /** v1.4.31 (#4) — 트윈(하티)이 본체와 다른 텍스처를 쓸 때의 애니 프리픽스 (boss_skoll → boss_hati) */
  private twinPrefix: string | null = null;

  constructor(scene: WorldScene, x: number, y: number, def: BossDef, diffKey: BossDiffKey = "normal") {
    /* v1.4.31 (#4 보스 개편) — 아틀라스 보스는 시트 frame 0, 구형은 개별 idle0 이미지 */
    const src = bossSourceFrame(def.tex);
    super(scene, x, y, src.key, src.frame);
    this.def = def;
    this.chaos = diffKey === "chaos"; // v4.1.4 — 카오스 전용 메커니즘 플래그
    this.elem = CHAPTER_ELEM[parseStage(scene.stageDef.key).ch] ?? "dark"; // v3.0.15 (#16) 챕터 테마 원소
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
    /* v1.4.31 (#4) — 아틀라스 프레임은 300px급 대형화 — 근접 판정도 표시 크기(displayWidth) 기준 */
    this.hitW = Math.round(this.displayWidth * 0.92);
    this.hitH = Math.round(this.displayHeight * 0.92);
    // 돌진/넉백으로 아레나 밖으로 나가지 않도록 경계 충돌
    (this.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    /* v5.0 보스 전면 리메이크 — 12FPS 풀애니(idle/walk/atk/die/sp1~3):
     *  캐시된 프레임 즉시 애니 등록 + 나머지 프레임 지연 로드 후 애니 승격(무결성 폴백)
     *  v1.4.31 (#4) — 애니 등록을 play보다 먼저 (아틀라스 보스는 부팅 폴백 애니가 없다) */
    registerBossAnims(scene, def.tex);
    if (!BOSS_ATLAS[def.tex]) void loadBossFrames(scene, def.tex); // 아틀라스 보스는 전 프레임 시트 포함 — 지연 로드 불필요
    this.play(`${def.tex}-idle`);

    /* v1.0.12 — 하티 스폰: 스콜 옆에 나란히 달린다.
     *  v1.4.31 (#4) — 아틀라스 시대: 본체=얼음 봉황(스콜), 트윈=화염 늑대(하티 전용 아트·무틴트).
     *  구형 아트는 기존대로 동일 텍스처+은빛 틴트. 히트박스/판정은 보스 본체 그대로(밸런스 불변). */
    if (def.key === "skoll") {
      if (BOSS_ATLAS[def.tex]) {
        this.twinPrefix = "boss_hati";
        this.twin = scene.add.sprite(this.x, this.y, "atl_boss_hati", 0)
          .setDepth(this.depth - 1)
          .setAlpha(0); // v1.4.9 — 낙하 등장 중 비표시, 착지 시 0.95로 복원
        this.twin.play("boss_hati-idle");
      } else {
        this.twin = scene.add.sprite(this.x, this.y, this.texture.key)
          .setDepth(this.depth - 1)
          .setTint(0x9fb8ff)
          .setAlpha(0);
        this.twin.play(`${def.tex}-idle`);
      }
      this.twin.setFlipX(true);
    }

    for (let i = 0; i < 44; i++) {
      const orb = scene.physics.add.image(0, 0, "orb");
      // 외부 에셋 구슬(Kenney circle_05) — 보스별 테마색 발광 에너지탄
      orb.setTint(def.orbTint).setBlendMode(Phaser.BlendModes.ADD);
      orb.setActive(false).setVisible(false);
      orb.setData("dmg", def.atk);
      (orb.body as Phaser.Physics.Arcade.Body).setCircle(7);
      this.orbPool.push(orb);
    }

    // v4.1.4 — 카오스 등장 연출은 착지 후 개시로 이동 (등장 페이드와 충돌 방지 — startChaosAura)
    /* v1.4.9 — 등장 연출: 하늘 높이에서 낙하 착지 (충격파+먼지+진동+착지 찌그러짐).
     *  착지 전까지 물리 바디 비활성 + 행동 정지(entranceDone) — 낙하 중 공격/충돌 없음 */
    this.baseSX = this.scaleX || 1;
    this.baseSY = this.scaleY || 1;
    const landY = this.y;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.setAlpha(0);
    this.setY(landY - 150);
    this.scene.tweens.add({ targets: this, alpha: 1, duration: 170 });
    this.scene.tweens.add({
      targets: this,
      y: landY,
      duration: 540,
      ease: "Bounce.easeOut",
      onComplete: () => {
        this.entranceDone = true;
        body.reset(this.x, landY);
        body.enable = true;
        this.squash(0.16, -0.16); // 착지 충격
        this.twin?.setAlpha(0.95);
        this.scene.spawnShockwave(this.x, this.y + 10, this.def.orbTint, 1.15, 420);
        this.scene.spawnBurstAt(this.x, this.y + 12, 12, 0xffffff);
        this.scene.cameras.main.shake(150, 0.007);
        this.startChaosAura();
      },
    });
  }

  /** v1.4.9 — 카오스 붉은 오라 펄스 (착지 후 개시) */
  private startChaosAura() {
    if (!this.chaos || !this.alive) return;
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0.86 },
      duration: 420,
      yoyo: true,
      repeat: -1,
    });
  }

  /** v1.4.9 — 예동(스쿼시&스트레치): 양수=누르기, 음수=쭉 펴기. preUpdate에서 지수 감쇠로 자연 복원 */
  private squash(x: number, y: number) {
    this.squashX = x;
    this.squashY = y;
  }

  /* ═══ v5.0 보스 전면 리메이크 — 모드별 풀애니 (12FPS 시트) ═══
   *  idle=대기/호흡 · walk=이동/돌진 · atk=근접 강타 · sp1=지면기 · sp2=탄막/소환 · sp3=브레스/빔 · die=사망
   *  프레임 미로드/미보유 애니는 자동 폴백(기존 idle 동작 유지) */
  private animFor(): string {
    const t = this.def.tex;
    switch (this.mode) {
      case "dead":
        return `${t}-die`;
      case "slamTele":
      case "counterTele":
        return `${t}-atk`;
      case "chargeTele":
      case "charging":
      case "blinkTele":
        return `${t}-walk`;
      case "volley":
      case "ringTele":
      case "summonTele":
        return `${t}-sp2`;
      case "zonesTele":
      case "quakeCast":
        return `${t}-sp1`;
      case "beamTele":
      case "beaming":
        return `${t}-sp3`;
      case "staggered":
        return `${t}-idle`;
      case "idle": {
        const v = this.body?.velocity;
        return v && Math.abs(v.x) + Math.abs(v.y) > 24 ? `${t}-walk` : `${t}-idle`;
      }
    }
    return `${t}-idle`;
  }

  /** 애니 전환 (미보유 애니 → idle 폴백). 현재 애니와 같으면 무시 — 루프 유지 */
  private setBossAnim(key: string) {
    const a = this.scene.anims;
    const want = a.exists(key) ? key : `${this.def.tex}-idle`;
    if (!a.exists(want) || this.anims.currentAnim?.key === want) return;
    this.play(want);
    /* v1.4.31 (#4) — 트윈이 다른 텍스처(하티)면 대응 애니키로 치환해 동기화 */
    if (this.twin) {
      const twinWant = this.twinPrefix && want.startsWith(`${this.def.tex}-`)
        ? `${this.twinPrefix}-${want.slice(this.def.tex.length + 1)}`
        : want;
      if (a.exists(twinWant)) this.twin.play(twinWant);
    }
  }

  /** v1.0.12 — 하티 동기화: 프레임마다 보스 뒤 오프셋에 붙어 같이 달린다 (tick 흐름과 무관)
   *  v1.4.9 — + 생동감 애니메이션: 호흡(±2.2% 부피 보존 펄스) + 예동 감쇠 적용 */
  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    if (this.twin?.active) {
      /* v1.4.31 (#4) — 오프셋을 표시 폭 비례로 (아틀라스 300px급 프레임 대응) */
      const off = Math.round(this.displayWidth * 0.22);
      this.twin.setPosition(this.x + (this.flipX ? -off : off), this.y + 2);
      this.twin.setFlipX(!this.flipX);
      this.twin.setDepth(this.depth - 1);
    }
    if (!this.alive) return;
    this.breathT += delta;
    const decay = Math.pow(0.5, delta / 200);
    this.squashX *= decay;
    this.squashY *= decay;
    const breathe = Math.sin(this.breathT / 300) * 0.022; // ±2.2% 호흡
    this.scaleX = this.baseSX * (1 - breathe * 0.6 + this.squashX);
    this.scaleY = this.baseSY * (1 + breathe + this.squashY);
    this.twin?.setScale(this.scaleX, this.scaleY);
  }

  tick(dt: number, player: PlayerLike2) {
    if (!this.alive || !this.entranceDone) return; // v1.4.9 — 낙하 등장 중 행동 정지
    this.modeTimer -= dt;
    this.knockVec.scale(Math.pow(0.002, dt / 1000));

    // v2.0 프롤로그 보호 — 인트로/입장 유예 중 보스 행동 정지 (투사체는 유지)
    if (this.scene.isPrologueSafe) {
      this.setVelocity(0, 0);
      this.setBossAnim(`${this.def.tex}-idle`);
      return;
    }
    // v5.0 — 모드/이동 기반 애니 갱신 (매 틱 평가, 전환 시에만 play)
    this.setBossAnim(this.animFor());

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
          this.squash(0.12, -0.08); // v1.4.9 — 돌진 출발 러닝 스트레치
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
        if (this.modeTimer <= 0) {
          // v4.1.4 — 돌진 연쇄 (fenrir/skoll 고유성, 카오스 +1): 끝나면 짧은 예고 뒤 재돌진
          if (this.chargeChainLeft > 0 && player.hp > 0) {
            this.chargeChainLeft--;
            this.setMode("chargeTele", this.chaos ? 240 : 320);
          } else {
            this.endAttack(1400);
          }
        }
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
      /* ---- v4.1.4 — 신규 개성 패턴 상태 ---- */
      case "beamTele": {
        this.setVelocity(this.knockVec.x, this.knockVec.y);
        if (this.modeTimer <= 0) this.doBeam();
        break;
      }
      case "beaming": {
        this.setVelocity(this.knockVec.x, this.knockVec.y);
        break;
      }
      case "blinkTele": {
        this.setVelocity(0, 0);
        if (this.modeTimer <= 0) this.doBlink(player);
        break;
      }
      case "counterTele": {
        this.setVelocity(this.knockVec.x, this.knockVec.y);
        if (this.modeTimer <= 0) this.doCounterPunish(player);
        break;
      }
      case "staggered": {
        this.setVelocity(0, 0);
        if (this.modeTimer <= 0) {
          this.clearTint();
          this.endAttack(700);
        }
        break;
      }
      case "quakeCast": {
        this.setVelocity(this.knockVec.x, this.knockVec.y);
        if (this.modeTimer <= 0) this.mode = "idle"; // 낙뢰 자체는 delayedCall로 계속
        break;
      }
      case "volley": {
        this.setVelocity(this.knockVec.x, this.knockVec.y);
        break;
      }
      default:
        break;
    }

    /* v1.4.12 (#18 보스가 플레이어 반대 방향을 바라보는 버그) — 근원 2가지:
     *  ①기존엔 이동 속도 부호만 봤다 → 정지 상태(속도 0)에선 마지막 방향을 유지해
     *    플레이어가 뒤로 돌면 뒷돌기 ②교체된 아트가 오른쪽 기준일 땐 부호가 반대로 해석됨.
     *  이제 항상 플레이어 위치 기준으로 정면을 향하고, 아트 기준 방향(faceLeft)을 존중한다. */
    const playerOnLeft = player.x < this.x;
    this.setFlipX(this.def.faceLeft ? !playerOnLeft : playerOnLeft);
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
    if (this.phase === 3) {
      this.enraged = true;
      // v4.1.4 — 카오스 페이즈 3: 권속 지원군 (summonKey가 있는 보스 한정, 12초마다 1마리)
      if (this.chaos && this.def.summonKey && !this.supportTimer) {
        this.supportTimer = this.scene.time.addEvent({
          delay: 12000,
          loop: true,
          callback: () => {
            if (!this.alive || this.scene.enemies.length >= 9) return;
            this.scene.requestSummon(this.def.summonKey!, 1, this.x, this.y);
            this.scene.spawnBurstAt(this.x, this.y, 10, 0xff6a7d);
          },
        });
      }
    }
    this.scene.sfxRoar();
    this.scene.cameras.main.shake(220, this.phase === 3 ? 0.01 : 0.007);
    this.scene.spawnBurstAt(this.x, this.y, 20, this.def.orbTint);
    /* v1.4.11 — 페이즈 전환 대형 플래시 + 룬진 펄스 (hv2_flash2·hv2_magiccircle2) */
    this.bossFx("hv2_flash2", this.x, this.y - 20, { tint: 0xffffff, scale: 2.1, alpha: 0.7, dur: 320, depth: 29 });
    this.bossFx("hv2_magiccircle2", this.x, this.y + 8, { tint: this.def.orbTint, scale: 1.5, alpha: 0.8, dur: 620, depth: 8 });
    this.squash(-0.1, 0.16); // v1.4.9 — 페이즈 포효 자세
    this.scene.showBanner(
      this.phase === 3
        ? `${this.def.name} — 최후의 힘을 해방한다!`
        : `${this.def.name} — 2 페이즈!`
    );
    // 페이즈 전환 플래시
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(120, () => this.alive && this.clearTint());
  }

  /** 페이즈 패턴 풀에서 공격 선택 (직전 공격 제외 — 연속 반복 방지) */
  private pickAttack(player: PlayerLike2, dist: number) {
    const pool =
      this.phase === 1 ? this.def.patterns.p1 : this.phase === 2 ? this.def.patterns.p2 : this.def.patterns.p3;
    let candidates = pool.filter((k) => k !== this.lastAttack);
    if (candidates.length === 0) candidates = pool;
    /* v1.4.12 (#20 보스마다 패턴 차별화) — 시그니처 패턴 가중치 뽑기:
     *  보스별 정체성 패턴(sig)이 2.6배 확률로 나온다 — 수호자는 강타, 펜리르는 돌진,
     *  가름은 반격처럼 각자의 전투 스타일이 체감된다. */
    const sig = this.def.sig;
    let kind: BossAttackKind;
    if (sig && candidates.includes(sig)) {
      const weight = (k: BossAttackKind) => (k === sig ? 2.6 : 1);
      const total = candidates.reduce((s2, k) => s2 + weight(k), 0);
      let roll = Math.random() * total;
      kind = candidates[candidates.length - 1];
      for (const k of candidates) {
        roll -= weight(k);
        if (roll <= 0) { kind = k; break; }
      }
    } else {
      kind = Phaser.Utils.Array.GetRandom(candidates);
    }
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
      /* ---- v4.1.4 — 보스별 시그니처 패턴 ---- */
      case "spiral":
        this.startSpiral();
        break;
      case "beam":
        this.startBeam(player);
        break;
      case "blink":
        this.startBlink();
        break;
      case "quake":
        this.startQuake();
        break;
      case "counter":
        this.startCounter();
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
    this.squash(-0.07, 0.11); // v1.4.9 — 강타 예고: 몸을 뒤로 젖히며 기모으기
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
    this.squash(0.14, -0.14); // v1.4.9 — 강타 착지 임팩트
    const ring = this.teleRing;
    if (ring) {
      const tx = ring.x;
      const ty = ring.y;
      this.scene.cameras.main.shake(90, 0.006);
      this.scene.spawnSlamBurst(tx, ty);
      this.scene.spawnCrack(tx, ty);
      /* v1.4.11 — 강타 지균 데칼 (hv2_crater — 바닥에 새겨지는 충격 흔적) */
      this.scene.driveFx?.crater(tx, ty, 0x181008, 1.0, 2600);
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
    // v4.1.4 — 돌진 연쇄: def.chargeChain(fenrir 2 / skoll 2+blink, 카오스 +1, 상한 3)
    this.chargeChainLeft = Math.min(3, (this.def.chargeChain ?? 1) - 1 + (this.chaos ? 1 : 0));
    this.setMode("chargeTele", 550);
  }

  /* ---------- 스킬 3: 투사체 ---------- */

  private startVolley() {
    this.setMode("volley", 10);
    this.setTint(0x88a0ff);
    this.squash(-0.05, 0.07); // v1.4.9 — 발사 전 들이마시기
    /* v1.4.11 — 원소 충전 연출 (빙결=눈꽃·화염=화염 퍼프·기타=글로우 — hv2_·mg_ 시리즈 팩) */
    {
      const e = this.elem;
      const ck = e === "ice" ? "hv2_snow" : e === "fire" ? "mg_fire" : "hv2_glow";
      this.bossFx(ck, this.x, this.y - 30, { tint: e === "fire" ? 0xff9a5a : 0xffffff, scale: 0.55, alpha: 0.85, dur: 300, depth: 20 });
    }
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
    this.squash(-0.05, 0.07); // v1.4.9 — 탄막 예고 기모으기
  }

  private doRing() {
    this.clearTint();
    // 보스를 중심으로 방사형 탄막 — 페이즈 3은 2연속 파동 (v3.0.6: 탄수 상향 12/16/20)
    const waves = this.phase === 3 ? 2 : 1;
    const count = this.phase === 1 ? 12 : this.phase === 2 ? 16 : 20;
    for (let w = 0; w < waves; w++) {
      this.scene.time.delayedCall(w * 340, () => {
        if (!this.alive) return;
        this.squash(0.06, -0.06); // v1.4.9 — 파동 발사 펄스
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
    this.squash(-0.06, 0.09); // v1.4.9 — 장판 시전 기모으기
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
      /* v1.4.11 — 장판 폭발: 결정 파편 + MG 폭발 퍼프 (hv2_crystal·mg_explode) */
      this.scene.driveFx?.crystalPop(ring.x, ring.y, 0xff9a68, 3);
      this.bossFx("mg_explode", ring.x, ring.y - 6, { tint: 0xff8848, scale: 0.9, alpha: 0.95, dur: 340, depth: 25 });
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

  /* ---------- v1.4.11 — Drive 신규 팩 이펙트 헬퍼 (hv2_·mg_ 시리즈 — 텍스처 없으면 무시, 구버전 호환) ---------- */

  /** 보스 이펙트 공용: 텍스처 존재 가드 + ADD 블렌드 페이드인→아웃 1회성 이미지 */
  private bossFx(key: string, x: number, y: number, opt: { tint?: number; scale?: number; alpha?: number; dur?: number; depth?: number } = {}) {
    if (!this.scene.textures.exists(key)) return;
    const s = opt.scale ?? 1;
    const im = this.scene.add.image(x, y, key)
      .setDepth(opt.depth ?? 9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(opt.tint ?? 0xffffff)
      .setScale(s * 0.6)
      .setAlpha(0);
    this.scene.tweens.add({ targets: im, alpha: opt.alpha ?? 0.9, scaleX: s, scaleY: s, duration: 130, ease: "Quad.out" });
    this.scene.tweens.add({ targets: im, alpha: 0, duration: opt.dur ?? 260, delay: (opt.dur ?? 260) * 0.4, onComplete: () => im.destroy() });
  }

  /** 소환 채널링 — Hovl 룬 마법진 회전 (보스 발밑) */
  private summonFx(tint = 0xc070ff, dur = 620) {
    if (!this.scene.textures.exists("hv2_magiccircle")) return;
    const c = this.scene.add.image(this.x, this.y + 8, "hv2_magiccircle")
      .setDepth(8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(0.55)
      .setAlpha(0.9);
    this.scene.tweens.add({ targets: c, rotation: Math.PI * 2, duration: dur * 2, repeat: -1 });
    this.scene.tweens.add({ targets: c, alpha: 0, scale: 0.8, duration: dur, delay: dur * 0.4, onComplete: () => c.destroy() });
  }

  private startSummon() {
    this.setMode("summonTele", 620);
    this.setTint(0xc070ff);
    this.squash(-0.07, 0.12); // v1.4.9 — 소환 주문 채널링
    this.summonFx(0xc070ff, 620); // v1.4.11 — 룬 마법진 (hv2_magiccircle)
  }

  private doSummon() {
    this.clearTint();
    const key = this.def.summonKey;
    if (key) {
      this.scene.requestSummon(key, this.phase === 3 ? 2 : 1, this.x, this.y);
      this.scene.spawnBurstAt(this.x, this.y, 16, 0xc070ff);
      this.bossFx("hv2_crystal", this.x, this.y - 6, { tint: 0xc070ff, scale: 0.9, dur: 320 }); // v1.4.11 — 결정 파편
      this.scene.showBanner(`${this.def.name}가 권속을 부른다!`);
    }
    this.endAttack(1700);
  }

  /* ================= v4.1.4 — 보스별 시그니처 패턴 ================= */

  /* ---------- 나선 탄막 (behemoth 눈보라 / abysslord 심연 / abudditos 종언) ----------
   * 보스를 중심으로 회전하는 다중 나선 탄막 — 틈을 읽고 돌파하는 탄막 게임식 패턴 */
  private startSpiral() {
    this.setMode("volley", 10); // 대기 전용 모드 재사용 (volleyTimer와 무관 — spiralTimer 별도)
    this.setTint(0x9ad0ff);
    this.squash(-0.05, 0.08); // v1.4.9 — 나선 탄막 기모으기
    this.spiralAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const arms = this.chaos ? 3 : 2; // 카오스는 3갈래 나선
    const ticks = this.chaos ? 21 : 17;
    let done = 0;
    this.spiralTimer?.remove();
    this.spiralTimer = this.scene.time.addEvent({
      delay: 75,
      repeat: ticks - 1,
      callback: () => {
        if (!this.alive) return;
        this.spiralAngle += 0.52;
        for (let a = 0; a < arms; a++) {
          this.fireOrb(this.spiralAngle + (Math.PI * 2 * a) / arms, 195, Math.round(this.def.atk * 0.5));
        }
        if (done % 4 === 0) this.scene.sfxSwing();
        if (++done >= ticks) {
          this.clearTint();
          this.endAttack(1500);
        }
      },
    });
  }

  /* ---------- 회전 스윕 빔 (nidhog 독 브레스 / surt 화염 / skoll & abudditos) ----------
   * 예고 링 3개 후, 보스에서 뻗어나오는 회전하는 광선(구슬 벽)을 130° 회전 스윕 */
  private startBeam(player: PlayerLike2) {
    this.setMode("beamTele", 780);
    this.setTint(0xffd0a0);
    this.squash(-0.06, 0.1); // v1.4.9 — 브레스 들이마시기
    this.bossFx("hv2_techcircle", this.x, this.y + 8, { tint: 0xffc46a, scale: 0.95, alpha: 0.85, dur: 760 }); // v1.4.11 — 테크 서클 시전 링
    this.beamAngle = Math.atan2(player.y - this.y, player.x - this.x);
    this.beamDir = Math.random() < 0.5 ? 1 : -1;
    // 예고: 시전 방향 직선상 3개 링 (스윕 궤적 암시)
    for (let d = 100; d <= 300; d += 100) {
      const rx = Phaser.Math.Clamp(this.x + Math.cos(this.beamAngle) * d, 40, this.scene.stageW - 40);
      const ry = Phaser.Math.Clamp(this.y + Math.sin(this.beamAngle) * d, 40, this.scene.stageH - 40);
      const ring = this.scene.add
        .image(rx, ry, "ring")
        .setDepth(5)
        .setTint(0xffc46a)
        .setAlpha(0.28)
        .setScale(0.32);
      this.teleRings.push(ring);
      this.scene.tweens.add({ targets: ring, alpha: 0.75, duration: 700 });
      this.scene.time.delayedCall(760, () => {
        if (ring.active) {
          this.scene.tweens.add({ targets: ring, alpha: 0, duration: 140, onComplete: () => ring.destroy() });
          this.teleRings = this.teleRings.filter((r) => r !== ring);
        }
      });
    }
  }

  private doBeam() {
    this.clearTint();
    this.setMode("beaming", 10);
    this.squash(0.05, -0.05); // v1.4.9 — 브레스 분출 반동
    const step = this.chaos ? 0.042 : 0.032; // 카오스는 더 빠른 회전
    const speed = this.chaos ? 250 : 235;
    let done = 0;
    const ticks = 26;
    this.beamTimer?.remove();
    this.beamTimer = this.scene.time.addEvent({
      delay: 60,
      repeat: ticks - 1,
      callback: () => {
        if (!this.alive) return;
        this.beamAngle += this.beamDir * step;
        this.fireOrb(this.beamAngle, speed, Math.round(this.def.atk * 0.55));
        this.fireOrb(this.beamAngle + 0.14, speed, Math.round(this.def.atk * 0.55));
        if (this.chaos) this.fireOrb(this.beamAngle - 0.14, speed, Math.round(this.def.atk * 0.55));
        if (done % 4 === 0) this.scene.sfxSwing();
        if (++done >= ticks) this.endAttack(1600);
      },
    });
  }

  /* ---------- 그림자 급습 (fenrir / skoll / gram / abudditos) ----------
   * 모습을 숨긴 뒤 플레이어 근처로 순간이동 → 짧은 강타 텔레그래프 */
  private startBlink() {
    this.setMode("blinkTele", 320);
    this.setAlpha(0.25);
    this.squash(-0.08, 0.1); // v1.4.9 — 그림자로 뭉개지는 수축
    this.scene.spawnBurstAt(this.x, this.y, 14, 0x8040c0);
    this.scene.driveFx?.deathPuff(this.x, this.y - 10, 0x9a7ad8); // v1.4.11 — 소멸 연기
    this.scene.sfxDash();
  }

  private doBlink(player: PlayerLike2) {
    this.setAlpha(1);
    this.squash(0.1, -0.1); // v1.4.9 — 재등장 팝
    const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const d = Phaser.Math.Between(140, 190);
    this.setPosition(
      Phaser.Math.Clamp(player.x + Math.cos(ang) * d, 60, this.scene.stageW - 60),
      Phaser.Math.Clamp(player.y + Math.sin(ang) * d, 60, this.scene.stageH - 60)
    );
    this.scene.spawnBurstAt(this.x, this.y, 14, 0xb06aff);
    this.bossFx("hv2_smoke", this.x, this.y - 8, { tint: 0xb08aff, scale: 0.9, alpha: 0.8, dur: 380, depth: 11 }); // v1.4.11 — 재등장 연기
    // 짧은 강타 — 보라색 링(일반 강타와 구분)
    this.startShadowSlam(player);
  }

  /** blink 직속 강타 — 일반 강타보다 텔레그래프가 짧고(500ms) 보라색 */
  private startShadowSlam(player: PlayerLike2) {
    this.setMode("slamTele", this.chaos ? 380 : 500);
    const ring = this.scene.add
      .image(player.x, player.y, "ring")
      .setDepth(5)
      .setTint(0xb06aff)
      .setAlpha(0.4)
      .setScale(0.2);
    this.teleRings.push(ring);
    this.teleRing = ring;
    this.scene.tweens.add({ targets: ring, scale: 1, alpha: 0.9, duration: (this.chaos ? 380 : 500) - 30 });
    this.setTint(0xb06aff);
    this.scene.time.delayedCall(this.chaos ? 380 : 500, () => this.alive && this.clearTint());
  }

  /* ---------- 연속 낙뢰 (guardian 심연 지진 / surt 용암 분출 / behemoth 눈보라 폭풍) ----------
   * 플레이어를 쫓는 연속 낙뢰 장판 — 6~8회 연속으로 이동기 강제 */
  private startQuake() {
    this.setMode("quakeCast", 80);
    this.setTint(0xffb05a);
    const shots = this.chaos ? 8 : 6;
    this.quakeTimer?.remove();
    let done = 0;
    this.quakeTimer = this.scene.time.addEvent({
      delay: 340,
      repeat: shots - 1,
      callback: () => {
        if (!this.alive) return;
        const p0 = this.scene.playerRef;
        if (!p0) return;
        // 70% 확률 플레이어 현재 위치, 30%는 예측 차단용 근처 무작위
        const tx =
          Math.random() < 0.7
            ? p0.x
            : Phaser.Math.Clamp(p0.x + Phaser.Math.Between(-240, 240), 60, this.scene.stageW - 60);
        const ty =
          Math.random() < 0.7
            ? p0.y
            : Phaser.Math.Clamp(p0.y + Phaser.Math.Between(-200, 200), 60, this.scene.stageH - 60);
        const ring = this.scene.add
          .image(tx, ty, "ring")
          .setDepth(5)
          .setTint(0xffa040)
          .setAlpha(0.35)
          .setScale(0.18);
        this.zoneRings.push(ring);
        this.scene.tweens.add({ targets: ring, scale: 0.8, alpha: 0.9, duration: 580 });
        this.scene.time.delayedCall(600, () => {
          if (!ring.active) return;
          this.scene.spawnSlamBurst(ring.x, ring.y);
          /* v1.4.11 — 낙뢰 섬광 + 지균 데칼 (hv2_electro·hv2_crater — 지진 임팩트) */
          this.bossFx("hv2_electro", ring.x, ring.y, { tint: 0xffd28a, scale: 1.25, alpha: 0.95, dur: 200, depth: 27 });
          this.scene.driveFx?.crater(ring.x, ring.y, 0x1a1208, 0.85, 2200);
          this.scene.cameras.main.shake(80, 0.004);
          const p = this.scene.playerRef;
          if (p && Phaser.Math.Distance.Between(ring.x, ring.y, p.x, p.y) < 88) {
            const dir = new Phaser.Math.Vector2(p.x - ring.x, p.y - ring.y).normalize();
            p.takeDamage(Math.round(this.def.atk * 0.8), dir);
          }
          this.scene.tweens.add({ targets: ring, alpha: 0, duration: 140, onComplete: () => ring.destroy() });
          this.zoneRings = this.zoneRings.filter((r) => r !== ring);
        });
        if (done % 2 === 0) this.scene.sfxSwing();
        if (++done >= shots) {
          this.clearTint();
          this.endAttack(shots * 340 + 260);
        }
      },
    });
  }

  /* ---------- 반격 카운터 (abysslord / gram / abudditos — 로스트아크식) ----------
   * 노란 링 = 반격의 창. 창 안에 1회라도 맞추면 보스가 기절+취약(받는 피해 ×1.6),
   * 방관하면 즉시 대폭발(링 2파동 + 장판)으로 응수 */
  private startCounter() {
    this.setMode("counterTele", this.chaos ? 1050 : 1400);
    this.setTint(0xffe95a);
    this.squash(-0.06, 0.06); // v1.4.9 — 반격 자세
    this.counterRing = this.scene.add
      .image(this.x, this.y, "ring")
      .setDepth(5)
      .setTint(0xffe95a)
      .setAlpha(0.5)
      .setScale(1.15);
    this.teleRings.push(this.counterRing);
    this.scene.tweens.add({ targets: this.counterRing, scale: 0.9, alpha: 0.95, duration: 300, yoyo: true, repeat: -1 });
    /* v1.4.30 (#15 반격 UX) — 링 위에 "반격! 공격" 라벨을 상시 띄운다.
     *  기존엔 첫 2회 배너 힌트뿐이라 창이 왔는지 인지 못해 방관→응징 폭발을 당했다.
     *  이제 라벨이 창이 열릴 때마다 보스 머리 위에 떠서 "지금 때려야 한다"가 즉시 보인다. */
    const lbl = this.scene.add
      .text(this.x, this.y - 66, "반격! 공격 ➤", {
        fontFamily: "Galmuri11, sans-serif", fontSize: "14px", color: "#ffe95a",
        stroke: "#1a1020", strokeThickness: 5, fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(26);
    this.scene.tweens.add({ targets: lbl, y: this.y - 74, alpha: { from: 1, to: 0.72 }, duration: 260, yoyo: true, repeat: -1 });
    this.counterLabel = lbl;
    if (this.counterHintShown < 2) {
      this.counterHintShown++;
      this.scene.showBanner("노란 원이 보이면 — 창이 닫히기 전에 보스를 1번 때려라! (성공 시 기절+피해 ×1.6)");
    }
    this.scene.sfxRoar();
  }

  /** 카운터 창 방관 — 응징 폭발 */
  private doCounterPunish(player: PlayerLike2) {
    this.clearTint();
    this.destroyCounterRing();
    this.scene.cameras.main.shake(200, 0.009);
    this.scene.showBanner("반격 실패!");
    this.setTint(0xff7a5a);
    // 즉시 링 2파동 (틀어진 각도)
    for (let w = 0; w < 2; w++) {
      this.scene.time.delayedCall(w * 320, () => {
        if (!this.alive) return;
        const count = 20;
        for (let i = 0; i < count; i++) {
          this.fireOrb(w * 0.19 + (Math.PI * 2 * i) / count, 175 + w * 25, Math.round(this.def.atk * 0.55));
        }
      });
    }
    // 근거리 장판 2개
    const spots: [number, number][] = [
      [player.x, player.y],
      [this.x, this.y],
    ];
    for (const [zx, zy] of spots) {
      const ring = this.scene.add.image(zx, zy, "ring").setDepth(5).setTint(0xff8848).setAlpha(0.35).setScale(0.2);
      this.zoneRings.push(ring);
      this.scene.tweens.add({ targets: ring, scale: 0.82, alpha: 0.9, duration: 800 });
      this.scene.time.delayedCall(830, () => {
        if (!ring.active) return;
        this.scene.spawnSlamBurst(ring.x, ring.y);
        if (Phaser.Math.Distance.Between(ring.x, ring.y, player.x, player.y) < 95) {
          const dir = new Phaser.Math.Vector2(player.x - ring.x, player.y - ring.y).normalize();
          player.takeDamage(Math.round(this.def.atk * 0.9), dir);
        }
        this.scene.tweens.add({ targets: ring, alpha: 0, duration: 150, onComplete: () => ring.destroy() });
        this.zoneRings = this.zoneRings.filter((r) => r !== ring);
      });
    }
    this.scene.time.delayedCall(900, () => this.alive && this.clearTint());
    this.endAttack(1900);
  }

  private destroyCounterRing() {
    if (this.counterRing && this.counterRing.active) {
      this.scene.tweens.killTweensOf(this.counterRing);
      this.counterRing.destroy();
    }
    this.teleRings = this.teleRings.filter((r) => r !== this.counterRing);
    this.counterRing = null;
    /* v1.4.30 (#15) — 라벨도 같이 정리 */
    if (this.counterLabel && this.counterLabel.active) {
      this.scene.tweens.killTweensOf(this.counterLabel);
      this.counterLabel.destroy();
    }
    this.counterLabel = null;
  }

  private fireOrb(angle: number, speed: number, dmgOverride?: number) {
    const orb = this.orbPool[this.orbIdx];
    this.orbIdx = (this.orbIdx + 1) % this.orbPool.length;
    orb.enableBody(true, this.x, this.y - 20, true, true);
    // v4.1.4 — 카오스는 탄속 +22% (회피 난이도 상향)
    this.scene.physics.velocityFromRotation(angle, this.chaos ? speed * 1.22 : speed, orb.body!.velocity);
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

  /** 공격 종료 — 다음 공격까지 대기. v3.0.6: 페이즈별 태진 단축 (p1 0.85 / p2 0.7 / 격노 0.5)
   *  v4.1.4 — 카오스는 쿨타임 25% 추가 단축 (패턴 밀도 대폭 상향) */
  private endAttack(cd: number) {
    this.mode = "idle";
    let m = this.enraged ? 0.5 : this.phase === 2 ? 0.7 : 0.85;
    if (this.chaos) m *= 0.75;
    /* v1.4.12 (#20) — 보스별 공격 성향 (aggr: 1보다 작으면 더 빠르게 다시 공격) */
    if (this.def.aggr) m *= this.def.aggr;
    this.nextAttackCd = cd * m;
  }

  /* ---------- 피격/사망 ---------- */

  /* v1.4.16 — 원소 반응 쿨다운 (보스도 같은 규칙 적용 — CC는 면역) */
  private lastReactAt = 0;

  /* v1.4.30 (#7 이터널 실성능) — "시간의 잠금": 보스가 받는 유일한 CC.
   *  일반 몹의 applyStun과 달리 보스는 최대 1.4초의 경직(staggered, 피해 ×1.6)으로
   *  완화되어 들어간다 — 이터널 영원의 고리·영겁극의 시간 정지가 보스전에서도 의미를 갖는다.
   *  반격 카운터 대기 중에는 카운터 창을 지키기 위해 무시한다. */
  applyStun(ms: number) {
    if (!this.alive) return;
    if (this.mode === "counterTele") return;
    const clamp = Math.min(1400, Math.max(600, ms));
    this.mode = "staggered";
    this.modeTimer = clamp;
    this.setTint(0x8a7aff);
    this.setVelocity(0, 0);
    this.scene.spawnPickupText?.(this.x, this.y - 56, "시간의 잠금!", "#d8ccff");
    this.scene.spawnBurstAt(this.x, this.y, 12, 0xb0a0ff);
    EventBus.emit("boss:update", { hp: Math.max(0, this.hp), maxHp: this.maxHp });
  }

  takeDamage(dmg: number, dir: Phaser.Math.Vector2, knock: number, crit = false) {
    if (!this.alive) return;
    /* v1.4.30 (#2 사냥/보스 밸런스) — 보스 특화 직업(전사·데드아이·아크로드·섀도우로드 등)
     *  체인 합산 bossDmgPct만큼 보스에게 주는 피해 증가 */
    const spec = this.scene.playerRef ? (this.scene.playerRef as unknown as { bossDmgBonus?: number }).bossDmgBonus ?? 0 : 0;
    dmg = Math.max(1, Math.round(dmg * (1 + spec / 100)));
    /* v3.0.15 (#16) — 보스도 챕터 테마 원소를 가진다 (상성 배율 적용) */
    const atkElem = this.scene.playerRef?.attackElem ?? "none";
    const adv = elemAdvantage(atkElem, this.elem);
    const weak = adv > 1;
    /* v1.4.16 — 보스 원소 반응: 연출+데미지 보너스만 (스플래시/기절/슬로우 면역 — 보스전 밸런스) */
    const now = this.scene.time.now;
    const reactKey = elementReaction(atkElem, this.elem);
    const reacted = !!reactKey && now - this.lastReactAt > 1600;
    if (reacted && reactKey) {
      this.lastReactAt = now;
      this.scene.spawnElementReaction(this.x, this.y - 20, reactKey);
    }
    const R = reacted && reactKey ? ELEM_REACTION_META[reactKey] : null;
    let dealt = R ? Math.max(1, Math.round(dmg * adv * R.dmgMul))
      : adv === 1 ? dmg : Math.max(1, Math.round(dmg * adv));
    /* v1.4.31 — 교실 모드 공유 보스 레이드: 보스에 넣은 피해도 합산 (기존은 일반 몬스터만 카운트되는
     *  블라인드스팟 — Enemy.takeDamage의 trackDamage와 짝을 이룬다. 교실 밖 no-op) */
    trackDamage(dealt);

    // v4.1.4 — 반격 카운터: 창(노란 링) 안에 한 대라도 맞추면 카운터 성공 → 기절 + 취약
    if (this.mode === "counterTele") {
      this.clearTint();
      this.destroyCounterRing();
      this.mode = "staggered";
      this.modeTimer = 2800;
      this.setTint(0x8a7aff);
      this.scene.showBanner("반격 성공 — " + this.def.name + " 대굴! (피해 ×1.6)");
      this.scene.cameras.main.shake(160, 0.008);
      this.scene.spawnBurstAt(this.x, this.y, 22, 0xffe95a);
      EventBus.emit("boss:update", { hp: Math.max(0, this.hp), maxHp: this.maxHp });
      return; // 이 한 대는 그대로 반영 — 이후 타격부터 ×1.6
    }
    if (this.mode === "staggered") dealt = Math.max(1, Math.round(dealt * 1.6)); // 취약 상태

    this.hp -= dealt;
    this.knockVec.set(dir.x * knock * 0.12, dir.y * knock * 0.12); // 보스는 넉백 거의 안 됨
    this.squash(0.035, -0.035); // v1.4.9 — 피격 미세 진동
    // 타격감: 화이트 플래시 — 카운터/기절 상태의 틴트는 유지
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(60, () => {
      if (!this.alive || !this.active) return;
      if (this.mode === "staggered") this.setTint(0x8a7aff);
      else if (this.mode !== "counterTele") this.clearTint();
    });
    this.scene.spawnDamageText(
      this.x + Phaser.Math.Between(-14, 14), this.y - 44, dealt, crit || weak,
      weak ? ELEMENT_META[this.elem].color : undefined, weak ? "약점" : undefined
    );
    this.scene.spawnHitSpark(this.x, this.y - 30);
    /* v4.8.0 — 보스에게 먹힌 크리티컬은 더 큰 충격파로 (격판 강조, WebGL 전용) */
    if (crit) { this.scene.spawnShockwave(this.x, this.y - 24, 0xffd76a, 1.3, 400); this.scene.spawnCritSplat(this.x, this.y - 20, 0xffd76a); }
    EventBus.emit("boss:update", { hp: Math.max(0, this.hp), maxHp: this.maxHp });

    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.mode = "dead";
      this.setBossAnim(`${this.def.tex}-die`); // v5.0 — 사망 애니 (미보유 시 idle 폴백)
      this.volleyTimer?.remove();
      this.spiralTimer?.remove();
      this.beamTimer?.remove();
      this.quakeTimer?.remove();
      this.supportTimer?.remove();
      this.scene.tweens.killTweensOf(this); // v4.1.4 — 카오스 오라 펄스 정지
      this.setAlpha(1);
      /* v1.4.9 — 사망 연출 강화: 오라색 잔상 3겹 확산 + 본체 소멸 트윈 + 2중 충격파 */
      {
        const gx = this.x, gy = this.y;
        const gtex = this.texture.key;
        const gframe = this.frame.name; // v1.4.31 — 아틀라스 보스 잔상은 현재 프레임 유지 (__BASE는 구형)
        const gfl = this.flipX;
        const gsx = this.scaleX, gsy = this.scaleY;
        for (let i = 0; i < 3; i++) {
          const ghost = this.scene.add.image(gx, gy, gtex, gframe)
            .setDepth(10)
            .setTint(this.def.orbTint)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setAlpha(0.5)
            .setScale(gsx, gsy)
            .setFlipX(gfl);
          this.scene.tweens.add({
            targets: ghost,
            alpha: 0,
            scaleX: gsx * (1.3 + i * 0.22),
            scaleY: gsy * (1.3 + i * 0.22),
            duration: 620 + i * 150,
            ease: "Cubic.easeOut",
            onComplete: () => ghost.destroy(),
          });
        }
        this.scene.tweens.add({
          targets: this,
          alpha: 0,
          scaleX: gsx * 1.1,
          scaleY: gsy * 0.88,
          duration: 850,
          ease: "Cubic.easeIn",
        });
        this.scene.time.delayedCall(160, () => this.scene.spawnShockwave(gx, gy, this.def.orbTint, 1.1, 420));
        this.scene.time.delayedCall(340, () => this.scene.spawnShockwave(gx, gy, 0xffffff, 0.85, 340));
        /* v1.4.11 — 최후 폭발 + 상승 연기 (mg_explode·mg_smoke — Drive 팩 종결 연출) */
        this.bossFx("mg_explode", gx, gy - 10, { tint: this.def.orbTint, scale: 1.7, alpha: 0.95, dur: 420, depth: 26 });
        this.bossFx("mg_smoke", gx, gy - 22, { tint: 0xcfc6de, scale: 1.3, alpha: 0.7, dur: 800, depth: 12 });
      }
      for (const orb of this.orbPool) this.killOrb(orb);
      for (const r of this.teleRings) r.destroy();
      this.teleRings = [];
      for (const r of this.zoneRings) r.destroy();
      this.zoneRings = [];
      this.twin?.destroy(); this.twin = null; // v1.0.12 — 하티 동반 소멸
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
    this.spiralTimer?.remove();
    this.beamTimer?.remove();
    this.quakeTimer?.remove();
    this.supportTimer?.remove();
    this.twin?.destroy(); this.twin = null; // v1.0.12 — 씬 정리 시 하티 제거
    for (const orb of this.orbPool) orb.destroy();
    for (const r of this.teleRings) r.destroy();
    for (const r of this.zoneRings) r.destroy();
    this.orbPool = [];
    this.teleRings = [];
    this.zoneRings = [];
    this.counterRing = null;
    /* v1.4.30 (#15) — 반격 라벨도 정리 */
    if (this.counterLabel && this.counterLabel.active) this.counterLabel.destroy();
    this.counterLabel = null;
  }
}

export interface PlayerLike2 {
  x: number;
  y: number;
  hp: number;
  /** v3.0.6 — pierce(0~1): 방어력 관통, hpPct(0~1): maxHP % 고정 피해 하한 (보스 공격 전용) */
  takeDamage(dmg: number, fromDir: Phaser.Math.Vector2, pierce?: number, hpPct?: number): void;
}
