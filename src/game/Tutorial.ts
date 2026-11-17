import Phaser from "phaser";
import { EventBus } from "../components/game/EventBus";
import type { WorldScene } from "./scenes/WorldScene";
import { Enemy } from "./entities/Enemy";
import type { Boss } from "./entities/Boss";
import { castActor } from "./cutsceneCast";
import type { CutStep } from "./fx/AutoCutscene";
import { cancelSceneCinematic } from "./fx/sceneCinematic";
import { keyLabel, loadKeyMap, loadMoveScheme, type GameAction } from "./keymap";
import { TUTORIAL_STEPS as STEPS, type TutorialStepId } from "./tutorialFlow";

type Point = { x: number; y: number };
type Evidence = { enemy?: Enemy | Boss; missed?: boolean; kind?: string; viaPet?: boolean };
const PANEL_W = 331;
const PANEL_H = 84;
const STEP_KEYS: Partial<Record<TutorialStepId, [GameAction, string]>> = {
  talk: ["interact", "대화 버튼"],
  attack: ["attack", "공격 버튼"],
  skill: ["skill1", "첫 스킬 버튼"],
  inventory: ["bag", "가방 확인"],
  accept: ["interact", "대화 버튼"],
  mission: ["attack", "공격 버튼"],
  reward: ["interact", "대화 버튼"],
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
  private evadeDashed = false;
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
  private tSkip!: Phaser.GameObjects.Text;
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
  get waypoint(): Point | null { return this.done || this.hidden || this.pending ? null : this.target; }

  setHidden(on: boolean) {
    this.hidden = on;
    this.hud?.setVisible(!on);
    this.warning?.setVisible(!on);
  }

  private defer(fn: () => void, ms = 0) {
    const timer = this.scene.time.delayedCall(ms, () => { this.timers.delete(timer); if (!this.done) fn(); });
    this.timers.add(timer);
  }

  private refresh() {
    const st = STEPS[this.stepIdx];
    this.tTitle.setText(`${this.stepIdx + 1}/${STEPS.length} · ${st.title}`);
    this.tDesc.setText(st.desc).setColor("#e8f4ff");
    this.refreshKeys();
    EventBus.emit("tut:active", { active: true });
    EventBus.emit("tut:state", { active: true, step: st.id });
    EventBus.emit("tut:dom", { key: "skill", on: st.id === "skill" });
  }

  private refreshKeys() {
    const id = this.currentId;
    const keys = id && STEP_KEYS[id];
    if (keys) {
      const [action, label] = keys;
      this.tKey.setText(`${keyLabel(loadKeyMap()[action])} · ${label}`);
    } else if (id === "move" || id === "pickup" || id === "evade") {
      const move = loadMoveScheme() === "wasd" ? "WASD" : "방향키";
      const touch = this.scene.scale.width < 900 || (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
      const keyboard = id === "evade" ? `${move} + Shift` : move;
      const pad = id === "evade" ? "이동 패드 + 돌진" : "왼쪽 이동 패드";
      this.tKey.setText(touch ? `${pad} · ${keyboard}` : keyboard);
    } else this.tKey.setText("");
  }

  /** Only evidence from the designated target or committed panel can pass a practice. */
  notify(ev: string, data: Evidence = {}) {
    const id = this.currentId;
    if (!id || this.pending || this.hidden) return;
    if ((ev === "attack" && id === "attack") || (ev === "skill" && id === "skill")) {
      this.hitAction = { kind: ev, at: this.scene.time.now }; return;
    }
    if (ev === "hit" && data.enemy === this.practice && this.hitAction?.kind === id && this.scene.time.now - this.hitAction.at < 3000) this.advance();
    if (id === "evade" && ev === "dash" && this.evadeOrigin) this.evadeDashed = true;
    if (id === "evade" && data.enemy === this.practice) {
      if (ev === "evade_windup") {
        const p = this.scene.playerRef!;
        this.evadeOrigin = { x: p.x, y: p.y };
        this.evadeDashed = false;
        this.tDesc.setText("지금! 쥐에게서 멀어지는 방향으로 돌진하세요.").setColor("#ffd98a");
        if (this.scene.textures.exists("vfx_ring")) {
          this.warning?.destroy();
          this.warning = this.scene.add.image(data.enemy.x, data.enemy.y, "vfx_ring")
            .setDisplaySize(116, 116).setTint(0xff9b62).setAlpha(0.7).setDepth(this.scene.yDepthFor(data.enemy.y) - 0.1);
        }
      }
      if (ev === "evade_resolved") {
        const p = this.scene.playerRef!;
        this.warning?.destroy(); this.warning = null;
        if (data.missed && this.evadeDashed && this.evadeOrigin && Phaser.Math.Distance.Between(p.x, p.y, this.evadeOrigin.x, this.evadeOrigin.y) >= 64) this.advance();
        else this.tDesc.setText("쥐에게 다시 다가가 공격 예고를 기다리세요.").setColor("#e8f4ff");
        this.evadeOrigin = null; this.evadeDashed = false;
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
      if (this.scene.stageDef.key !== "lilacworld1x2") { this.scene.tutorialTransition(); return; }
      this.brief("register", "레지스터", "라일락과의 약속을 품고 기초부터 익히자. 오랜 수련도 첫걸음은 정확한 한 번의 검격이다.", () => this.advance());
    } else if (id === "attack") {
      this.spawnPractice(true);
    } else if (id === "evade") {
      this.spawnPractice(false, true);
    } else if (id === "skill") {
      this.spawnPractice(true);
      this.scene.playerRef!.mp = Math.max(15, this.scene.playerRef!.mp);
    } else if (id === "pickup") {
      this.target = this.scene.tutorialPoint(430, 0);
      const p = this.scene.playerRef!;
      if (Phaser.Math.Distance.Between(p.x, p.y, this.target.x, this.target.y) < 100) this.target = this.scene.tutorialPoint(170, 0);
      this.scene.tutorialDrop(this.target);
    } else if (id === "accept") {
      this.target = this.scene.tutorialPoint(-40, -45);
    } else if (id === "mission") this.spawnPractice(false);
    else if (id === "reward") this.target = this.scene.tutorialPoint(-40, -45);
    else if (id === "ending") this.brief("register", "레지스터", "기초는 익혔다. 기사단에 들어가려는 그 마음도 잊지 마라. 이제 네 발로 길을 찾아가 보아라.", () => this.finish());
  }

  update() {
    if (this.done || this.hidden) return;
    const p = this.scene.playerRef!;
    if (this.currentId === "move" && this.target && this.moveOrigin &&
      Phaser.Math.Distance.Between(p.x, p.y, this.target.x, this.target.y) < 34 &&
      Phaser.Math.Distance.Between(p.x, p.y, this.moveOrigin.x, this.moveOrigin.y) >= 70) this.advance();
  }

  private clearPractice() {
    this.evadeOrigin = null; this.evadeDashed = false;
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
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "15px", fontStyle: "bold", color: "#ffe9a0",
    });
    this.tDesc = s.add.text(-PANEL_W / 2 + 16, -PANEL_H / 2 + 29, "", {
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "14px", color: "#e8f4ff", wordWrap: { width: PANEL_W - 32 },
    });
    /* vc256 (지시 #9) — 조작 키 배지. 종전엔 조작법이 desc 문장 안에 섞여 있어
     *  "글자 도배"의 주범이었다. 조작은 짧은 배지로 분리한다. */
    this.tKey = s.add.text(-PANEL_W / 2 + 16, PANEL_H / 2 - 8, "", {
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "11px", color: "#ffd98a",
    }).setOrigin(0, 1);
    this.tSkip = s.add.text(PANEL_W / 2 - 16, PANEL_H / 2 - 8, "수련 건너뛰기", {
      fontFamily: "Noto Sans SC, sans-serif", fontSize: "11px", color: "#afbed0",
    }).setOrigin(1, 1).setScrollFactor(0);
    const skipArea = new Phaser.Geom.Rectangle(-6, -6, this.tSkip.width + 12, this.tSkip.height + 12);
    this.tSkip.setInteractive({ hitArea: skipArea, hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
    this.tSkip.on("pointerup", () => this.skip());

    this.hud.add([this.g, this.tTitle, this.tDesc, this.tKey, this.tSkip]);
    this.layoutHud();
    s.scale.on("resize", this.onResize, this);
  }

  /* v1.0.11 버그 수정 — 카메라 줌(1600×720 대응 applyCameraZoom)에서 scrollFactor 0 오브젝트는
   *  화면 좌표 = 월드좌표×zoom + 중심×(1−zoom) 로 사영된다. 고정 y=44는 zoom 1.25에서
   *  화면 위(-35px)로 밀려나 패널이 안 보였다 → 줌을 역산해 화면 상단 중앙에 고정 */
  layoutHud() {
    if (!this.hud) return;
    const s = this.scene;
    const cam = s.cameras?.main;
    if (!cam) return;
    const z = cam.zoom || 1;
    const sx = s.scale.width / 2;
    const sy = 100; // 상단 토스트·HP바 회피 (v1.0.11 — 44에서 하향)
    const wx = (sx - (s.scale.width / 2) * (1 - z)) / z;
    const wy = (sy - (s.scale.height / 2) * (1 - z)) / z;
    this.hud.setScale(Math.min(1, (s.scale.width - 24) / PANEL_W) / z).setPosition(wx, wy);
  }

  private onResize() {
    this.layoutHud();
    this.refreshKeys();
  }


}
