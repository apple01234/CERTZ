import manifest from "../../public/assets/cutscene-cast/manifest.json" with { type: "json" };

/** One identity for the portrait, world actor and all of a character's aliases. */
export const CUTSCENE_CAST = manifest.characters;
export const CAST_FRAME = { width: manifest.frameWidth, height: manifest.frameHeight, origin: manifest.origin, scale: manifest.worldScale };
export const CAST_FRAME_NAMES = [
  "idle-down-0", "idle-down-1", "walk-down-0", "walk-down-1",
  "idle-side-0", "idle-side-1", "walk-side-0", "walk-side-1",
  "idle-up-0", "idle-up-1", "walk-up-0", "walk-up-1",
  "talk", "reach", "hurt", "ready",
] as const;
export type CastPose = "idle" | "idle-side" | "idle-up" | "walk" | "walk-side" | "walk-up" | "talk" | "reach" | "hurt" | "ready";
export type CutsceneCharacter = (typeof CUTSCENE_CAST)[number];

const byName = new Map(CUTSCENE_CAST.flatMap((c) => [c.id, `cast_${c.id}`, c.name, ...c.aliases].map((alias) => [alias, c] as const)));
export function cutsceneCharacter(name: string | undefined | null): CutsceneCharacter | undefined {
  return name ? byName.get(name) : undefined;
}
export const castTexture = (id: string): string => `cast_${id}`;
export const castAnimation = (id: string, pose: CastPose = "idle"): string => `${castTexture(id)}-${pose}`;
export const castPortrait = (id: string): string => `/assets/cutscene-cast/portraits/${id}.png`;

export function castActor(id: string, x = -34, y = 0) {
  if (!cutsceneCharacter(id)) throw new Error(`Unknown cutscene character: ${id}`);
  return {
    character: id, tex: castTexture(id), frame: "idle-down-0", anim: castAnimation(id),
    anchor: "feature" as const, x, y, fadeIn: true, scale: CAST_FRAME.scale,
  };
}
