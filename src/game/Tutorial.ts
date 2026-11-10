import Phaser from "phaser";
import { EventBus } from "../components/game/EventBus";
import type { WorldScene } from "./scenes/WorldScene";
import { Enemy } from "./entities/Enemy";
import type { Boss } from "./entities/Boss";
import { castActor } from "./cutsceneCast";
import type { CutStep } from "./fx/AutoCutscene";
import { cancelSceneCinematic } from "./fx/sceneCinematic";
import { keyLabel, loadKeyMap, type GameAction } from "./keymap";
import { TUTORIAL_STEPS as STEPS, type TutorialStepId } from "./tutorialFlow";

type Point = { x: number; y: number };
type Evidence = { enemy?: Enemy | Boss; missed?: boolean; kind?: string; viaPet?: boolean };
const PANEL_W = 331;
const PANEL_H = 84;
const STEP_KEYS: Partial<Record<TutorialStepId, GameAction>> = {
  talk: "interact", attack: "attack", skill: "skill1", inventory: "bag", accept: "interact", reward: "interact",
};

/** The existing tutorial now alternates the shared director with real WorldScene actions.
 * Save only at completed actions. Original enemies are parked, never deleted or killed. */
export class Tutorial {
  private stepIdx: number;
  private done = false;
  private pending = false;
  private hidden = false;
  private inventoryOpened = false;
  private hitAction: { kind: "attack" | "skill"; at: number } | null = null;
  private evadeOrigin: Point | null = null;
  private target: Point | null = null;
  private moveOrigin: Point | null = null;
  private practice: Enemy | null = null;
  private parked: Enemy[] = [];
  private warning: Phaser.GameObjects.Image | null = null;
  private timers = new Set<Phaser.Time.TimerEvent>();
  private hud: Phaser.GameObjects.Container | null = null;
  private g!: Phaser.GameObjects.Graphics;
  private tTitle!: Phaser.GameObjects.Text;
  private tDesc!: Phaser.GameObjects.Text;
  private tKey!: Phaser.GameObjects.Text;
  private tPips!: Phaser.GameObjects.Text;
  private tSkip!: Phaser.GameObjects.Text;
  private mkGlow: Phaser.GameObjects.Image | null = null;
  private mkSpark: Phaser.GameObjects.Sprite | null = null;
  private readonly onCinematic = (v: { active?: boolean }) => {
    this.setHidden(!!v?.active);
    if (!v?.active) this.layoutHud();
  };

  constructor(private scene: WorldScene, resumeStep = 0) {
    this.stepIdx = Phaser.Math.Clamp(resumeStep, 0, STEPS.length - 1);
    this.parked = scene.enemyList.filter(e => e.active && e.alive);
    this.parked.forEach(e => e.setTutorialPaused(true));
    this.buildHud();
    EventBus.on("cinematic:state", this.onCinematic);
    this.defer(() => this.enterStep()); // WorldScene assigns this.tut before actors/input run.
    this.refresh();
  }

  get currentId(): TutorialStepId | null { return this.done ? null : STEPS[this.stepIdx].id; }

  setHidden(on: boolean) {
    this.hidden = on;
    this.hud?.setVisible(!on);
    if (on) { this.mkGlow?.setVisible(false); this.mkSpark?.setVisible(false); this.warning?.setVisible(false); }
  }

  private defer(fn: () => void, ms = 0) {
    const timer = this.scene.time.delayedCall(ms, () => { this.timers.delete(timer); if (!this.done) fn(); });
    this.timers.add(timer);
  }

  private refresh() {
    const st = STEPS[this.stepIdx];
    this.tTitle.setText(`${this.stepIdx + 1}/${STEPS.length} · ${st.title}`);
    this.tDesc.setText(st.desc);
    this.tPips.setText("");
    const action = STEP_KEYS[st.id];
    this.tKey.setText(action ? `${keyLabel(loadKeyMap()[action])} / ${action === "bag" ? "가방" : action === "interact" ? "NPC/채집" : action === "attack" ? "공격" : "주력 스킬"}` : ["move", "evade", "pickup"].includes(st.id) ? "이동키 / 조이스틱 · Shift / 돌진" : "");
    EventBus.emit("tut:active", { active: true });
    EventBus.emit("tut:state", { active: true, step: st.id });
    EventBus.emit("tut:dom", { key: "skill", on: st.id === "skill" });
  }

