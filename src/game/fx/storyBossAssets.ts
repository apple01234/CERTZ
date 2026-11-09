import type Phaser from "phaser";
import manifest from "../../../public/assets/story-bosses/manifest.json" with { type: "json" };

export function preloadStoryBosses(scene: Phaser.Scene): void {
  for (const b of manifest.bosses) scene.load.atlas(b.texture, `story-bosses/${b.id}.png`, `story-bosses/${b.id}.json`);
}
export function registerStoryBosses(scene: Phaser.Scene): void {
  for (const b of manifest.bosses) {
    for (const [name, row, rate] of [["idle", "idle", 4], ["walk", "walk", 8], ["atk", "attack", 9], ["sp1", "cast", 7], ["sp2", "cast", 7], ["sp3", "cast", 7], ["die", "idle", 3]] as const) {
      const key = `${b.texture}-${name}`;
      if (!scene.anims.exists(key)) scene.anims.create({ key, frames: Array.from({ length: 4 }, (_, n) => ({ key: b.texture, frame: `${row}-${n}` })), frameRate: rate, repeat: -1 });
    }
  }
}
