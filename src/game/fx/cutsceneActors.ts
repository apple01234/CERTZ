import type Phaser from "phaser";
import { CAST_FRAME, CAST_FRAME_NAMES, CUTSCENE_CAST, castAnimation, castTexture, type CastPose } from "../cutsceneCast";

/** Called while Boot's loader path is assets/. Separate files remain reusable by the editor. */
export function preloadCutsceneCast(scene: Phaser.Scene): void {
  for (const c of CUTSCENE_CAST) scene.load.atlas(castTexture(c.id), `cutscene-cast/${c.id}.png`, `cutscene-cast/${c.id}.json`);
}

export function registerCutsceneCast(scene: Phaser.Scene): void {
  const poses: Record<CastPose, { frames: number[]; rate: number }> = {
    idle: { frames: [0, 1], rate: 2 }, "idle-side": { frames: [4, 5], rate: 2 }, "idle-up": { frames: [8, 9], rate: 2 },
    walk: { frames: [0, 2, 0, 3], rate: 8 }, "walk-side": { frames: [4, 6, 4, 7], rate: 8 }, "walk-up": { frames: [8, 10, 8, 11], rate: 8 },
    talk: { frames: [0, 12, 12, 0], rate: 3 }, reach: { frames: [13], rate: 1 }, hurt: { frames: [14], rate: 1 }, ready: { frames: [15], rate: 1 },
  };
  for (const c of CUTSCENE_CAST) {
    const key = castTexture(c.id);
    if (!scene.textures.exists(key)) continue;
    for (const [pose, def] of Object.entries(poses)) {
      const anim = castAnimation(c.id, pose as CastPose);
      if (scene.anims.exists(anim)) continue;
      scene.anims.create({ key: anim, frames: def.frames.map((n) => ({ key, frame: CAST_FRAME_NAMES[n] })), frameRate: def.rate, repeat: -1 });
    }
  }
}

export function createCastSprite(scene: Phaser.Scene, id: string, x: number, y: number): Phaser.GameObjects.Sprite | null {
  const tex = castTexture(id);
  if (!scene.textures.exists(tex)) return null;
  return scene.add.sprite(x, y, tex, "idle-down-0").setOrigin(CAST_FRAME.origin.x, CAST_FRAME.origin.y)
    .setScale(CAST_FRAME.scale).setName(`cast:${id}`).play(castAnimation(id));
}