  /** Only evidence from the designated target or committed panel can pass a practice. */
  notify(ev: string, data: Evidence = {}) {
    const id = this.currentId;
    if (!id || this.pending || this.hidden) return;
    if ((ev === "attack" && id === "attack") || (ev === "skill" && id === "skill")) {
      this.hitAction = { kind: ev, at: this.scene.time.now }; return;
    }
    if (ev === "hit" && data.enemy === this.practice && this.hitAction?.kind === id && this.scene.time.now - this.hitAction.at < 3000) this.advance();
    if (id === "evade" && data.enemy === this.practice) {
      if (ev === "evade_windup") {
        const p = this.scene.playerRef!;
        this.evadeOrigin = { x: p.x, y: p.y };
        if (this.scene.textures.exists("vfx_ring")) {
          this.warning?.destroy();
          this.warning = this.scene.add.image(data.enemy.x, data.enemy.y, "vfx_ring")
            .setDisplaySize(116, 116).setTint(0xff9b62).setAlpha(0.7).setDepth(this.scene.yDepthFor(data.enemy.y) - 0.1);
        }
      }
      if (ev === "evade_resolved") {
        const p = this.scene.playerRef!;
        this.warning?.destroy(); this.warning = null;
        if (data.missed && this.evadeOrigin && Phaser.Math.Distance.Between(p.x, p.y, this.evadeOrigin.x, this.evadeOrigin.y) >= 64) this.advance();
        this.evadeOrigin = null;
      }
    }
    if (id === "pickup" && ev === "pickup" && data.kind === "potion_hp" && !data.viaPet) this.advance();
    if (id === "inventory" && ev === "inventory_open") this.inventoryOpened = true;
    if (id === "inventory" && ev === "inventory_close" && this.inventoryOpened) this.advance();
    if ((id === "accept" && ev === "accept") || (id === "reward" && ev === "reward")) this.advance();
    if (id === "mission" && ev === "kill" && data.enemy === this.practice) this.advance();
  }

  interact(who: "lilac" | "register") {
    if (this.pending || this.hidden || this.done) return;
    if (this.currentId === "talk" && who === "lilac") {
      this.pending = true;
      this.brief("lilac", "라일락", "기사단에 정식으로 들어오면 그 펜던트를 돌려줘. 네가 누군가를 살리는 사람이 되기를 바랄게.", () => { this.pending = false; this.advance(); });
    } else if (["accept", "reward"].includes(this.currentId ?? "") && who === "register") this.scene.tutorialRequest();
  }

  private advance() {
    if (this.done || this.pending) return;
    this.pending = true;
    // A choice/kill may still be finishing its existing reward/dialogue transaction.
    const commit = () => {
      if (this.hidden) { this.defer(commit, 80); return; }
      this.clearPractice();
      this.pending = false;
      this.stepIdx++;
      this.hitAction = null; this.target = null;
      if (this.stepIdx >= STEPS.length) { this.finish(); return; }
      this.scene.saveTutorialProgress(this.stepIdx);
      this.refresh();
      this.enterStep();
    };
    this.defer(commit, 100);
  }

  private brief(who: "lilac" | "register", speaker: string, line: string, done: () => void) {
    const steps: CutStep[] = [
      { t: "enter", id: "teacher", actor: castActor(who, 0, 0) },
      { t: "cam", focus: "teacher", rx: 0.5, ry: 0.5, zoom: 1.15, panMs: 450 },
      { t: "pose", id: "teacher", pose: "talk" },
      { t: "say", speaker, lines: [line], actor: "teacher" },
      { t: "exit", id: "teacher", ms: 120 },
      { t: "cam", focus: "player", rx: 0.5, ry: 0.5, zoom: 1, panMs: 400 },
    ];
    if (!this.scene.playTutorialCinematic(steps, () => { if (!this.done) done(); })) this.defer(() => this.brief(who, speaker, line, done), 120);
  }

  private spawnPractice(dummy: boolean, evade = false) {
    const pos = this.scene.tutorialPoint(170, 0);
    const enemy = new Enemy(this.scene, pos.x, pos.y, dummy ? "golem" : "x2_rat", {
      hp: evade ? 9999 : 45, atk: 1, exp: 0, gold: 0, abs: true, dummy,
      displayName: dummy ? "수련 표적" : "수련용 쥐",
    });
    // This is an instructor's safe practice, not a new story invasion or a bleeding encounter.
    enemy.def = { ...enemy.def, profile: undefined, dropHp: 0, dropMp: 0 };
    enemy.setData("tutorialOwned", true);
    if (evade) enemy.setData("tutorialEvade", true);
    this.scene.enemyList.push(enemy);
    this.practice = enemy;
    this.target = enemy;
  }

