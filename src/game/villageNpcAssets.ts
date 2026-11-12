/** Purchased SPUM assets take priority; old replacement art is only a missing-file fallback. */
export function resolveVillageNpcTexture(texture: string, exists: (key: string) => boolean, fallback?: string): string {
  if (exists(texture)) return texture;
  return fallback && exists(fallback) ? fallback : texture;
}
