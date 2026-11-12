/**
 * vc282 — 기록전 클라이언트 흐름을 서버 계약으로 실행 검증.
 *
 * 브라우저(Phaser) 없이 확인할 수 있는 부분을 실제로 "돌려" 본다:
 *   prepare → 경기장 진입 → 카운트다운 → start → (보스 처치) → finish(defeated)
 * 이 순서가 서버 스토어에서 승인 대기(pending)까지 실제로 도달하는지 본다.
 *
 * 이 검사가 잠그는 회귀: vc282 이전에는 start 를 부르지 않아 finish 가
 * "이미 제출했거나 시작하지 않은 출전이에요" 로 거부됐다. 즉 기록전이
 * 화면상으로는 동작하는데 제출만 조용히 실패했다.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { contestAction, contestSnapshot, CONTEST_RULES } from '../src/lib/bossContestStore.ts';

const gm = { id: 'gm', name: '선생님', admin: true };
const me = { id: 'u1', name: '나', admin: false };
function contest(minutes = 30) {
  const store = { contests: {} };
  contestAction(store, gm, { action: 'create', title: '기록전', prize: '간식', places: 3, minutes }, 1000, 'c1');
  return store;
}

test('카운트다운 경로: prepare → start → 처치 제출이 pending 까지 도달한다', () => {
  const s = contest();
  const t0 = 2000;
  // 1) React 출전 준비 (attemptId 발급, 30초 ready 창)
  const a = contestAction(s, me, { action: 'prepare', contestId: 'c1' }, t0, 'a1').attempt;
  assert.equal(a.state, 'ready');

  // 2) 경기장 도착 후 카운트다운(3초) → 서버 start
  const startedAt = t0 + 3400;
  const run = contestAction(s, me, { action: 'start', contestId: 'c1', attemptId: a.id }, startedAt, '').attempt;
  assert.equal(run.state, 'running');
  assert.equal(run.expiresAt, startedAt + CONTEST_RULES.limitMs);

  // 3) 실제 보스 처치 → 근거 제출 (전투는 42초 걸렸다고 가정)
  const combatMs = 42000;
  const finAt = startedAt + combatMs;
  const done = contestAction(s, me, {
    action: 'finish', contestId: 'c1', attemptId: a.id, outcome: 'defeated',
    evidence: { bossHp: 0, damage: CONTEST_RULES.bossHp, hits: 137, combatMs },
  }, finAt, '').attempt;

  // 승인 대기로만 저장된다(자동 승인 아님)
  assert.equal(done.state, 'pending');
  assert.equal(done.elapsedMs, combatMs);
  assert.equal(contestSnapshot(s, me, finAt).contests[0].official.length, 0,
    'GM 승인 전에는 공식 기록이 없다');
});

test('start 를 건너뛰면 제출이 거부된다(종전 버그의 재현)', () => {
  const s = contest();
  contestAction(s, me, { action: 'prepare', contestId: 'c1' }, 2000, 'a1');
  // vc282 이전 클라이언트가 하던 일: start 없이 바로 finish
  assert.throws(() => contestAction(s, me, {
    action: 'finish', contestId: 'c1', attemptId: 'a1', outcome: 'defeated',
    evidence: { bossHp: 0, damage: CONTEST_RULES.bossHp, hits: 10, combatMs: 30000 },
  }, 33000, ''), /시작하지 않은|이미 제출/);
});

test('중도 이탈이 running 을 남기지 않는다(순위 확정 차단 방지)', () => {
  const s = contest();
  const a = contestAction(s, me, { action: 'prepare', contestId: 'c1' }, 2000, 'a1').attempt;
  contestAction(s, me, { action: 'start', contestId: 'c1', attemptId: a.id }, 3000, '');
  // 경기장 이탈 → abandoned 보고
  contestAction(s, me, { action: 'finish', contestId: 'c1', attemptId: a.id, outcome: 'abandoned' }, 9000, '');
  const c = contestSnapshot(s, gm, 9000).contests[0];
  assert.equal(c.attempts[0].state, 'abandoned');
  // abandoned 는 순위에서 제외되고, 확정을 막지 않는다
  contestAction(s, gm, { action: 'finalize', contestId: 'c1' }, 9500, '');
  assert.equal(contestSnapshot(s, gm, 9600).contests[0].official.length, 0);
});

test('제한시간을 넘긴 제출은 거부된다(서버 시간 권위)', () => {
  const s = contest();
  const a = contestAction(s, me, { action: 'prepare', contestId: 'c1' }, 2000, 'a1').attempt;
  contestAction(s, me, { action: 'start', contestId: 'c1', attemptId: a.id }, 3000, '');
  const late = 3000 + CONTEST_RULES.limitMs + 1;
  assert.throws(() => contestAction(s, me, {
    action: 'finish', contestId: 'c1', attemptId: a.id, outcome: 'defeated',
    evidence: { bossHp: 0, damage: CONTEST_RULES.bossHp, hits: 10, combatMs: CONTEST_RULES.limitMs },
  }, late, ''), /시간/);
});

test('준비만 하고 경기장에 들어가지 않아도 30초 뒤 만료된다', () => {
  const s = contest();
  const a = contestAction(s, me, { action: 'prepare', contestId: 'c1' }, 2000, 'a1').attempt;
  // readyUntil(+30s) 이후에는 start 가 거부된다 — 클라이언트가 늦게 시작할 수 없다.
  assert.throws(() => contestAction(s, me, { action: 'start', contestId: 'c1', attemptId: a.id },
    a.readyUntil + 1, ''), /준비 시간/);
});
