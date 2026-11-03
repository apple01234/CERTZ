/** Story progress is versioned separately from owned RPG items and advancement. */
export const STORY_REVISION = "haru-evernote-v1";

type StorySave = {
  storyRevision?: string;
  stage: string;
  youngPrincessCleared?: boolean;
  dlcTalked?: boolean;
  questIdx?: Record<string, number>;
  questAccepted?: Record<string, number>;
  questTracked?: string | null;
  seen?: string[];
  cutsceneSeen?: string[];
  huntKills?: Record<string, number>;
  huntBase?: Record<string, number>;
};

function isStoryStage(stage: string): boolean {
  return /^(?:village|youngprincess|howlrstone|dlc|forest|kingdom|alfheim|muspelheim|niflheim|cave|nidavellir|hel|abyss)/.test(stage);
}

function withoutStoryStages(values: Record<string, number> | undefined) {
  return Object.fromEntries(Object.entries(values ?? {}).filter(([stage]) => !isStoryStage(stage)));
}

/** A new story replays its own quests, never the player's earned character growth. */
export function migrateStoryProgress<T extends StorySave>(data: T): T {
  if (data.storyRevision === STORY_REVISION) return data;
  return {
    ...data,
    storyRevision: STORY_REVISION,
    stage: "village",
    youngPrincessCleared: false,
    dlcTalked: false,
    questIdx: withoutStoryStages(data.questIdx),
    questAccepted: withoutStoryStages(data.questAccepted),
    questTracked: data.questTracked && !isStoryStage(data.questTracked) ? data.questTracked : null,
    seen: [],
    cutsceneSeen: [],
    huntBase: { ...data.huntKills },
  };
}

/** The prefix deliberately does not match sertz_char_* orphan-character discovery. */
export function storyBackupKey(saveKey: string): string {
  return `sertz:story-backup:${STORY_REVISION}:${saveKey}`;
}
