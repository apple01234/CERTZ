import type Phaser from "phaser";
import { beginSceneCinematic, sceneCinematicPlaying, type CinematicEnd } from "./sceneCinematic";
import { CAST_FRAME, castAnimation, cutsceneCharacter, type CastPose } from "../cutsceneCast";

type Point = { x: number; y: number };
export type CutAnchor = "entry" | "feature";
export type CutActorSpec = {
  tex: string;
  frame?: string;
  character?: string;
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
  | { t: "pose"; id: string; pose: CastPose }
  | { t: "say"; speaker: string; lines: string[]; holdPerChar?: number; minHold?: number;
      actor?: string;
      /** vc279 (P7c) — 대사 치환용 flag 키. lines 안의 `{키}` 를 저장된 선택 라벨로 바꾼다.
       *  예: lines: ["나는 '{haruWho}' 라고 답했어"] + recall: "haruWho"
       *       → "나는 '두려움에 도망치는 사람' 라고 답했어"
       *  저장값이 없으면 `recallFallback` → 그것도 없으면 원문 유지(빈 칸 금지). */
      recall?: string; recallFallback?: string }
  | { t: "wait"; ms: number }
  | { t: "flash"; color?: number; ms?: number }
  | { t: "fade"; out: boolean; ms?: number }
  | { t: "shake"; ms?: number; intensity?: number }
  /* vc279 (P7c) — 선택지. 지시서 요구 "스토리를 텍스트 대화만으로 처리하지 말고
   * 게임플레이와 연결" 의 최소 구현이다.
   *
   * [설계] 선택은 **flag 로 저장**되고, 그 flag 는 quest/progress 로직이 읽는다.
   *  대사만 늘리는 게 아니라 실제로 게임 상태를 바꾸는 것이 목적이다.
   *  `key` 는 저장 키(식별자 — 절대 바꾸지 않는다, 세이브 호환).
   *
   * [주의] 선택지가 게임 난이도를 좌우하면 안 된다. 정본의 중심 질문
   *  ("너는 어떤 사람이 되고 싶니?")은 **플레이어의 자기 규정**이지
   *  스탯 선택이 아니다 — 보상은 표시·대사 분기로만 준다. */
  | { t: "choice"; prompt: string; key: string; options: { id: string; label: string }[] };
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
  actorPosition?: (point: Point, occupied: readonly Point[]) => Point;
  /** 하루 v2 — 연출 대사를 게임 공용 대사창(DialogueBox)으로 재생한다(NPC 대화와 같은 창·초상화).
   *  `done` 은 플레이어가 마지막 줄을 넘겼을 때 부른다. 반환값은 취소 함수(스킵 시 대사창을 닫는다).
   *  없으면 아래 Phaser 패널로 폴백 — 씬 없이 도는 단위 테스트와 호환. */
  say?: (speaker: string, lines: string[], done: () => void) => (() => void) | void;
  /* vc279 (P7c) — 선택지 UI. 없으면 첫 옵션 자동 선택으로 진행한다.
   *  `done` 에 선택된 옵션 id 를 넘긴다. 반환값은 취소 함수(스킵 시 UI 를 닫는다). */
  choice?: (prompt: string, options: readonly { id: string; label: string }[], done: (picked: string) => void) => (() => void) | void;
  /** 선택이 확정될 때마다 호출 — flag 저장 담당(WorldScene → SaveData). */
  onChoice?: (key: string, picked: string) => void;
  /** vc279 (P7c) — 저장된 선택 id 를 **표시 라벨**로 돌려준다. `{key}` 치환에 쓴다.
   *  예: recall("haruWho") → "두려움에 도망치는 사람" */
  recall?: (key: string) => string | undefined;
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
  const identities = new Map<string, string>();
  const resting = new Map<string, CastPose>();
  const facingLeft = new Map<string, boolean>();
  session.own(() => { for (const actor of actors.values()) actor.destroy(); actors.clear(); actorPrefixes.clear(); identities.clear(); resting.clear(); facingLeft.clear(); });
  const pose = (id: string, state: CastPose) => {
    const who = identities.get(id);
    const actor = actors.get(id);
    if (who && actor && scene.anims.exists(castAnimation(who, state))) {
      actor.setFlipX(state.endsWith("side") && (facingLeft.get(id) ?? false));
      actor.play(castAnimation(who, state));
    }
  };
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
          (focus?.y ?? step.ry * spec.stageH) + (step.offsetY ?? 0), Math.max(120, step.panMs ?? 700),
          /* 2026-11-14 — 지형(입구·랜드마크)을 비추는 컷은 줌아웃하지 않는다(맵을 훑어 보여주는 연출 제거). */
          step.focus === "entry" || step.focus === "feature" ? undefined : step.zoom, next);
        break;
      }
      case "enter": {
        // Missing assets are skipped, never represented by fake character rectangles.
        if (!scene.textures.exists(step.actor.tex)) { next(); break; }
        actors.get(step.id)?.destroy();
        const a = step.actor;
        const target = actorPoint(a);
        const p = opts.actorPosition?.(target, [...actors.values()]) ?? target;
        const actor = scene.add.sprite(p.x, p.y, a.tex, a.frame).setName(`rea:actor:${step.id}`).setDepth(a.depth ?? 50)
          .setOrigin(a.character ? CAST_FRAME.origin.x : 0.5, a.character ? CAST_FRAME.origin.y : 1);
        actor.setScale(a.scale ?? 1).setFlipX(a.flip ?? false);
        if (a.anim && scene.anims.exists(a.anim)) actor.play(a.anim);
        if (a.ratio) actor.setScrollFactor(0);
        if (a.fadeIn) { actor.setAlpha(0); session.tween({ targets: actor, alpha: 1, duration: 220 }); }
        actors.set(step.id, actor);
        actorPrefixes.set(step.id, a.tex.replace(/_idle\d+$/, ""));
        if (a.character) { identities.set(step.id, a.character); resting.set(step.id, "idle"); }
        session.delay(a.fadeIn ? 220 : 0, next);
        break;
      }
      case "exit": {
        const actor = actors.get(step.id);
        if (!actor) { next(); break; }
        const ms = Math.max(0, step.ms ?? 220);
        session.tween({ targets: actor, alpha: 0, duration: ms, onComplete: () => {
          if (!session.active) return;
          actor.destroy(); actors.delete(step.id); actorPrefixes.delete(step.id); identities.delete(step.id); resting.delete(step.id); facingLeft.delete(step.id); next();
        } });
        break;
      }
      case "move": {
        const actor = actors.get(step.id);
        if (!actor) { next(); break; }
        const target = step.anchor ? { x: anchor(step.anchor).x + step.rx, y: anchor(step.anchor).y + step.ry }
          : { x: step.rx * spec.stageW, y: step.ry * spec.stageH };
        const p = opts.actorPosition?.(target, [...actors.values()].filter((a) => a !== actor)) ?? target;
        const prefix = actorPrefixes.get(step.id) ?? "";
        const side = Math.abs(p.x - actor.x) >= Math.abs(p.y - actor.y);
        const up = p.y < actor.y;
        const walk = `${prefix}-walk${side ? "-side" : up ? "-up" : ""}`;
        facingLeft.set(step.id, side && p.x < actor.x);
        actor.setFlipX(side && p.x < actor.x);
        if (scene.anims.exists(walk)) actor.play(walk);
        session.tween({ targets: actor, ...p, duration: Math.max(120, step.ms ?? 600), ease: "Sine.easeInOut", onComplete: () => {
          if (!session.active) return;
          const idle: CastPose = side ? "idle-side" : up ? "idle-up" : "idle";
          if (identities.has(step.id)) { resting.set(step.id, idle); pose(step.id, idle); }
          else if (scene.anims.exists(`${prefix}-idle`)) actor.play(`${prefix}-idle`);
          next();
        } });
        break;
      }
      case "pose": resting.set(step.id, step.pose); pose(step.id, step.pose); next(); break;
      case "say": {
        const who = cutsceneCharacter(step.speaker);
        const speaking = step.actor ?? [...identities].find(([, id]) => id === who?.id)?.[0];
        for (const [id] of identities) {
          const state = resting.get(id) ?? "idle";
          // An injured character keeps kneeling while speaking; a held-out hand stays held out.
          pose(id, id === speaking && state.startsWith("idle") ? "talk" : state);
        }
        /* vc279 (P7c) — recall 치환. 저장된 선택 라벨을 대사에 넣는다.
         *  저장값이 없으면 recallFallback → 원문 유지. 빈 칸으로 문장이 깨지면 안 된다. */
        let lines = step.lines;
        if (step.recall) {
          const v = opts.recall?.(step.recall) ?? step.recallFallback;
          if (v) lines = lines.map((l) => l.split(`{${step.recall}}`).join(v));
        }
        if (opts.say) {
          /* 공용 대사창: 읽는 시간에는 상한이 없다(플레이어가 키/탭으로 넘김). 워치독은 끄고 ESC 스킵만 둔다. */
          session.unwatch();
          let settled = false;
          const cancel = opts.say(step.speaker, lines, () => {
            if (!settled) { settled = true; if (speaking) pose(speaking, resting.get(speaking) ?? "idle"); next(); }
          });
          if (typeof cancel === "function") session.own(() => { if (!settled) { settled = true; cancel(); } });
          break;
        }
        // Re-show the existing box after a camera/movement step hid it.
        name.setText(step.speaker); body.setText(lines.join("\n")); dialogue.setVisible(true);
        const chars = lines.reduce((n, line) => n + line.length, 0);
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
      case "choice": {
        /* vc279 (P7c) — 선택지. `opts.choice` 가 있으면 UI 는 호출부(WorldScene)가 그린다.
         *  없으면(단위 테스트·연출 미지원) **첫 옵션을 자동 선택**하고 넘어간다 —
         *  진행이 멈추지 않게 하는 것이 최우선이다(조용한 실패 금지). */
        if (opts.choice) {
          session.unwatch();
          let settled = false;
          const cancel = opts.choice(step.prompt, step.options, (picked) => {
            if (settled) return;
            settled = true;
            opts.onChoice?.(step.key, picked);
            next();
          });
          if (typeof cancel === "function") session.own(() => { if (!settled) { settled = true; cancel(); } });
          break;
        }
        opts.onChoice?.(step.key, step.options[0]?.id ?? "");
        next();
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
