/** 세계관 간 이동 계약. 본편 클리어·영프 엔딩을 서로 대신하지 않는다. */
import { STORY_SEQUENCE } from "./stages";

export const YOUNG_PRINCESS_VILLAGE = "youngprincessv";
export type StoryProgress = {
  cleared?: boolean;
  youngPrincessCleared?: boolean;
};

/**
 * 영프 편(하울르스톤: 영준 프린세스)의 실제 챕터/엔딩 콘텐츠가 들어왔는지.
 * STORY_SEQUENCE[1](howlrstone) 표시가 "not-implemented"인 동안에는
 * 영프 시작 마을을 경유지로 통과시킨다 — 해제 수단 없는 잠금은 그랜드 플레닛을
 * 영구히 막는 막다른 길이 되기 때문. 콘텐츠가 들어오면 자동으로 잠근다.
 */
export const MIDDLE_CHAPTER_IMPLEMENTED = STORY_SEQUENCE.some(
  (s) => s.id === "howlrstone" && s.status !== "not-implemented",
);

export function storyPortalDestination(stage: string, progress: StoryProgress): string | null {
  if (!progress.cleared) return null;
  if (stage === "village") return YOUNG_PRINCESS_VILLAGE;
  if (stage === YOUNG_PRINCESS_VILLAGE) {
    return progress.youngPrincessCleared || !MIDDLE_CHAPTER_IMPLEMENTED ? "dlcstargate1" : null;
  }
  return null;
}

/** 포탈·친구 따라가기·워프·세이브 재진입 모두 같은 잠금을 사용한다. */
export function storyEntryAllowed(stage: string, progress: StoryProgress): boolean {
  if (stage.startsWith("dlc")) {
    return !!progress.cleared && (!!progress.youngPrincessCleared || !MIDDLE_CHAPTER_IMPLEMENTED);
  }
  if (stage.startsWith("youngprincess")) return !!progress.cleared;
  return true;
}
