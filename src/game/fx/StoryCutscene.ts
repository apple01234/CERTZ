import type Phaser from "phaser";
import { beginSceneCinematic, sceneCinematicPlaying, type CinematicEnd } from "./sceneCinematic";

export type StoryShot = {
  x: number;
  y: number;
  panMs?: number;
  holdMs?: number;
  dialogue?: string;
  /** Multiplier of the scene's base zoom. */
  zoom?: number;
};
export type StoryCutsceneOpts = {
  shots: StoryShot[];
  onDone?: () => void;
  onFinish?: (reason: CinematicEnd) => void;
  showDialogue?: (key: string) => boolean;
};

export const storyCutscenePlaying = (scene: Phaser.Scene): boolean => sceneCinematicPlaying(scene);

/** Establishing shot → route → close-up. Dialogue is queued after camera ownership ends. */
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
  let index = 0;
  const next = () => {
    if (!session.active) return;
    const shot = shots[index++];
    if (!shot) { session.finish(); return; }
    if (shot.dialogue) dialogueKeys.add(shot.dialogue);
    session.pan(shot.x, shot.y, Math.max(120, shot.panMs ?? 700), shot.zoom, () => {
      /* vc242 (지시 #2) — 시간이 흐르면 자동으로 넘어가던 것을 키 입력 진행으로 바꾼다.
       *  minMs 는 카메라가 도착한 뒤 최소 감상 시간(연출이 깜빡이고 넘어가지 않게),
       *  maxMs 는 무입력 시 자동 진행 상한(연출이 멈춰서 게임이 잠기지 않게). */
      session.waitForKey({ minMs: 260, maxMs: Math.max(2600, (shot.holdMs ?? 450) * 6) }, next);
    });
  };
  /* vc242 — 총 시간 워치독. 각 단계가 키 대기(최대 holdMs*6)로 늘어났으므로
   *  같은 식으로 상한을 잡는다. 이 값은 "연출이 영구히 잠기는 것"을 막는 안전망이고,
   *  정상 진행에서는 각 단계의 waitForKey 가 먼저 끝낸다. */
  session.delay(shots.reduce((ms, shot) => ms + (shot.panMs ?? 700) + Math.max(2600, (shot.holdMs ?? 450) * 6) + 200, 1000), () => session.finish());
  next();
  return true;
}
