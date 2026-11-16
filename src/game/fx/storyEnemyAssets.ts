import type Phaser from "phaser";
import { STORY_ENEMY_TEXTURES } from "../storyEnemyVisuals";

export function preloadStoryEnemies(scene: Phaser.Scene): void {
  for (const texture of STORY_ENEMY_TEXTURES) {
    const id = texture.slice("storymob_".length);
    scene.load.atlas(texture, `story-enemies/${id}.png`, `story-enemies/${id}.json`);
  }
}
export function registerStoryEnemies(scene: Phaser.Scene): void {
  for (const texture of STORY_ENEMY_TEXTURES) {
    if (!scene.textures.exists(texture)) continue;
    // Reuse six existing poses for anticipation, strike and recovery; no synthetic in-between art.
    const motions = [
      { name: "idle", frames: ["idle-0", "idle-1"], rate: 3, repeat: -1 },
      { name: "run", frames: ["run-0", "run-1", "run-2", "run-3"], rate: 8, repeat: -1 },
      { name: "windup", frames: ["idle-1", "run-0", "attack-0"], rate: 9, repeat: 0 },
      { name: "attack", frames: ["attack-0", "attack-1", "run-1", "idle-0"], rate: 7, repeat: 0 },
    ];
    for (const { name, frames, rate, repeat } of motions) {
      const key = `${texture}-${name}`;
      if (!scene.anims.exists(key)) scene.anims.create({ key, frames: frames.map(frame => ({ key: texture, frame })), frameRate: rate, repeat });
    }
  }
}
