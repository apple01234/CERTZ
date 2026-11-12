import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contestAction, contestSnapshot, CONTEST_RULES } from '../src/lib/bossContestStore.ts';
const gm = { id: 'gm', name: '선생님', admin: true };
const player = (id = 'u1') => ({ id, name: id, admin: false });
function setup() {
  const store = { contests: {} };
  contestAction(store, gm, { action: 'create', title: '간식전', prize: '과자', places: 1, minutes: 10 }, 1000, 'c1');
  return store;
}
function join(store, id = 'u1', at = 2000) {
  const a = contestAction(store, player(id), { action: 'prepare', contestId: 'c1' }, at, `a-${id}`).attempt;
  contestAction(store, player(id), { action: 'start', contestId: 'c1', attemptId: a.id }, at + 1000, 'unused');
  return a;
}
function finish(store, id = 'u1', at = 8000) {
  return contestAction(store, player(id), { action: 'finish', contestId: 'c1', attemptId: `a-${id}`, outcome: 'defeated', evidence: { bossHp: 0, damage: CONTEST_RULES.bossHp, hits: 5, combatMs: at - 3000 } }, at, 'unused');
}
test('서버 단발시도→검토→공식순위→순위확정→실물지급 기록', () => {
  const s = setup(); join(s); finish(s);
  assert.equal(contestSnapshot(s, player(), 9000).contests[0].official.length, 0);
  contestAction(s, gm, { action: 'review', contestId: 'c1', attemptId: 'a-u1', decision: 'approved', note: '현장 확인' }, 9000, '');
  let c = contestSnapshot(s, gm, 9000).contests[0];
  assert.equal(c.official[0].rank, 1); assert.equal(c.official[0].elapsedMs, 5000);
  assert.throws(() => contestAction(s, gm, { action: 'award', contestId: 'c1', attemptId: 'a-u1', note: '전달' }, 9100, ''), /확정/);
  contestAction(s, gm, { action: 'finalize', contestId: 'c1' }, 10000, '');
  contestAction(s, gm, { action: 'award', contestId: 'c1', attemptId: 'a-u1', note: '현장에서 전달' }, 11000, '');
  c = contestSnapshot(s, gm, 12000).contests[0];
  assert.equal(c.official[0].awardedAt, 11000); assert.equal(c.official[0].awardedBy, 'gm');
  assert.throws(() => contestAction(s, gm, { action: 'award', contestId: 'c1', attemptId: 'a-u1', note: '중복' }, 12000, ''), /이미/);
});
test('권한·다른계정·중복·임의점수·음수/초단시간·허위처치 거부', () => {
  const s = setup(); join(s);
  assert.throws(() => contestAction(s, player(), { action: 'create' }, 4000, ''), /관리자/);
  assert.throws(() => contestAction(s, player(), { action: 'prepare', contestId: 'c1' }, 4000, 'a2'), /한 번/);
  assert.throws(() => contestAction(s, player('other'), { action: 'start', contestId: 'c1', attemptId: 'a-u1' }, 4000, ''), /본인/);
  assert.throws(() => contestAction(s, player(), { action: 'finish', contestId: 'c1', attemptId: 'a-u1', outcome: 'defeated', score: 1 }, 4000, ''), /허용/);
  assert.throws(() => finish(s, 'u1', 3100), /시간/);
  const body = { action: 'finish', contestId: 'c1', attemptId: 'a-u1', outcome: 'defeated', evidence: { bossHp: 1, damage: 1, hits: 1, combatMs: 5000 } };
  assert.throws(() => contestAction(s, player(), body, 8000, ''), /처치/);
  body.evidence.bossHp = 0; body.evidence.damage = CONTEST_RULES.bossHp; body.evidence.combatMs = -1;
  assert.throws(() => contestAction(s, player(), body, 8000, ''), /시간/);
  finish(s);
  assert.throws(() => finish(s), /이미/);
  assert.throws(() => contestAction(s, player(), { action: 'review', contestId: 'c1', attemptId: 'a-u1', decision: 'approved', note: '위조' }, 9000, ''), /관리자/);
});
test('동률 공동순위·실패/이탈 제외·검토 미완료시 마감차단', () => {
  const s = setup(); join(s); join(s, 'u2'); finish(s); finish(s, 'u2');
  assert.throws(() => contestAction(s, gm, { action: 'finalize', contestId: 'c1' }, 9000, ''), /검토/);
  for (const id of ['u1', 'u2']) contestAction(s, gm, { action: 'review', contestId: 'c1', attemptId: `a-${id}`, decision: 'approved', note: '확인' }, 9000, '');
  assert.deepEqual(contestSnapshot(s, player(), 9000).contests[0].official.map(a => a.rank), [1, 1]);
  join(s, 'u3'); contestAction(s, player('u3'), { action: 'finish', contestId: 'c1', attemptId: 'a-u3', outcome: 'failed' }, 8000, '');
  join(s, 'u4');
  assert.throws(() => contestAction(s, gm, { action: 'finalize', contestId: 'c1' }, 9000, ''), /진행/);
  const c = contestSnapshot(s, gm, 300000).contests[0];
  assert.equal(c.attempts.find(a => a.id === 'a-u4').state, 'expired');
  assert.equal(c.official.length, 2);
  assert.equal(contestSnapshot(s, player('stranger'), 9000).contests[0].attempts.length, 0);
});

test('public official ranks hide account IDs, full names and reviewer identities', () => {
  const s = setup(); join(s); finish(s);
  contestAction(s, gm, { action: 'review', contestId: 'c1', attemptId: 'a-u1', decision: 'approved', note: 'private review' }, 9000, '');
  const publicView = contestSnapshot(s, player('stranger'), 10000).contests[0];
  assert.equal(publicView.createdBy, ''); assert.equal(publicView.attempts.length, 0);
  assert.equal(publicView.official[0].uid, ''); assert.equal(publicView.official[0].name, 'u***');
  assert.equal(publicView.official[0].reviewedBy, undefined);
  assert.equal(publicView.official[0].reviewNote, undefined);
  assert.equal(contestSnapshot(s, player(), 10000).contests[0].official[0].uid, 'u1');
  assert.equal(contestSnapshot(s, gm, 10000).contests[0].official[0].reviewNote, 'private review');
});
