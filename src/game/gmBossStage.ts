/**
 * GM 보스 체험 — 보스를 띄울 구역을 고른다(WorldScene.gmBossStageOf 에서 분리, 2026-11-14).
 *
 * 순서
 *   ① STAGES 의 bossKey 역색인 — 실제로 그 보스가 서 있는 구역(영프 편·재림 r5/r10/r15 포함)
 *   ② CHAPTERS(그랜드 플래닛) 의 boss — `{chapter}10`
 *   ③ 정본 배치에 필드 구역이 없는 보스(guardian·behemoth·클로체스·어둠의 군주 스칼렛) — 첫 재림 보스 구역
 *      종전엔 여기서 null 을 돌려 "배치 구역을 찾지 못했습니다"로 끝났다(유저 신고: GM 패널에서 안 가지는 보스).
 * 영프 편 챕터 탐색은 뺐다 — 챕터 boss 는 스토리 배치(CHAPTER_STORY_PLAN)에서 오므로 ①이 항상 먼저 찾는다.
 * GM 보스 스폰(spawnGmBoss)은 구역의 원래 보스와 무관하게 요청한 보스를 띄운다.
 */
import { STAGES, CHAPTERS, type BossKey, type StageKey } from "./data";

export const GM_BOSS_FALLBACK_STAGE = "r5";

export function gmBossStage(bossKey: BossKey): string | null {
  for (const key of Object.keys(STAGES) as StageKey[]) {
    const def = STAGES[key];
    if (def?.boss && def.bossKey === bossKey) return key;
  }
  const ch = CHAPTERS.find((c) => c.boss === bossKey);
  if (ch && STAGES[`${ch.key}10` as StageKey]) return `${ch.key}10`;
  return STAGES[GM_BOSS_FALLBACK_STAGE as StageKey] ? GM_BOSS_FALLBACK_STAGE : null;
}
