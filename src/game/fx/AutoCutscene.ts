import type Phaser from "phaser";
import { beginSceneCinematic, sceneCinematicPlaying, type CinematicEnd } from "./sceneCinematic";

type Point = { x: number; y: number };
export type CutAnchor = "entry" | "feature";
export type CutActorSpec = {
  tex: string;
  x: number;
  y: number;
  /** An anchor makes x/y pixel offsets from an actual map landmark. */
  anchor?: CutAnchor;
  ratio?: boolean;
  fadeIn?: boolean;
  flip?: boolean;
  scale?: number;
  anim?: string;
  depth?: number;
};
export type CutStep =
  | { t: "cam"; rx: number; ry: number; focus?: CutAnchor | "player" | string; offsetX?: number; offsetY?: number; panMs?: number; zoom?: number }
  | { t: "enter"; id: string; actor: CutActorSpec }
  | { t: "exit"; id: string; ms?: number }
  | { t: "move"; id: string; rx: number; ry: number; anchor?: CutAnchor; ms?: number }
  | { t: "say"; speaker: string; lines: string[]; holdPerChar?: number; minHold?: number }
  | { t: "wait"; ms: number }
  | { t: "flash"; color?: number; ms?: number }
  | { t: "fade"; out: boolean; ms?: number }
  | { t: "shake"; ms?: number; intensity?: number };
export type AutoCutsceneSpec = {
  id: string;
  once?: boolean;
  steps: CutStep[];
  stageW: number;
  stageH: number;
  anchors?: Partial<Record<CutAnchor, Point>>;
};
export type AutoCutsceneOptions = {
  onFinish?: (reason: CinematicEnd) => void;
  /** 하루 v2 — 연출 대사를 게임 공용 대사창(DialogueBox)으로 재생한다(NPC 대화와 같은 창·초상화).
   *  `done` 은 플레이어가 마지막 줄을 넘겼을 때 부른다. 반환값은 취소 함수(스킵 시 대사창을 닫는다).
   *  없으면 아래 Phaser 패널로 폴백 — 씬 없이 도는 단위 테스트와 호환. */
  say?: (speaker: string, lines: string[], done: () => void) => (() => void) | void;
};
export const autoCutscenePlaying = (scene: Phaser.Scene): boolean => sceneCinematicPlaying(scene);

