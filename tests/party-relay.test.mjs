import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return next(new URL('src/' + specifier.slice(2) + '.ts', root).href, context);
  if (specifier === 'next/server') return next('next/server.js', context);
  return next(specifier, context);
} });

// The real route and GitHub DB implementation run against disposable memory only.
const files = new Map();
const previousFetch = globalThis.fetch;
const previousToken = process.env.GITHUB_TOKEN;
process.env.GITHUB_TOKEN = 'fixture-only-token';
let failure = 0, puts = 0, conflicts = 0;
globalThis.fetch = async (url, options = {}) => {
  assert.equal(new URL(url).hostname, 'api.github.com', 'no external requests');
  if (failure) return Response.json({}, { status: failure });
  const path = new URL(url).pathname.split('/contents/')[1];
  if (options.method === 'PUT') {
    if (conflicts-- > 0) return Response.json({}, { status: 409 });
    const body = JSON.parse(options.body);
    files.set(path, JSON.parse(Buffer.from(body.content, 'base64').toString()));
    return Response.json({ content: { sha: `fixture-${++puts}` } });
  }
  return Response.json({ sha: `fixture-${puts}`, content: Buffer.from(JSON.stringify(files.get(path) || { parties: {} })).toString('base64') });
};
const { NextRequest } = await import('next/server.js');
const route = await import('../src/app/api/party/route.ts');
const { PARTY_PATH, PARTY_STALE_MS } = await import('../src/lib/relaydb.ts');
let requestNumber = 0;
const post = async body => {
  const response = await route.POST(new NextRequest('http://localhost/api/party', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `192.0.2.${++requestNumber}` }, body: JSON.stringify(body) }));
  return { status: response.status, ...await response.json() };
};
const get = async code => {
  const response = await route.GET(new NextRequest(`http://localhost/api/party?code=${code}`));
  return { status: response.status, ...await response.json() };
};
const host = { cid: 'fixture_host', name: '검증주인', lv: 1, cls: 'warrior' };
const member = { cid: 'fixture_member', name: '검증손님', lv: 2, cls: 'mage' };

test('guest party lifecycle: create, invite join, state, seat authorization, leader transfer and cleanup', async () => {
  const created = await post({ action: 'create', ...host });
  assert.equal(created.status, 200);
  assert.equal(created.party.members.length, 1, 'creation immediately returns the committed snapshot');
  assert.match(created.seat, /^[A-Za-z0-9_-]{32}$/);
  assert.ok(!JSON.stringify(created.party).includes(host.cid));
  const joined = await post({ action: 'join', ...member, code: created.code });
  assert.equal(joined.status, 200);
  assert.equal(joined.party.members.length, 2);
  assert.ok(!JSON.stringify(joined.party).includes(joined.seat));
  assert.equal((await post({ action: 'beat', ...host, code: created.code, seat: 'wrong' })).status, 403);
  assert.equal((await post({ action: 'leave', ...host, code: created.code, seat: joined.seat })).status, 403);
  const beat = await post({ action: 'beat', ...host, code: created.code, seat: created.seat, lv: 12, cls: 'guardian' });
  assert.equal(beat.party.members[0].cls, 'guardian');
  assert.equal(beat.party.members[0].lv, 12);
  const moved = await post({ action: 'create', ...host });
  assert.equal(moved.status, 200);
  const remaining = (await get(created.code)).party;
  assert.equal(remaining.leader, member.name, 'changing parties transfers leadership');
  assert.equal(remaining.members[0].leader, true);
  assert.equal((await post({ action: 'leave', ...host, code: created.code, seat: created.seat })).status, 200);
  assert.equal((await get(moved.code)).party.members.length, 1, 'old delayed leave cannot remove the new seat');
  await post({ action: 'leave', ...host, code: moved.code, seat: moved.seat });
  await post({ action: 'leave', ...member, code: created.code, seat: joined.seat });
  assert.equal((await get(created.code)).party, null);
  assert.equal((await get(moved.code)).party, null);
  assert.deepEqual(files.get(PARTY_PATH), { parties: {} });
});

test('join transfers leadership; full/invalid rooms preserve the current seat; leave elects oldest member', async () => {
  const a = await post({ action: 'create', ...host });
  const b = await post({ action: 'join', ...member, code: a.code });
  const destination = await post({ action: 'create', cid: 'fixture_other', name: '다른방' });
  const moved = await post({ action: 'join', ...host, code: destination.code });
  assert.equal((await get(a.code)).party.leader, member.name);
  for (let i = 0; i < 2; i++) await post({ action: 'join', cid: `fixture_extra${i}`, name: `손님${i}`, code: destination.code });
  assert.equal((await post({ action: 'join', ...member, code: destination.code })).status, 409);
  assert.equal((await post({ action: 'join', ...member, code: 'NOPE' })).status, 404);
  assert.equal((await get(a.code)).party.members[0].name, member.name);
  await post({ action: 'leave', cid: 'fixture_other', code: destination.code, seat: destination.seat });
  assert.equal((await get(destination.code)).party.leader, host.name);
  await post({ action: 'leave', ...host, code: destination.code, seat: moved.seat });
  await post({ action: 'leave', ...member, code: a.code, seat: b.seat });
});

test('fresh optimistic-lock retry and stale-party pruning commit correctly', async () => {
  files.get(PARTY_PATH).parties.STAL = { code: 'STAL', leader: 'old', createdAt: 1, members: { old: { name: '오래됨', seenAt: Date.now() - PARTY_STALE_MS - 1, joinedAt: 1 } } };
  conflicts = 1;
  const result = await post({ action: 'create', cid: 'fixture_retry', name: '재시도' });
  assert.equal(result.status, 200);
  assert.equal((await get('STAL')).party, null);
  assert.equal((await get(result.code)).party.members[0].name, '재시도');
});

test('storage credentials/read failures are service errors instead of successful empty parties', async () => {
  delete process.env.GITHUB_TOKEN;
  assert.equal((await post({ action: 'create', ...host })).status, 503);
  process.env.GITHUB_TOKEN = 'fixture-only-token';
  failure = 401;
  assert.equal((await post({ action: 'create', ...host })).status, 503);
  failure = 0;
});

test.after(() => {
  globalThis.fetch = previousFetch;
  if (previousToken === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = previousToken;
});
