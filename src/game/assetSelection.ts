/** Selection rules only; definitions remain in the existing Boot catalog. */
import optimized from "../../public/assets/optimized-startup/manifest.json" with { type: "json" };
import { SIGNATURE_PIXELFX, BOSS_PIXELFX } from "./fx/pixelFxSheets";
const optimizedUrls = new Map(optimized.images.map(image => [image.source.slice(1), image.target.slice(1)]));
export const STARTER_PIXELFX = [...SIGNATURE_PIXELFX, "sword-slash", "claw-swipe", "spin-slash", "blunt-hit", "bullet-impact", "hit-spark", "crit-hit", "impact-frame", "coin-spin", "collect-burst", "gem-spin", "crystal-shard", "shatter-death", "dissolve-burn", "poof", "blink-in", "level-up", "quest-complete", "heal", "shield-block"];
export const pixelFxKey = (id: string): string => id.slice(id.lastIndexOf("/") + 1);
export type AssetDefinition = { type: "image" | "spritesheet" | "atlas" | "audio" | "json"; key: string; urls: string[]; config?: Record<string, unknown>; backgroundOnly?: boolean };
export type AssetScope = { body: string; bodies: readonly string[]; monsters: readonly string[]; allMonsters: readonly string[]; demandFx?: boolean; bossFx?: boolean; presentation?: readonly string[] };
export const TITLE_ASSETS = ["glow", "tree", "fragment"] as const;

export function isWorldAsset(asset: AssetDefinition, scope: AssetScope): boolean {
  const key = asset.key;
  if (scope.demandFx && asset.urls.some(url => url.includes("assets/fx/"))) {
    const fx = key.replace(/__meta$/, "");
    return STARTER_PIXELFX.includes(fx) || !!scope.bossFx && BOSS_PIXELFX.includes(fx);
  }
  if (scope.presentation && /^(?:cast_|story_|atl_boss|boss)/.test(key)) return scope.presentation.includes(key);
  const body = scope.bodies.find(prefix => key.startsWith(`${prefix}_`));
  if (body) return body === scope.body;
  const monster = scope.allMonsters.find(prefix => key === prefix || key.startsWith(`${prefix}_`));
  if (monster) return scope.monsters.includes(monster);
  if (key === "wraith_spirit") return scope.monsters.includes("wraith");
  // ponytail: shared FX, lighting, cutscenes and on-map boss summons stay gated
  // until their callers have explicit on-demand dependencies; never hide them by tier.
  return true;
}

export function assetUrl(path: string, value: string): string {
  const url = /^(?:blob:|data:|capacitor:\/\/|https?:\/\/|\/)/.test(value) ? value : path + value;
  const key = url.startsWith("/") ? url.slice(1) : url;
  const replacement = optimizedUrls.get(key);
  return replacement ? (url.startsWith("/") ? "/" : "") + replacement : url;
}
