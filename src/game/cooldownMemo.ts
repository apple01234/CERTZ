/**
 * cooldownMemo.ts — 맵 이동 간 스킬 쿨타임 유지 (v1.0.15 피드백 #3)
 *
 * 문제: WorldScene은 맵 이동 시 scene.restart로 통째로 재생성되고, Player 필드
 *  (skill1Cd~skill5bCd, potCd)가 초기값 0으로 다시 태어나 "맵만 넘어가면 쿨타임이
 *  초기화"되는 버그로 보였다.
 *
 * 해결: 모듈 레벨 싱글톤 메모에 "남은 쿨타임(ms)"을 기록했다가, 다음 맵의 새
 *  Player 생성자에서 복원한다. 기록은 gotoStage(유일한 맵 전환 통로)에서 1회,
 *  복원은 1회성(복원 후 메모 비움)이라 타이틀 복귀·새 게임에는 영향이 없다.
 *  전직/GM 리셋 등 "의도된" 초기화는 복원 이후에 일어나므로 그대로 유지된다.
 */

const memo = new Map<string, number>();

/** 씬 전환 직전 호출 — 현재 남은 쿨타임을 기록 (덮어쓰기: 마지막 전환 기준) */
export function memoCooldowns(cd: Record<string, number>) {
  for (const [k, v] of Object.entries(cd)) {
    if (v > 0) memo.set(k, v);
    else memo.delete(k);
  }
}

/** 새 Player 생성 직후 호출 — 기록된 쿨타임 복원 후 메모 비움 (1회성) */
export function restoreCooldowns(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of memo) out[k] = v;
  memo.clear();
  return out;
}
