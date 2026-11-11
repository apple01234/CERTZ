import type Phaser from "phaser";
import manifest from "../../../public/assets/story-bosses/manifest.json" with { type: "json" };

export function preloadStoryBosses(scene: Phaser.Scene): void {
  for (const b of manifest.bosses) scene.load.atlas(b.texture, `story-bosses/${b.id}.png`, `story-bosses/${b.id}.json`);
}
export function registerStoryBosses(scene: Phaser.Scene): void {
  for (const b of manifest.bosses) {
    if (!scene.textures.exists(b.texture)) continue;
    for (const [name, row, rate] of [["idle", "idle", 4], ["walk", "walk", 8], ["atk", "attack", 9], ["sp1", "cast", 7], ["sp2", "cast", 7], ["sp3", "cast", 7], ["die", "idle", 3]] as const) {
      const key = `${b.texture}-${name}`;
      if (!scene.anims.exists(key)) scene.anims.create({ key, frames: Array.from({ length: 4 }, (_, n) => ({ key: b.texture, frame: `${row}-${n}` })), frameRate: rate, repeat: -1 });
    }
    /* vc275 — 예고(windup) / 발동(release) 분리. 새 그림을 만들지 않고 **기존 4프레임을 재조합**한다.
     *  · windup : attack 프레임을 **거꾸로**(3→0) 재생해 "뒤로 감기는 예비동작"을 만든다.
     *             실행 코드가 예고 시간에 맞춰 timeScale 을 조절하므로 길이는 호출부가 정한다.
     *  · release: attack 을 정방향으로 **한 번만** 재생(repeat 0)해 타격 순간을 표현한다.
     *  기존 `atk`(루프)는 그대로 두어 다른 경로가 깨지지 않게 한다. */
    const windup = `${b.texture}-windup`;
    if (!scene.anims.exists(windup)) {
      scene.anims.create({
        key: windup,
        frames: [3, 2, 1, 0].map((n) => ({ key: b.texture, frame: `attack-${n}` })),
        frameRate: 8, repeat: 0,
      });
    }
    const release = `${b.texture}-release`;
    if (!scene.anims.exists(release)) {
      scene.anims.create({
        key: release,
        frames: [0, 1, 2, 3].map((n) => ({ key: b.texture, frame: `attack-${n}` })),
        frameRate: 12, repeat: 0,
      });
    }
  }
}
