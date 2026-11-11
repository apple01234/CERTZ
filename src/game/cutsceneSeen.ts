/**
 * vc270 — "한 번 본 컷씬은 다시 재생하지 않는다"를 위한 시청 기록 정리.
 *
 * 왜 순수 함수인가: WorldScene 의 buildSave 안에 인라인으로 두면 회귀를 고정할 수 없다.
 * 저장 시점에 어떤 키를 남기고 버리는지만 책임지고, 테스트가 그 규칙을 직접 검증한다.
 *
 * 종전 버그: `[...seenSet].slice(-160)` 이 Set 삽입 순서대로 잘라 **먼저 본 컷신 기록부터**
 * 버렸다. 컷신을 160개 넘게 본 세이브에서는 오래된 연출이 맵 이동 후 다시 재생됐다.
 */

/** 컷신·연출 키인가 (일반 대사 키와 구분해 절대 버리지 않는다). */
export function isCutsceneSeenKey(key: string): boolean {
  return /^lilacCut_/.test(key) || /_intro$/.test(key) || /^chapter_/.test(key) || /^stageIntro_/.test(key);
}

/**
 * 저장할 시청 기록을 만든다.
 * - 컷신 키: 전부 보존(재생 억제가 목적이므로 버리면 사용자 지적 버그가 재발한다).
 * - 일반 대사 키: 최근 것 위주로 상한을 둔다(무한 증가 방지).
 */
export function buildSeenList(keys: Iterable<string>, dialogueBudget = 160): string[] {
  /* 입력이 Set 이든 배열이든 같은 결과가 나오도록 중복을 먼저 제거한다.
   * (호출부는 Set 을 넘기지만, 배열을 넘기는 실수 한 번이 세이브 크기를 두 배로 만들 수 있다.) */
  const all = [...new Set(keys)];
  const cut: string[] = [];
  const dlg: string[] = [];
  for (const k of all) (isCutsceneSeenKey(k) ? cut : dlg).push(k);
  const keep = Math.max(0, dialogueBudget - cut.length);
  return [...cut, ...(keep > 0 ? dlg.slice(-keep) : [])];
}
