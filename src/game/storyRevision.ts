/** Story progress is versioned separately from owned RPG items and advancement. */
export const STORY_REVISION = "haru-evernote-v1";

type StorySave = {
  storyRevision?: string;
  storyChoices?: Record<string, string>;
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

/** Only an explicitly identified legacy story may reset story progress. */
export function migrateStoryProgress<T extends StorySave>(data: T): T {
  /* 유저 지시 — '영준 프린세스 시작 마을'(youngprincessv)을 진행 경로에서 제거했다.
   *  구 세이브가 이 구역을 가리키고 있으면 유효한 곳에서 이어서 시작하게 한다:
   *  영프 편을 끝낸 세이브는 그랜드 플래닛 입구로, 아니면 애델리오나 마을로 보낸다.
   *  (스테이지 정의 자체는 남아 있으므로 데이터 손실은 없다 — 위치만 정규화) */
  const next = data.storyRevision !== "memory-oath-v1" ? { ...data } : {
    ...data,
    storyRevision: STORY_REVISION,
    storyChoices: {},
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
  if (next.stage === "youngprincessv") next.stage = next.youngPrincessCleared ? "dlcstargatev" : "village";
  if (!next.storyRevision) next.storyRevision = STORY_REVISION;
  return next;
}

/** The prefix deliberately does not match sertz_char_* orphan-character discovery. */
export function storyBackupKey(saveKey: string): string {
  return `sertz:story-backup:${STORY_REVISION}:${saveKey}`;
}
