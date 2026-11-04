import type Phaser from "phaser";

export type CinematicEnd = "complete" | "skip" | "shutdown";
export type CinematicScene = Phaser.Scene & {
  camCinema?: boolean;
  dialoguing?: boolean;
  baseZoom?: number;
  stageW?: number;
  stageH?: number;
  player?: { x: number; y: number; active: boolean };
};

const sessions = new WeakMap<Phaser.Scene, CinematicSession>();
export const sceneCinematicPlaying = (scene: Phaser.Scene): boolean => sessions.has(scene);
export function cancelSceneCinematic(scene: Phaser.Scene): void { sessions.get(scene)?.finish("shutdown"); }

/** One camera/input owner. RE: Feather Park completion signals, Morfosi cleanup,
 * JENNY camera-effect lifetime; see REFERENCE_DEEP_ANALYSIS.md §§1,3,5. */
export function beginSceneCinematic(scene: Phaser.Scene, onFinish: (reason: CinematicEnd) => void): CinematicSession | null {
  if (sessions.has(scene) || (scene as CinematicScene).camCinema) return null;
  const session = new CinematicSession(scene as CinematicScene, onFinish);
  sessions.set(scene, session);
  return session;
}

export class CinematicSession {
  private ended = false;
  private cleanups: (() => void)[] = [];
  private timers = new Set<Phaser.Time.TimerEvent>();
  private tweens = new Set<Phaser.Tweens.Tween>();
  private originalZoom: number;
  private originalDialoguing: boolean | undefined;
  private wasPaused: boolean;
  readonly zoom: number;

  constructor(readonly scene: CinematicScene, private onFinish: (reason: CinematicEnd) => void) {
    const cam = scene.cameras.main;
    this.originalZoom = cam.zoom;
    this.zoom = Math.max(0.25, scene.baseZoom ?? cam.zoom);
    this.originalDialoguing = scene.dialoguing;
    this.wasPaused = scene.physics?.world?.isPaused ?? false;
    scene.camCinema = true;
    scene.dialoguing = true;
    scene.physics?.world?.pause();
    scene.input.keyboard?.resetKeys();
    const skip = () => this.finish("skip");
    const shutdown = () => this.finish("shutdown");
    scene.input.keyboard?.on("keydown-SPACE", skip);
    scene.input.keyboard?.on("keydown-ESC", skip);
    scene.input.on("pointerdown", skip);
    scene.events.once("shutdown", shutdown);
    scene.events.once("destroy", shutdown);
    this.own(() => {
      scene.input.keyboard?.off("keydown-SPACE", skip);
      scene.input.keyboard?.off("keydown-ESC", skip);
      scene.input.off("pointerdown", skip);
      scene.events.off("shutdown", shutdown);
      scene.events.off("destroy", shutdown);
    });
    this.letterbox();
  }

  get active(): boolean { return !this.ended; }
  own(cleanup: () => void): void { this.cleanups.push(cleanup); }
  delay(ms: number, fn: () => void): Phaser.Time.TimerEvent {
    const timer = this.scene.time.delayedCall(Math.max(0, ms), () => {
      this.timers.delete(timer);
      if (this.active) fn();
    });
    this.timers.add(timer);
    return timer;
  }

  /** vc242 (지시 #2) — "연출 시에도 NPC/채집 키를 눌러야만 다음 장면으로 한 단계씩 넘어가게".
   *
   *  [왜 delay 로는 안 되는가] 종전 연출은 pan→delay(holdMs)→next 로 **시간이 흐르면
   *  알아서** 다음 장면으로 넘어갔다. 유저는 연출을 읽을 시간을 스스로 정할 수 없었고,
   *  Space/ESC 는 전체 스킵(연출 전부 종료)에만 묶여 있었다. 그래서 "한 단계씩" 넘기는
   *  수단 자체가 없었다.
   *
   *  [구현] minMs 동안은 키를 무시해(연출이 즉시 넘어가 버리지 않게) 최소 감상 시간을 주고,
   *  그 뒤로는 NPC/채집 키(interact) 또는 Space 입력에 다음 단계로 넘어간다.
   *  maxMs 가 지나면 자동 진행 — 유저가 키를 안 눌러도 연출이 영구 정지하지 않는다.
   *  ESC 는 기존대로 전체 스킵(종료)이라 건드리지 않는다.
   *
   *  [키] interact 를 먼저 찾고, 없으면 SPACE 폴백. WorldScene 이 interact 를
   *  Space/E 로 등록하므로 실기기·키맵 변경 모두 자동으로 따라간다. */
  waitForKey(opts: { minMs?: number; maxMs?: number } = {}, fn: () => void): void {
    if (!this.active) return;
    const minMs = Math.max(0, opts.minMs ?? 320);
    const maxMs = Math.max(minMs + 100, opts.maxMs ?? 6000);
    const started = this.scene.time.now;
    let done = false;
    const finish = () => {
      if (done || !this.active) return;
      done = true;
      this.scene.input.keyboard?.off("keydown", onAny);
      timer?.remove(false);
      if (timer) this.timers.delete(timer);
      fn();
    };
    /* 아무 키나 받되 최소 시간 전에는 무시 — 실수로 넘겨 읽을 기회를 뺏기지 않게. */
    const onAny = (ev: KeyboardEvent) => {
      if (this.scene.time.now - started < minMs) return;
      const code = ev.code ?? "";
      const isAdvance = code === "Space" || code === "Enter" || code === "NumpadEnter"
        || code === "KeyE" || code === "Escape";
      if (!isAdvance) return;
      /* Escape 는 전체 스킵이 우선 — 여기서 잡으면 "한 단계" 의미가 사라진다. */
      if (code === "Escape") return;
      ev.preventDefault?.();
      finish();
    };
    const timer: Phaser.Time.TimerEvent = this.delay(maxMs, finish);
    this.scene.input.keyboard?.on("keydown", onAny);
    this.cleanups.push(() => this.scene.input.keyboard?.off("keydown", onAny));
  }

