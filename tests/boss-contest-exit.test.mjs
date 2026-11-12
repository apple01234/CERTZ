/**
 * vc283 후속 — 기록전 종료 경로(평가 P0/P1) 회귀 고정.
 *  P0 ① 시간 초과·포기·사망 뒤 경기장에 갇히지 않는다(보스를 먼저 치운다).
 *  P0 ② 결과 제출은 네트워크 실패 시 재전송한다(실행 검증).
 *  P1   기록전은 파티 공유·조우 컷신·GM 체험 보상 없이 독립 판으로 돈다.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { submitWithRetry } from '../src/lib/bossContestStore.ts';
import { stageScale } from '../src/game/stages.ts';

const scene = readFileSync('src/game/scenes/WorldScene.ts', 'utf8');
const client = readFileSync('src/game/bossContest.ts', 'utf8');
const body = (sig) => {
  const i = scene.indexOf(sig);
  assert.ok(i > -1, `${sig} 구현이 있어야 한다`);
  return scene.slice(i, scene.indexOf('\n  }\n', i));
};
const err = (status) => Object.assign(new Error('x'), status ? { status } : {});
const noSleep = async () => {};

test('처치가 아닌 종료는 복귀 예약 전에 보스를 치운다', () => {
  const b = body('private finishContest(');
  const remove = b.indexOf('this.removeBossNow()');
  assert.ok(remove > -1 && remove < b.indexOf('this.scheduleContestReturn('),
    'startTransition 은 보스전 중 이동을 막는다 — 보스 정리가 먼저여야 한다');
  assert.ok(b.indexOf('this.boss?.hp') < remove, '잔여 HP 는 보스를 지우기 전에 읽는다');
  assert.match(body('private removeBossNow()'), /this\.boss = null/);
});

test('기록전 사망은 실패 보고 + 패널티 면제', () => {
  const b = body('onPlayerDead() {');
  assert.match(b, /this\.finishContest\("failed", true\)/);
  assert.match(b, /const safeZone = [^;]*inContest/);
});

test('네트워크 실패는 재전송하고, 성공하면 결과를 돌려준다', async () => {
  let n = 0;
  const r = await submitWithRetry(async () => { if (++n < 3) throw err(); return 'ok'; }, [0, 1, 1, 1], noSleep);
  assert.equal(r, 'ok');
  assert.equal(n, 3);
});

test('서버 거절(4xx)은 재전송하지 않는다', async () => {
  let n = 0;
  await assert.rejects(submitWithRetry(async () => { n++; throw err(400); }, [0, 1, 1], noSleep));
  assert.equal(n, 1);
});

test('끊긴 요청이 접수된 뒤의 409 는 실패가 아니다', async () => {
  let n = 0;
  const r = await submitWithRetry(async () => { throw err(++n === 1 ? 0 : 409); }, [0, 1, 1], noSleep);
  assert.equal(r, null);
  // 첫 요청부터 409 면 진짜 거절이다.
  await assert.rejects(submitWithRetry(async () => { throw err(409); }, [0, 1], noSleep));
});

test('재전송이 모두 실패하면 마지막 오류를 던진다', async () => {
  let n = 0;
  await assert.rejects(submitWithRetry(async () => { n++; throw err(503); }, [0, 1, 1], noSleep));
  assert.equal(n, 3);
});

test('클라이언트는 응답 확인 뒤에만 출전 상태를 풀고 실패를 알린다', () => {
  const f = client.slice(client.indexOf('export async function finishBossContest'));
  assert.match(f, /submitWithRetry\(/);
  assert.match(f, /finally \{[\s\S]*active = null/);
  assert.match(f, /notice\(/);
});

test('기록전은 독립 판: 파티 공유·컷신 없음, 레벨 무관 배율, 전용 보상 문구', () => {
  const b = body('private spawnGmBoss(');
  assert.match(b, /if \(!contest\) this\.setupBossShare\(\)/);
  assert.match(b, /if \(!contest\) this\.bossIntroCinematic\(/);
  assert.deepEqual(stageScale('contest', 1), stageScale('contest', 300), '보스 스탯이 참가자 레벨에 따라 달라지면 안 된다');
  const dead = body('onBossDead() {');
  const c = dead.indexOf('this.stageDef.key === "contest"');
  assert.ok(c > -1 && c < dead.indexOf('weeklyRaidBoss()'), '기록전 분기가 레이드/일일 집계보다 먼저');
  assert.ok(c < dead.indexOf('if (this.replayBossActive)'), 'GM 체험 보상 경로에 닿지 않는다');
});

test('contest:start 리스너를 씬 종료 때 해제한다', () => {
  assert.match(scene, /unlisten\("contest:start", this\.onContestStart/);
});
