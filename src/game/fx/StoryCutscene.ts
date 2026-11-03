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
      session.delay(Math.max(0, shot.holdMs ?? 450), next);
    });
  };
  session.delay(shots.reduce((ms, shot) => ms + (shot.panMs ?? 700) + (shot.holdMs ?? 450) + 200, 1000), () => session.finish());
  next();
  return true;
}
