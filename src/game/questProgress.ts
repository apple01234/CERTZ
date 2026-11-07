/**
 * 퀘스트 토벌 진행도 — (스테이지, 퀘스트) 단위 독립 카운터.
 *
 * [왜 필요한가]
 *  종전엔 전역 종족 카운터(`killTotals`)에서 "퀘스트 수락 시점 기준선"을 빼는 방식이었다.
 *  그러면 기준선을 잡은 뒤의 **모든 킬**이 그 퀘스트에 더해지므로, 맵이 달라도 구분되지 않는다.
 *   · mapA 퀘스트를 3/8 로 진행 중 → mapB 에서 같은 몬스터 5마리 사냥 → mapA 로 돌아오면 8/8.
 *   · 실제로 mapA 에서 잡은 것은 3마리뿐인데 퀘스트가 완료된다.
 *  유저 신고 "서로 다른 맵/퀘스트의 처치 수가 다른 퀘스트에 반영된다"가 정확히 이것이다.
 *
 * [해결]
 *  처치 이벤트가 **그 스테이지의 그 퀘스트** 목표에 맞을 때만 그 퀘스트 칸을 1 올린다.
 *  기준선 차감이 없으므로 다른 맵/다른 퀘스트가 오염될 경로 자체가 없다.
 *
 * 이 모듈은 순수 함수만 둔다 (WorldScene 은 Phaser 의존이라 단위 테스트가 어렵다).
 */

/** 저장 형태 — `"스테이지:퀘스트id"` → 처치 수. 값은 항상 0 이상 정수. */
export type HuntProgress = Record<string, number>;

/** 진행도 키. `:` 는 스테이지 키/퀘스트 id 어디에도 쓰이지 않는다. */
export function huntScope(stage: string, questId: string): string {
  return `${stage}:${questId}`;
}

/** 이 퀘스트의 현재 처치 수. */
export function huntProgressOf(progress: HuntProgress, scope: string): number {
  return progress[scope] ?? 0;
}

/**
 * 처치 1회 반영. 그 퀘스트의 대상 종이 아니면 아무 것도 하지 않는다.
 * 목표치를 넘겨 세지 않고(초과 집계 금지), 이미 목표에 도달한 퀘스트도 더 오르지 않는다
 * (완료 후 추가 집계 금지 — 다른 맵에서 잡아도 넘치지 않는다).
 * @returns 이번 처치가 진행도에 반영됐는가
 */
export function recordHuntKill(
  progress: HuntProgress,
  scope: string,
  targets: readonly string[],
  species: string,
  need: number,
): boolean {
  if (!targets.includes(species)) return false;
  const cur = progress[scope] ?? 0;
  if (need > 0 && cur >= need) return false;
  progress[scope] = cur + 1;
  return true;
}

/**
 * 구세이브 이관 — 옛 방식(전역 종족 킬 − 수락 시점 기준선)으로 계산된 값을 새 카운터에 넣는다.
 * 이미 이 퀘스트의 새 카운터가 있으면 손대지 않는다(진행도 보존).
 * @param legacyTotal 옛 공식으로 계산한 진행도
 */
export function seedHuntProgress(
  progress: HuntProgress,
  scope: string,
  legacyTotal: number,
  need: number,
): void {
  if (scope in progress) return;
  const v = Math.max(0, Math.floor(legacyTotal) || 0);
  progress[scope] = need > 0 ? Math.min(v, need) : v;
}
