// 2026-11-14 — GM 패널 보스 체험: 모든 보스 버튼이 갈 수 있는 보스 구역을 찾는다.
import test from 'node:test';
import assert from 'node:assert/strict';
const { BOSS_DEFS, STAGES } = await import('../src/game/data.ts');
const { gmBossStage } = await import('../src/game/gmBossStage.ts');

test('GM 패널의 모든 보스가 이동할 보스 구역을 찾는다', () => {
  const missing = Object.keys(BOSS_DEFS).filter((k) => !STAGES[gmBossStage(k)]?.boss);
  assert.deepEqual(missing, []);
});

test('정본에 필드 배치가 없는 보스 4종은 첫 재림 보스 구역에서 체험한다', () => {
  for (const k of ['guardian', 'behemoth', 'snorikaking', 'scarlet']) assert.equal(gmBossStage(k), 'r5', k);
});
