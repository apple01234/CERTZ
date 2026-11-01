/** Aura-only textures; BootScene loads AURA_TEXTURE_LOADS via load.image(key, file).
 * Never infer animation from aspect ratio: portrait glow/wave masks are full static
 * source artwork. circle_aggr alone is the explicit original 4×4, 128px grid.
 */
import type Phaser from "phaser";
import manifest from "../../../public/assets/aura/manifest.json";
export const AURA_TEXTURES = Object.fromEntries(manifest.map(def => [def.source, def]));
export const AURA_TEXTURE_LOADS = manifest.map(({ key, file }) => ({ key, file }));
export const AURA_WORLD_CAPS = { core: 64, halo: 80, ground: 94, barrier: 110 } as const;
export function auraTextureKey(source: string): string {
  return AURA_TEXTURES[source]?.key ?? `aura_${source}`;
}
/** Scale by actual frame edge; cap includes maximum pulse, not just base scale. */
export function auraScale(image: Phaser.GameObjects.Image, cap: number, intensity = 1): number {
  const edge = Math.max(image.frame?.width || image.width || 1, image.frame?.height || image.height || 1);
  return cap / edge * Math.min(1, Math.max(0, intensity));
}
export function ensureAuraAnim(scene: Phaser.Scene, source: string): string | null {
  const def = AURA_TEXTURES[source];
  if (!def || def.cols * def.rows === 1 || !scene.textures.exists(def.key)) return null;
  const tex = scene.textures.get(def.key);
  const fw = def.width / def.cols, fh = def.height / def.rows;
  for (let i = 0; i < def.cols * def.rows; i++) {
    if (!tex.has(String(i))) tex.add(i, 0, i % def.cols * fw, Math.floor(i / def.cols) * fh, fw, fh);
  }
  const key = `aura-anim:${source}`;
  if (!scene.anims.exists(key)) scene.anims.create({ key,
    frames: Array.from({ length: def.cols * def.rows }, (_, frame) => ({ key: def.key, frame })),
    frameRate: 10, repeat: -1 });
  return key;
}
