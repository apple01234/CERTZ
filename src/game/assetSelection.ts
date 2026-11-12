/** Selection rules only; definitions remain in the existing Boot catalog. */
export type AssetDefinition = { type: "image" | "spritesheet" | "atlas" | "audio" | "json"; key: string; urls: string[]; config?: Record<string, unknown>; backgroundOnly?: boolean };
export type AssetScope = { body: string; bodies: readonly string[]; monsters: readonly string[]; allMonsters: readonly string[] };
export const TITLE_ASSETS = ["glow", "tree", "fragment"] as const;

export function isWorldAsset(asset: AssetDefinition, scope: AssetScope): boolean {
  const key = asset.key;
  const body = scope.bodies.find(prefix => key.startsWith(`${prefix}_`));
  if (body) return body === scope.body;
  const monster = scope.allMonsters.find(prefix => key.startsWith(`${prefix}_`));
  if (monster) return scope.monsters.includes(monster);
  if (key === "wraith_spirit") return scope.monsters.includes("wraith");
  // ponytail: shared FX, lighting, cutscenes and on-map boss summons stay gated
  // until their callers have explicit on-demand dependencies; never hide them by tier.
  return true;
}

export function assetUrl(path: string, value: string): string {
  return /^(?:blob:|data:|capacitor:\/\/|https?:\/\/|\/)/.test(value) ? value : path + value;
}
