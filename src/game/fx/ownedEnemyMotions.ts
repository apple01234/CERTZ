import type Phaser from "phaser";

/** Existing licensed Layer Lab strips; no generated in-between frames. */
export const OWNED_ENEMY_MOTIONS: Record<string, { run: number; anticipation: number; releaseFps: number }> = {
  ll_goblin: { run: 8, anticipation: 3, releaseFps: 10 },
  ll_skeleton: { run: 4, anticipation: 4, releaseFps: 11 },
  ll_mushroom: { run: 8, anticipation: 4, releaseFps: 7 },
  ll_flyingeye: { run: 4, anticipation: 3, releaseFps: 14 },
};
const names = (prefix: string, count: number, start = 0) => Array.from({ length: count }, (_, i) => `${prefix}${start + i}`);

export function preloadOwnedEnemyFrames(scene: Phaser.Scene): void {
  for (const [key, def] of Object.entries(OWNED_ENEMY_MOTIONS)) {
    for (const frame of [...names("atk", 7, 1), ...names("run", def.run - 4, 4), ...names("hit", 4), ...names("death", 4)]) {
      scene.load.image(`${key}_${frame}`, `${key}_${frame}.webp`);
    }
  }
}

export function registerOwnedEnemyAnimations(scene: Phaser.Scene): void {
  for (const [key, def] of Object.entries(OWNED_ENEMY_MOTIONS)) {
    const motions: [string, string[], number, number][] = [
      ["idle", names("idle", 4), 5, -1], ["run", names("run", def.run), 10, -1],
      ["atk", names("atk", 8), 14, 0], ["windup", names("atk", def.anticipation), 10, 0],
      ["release", names("atk", 8 - def.anticipation, def.anticipation), def.releaseFps, 0],
      ["hit", names("hit", 4), 30, 0], ["death", names("death", 4), 12, 0],
    ];
    for (const [motion, frames, fps, repeat] of motions) {
      const anim = `${key}-${motion}`, textures = frames.map(frame => `${key}_${frame}`);
      if (!scene.anims.exists(anim) && textures.every(texture => scene.textures.exists(texture))) {
        scene.anims.create({ key: anim, frames: textures.map(texture => ({ key: texture })), frameRate: fps, repeat });
      }
    }
  }
}
