import type Phaser from "phaser";
import { EventBus } from "../../components/game/EventBus";

export type CinematicEnd = "complete" | "skip" | "shutdown";
export type CinematicScene = Phaser.Scene & {
  camCinema?: boolean;
  dialoguing?: boolean;
  baseZoom?: number;
  stageW?: number;
  stageH?: number;
  player?: { x: number; y: number; active: boolean };
  cinematicObstructions?: () => { active: boolean; visible: boolean; setVisible: (on: boolean) => unknown }[];
};

const sessions = new WeakMap<Phaser.Scene, CinematicSession>();
export const sceneCinematicPlaying = (scene: Phaser.Scene): boolean => sessions.has(scene);
export function cancelSceneCinematic(scene: Phaser.Scene, reason: "shutdown" | "skip" = "shutdown"): void { sessions.get(scene)?.finish(reason); }

/** vc264 (지시 #2) — 연출 재생 여부를 React HUD 에 알린다.
 *  "연출 중에는 모든 대사창을 제외한 모든 UI 안보이게 해"
 *
 *  [왜 여기서 발신하나] HUD·스킬버튼·미니맵은 React DOM 이고 연출은 Phaser 씬 안에서 돈다.
 *  서로의 상태를 볼 수 없어 EventBus 가 유일한 통로다.
 *  [이벤트명] GameRoot 가 이미 `cinematic:state` 를 구독해 HUD 를 hidden 처리하고 있다.
 *  같은 이름을 쓰면 UI 쪽 수정 없이 **모든 연출 경로**가 자동으로 덮인다
 *  (WorldScene 이 직접 emit 하던 두 곳 외에 autoCutscene·cine3d 경로도 포함).
 *  [대사창] DialogueBox 는 GameRoot 의 이 래퍼 **밖**에 있어 이 신호로 숨지 않는다 —
 *  지시대로 대사창만 남는다. */
const CINEMATIC_STATE_EVENT = "cinematic:state";
function announce(on: boolean): void {
  try { EventBus.emit(CINEMATIC_STATE_EVENT, { active: on }); } catch { /* React 미장착 */ }
}

/** One camera/input owner. RE: Feather Park completion signals, Morfosi cleanup,
 * JENNY camera-effect lifetime; see REFERENCE_DEEP_ANALYSIS.md §§1,3,5. */
