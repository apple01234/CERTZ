/** Selection rules only; definitions remain in the existing Boot catalog. */
import optimized from "../../public/assets/optimized-startup/manifest.json" with { type: "json" };
import { SIGNATURE_PIXELFX, BOSS_PIXELFX } from "./fx/pixelFxSheets";
const optimizedUrls = new Map(optimized.images.map(image => [image.source.slice(1), image.target.slice(1)]));
export const STARTER_PIXELFX = [...SIGNATURE_PIXELFX, "sword-slash", "claw-swipe", "spin-slash", "blunt-hit", "bullet-impact", "hit-spark", "crit-hit", "hit-flash", "coin-spin", "collect-burst", "gem-spin", "crystal-shard", "shatter-death", "dissolve-burn", "poof", "blink-in", "level-up", "quest-complete", "heal", "shield-block"];
export const pixelFxKey = (id: string): string => id.slice(id.lastIndexOf("/") + 1);
export type AssetDefinition = { type: "image" | "spritesheet" | "atlas" | "audio" | "json"; key: string; urls: string[]; config?: Record<string, unknown>; backgroundOnly?: boolean };
export type AssetScope = { body: string; bodies: readonly string[]; monsters: readonly string[]; allMonsters: readonly string[]; demandFx?: boolean; bossFx?: boolean; presentation?: readonly string[] };
export const TITLE_ASSETS = ["glow", "tree", "fragment"] as const;

export function isWorldAsset(asset: AssetDefinition, scope: AssetScope): boolean {
  const key = asset.key;
  if (scope.demandFx && !key.startsWith("vx_") && asset.urls.some(url => url.includes("assets/fx/"))) {
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

// Keep the texture keys used by combat and saved effects while loading alpha-backed art.
const transparentFxUrls = new Map([
  ["assets/aura_ring.webp", "assets/gvb_ring_soft.webp"],
  ["assets/fx2/fx_Circle.webp", "assets/vfx2/vfx_ring.png"],
  ["assets/fx2/fx_Circle2.webp", "assets/gvb_ring_soft.webp"],
  ["assets/cfxr_flamme.webp", "assets/vfx2/vfx_fire.png"],
  ["assets/gw_crater.webp", "assets/wx_crack.webp"],
  ["assets/gw_rune.webp", "assets/gvu_circle_aggr.webp"],
  ["assets/hv2_circle.webp", "assets/vfx2/vfx_ring.png"],
  ["assets/hv2_circle2.webp", "assets/gvb_ring_soft.webp"],
  ["assets/hv2_crater.webp", "assets/wx_crack.webp"],
  ["assets/hv2_magiccircle.webp", "assets/vfx2/vfx_magic2.png"],
  ["assets/hv2_mask.webp", "assets/vfx/fx_glow.webp"],
  ["assets/hv2_point.webp", "assets/vfx2/vfx_pt1.png"],
  ["assets/hv2_star.webp", "assets/vf_star.webp"],
  ["assets/vx_aura.webp", "assets/vfx/fx_aura.webp"],
  ["assets/vx_circlehazy.webp", "assets/gvb_ring_soft.webp"],
  ["assets/vx_bolt.webp", "assets/fx/spark-arc.png"],
  ["assets/vx_elec.webp", "assets/fx/zap-hit.png"],
  ["assets/vx_expcore.webp", "assets/fx/plasma-explosion.png"],
  ["assets/vx_fire.webp", "assets/fx/fireball.png"],
  ["assets/vx_smokecloud.webp", "assets/vx_smoke.webp"],
  ["assets/vx_star.webp", "assets/vf_star.webp"],
  ["assets/vx_trailghost.webp", "assets/vfx2/vfx_wisp.png"],
  ["assets/vfx3/gv_snowflake.webp", "assets/vx_snow.webp"],
  ["assets/wx_crater.webp", "assets/wx_crack.webp"],
  ["assets/wx_snowflake.webp", "assets/vx_snow.webp"],
]);

export function assetUrl(path: string, value: string): string {
  const url = /^(?:blob:|data:|capacitor:\/\/|https?:\/\/|\/)/.test(value) ? value : path + value;
  const key = url.startsWith("/") ? url.slice(1) : url;
  const transparent = transparentFxUrls.get(key);
  const replacement = optimizedUrls.get(transparent ?? key) ?? transparent;
  return replacement ? (url.startsWith("/") ? "/" : "") + replacement : url;
}