  tween(config: Phaser.Types.Tweens.TweenBuilderConfig): void {
    this.tweens.add(this.scene.tweens.add(config));
  }

  /** Relative zoom keeps close/long shots legible at desktop and mobile baseZoom. */
  pan(x: number, y: number, ms: number, zoomRatio: number | undefined, next: () => void): void {
    if (!this.active) return;
    const scene = this.scene;
    const cam = scene.cameras.main;
    const targetZoom = Math.min(6, Math.max(0.25, zoomRatio === undefined ? cam.zoom : this.zoom * zoomRatio));
    const sw = scene.stageW ?? 0;
    const sh = scene.stageH ?? 0;
    const hw = cam.width / targetZoom / 2;
    const hh = cam.height / targetZoom / 2;
    const tx = sw > 0 ? sw <= hw * 2 ? sw / 2 : Math.min(Math.max(x, hw), sw - hw) : x;
    const ty = sh > 0 ? sh <= hh * 2 ? sh / 2 : Math.min(Math.max(y, hh), sh - hh) : y;
    let completed = false;
    let fallback: Phaser.Time.TimerEvent | undefined;
    const complete = () => {
      if (completed || !this.active) return;
      completed = true;
      cam.off("camerapancomplete", complete);
      fallback?.remove(false);
      if (fallback) this.timers.delete(fallback);
      next();
    };
    cam.once("camerapancomplete", complete);
    this.own(() => cam.off("camerapancomplete", complete));
    // Completion events advance shots; this bounded fallback only heals interrupted effects.
    fallback = this.delay(ms + 160, complete);
    if (zoomRatio !== undefined) cam.zoomTo(targetZoom, ms, "Sine.easeInOut", true);
    cam.pan(tx, ty, ms, "Sine.easeInOut", true);
  }

  private letterbox(): void {
    const { scene } = this;
    const cam = scene.cameras.main;
    // Scroll-factor zero still inherits camera zoom; compensate scale so bars stay on screen.
    const ui = scene.add.container(0, 0).setScrollFactor(0).setDepth(9500);
    const h = Math.round(cam.height * 0.1);
    const top = scene.add.rectangle(0, 0, cam.width, h, 0x000000).setOrigin(0, 0);
    const bottom = scene.add.rectangle(0, cam.height - h, cam.width, h, 0x000000).setOrigin(0, 0);
    const skip = scene.add.text(cam.width - 16, 14, "SPACE / ESC · 화면 터치로 건너뛰기", {
      fontFamily: "sans-serif", fontSize: "12px", color: "#eeeeee",
    }).setOrigin(1, 0);
    ui.add([top, bottom, skip]);
    this.pinScreen(ui);
    this.own(() => ui.destroy(true));
  }

  /** Phaser world objects need inverse zoom and a viewport-origin offset for screen UI. */
  pinScreen(ui: Phaser.GameObjects.Container): void {
    const cam = this.scene.cameras.main;
    const sync = () => {
      ui.setScale(1 / cam.zoom);
      ui.setPosition(cam.width / 2 * (1 - 1 / cam.zoom), cam.height / 2 * (1 - 1 / cam.zoom));
    };
    sync();
    this.scene.events.on("prerender", sync);
    this.own(() => this.scene.events.off("prerender", sync));
  }

  finish(reason: CinematicEnd = "complete"): void {
    if (this.ended) return;
    this.ended = true;
    for (const timer of this.timers) timer.remove(false);
    this.timers.clear();
    for (const tween of this.tweens) tween.remove();
    this.tweens.clear();
    for (const cleanup of this.cleanups.reverse()) {
      try { cleanup(); } catch { /* Scene objects may already have been destroyed. */ }
    }
    this.cleanups.length = 0;
    const { scene } = this;
    // Phaser's camera manager shuts down before later scene listeners and clears main.
    const cam = scene.cameras.main;
    if (reason !== "shutdown" && cam) {
      cam.resetFX();
      // Phaser 4 resetFX omits zoomEffect; its next tick would overwrite setZoom.
      cam.zoomEffect.reset();
      cam.setZoom(scene.baseZoom ?? this.originalZoom);
      if (scene.player?.active) cam.centerOn(scene.player.x, scene.player.y);
    }
    scene.camCinema = false;
    scene.dialoguing = this.originalDialoguing;
    if (reason !== "shutdown") {
      if (!this.wasPaused) scene.physics?.world?.resume();
      scene.input.keyboard?.resetKeys();
    }
    sessions.delete(scene);
    this.onFinish(reason);
  }
}
