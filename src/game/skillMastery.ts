import type { WeaponMasterStyle } from "./weaponMasterProfiles";

export type TaughtSkill = Exclude<WeaponMasterStyle, "starter">;
export type SkillMastery = Partial<Record<TaughtSkill, number>>;
const SKILLS: TaughtSkill[] = ["solar", "life", "lightning", "chakram", "book", "art", "shadow", "copy", "water", "hammer"];
const USES_PER_LEVEL = 20;
const MAX_LEVEL = 10;

export function skillMasteryProgress(value: unknown) {
  const uses = typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(USES_PER_LEVEL * MAX_LEVEL, Math.floor(value))) : 0;
  const level = Math.floor(uses / USES_PER_LEVEL);
  return { uses, level, maxLevel: MAX_LEVEL, maxUses: USES_PER_LEVEL * MAX_LEVEL,
    usesToNext: level === MAX_LEVEL ? 0 : USES_PER_LEVEL - uses % USES_PER_LEVEL,
    powerBonusPct: level * 2 };
}

/** Old saves start empty; ignore unknown keys and clamp malformed/oversized counters. */
export function normalizeSkillMastery(value: unknown): SkillMastery {
  const result: SkillMastery = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const key of SKILLS) {
    const uses = skillMasteryProgress((value as Record<string, unknown>)[key]).uses;
    if (uses > 0) result[key] = uses;
  }
  return result;
}
