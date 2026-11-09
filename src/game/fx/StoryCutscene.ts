import type Phaser from "phaser";
import { beginSceneCinematic, sceneCinematicPlaying, type CinematicEnd } from "./sceneCinematic";
import { createCastSprite } from "./cutsceneActors";
import { castAnimation } from "../cutsceneCast";

export type StoryShot = {
  x: number;
  y: number;
  panMs?: number;
  holdMs?: number;
  dialogue?: string;
  /** Multiplier of the scene's base zoom. */
  zoom?: number;
  actor?: { character: string; x: number; y: number };
};
export type StoryCutsceneOpts = {
  shots: StoryShot[];
  onDone?: () => void;
  onFinish?: (reason: CinematicEnd) => void;
  /** 연출이 끝난 뒤 대사를 한꺼번에 띄우던 종전 방식(playDialogue 가 없을 때만 쓴다). */
  showDialogue?: (key: string) => boolean;
  /** 하루 v2 (지시 "대사를 치는 동안 대사에 맞는 컷씬") — 그 컷의 카메라가 도착한 시점에 대사를 재생하고
   *  플레이어가 다 넘기면 `done` 을 부른다. 재생할 대사가 없으면(이미 봄/없는 키) null.
   *  반환값은 취소 함수(스킵 시 대사창을 닫는다). */
  playDialogue?: (key: string, done: () => void) => (() => void) | null;
};

export const storyCutscenePlaying = (scene: Phaser.Scene): boolean => sceneCinematicPlaying(scene);

/** Establishing shot → route → close-up. 대사는 해당 컷이 화면에 있는 동안 재생된다. */
export function playStoryCutscene(scene: Phaser.Scene, opts: StoryCutsceneOpts): boolean {
  const shots = opts.shots.filter((s) => Number.isFinite(s.x) && Number.isFinite(s.y));
  if (!shots.length) return false;
  const dialogueKeys = new Set<string>();
  const session = beginSceneCinematic(scene, (reason) => {
    opts.onFinish?.(reason);
    if (reason === "shutdown") return;
    opts.onDone?.();
    if (reason === "complete") for (const key of dialogueKeys) opts.showDialogue?.(key);
  });
  if (!session) return false;
  let actor: Phaser.GameObjects.Sprite | null = null;
  session.own(() => { actor?.destroy(); actor = null; });
  let index = 0;
  const next = () => {
    if (!session.active) return;
    const shot = shots[index++];
    if (!shot) { session.finish(); return; }
    actor?.destroy(); actor = null;
    if (shot.actor) actor = createCastSprite(scene, shot.actor.character, shot.actor.x, shot.actor.y)?.setDepth(50) ?? null;
    if (shot.dialogue && !opts.playDialogue) dialogueKeys.add(shot.dialogue);
    /* 컷 하나(이동 + 감상/대사 대기)가 멈춰 있으면 끝내는 idle 워치독. 종전 '전체 길이' 합산은
     *  키 대기가 늘어난 뒤 느린 독자를 중간에 끊을 수 있었다. */
    session.watch((shot.panMs ?? 700) + Math.max(2600, (shot.holdMs ?? 450) * 6) + 1500);
    session.pan(shot.x, shot.y, Math.max(120, shot.panMs ?? 700), shot.zoom, () => {
      if (shot.dialogue && opts.playDialogue) {
        if (shot.actor && actor) actor.play(castAnimation(shot.actor.character, "talk"));
        let settled = false;
        const cancel = opts.playDialogue(shot.dialogue, () => { if (!settled) { settled = true; next(); } });
        if (cancel) {
          /* 대사창이 떠 있는 동안은 읽는 시간에 상한이 없다(ESC 스킵만). */
          session.unwatch();
          session.own(() => { if (!settled) { settled = true; cancel(); } });
          return;
        }
      }
      /* vc242 (지시 #2) — 키 입력 진행. minMs 는 카메라가 도착한 뒤 최소 감상 시간,
       *  maxMs 는 무입력 시 자동 진행 상한(연출이 멈춰서 게임이 잠기지 않게). */
      session.waitForKey({ minMs: 260, maxMs: Math.max(2600, (shot.holdMs ?? 450) * 6) }, next);
    });
  };
  next();
  return true;
}
