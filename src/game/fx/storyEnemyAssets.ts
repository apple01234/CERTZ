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
    for (const [name, count, rate] of [["idle", 2, 3], ["run", 4, 8], ["attack", 2, 8]] as const) {
      const key = `${texture}-${name}`;
      if (!scene.anims.exists(key)) scene.anims.create({ key, frames: Array.from({ length: count }, (_, i) => ({ key: texture, frame: `${name}-${i}` })), frameRate: rate, repeat: -1 });
    }
  }
}