export function beginSceneCinematic(scene: Phaser.Scene, onFinish: (reason: CinematicEnd) => void): CinematicSession | null {
  if (sessions.has(scene) || (scene as CinematicScene).camCinema) return null;
  const session = new CinematicSession(scene as CinematicScene, onFinish);
  sessions.set(scene, session);
  announce(true);
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
    // Portal blooms and route labels must not cover the story actors. Restore exact prior visibility.
    for (const object of scene.cinematicObstructions?.() ?? []) {
      const visible = object.visible;
      object.setVisible(false);
      this.own(() => { if (object.active) object.setVisible(visible); });
    }
    scene.input.keyboard?.resetKeys();
    const skip = () => this.finish("skip");
    const shutdown = () => this.finish("shutdown");
    /* 하루 v2 (지시 "연출도 NPC/채집 키로 대사 넘김") — 전체 스킵은 ESC 와 우상단 '건너뛰기' 영역뿐이다.
     *  종전엔 Space·화면 어디든 터치가 전체 스킵이었다. 기본 interact 키가 Space 라서, Phaser 가
     *  한 번의 Space 입력에 keydown-SPACE(스킵)와 keydown(waitForKey 다음 단계)을 둘 다 내보내
     *  "한 단계씩 넘기기"는 항상 스킵에 먼저 막혔다(Space 한 번에 연출 전체 종료). */
    const onPointer = (p?: { x?: number; y?: number }) => { if (this.inSkipZone(p)) skip(); };
    scene.input.keyboard?.on("keydown-ESC", skip);
    scene.input.on("pointerdown", onPointer);
    scene.events.once("shutdown", shutdown);
    scene.events.once("destroy", shutdown);
    this.own(() => {
      scene.input.keyboard?.off("keydown-ESC", skip);
      scene.input.off("pointerdown", onPointer);
      scene.events.off("shutdown", shutdown);
      scene.events.off("destroy", shutdown);
    });
    this.letterbox();
  }

  get active(): boolean { return !this.ended; }
  own(cleanup: () => void): void { this.cleanups.push(cleanup); }

  /** 화면(캔버스) 좌표 기준 우상단 '건너뛰기' 영역. 좌표가 없으면(키보드 합성 입력 등) 스킵이 아니다. */
  private inSkipZone(p?: { x?: number; y?: number }): boolean {
    if (!p || typeof p.x !== "number" || typeof p.y !== "number") return false;
    const w = this.scene.cameras.main?.width ?? 0;
    return p.x >= w - 170 && p.y <= 54;
  }

  private hint?: Phaser.GameObjects.Text;
  private watchdog?: Phaser.Time.TimerEvent;
  /** 단계가 넘어갈 때마다 부른다: 한 단계가 ms 이상 멈춰 있으면 연출 전체를 끝낸다(영구 정지 방지).
   *  종전 '전체 길이' 워치독은 키 대기(단계당 최대 ~15초)가 늘어난 뒤 느린 독자를 중간에 끊을 수 있었다. */
  watch(ms: number): void {
    this.unwatch();
    if (this.active) this.watchdog = this.delay(ms, () => this.finish());
  }
  /** 플레이어 입력을 기다리는 대사창 동안은 끈다(읽는 시간에는 상한이 없다 — ESC 로 언제든 스킵). */
  unwatch(): void {
    if (!this.watchdog) return;
    this.watchdog.remove(false);
    this.timers.delete(this.watchdog);
    this.watchdog = undefined;
  }
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
      this.scene.input.off("pointerdown", onTap);
      this.hint?.setVisible(false);
      timer?.remove(false);
      if (timer) this.timers.delete(timer);
      fn();
    };
    /* 화면 터치(모바일)도 '다음 단계' — 우상단 건너뛰기 영역은 세션 쪽이 스킵으로 처리한다. */
    const onTap = (p?: { x?: number; y?: number }) => {
      if (this.scene.time.now - started < minMs || this.inSkipZone(p)) return;
      finish();
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
    this.scene.input.on("pointerdown", onTap);
    this.hint?.setVisible(true);
    this.cleanups.push(() => {
      this.scene.input.keyboard?.off("keydown", onAny);
      this.scene.input.off("pointerdown", onTap);
    });
  }

  tween(config: Phaser.Types.Tweens.TweenBuilderConfig): void {
    this.tweens.add(this.scene.tweens.add(config));
  }

  /** Relative zoom keeps close/long shots legible at desktop and mobile baseZoom. */
  pan(x: number, y: number, ms: number, zoomRatio: number | undefined, next: () => void): void {
    if (!this.active) return;
    const scene = this.scene;
    const cam = scene.cameras.main;
    /* vc278 — framedRoom 에서는 카메라 팬/줌 연출을 하지 않는다.
     *  방 전체가 한 화면에 들어오는 연출이라 팬이 정보를 더 주지 않고, 오히려
     *  cam.pan/zoomTo 가 setZoom·setScroll 을 자기 목표로 덮어써 검정 여백이 사라진다.
     *  다음 단계는 즉시 진행시켜 연출 흐름 자체는 유지한다. */
    if ((scene as { framedRoom?: boolean }).framedRoom) { next(); return; }
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
    /* 하루 v2 — 전체 스킵은 ESC·우상단 영역(inSkipZone). 다음 단계 안내는 키를 기다리는 동안만 아래 막대에 뜬다. */
    const skip = scene.add.text(cam.width - 16, 14, "건너뛰기 ▸▸  ESC", {
      fontFamily: "sans-serif", fontSize: "13px", color: "#eeeeee",
    }).setOrigin(1, 0);
    const hint = scene.add.text(cam.width / 2, cam.height - h / 2, "Space · 탭 ▸ 다음", {
      fontFamily: "sans-serif", fontSize: "12px", color: "#bbbbbb",
    }).setOrigin(0.5, 0.5).setVisible(false);
    this.hint = hint;
    ui.add([top, bottom, skip, hint]);
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
      /* vc278 — framedRoom(검은 배경에 떠 있는 방)에서는 카메라를 플레이어에 붙이지 않는다.
       *  방 전체가 한 화면에 들어오는 것이 목적이므로, 연출이 끝나면 씬이 계산한
       *  방 맞춤 카메라를 그대로 다시 적용하는 게 옳다. centerOn 은 카메라를 플레이어로
       *  끌어당겨 좌측 여백을 0 으로 만든다(실측: 좌 margin 0, 우 76~112 비대칭). */
      const framed = (scene as { framedRoom?: boolean; applyFramedCamera?: () => void });
      if (framed.framedRoom && typeof framed.applyFramedCamera === "function") {
        framed.applyFramedCamera();
      } else if (scene.player?.active) {
        cam.centerOn(scene.player.x, scene.player.y);
      }
    }
    scene.camCinema = false;
    scene.dialoguing = this.originalDialoguing;
    if (reason !== "shutdown") {
      if (!this.wasPaused) scene.physics?.world?.resume();
      scene.input.keyboard?.resetKeys();
    }
    sessions.delete(scene);
    /* vc264 (지시 #2) — 세션이 실제로 사라진 뒤에 해제 신호를 보낸다.
     *  순서를 뒤집으면 HUD 가 "아직 재생 중"으로 보고 다시 숨는다. */
    announce(false);
    this.onFinish(reason);
  }
}
