/** Selection rules only; definitions remain in the existing Boot catalog. */
export type AssetDefinition = { type: "image" | "spritesheet" | "atlas" | "audio" | "json"; key: string; urls: string[]; config?: Record<string, unknown>; backgroundOnly?: boolean };
export type AssetScope = { body: string; bodies: readonly string[]; monsters: readonly string[]; allMonsters: readonly string[]; bosses: readonly string[]; highTier: boolean; nativeTerrain?: boolean };
export const TITLE_ASSETS = ["glow", "tree", "fragment"] as const;

const BASIC_FX = new Set(["sword-slash", "hit-spark", "crit-hit", "coin-spin", "collect-burst", "gem-spin", "quest-complete", "level-up", "heal", "poof", "shield-block", "blink-in"]);

export function isWorldAsset(asset: AssetDefinition, scope: AssetScope): boolean {
  const key = asset.key;
  if (asset.backgroundOnly) return false;
  if (asset.type === "audio") return false; // Sound has its existing on-demand/idle path.
  const body = scope.bodies.find(prefix => key.startsWith(`${prefix}_`));
  if (body) return body === scope.body || key === `${body}_idle0`;
  const monster = scope.allMonsters.find(prefix => key.startsWith(`${prefix}_`));
  if (monster) return scope.monsters.includes(monster);
  if (key === "wraith_spirit") return scope.monsters.includes("wraith");
  if (key.startsWith("atl_boss") || key.startsWith("story_") || /^boss(?:\d|_)/.test(key)) return scope.bosses.some(prefix => key === prefix || key.startsWith(`${prefix}_`));
  // Native chapter maps have their own ground atlas; keep legacy terrain packs
  // in the catalog for other maps/editor without blocking this map's entrance.
  if (scope.nativeTerrain && (/^tx_/.test(key) || /_pack(?:_v\d+)?$/.test(key))) return false;
  if (asset.urls[0]?.includes("/fx/") && !scope.highTier && !scope.bosses.length) return BASIC_FX.has(key.replace(/__meta$/, ""));
  // Upper-tier flourishes stay available in the background. Do not hold a new
  // adventurer's first map for every later class's 1024px effect texture.
  if (/^(?:gv_|gvb_|gvu_|hv2_|vx_|tn_|mg_|pk_|vf_|gw_|wx_|cp_|cfxr_|aura_|vfx_|vfx2_)/.test(key)) return scope.highTier || scope.bosses.length > 0;
  return true;
}

export function assetUrl(path: string, value: string): string {
  return /^(?:blob:|data:|capacitor:\/\/|https?:\/\/|\/)/.test(value) ? value : path + value;
}