  private enterStep() {
    const id = this.currentId;
    if (!id) return;
    this.inventoryOpened = false;
    this.target = null;
    if (id === "opening") {
      if (!this.scene.playTutorialCinematic(null, () => { if (!this.done) this.advance(); })) this.defer(() => this.enterStep(), 120);
      return;
    }
    if (this.stepIdx < 3) this.scene.tutorialNpc("lilac", this.scene.tutorialPoint(210, 0));
    else this.scene.tutorialNpc("register", this.scene.tutorialPoint(-40, -45));
    if (id === "move") {
      const p = this.scene.playerRef!;
      this.moveOrigin = { x: p.x, y: p.y };
      this.target = this.scene.tutorialPoint(140, 0);
      if (Phaser.Math.Distance.Between(p.x, p.y, this.target.x, this.target.y) < 64) this.target = this.scene.tutorialPoint(240, 0);
    } else if (id === "talk") this.target = this.scene.tutorialPoint(210, 0);
    else if (id === "training") {
      if (this.scene.stageDef.key !== "howlrstone1x2") { this.scene.tutorialTransition(); return; }
      this.brief("register", "레지스터", "라일락과의 약속을 품고 기초부터 익히자. 오랜 수련도 첫걸음은 정확한 한 번의 검격이다.", () => this.advance());
    } else if (id === "attack") {
      this.spawnPractice(true);
      this.brief("register", "레지스터", "앞의 표적에 다가가 검을 정확히 맞혀 봐. 허공에 휘두르기만 해서는 안 된다.", () => {});
    } else if (id === "evade") {
      this.spawnPractice(false, true);
      this.brief("register", "레지스터", "이번에는 공격을 기다려라. 예고가 보이면 그 자리에서 걸어 나와 공격을 피하는 거다.", () => {});
    } else if (id === "skill") {
      this.spawnPractice(true);
      this.scene.playerRef!.mp = Math.max(15, this.scene.playerRef!.mp);
      this.brief("register", "레지스터", "이제 검을 다루는 기본 기술을 표적에 써 봐. 힘을 쓰는 순간과 검이 닿는 때를 익혀라.", () => {});
    } else if (id === "pickup") {
      this.target = this.scene.tutorialPoint(430, 0);
      const p = this.scene.playerRef!;
      if (Phaser.Math.Distance.Between(p.x, p.y, this.target.x, this.target.y) < 100) this.target = this.scene.tutorialPoint(170, 0);
      this.scene.tutorialDrop(this.target);
      this.brief("register", "레지스터", "수련에 쓸 보급품이다. 빛나는 물약까지 직접 걸어가 주워 봐.", () => {});
    } else if (id === "inventory") {
      this.brief("register", "레지스터", "방금 주운 물약이 가방에 들어갔는지 살펴보고, 확인했으면 가방을 닫아라.", () => {});
    } else if (id === "accept") {
      this.target = this.scene.tutorialPoint(-40, -45);
      this.brief("register", "레지스터", "이제 작은 수련 의뢰를 맡아 보자. 내게 다시 말을 걸고, 내용을 읽은 뒤 의뢰를 받아라.", () => {});
    } else if (id === "mission") this.spawnPractice(false);
    else if (id === "reward") this.target = this.scene.tutorialPoint(-40, -45);
    else if (id === "ending") this.brief("register", "레지스터", "기초는 익혔다. 기사단에 들어가려는 그 마음도 잊지 마라. 이제 네 발로 길을 찾아가 보아라.", () => this.finish());
  }

  update() {
    if (this.done) return;
    if (this.hidden) { this.mkGlow?.setVisible(false); this.mkSpark?.setVisible(false); return; }
    const p = this.scene.playerRef!;
    if (this.currentId === "move" && this.target && this.moveOrigin &&
      Phaser.Math.Distance.Between(p.x, p.y, this.target.x, this.target.y) < 34 &&
      Phaser.Math.Distance.Between(p.x, p.y, this.moveOrigin.x, this.moveOrigin.y) >= 70) this.advance();
    const target = this.target;
    this.mkGlow?.setVisible(!!target); this.mkSpark?.setVisible(!!target);
    if (target) {
      this.mkGlow?.setPosition(target.x, target.y - 42).setScale(0.28);
      this.mkSpark?.setPosition(target.x, target.y - 52).setScale(0.45);
    }
  }

  private clearPractice() {
    this.warning?.destroy(); this.warning = null;
    if (this.practice) {
      const at = this.scene.enemyList.indexOf(this.practice);
      if (at >= 0) this.scene.enemyList.splice(at, 1);
      if (this.practice.scene) this.practice.destroy();
      this.practice = null;
    }
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    cancelSceneCinematic(this.scene, "skip");
    const p = this.scene.playerRef!;
    p.addGold(500);
    for (let i = 0; i < 3; i++) { p.addPotion("hp"); p.addPotion("mp"); }
    this.scene.grantTutorialRewards();
    this.destroy();
    this.scene.completeTutorialSave();
    this.scene.showBanner("기초 수련 완료 · 500G / 물약 / 뽑기권을 받았습니다.");
  }

  skip() { this.finish(); }

