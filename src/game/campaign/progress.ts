import {
  CAMPAIGN_ID,
  CHAPTERS,
  CHAPTER_BY_ID,
  COSMETICS,
  FAMILIES,
  type Family,
} from "./catalog.ts";
export const SCHEMA_VERSION = 1;
export type CampaignProgress = {
  campaignId: typeof CAMPAIGN_ID;
  schemaVersion: 1;
  characterId: string;
  name: string;
  family: Family;
  chapterId: string;
  objective: number;
  targets: string[];
  completed: string[];
  memories: string[];
  coins: number;
  inventory: Record<string, number>;
  cosmetics: string[];
  equipped: string | null;
  choices: Record<string, string>;
  deaths: number;
  updatedAt: number;
};
export function newCampaign(
  name: string,
  family: Family,
  id: string,
  now = Date.now(),
): CampaignProgress {
  return {
    campaignId: CAMPAIGN_ID,
    schemaVersion: SCHEMA_VERSION,
    characterId: id,
    name: name.trim().slice(0, 12) || "여행자",
    family,
    chapterId: CHAPTERS[0].id,
    objective: 0,
    targets: [],
    completed: [],
    memories: [],
    coins: 0,
    inventory: {},
    cosmetics: [],
    equipped: null,
    choices: {},
    deaths: 0,
    updatedAt: now,
  };
}
export function currentChapter(p: CampaignProgress) {
  return CHAPTER_BY_ID[p.chapterId];
}
export function currentObjective(p: CampaignProgress) {
  return currentChapter(p).objectives[p.objective] ?? null;
}
export function unlocked(p: CampaignProgress, id: string) {
  const i = CHAPTERS.findIndex((c) => c.id === id);
  return i === 0 || (i > 0 && p.completed.includes(CHAPTERS[i - 1].id));
}
export function actComplete(p: CampaignProgress, act: 1 | 2 | 3) {
  return CHAPTERS.filter((c) => c.act === act).every((c) =>
    p.completed.includes(c.id),
  );
}
export type ProgressAction =
  | { kind: "interact"; target: string }
  | { kind: "boss-won" }
  | { kind: "choice"; value: string }
  | { kind: "travel"; chapterId: string };
export function advance(
  p: CampaignProgress,
  action: ProgressAction,
  now = Date.now(),
): CampaignProgress {
  if (action.kind === "travel")
    return unlocked(p, action.chapterId)
      ? {
          ...p,
          chapterId: action.chapterId,
          objective: 0,
          targets: [],
          updatedAt: now,
        }
      : p;
  if (action.kind === "choice")
    return ["remember", "protect"].includes(action.value)
      ? {
          ...p,
          choices: { ...p.choices, [p.chapterId]: action.value },
          updatedAt: now,
        }
      : p;
  const chapter = currentChapter(p),
    objective = currentObjective(p);
  if (!objective) return p;
  let targets = p.targets;
  if (action.kind === "boss-won") {
    if (objective.kind !== "boss") return p;
    targets = [...objective.targets];
  } else {
    if (
      objective.kind === "boss" ||
      !objective.targets.includes(action.target) ||
      targets.includes(action.target)
    )
      return p;
    if (
      objective.kind === "puzzle" &&
      objective.targets[targets.length] !== action.target
    )
      return { ...p, targets: [], updatedAt: now };
    targets = [...targets, action.target];
  }
  if (targets.length < objective.targets.length)
    return { ...p, targets, updatedAt: now };
  const next = {
    ...p,
    objective: p.objective + 1,
    targets: [],
    updatedAt: now,
  };
  if (
    next.objective === chapter.objectives.length &&
    !p.completed.includes(chapter.id)
  ) {
    next.completed = [...p.completed, chapter.id];
    next.memories = [...new Set([...p.memories, chapter.id])];
    next.coins = p.coins + 60;
    next.inventory = {
      ...p.inventory,
      "memory-fragment": (p.inventory["memory-fragment"] ?? 0) + 1,
    };
  }
  return next;
}
/** Strict import boundary: reject legacy, future, impossible, and oversized payloads. */
export function parseCampaign(input: unknown): CampaignProgress | null {
  if (!input || typeof input !== "object") return null;
  const p = input as CampaignProgress;
  if (
    p.campaignId !== CAMPAIGN_ID ||
    p.schemaVersion !== SCHEMA_VERSION ||
    typeof p.chapterId !== "string" ||
    typeof p.family !== "string" ||
    !Object.hasOwn(CHAPTER_BY_ID, p.chapterId) ||
    !Object.hasOwn(FAMILIES, p.family)
  )
    return null;
  if (
    typeof p.characterId !== "string" ||
    !/^[a-zA-Z0-9-]{8,80}$/.test(p.characterId) ||
    typeof p.name !== "string" ||
    p.name.trim().length < 1 ||
    p.name.length > 12 ||
    /[\x00-\x1f]/.test(p.name)
  )
    return null;
  if (
    !Array.isArray(p.completed) ||
    p.completed.length > CHAPTERS.length ||
    new Set(p.completed).size !== p.completed.length ||
    p.completed.some((id, i) => id !== CHAPTERS[i].id)
  )
    return null;
  const chapter = CHAPTER_BY_ID[p.chapterId];
  if (
    !unlocked(p, p.chapterId) ||
    !Number.isInteger(p.objective) ||
    p.objective < 0 ||
    p.objective > chapter.objectives.length
  )
    return null;
  if (
    p.objective === chapter.objectives.length &&
    !p.completed.includes(p.chapterId)
  )
    return null;
  const objective = chapter.objectives[p.objective];
  if (
    !Array.isArray(p.targets) ||
    new Set(p.targets).size !== p.targets.length ||
    p.targets.length > (objective?.targets.length ?? 0) ||
    p.targets.some((t) => !objective?.targets.includes(t))
  )
    return null;
  if (
    objective?.kind === "puzzle" &&
    p.targets.some((v, i) => v !== objective.targets[i])
  )
    return null;
  if (
    !Number.isSafeInteger(p.coins) ||
    p.coins < 0 ||
    p.coins > 10000000 ||
    !Number.isSafeInteger(p.deaths) ||
    p.deaths < 0
  )
    return null;
  if (
    !Array.isArray(p.cosmetics) ||
    p.cosmetics.some((id) => !COSMETICS.some((c) => c.id === id)) ||
    !Array.isArray(p.memories) ||
    p.memories.length > 34 ||
    new Set(p.memories).size !== p.memories.length ||
    p.memories.some((id) => !p.completed.includes(id))
  )
    return null;
  if (p.equipped !== null && !p.cosmetics.includes(p.equipped)) return null;
  if (
    !p.inventory ||
    typeof p.inventory !== "object" ||
    Object.entries(p.inventory).some(
      ([k, v]) =>
        k !== "memory-fragment" ||
        !Number.isSafeInteger(v) ||
        v < 0 ||
        v > 100000,
    )
  )
    return null;
  if (
    !p.choices ||
    typeof p.choices !== "object" ||
    Array.isArray(p.choices) ||
    Object.entries(p.choices).some(
      ([id, v]) => !CHAPTER_BY_ID[id] || !["remember", "protect"].includes(v),
    )
  )
    return null;
  if (!Number.isFinite(p.updatedAt) || p.updatedAt < 0) return null;
  return structuredClone(p);
}