/** Direction stays in data; one shared owner prevents opening/dialogue cameras racing. */
export function playAutoCutscene(scene: Phaser.Scene, spec: AutoCutsceneSpec, onDone?: () => void, opts: AutoCutsceneOptions = {}): boolean {
  if (!spec.steps.length) return false;
  const session = beginSceneCinematic(scene, (reason) => {
    opts.onFinish?.(reason);
    if (reason !== "shutdown") onDone?.();
  });
  if (!session) return false;
  const cam = scene.cameras.main;
  const actors = new Map<string, Phaser.GameObjects.Sprite>();
  const actorPrefixes = new Map<string, string>();
  session.own(() => { for (const actor of actors.values()) actor.destroy(); actors.clear(); actorPrefixes.clear(); });
  const anchor = (key: CutAnchor): Point => spec.anchors?.[key] ?? {
    x: spec.stageW * (key === "entry" ? 0.25 : 0.7), y: spec.stageH * 0.5,
  };
  const actorPoint = (a: CutActorSpec): Point => a.anchor ? {
    x: anchor(a.anchor).x + a.x, y: anchor(a.anchor).y + a.y,
  } : a.ratio ? { x: a.x * cam.width, y: a.y * cam.height } : a.ratio === false ? a : {
    x: a.x * spec.stageW, y: a.y * spec.stageH,
  };

  const w = Math.round(cam.width * 0.86);
  const h = Math.max(108, Math.round(cam.height * 0.23));
  const panel = scene.add.graphics();
  panel.fillStyle(0x0a0a12, 0.94).fillRoundedRect(0, 0, w, h, 10);
  panel.lineStyle(2, 0xd9c27a, 0.9).strokeRoundedRect(0, 0, w, h, 10);
  const name = scene.add.text(16, 10, "", { fontFamily: "sans-serif", fontSize: "15px", color: "#f0d98a", fontStyle: "bold" });
  const body = scene.add.text(16, 34, "", {
    fontFamily: "sans-serif", fontSize: "14px", color: "#e8e8f0", wordWrap: { width: w - 32 }, lineSpacing: 5,
  });
  const dialogue = scene.add.container(0, 0).setScrollFactor(0).setDepth(9600).setVisible(false);
  const inner = scene.add.container(Math.round((cam.width - w) / 2), Math.round(cam.height * 0.89 - h), [panel, name, body]);
  dialogue.add(inner);
  session.pinScreen(dialogue);
  session.own(() => dialogue.destroy(true));

  let index = 0;
  const next = () => {
    if (!session.active) return;
    const step = spec.steps[index++];
    if (!step) { session.finish(); return; }
    /* 단계마다 20초 idle 워치독을 다시 건다(단계가 멈춰 조작이 영구히 잠기는 것 방지). */
    session.watch(20000);
    switch (step.t) {
      case "cam": {
        dialogue.setVisible(false);
        const focus = step.focus === "entry" || step.focus === "feature" ? anchor(step.focus)
          : step.focus === "player" ? session.scene.player : step.focus ? actors.get(step.focus) : undefined;
        session.pan((focus?.x ?? step.rx * spec.stageW) + (step.offsetX ?? 0),
          (focus?.y ?? step.ry * spec.stageH) + (step.offsetY ?? 0), Math.max(120, step.panMs ?? 700), step.zoom, next);
        break;
      }
      case "enter": {
        // Missing assets are skipped, never represented by fake character rectangles.
        if (!scene.textures.exists(step.actor.tex)) { next(); break; }
        actors.get(step.id)?.destroy();
        const a = step.actor;
        const p = actorPoint(a);
        const actor = scene.add.sprite(p.x, p.y, a.tex).setName(`rea:actor:${step.id}`).setDepth(a.depth ?? 50).setOrigin(0.5, 1);
        actor.setScale(a.scale ?? 1).setFlipX(a.flip ?? false);
        if (a.anim && scene.anims.exists(a.anim)) actor.play(a.anim);
        if (a.ratio) actor.setScrollFactor(0);
        if (a.fadeIn) { actor.setAlpha(0); session.tween({ targets: actor, alpha: 1, duration: 220 }); }
        actors.set(step.id, actor);
        actorPrefixes.set(step.id, a.tex.replace(/_idle\d+$/, ""));
        session.delay(a.fadeIn ? 220 : 0, next);
        break;
      }
      case "exit": {
        const actor = actors.get(step.id);
        if (!actor) { next(); break; }
        const ms = Math.max(0, step.ms ?? 220);
        session.tween({ targets: actor, alpha: 0, duration: ms, onComplete: () => {
          if (!session.active) return;
          actor.destroy(); actors.delete(step.id); next();
        } });
        break;
      }
      case "move": {
        const actor = actors.get(step.id);
        if (!actor) { next(); break; }
        const p = step.anchor ? { x: anchor(step.anchor).x + step.rx, y: anchor(step.anchor).y + step.ry }
          : { x: step.rx * spec.stageW, y: step.ry * spec.stageH };
        const prefix = actorPrefixes.get(step.id) ?? "";
        const side = Math.abs(p.x - actor.x) >= Math.abs(p.y - actor.y);
        const walk = `${prefix}-walk${side ? "-side" : p.y < actor.y ? "-up" : ""}`;
        if (side) actor.setFlipX(p.x < actor.x);
        if (scene.anims.exists(walk)) actor.play(walk);
        session.tween({ targets: actor, ...p, duration: Math.max(120, step.ms ?? 600), ease: "Sine.easeInOut", onComplete: () => {
          if (!session.active) return;
          if (scene.anims.exists(`${prefix}-idle`)) actor.play(`${prefix}-idle`);
          next();
        } });
        break;
      }
      case "say": {
        if (opts.say) {
          /* 공용 대사창: 읽는 시간에는 상한이 없다(플레이어가 키/탭으로 넘김). 워치독은 끄고 ESC 스킵만 둔다. */
          session.unwatch();
          let settled = false;
          const cancel = opts.say(step.speaker, step.lines, () => { if (!settled) { settled = true; next(); } });
          if (typeof cancel === "function") session.own(() => { if (!settled) { settled = true; cancel(); } });
          break;
        }
        // Re-show the existing box after a camera/movement step hid it.
        name.setText(step.speaker); body.setText(step.lines.join("\n")); dialogue.setVisible(true);
        const chars = step.lines.reduce((n, line) => n + line.length, 0);
        /* vc242 (지시 #2) — 대사도 "키를 눌러 다음 장면" 으로 바꾼다.
         *  종전엔 글자 수로 시간을 계산해 자동으로 넘어가서, 느리게 읽는 사람은
         *  대사를 놓쳤고 빠른 사람은 기다려야 했다.
         *  minMs = 다 읽을 최소 시간(짧은 대사가 즉시 넘어가지 않게),
         *  maxMs = 무입력 시 자동 진행 상한. */
        session.waitForKey({
          minMs: Math.max(420, Math.min(1400, chars * 14)),
          maxMs: Math.max(step.minHold ?? 1100, Math.min(5200, chars * (step.holdPerChar ?? 42))) * 3,
        }, () => {
          dialogue.setVisible(false); next();
        });
        break;
      }
      case "wait": session.delay(Math.max(0, step.ms), next); break;
      case "flash": {
        const c = step.color ?? 0xffffff;
        const ms = Math.max(80, step.ms ?? 220);
        cam.flash(ms, (c >> 16) & 255, (c >> 8) & 255, c & 255);
        session.delay(ms, next); break;
      }
      case "fade": {
        const ms = Math.max(80, step.ms ?? 320);
        const event = step.out ? "camerafadeoutcomplete" : "camerafadeincomplete";
        const done = () => { if (session.active) next(); };
        cam.once(event, done); session.own(() => cam.off(event, done));
        if (step.out) cam.fadeOut(ms, 0, 0, 0);
        else cam.fadeIn(ms, 0, 0, 0);
        break;
      }
      case "shake": {
        const ms = Math.max(80, step.ms ?? 220);
        cam.shake(ms, Math.min(0.012, step.intensity ?? 0.006));
        session.delay(ms, next); break;
      }
    }
  };
  // A malformed step can never leave the player locked indefinitely: 단계별 idle 워치독(next 안)이 맡는다.
  next();
  return true;
}
