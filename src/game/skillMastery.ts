import type { WeaponMasterStyle } from "./weaponMasterProfiles";

export type TaughtSkill = Exclude<WeaponMasterStyle, "starter">;
export type SkillMastery = Partial<Record<TaughtSkill, number>>;
const SKILLS: TaughtSkill[] = ["solar", "life", "lightning", "chakram", "book", "art", "shadow", "copy", "water", "hammer"];
export const SKILL_MASTERY_REQUIREMENTS = [5, 8, 12, 16, 20, 35, 55, 80, 110, 150] as const;
const THRESHOLDS = [0];
for (const needed of SKILL_MASTERY_REQUIREMENTS) THRESHOLDS.push(THRESHOLDS[THRESHOLDS.length - 1] + needed);
const MAX_LEVEL = SKILL_MASTERY_REQUIREMENTS.length;

function boundedUses(value: unknown, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
}

export function skillMasteryProgress(value: unknown) {
  const uses = boundedUses(value, THRESHOLDS[MAX_LEVEL]);
  let level = 0;
  while (level < MAX_LEVEL && uses >= THRESHOLDS[level + 1]) level++;
  return { uses, level, maxLevel: MAX_LEVEL, maxUses: THRESHOLDS[MAX_LEVEL],
    levelUses: uses - THRESHOLDS[level], levelRequired: SKILL_MASTERY_REQUIREMENTS[level] ?? 0,
    usesToNext: level === MAX_LEVEL ? 0 : THRESHOLDS[level + 1] - uses,
    powerBonusPct: level * 2 };
}

/** Save v0/1 used 20 casts/level. Keep the earned level and fractional progress. */
export function migrateLegacySkillMastery(value: unknown): SkillMastery {
  const result: SkillMastery = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const key of SKILLS) {
    const old = boundedUses((value as Record<string, unknown>)[key], 200);
    const level = Math.floor(old / 20);
    const uses = level === MAX_LEVEL ? THRESHOLDS[MAX_LEVEL]
      : THRESHOLDS[level] + Math.floor(old % 20 / 20 * SKILL_MASTERY_REQUIREMENTS[level]);
    if (uses > 0) result[key] = uses;
  }
  return result;
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