  destroy() {
    this.done = true;
    for (const timer of this.timers) timer.remove(false);
    this.timers.clear();
    EventBus.off("cinematic:state", this.onCinematic);
    this.scene.scale.off("resize", this.onResize, this);
    this.clearPractice();
    this.parked.forEach(e => { if (e.scene) e.setTutorialPaused(false); });
    this.parked = [];
    this.mkGlow?.destroy(); this.mkGlow = null;
    this.mkSpark?.destroy(); this.mkSpark = null;
    this.hud?.destroy(); this.hud = null;
    EventBus.emit("tut:dom", { key: "skill", on: false });
    EventBus.emit("tut:active", { active: false });
    EventBus.emit("tut:state", { active: false, step: null });
  }
  private buildHud() {
    const s = this.scene;
    this.hud = s.add.container(0, 0).setDepth(9200).setScrollFactor(0);

    this.g = s.add.graphics();
    this.g.fillStyle(0x0a1020, 0.84);
    this.g.fillRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 12);
    this.g.lineStyle(1.5, 0x9df0ff, 0.5);
    this.g.strokeRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 12);

    this.tTitle = s.add.text(-PANEL_W / 2 + 16, -PANEL_H / 2 + 8, "", {
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "14px", fontStyle: "bold", color: "#ffe9a0",
    });
    /* v1.0.13 피드백#17 — desc 4줄 수용: 상단 오프셋 28→26, 랩폭 130→124 여백 확보 */
    this.tDesc = s.add.text(-PANEL_W / 2 + 16, -PANEL_H / 2 + 26, "", {
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "12px", color: "#e8f4ff", wordWrap: { width: PANEL_W - 32 },
    });
    this.tPips = s.add.text(PANEL_W / 2 - 16, -PANEL_H / 2 + 8, "", {
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "11px", color: "#9df0ff",
    }).setOrigin(1, 0);
    /* vc256 (지시 #9) — 조작 키 배지. 종전엔 조작법이 desc 문장 안에 섞여 있어
     *  "글자 도배"의 주범이었다. 조작은 짧은 배지로 분리한다. */
    this.tKey = s.add.text(-PANEL_W / 2 + 16, PANEL_H / 2 - 8, "", {
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "11px", color: "#ffd98a",
    }).setOrigin(0, 1);
    this.tSkip = s.add.text(PANEL_W / 2 - 16, PANEL_H / 2 - 8, "스킵 ▶", {
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "11px", color: "#7a8aa0",
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    this.tSkip.on("pointerup", () => this.skip());

    this.hud.add([this.g, this.tTitle, this.tDesc, this.tPips, this.tKey, this.tSkip]);
    this.layoutHud();

    /* 마커 — 목표물 위에서 깜빡이는 광점+스파클 (인트로 가이드와 같은 어휘)
     * v1.0.13 피드백#17 — 스케일은 update()의 sin 펄스가 담당(1.0→1.35 배수)하므로
     *  트윈은 알파 브리딩만 담당한다 (두 드라이버가 scale을 동시에 쓰는 충돌 방지) */
    if (s.textures.exists("gw_dot")) {
      this.mkGlow = s.add.image(0, 0, "gw_dot").setDepth(9100).setBlendMode(Phaser.BlendModes.ADD).setTint(0x9df0ff).setScale(0.62).setAlpha(0.85);
      s.tweens.add({ targets: this.mkGlow, alpha: 0.55, duration: 640, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    }
    if (s.textures.exists("sparkle0")) {
      this.mkSpark = s.add.sprite(0, 0, "sparkle0").setDepth(9101).setBlendMode(Phaser.BlendModes.ADD).setScale(0.8);
      try { this.mkSpark.play("sparkle"); } catch { /* 애니 미상 — 광점만 */ }
    }

    s.scale.on("resize", this.onResize, this);
  }

  /* v1.0.11 버그 수정 — 카메라 줌(1600×720 대응 applyCameraZoom)에서 scrollFactor 0 오브젝트는
   *  화면 좌표 = 월드좌표×zoom + 중심×(1−zoom) 로 사영된다. 고정 y=44는 zoom 1.25에서
   *  화면 위(-35px)로 밀려나 패널이 안 보였다 → 줌을 역산해 화면 상단 중앙에 고정 */
  private layoutHud() {
    if (!this.hud) return;
    const s = this.scene;
    const cam = s.cameras?.main;
    if (!cam) return;
    const z = cam.zoom || 1;
    const sx = s.scale.width / 2;
    const sy = 100; // 상단 토스트·HP바 회피 (v1.0.11 — 44에서 하향)
    const wx = (sx - (s.scale.width / 2) * (1 - z)) / z;
    const wy = (sy - (s.scale.height / 2) * (1 - z)) / z;
    this.hud.setScale(1 / z).setPosition(wx, wy);
  }

  private onResize() {
    this.layoutHud();
  }


}
