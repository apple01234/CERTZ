/** 세계관 간 이동 계약. 본편 클리어·영프 엔딩을 서로 대신하지 않는다. */
import { STORY_SEQUENCE } from "./stages";
import { HOWLRSTONE_FINAL, HOWLRSTONE_ENTRY } from "./howlrstone";

export const YOUNG_PRINCESS_VILLAGE = "youngprincessv";
/** 영프 편 마지막 구역 — 이 보스를 잡으면 `youngPrincessCleared` 가 선다. */
export const HOWLRSTONE_END = HOWLRSTONE_FINAL;
export type StoryProgress = {
  cleared?: boolean;
  youngPrincessCleared?: boolean;
};

/**
 * 영프 편(하울르스톤: 영준 프린세스)의 실제 챕터/엔딩 콘텐츠가 들어왔는지.
 *
 * `STORY_SEQUENCE.howlrstone.status` 에서 **파생**시킨다. 콘텐츠가 미구현이면
 * 영프 시작 마을을 경유지로 통과시키고(해제 수단 없는 잠금은 그랜드 플레닛을 영구히 막는다),
 * 구현되면 자동으로 잠근다.
 *
 * 비교를 문자열 리터럴이 아니라 `string` 으로 넓혀서 한다 — `STORY_SEQUENCE` 는
 * `as const` 라 status 가 리터럴 유니온("implemented")으로 좁혀져, 리터럴과의
 * `!==` 비교가 TS2339("no overlap")로 빌드를 깨뜨린다. 데이터를 바꾸는 것만으로
 * 게이트가 뒤집히는 계약은 그대로 유지된다.
 */
export const MIDDLE_CHAPTER_IMPLEMENTED: boolean = STORY_SEQUENCE.some(
  (s) => s.id === "howlrstone" && (s.status as string) !== "not-implemented",
);

/** 영프 편 마지막 구역인가 — 엔딩 플래그를 세우는 지점 판정에 쓴다. */
export function howlFinalStage(stage: string): boolean {
  return stage === HOWLRSTONE_END;
}

export function storyPortalDestination(stage: string, progress: StoryProgress): string | null {
  /* 유저 지시 — "애델리오나 마을 → 1-1 스테이지" 직행.
   *  종전엔 village → youngprincessv('영준 프린세스 시작 마을')를 한 번 더 경유했다.
   *  기획상 애델리오나 마을 다음은 별도 시작 마을이 아니라 영프 편 본편 첫 구역이다.
   *  youngprincessv 정의 자체는 남겨 둔다(구 세이브가 이 키를 들고 있을 수 있고,
   *  grandPlanetCanon 이 복귀 지점으로 참조한다). 다만 진행 경로에서는 건너뛴다. */
  if (stage === "village") return HOWLRSTONE_ENTRY;
  if (stage === YOUNG_PRINCESS_VILLAGE) {
    return progress.youngPrincessCleared || !MIDDLE_CHAPTER_IMPLEMENTED ? "dlcstargate1" : null;
  }
  return null;
}

/** 포탈·친구 따라가기·워프·세이브 재진입 모두 같은 잠금을 사용한다. */
export function storyEntryAllowed(stage: string, progress: StoryProgress): boolean {
  if (stage.startsWith("dlc")) {
    return !!progress.youngPrincessCleared || !MIDDLE_CHAPTER_IMPLEMENTED;
  }
  if (stage.startsWith("youngprincess")) return true;
  return true;
}
