import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import storage from '../accounts/storage.json' with { type: 'json' };

const prefix = `db-backup/${storage.generation}/`;
let serial = 0;
function encrypt(data, secret) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
  return Buffer.concat([Buffer.from('SZBK1'), iv, cipher.getAuthTag(), body]).toString('base64');
}
function decrypt(enc, secret) {
  const raw = Buffer.from(enc, 'base64');
  const cipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), raw.subarray(5, 17));
  cipher.setAuthTag(raw.subarray(17, 33));
  return JSON.parse(Buffer.concat([cipher.update(raw.subarray(33)), cipher.final()]).toString());
}
const empty = () => ({ users: {}, tokens: {}, saves: {}, market: { nextId: 1, listings: {} }, payouts: {}, rank: {}, charNames: {}, iapUsed: {} });

async function fixture(run, { failure = 0, missingKey = false, wrongKey = false } = {}) {
  const previous = { fetch: globalThis.fetch, token: process.env.GITHUB_TOKEN, key: process.env.SERTZ_BACKUP_KEY, node: process.env.NODE_ENV };
  const secret = randomBytes(32).toString('hex');
  const files = new Map([
    [prefix + 'accounts.enc', encrypt(empty(), secret)],
    [prefix + 'relay-chat.json', JSON.stringify({ global: [], party: {} })],
    [prefix + 'relay-parties.json', JSON.stringify({ parties: {} })],
    ['db-backup/accounts.enc', 'unreadable-legacy-archive'],
  ]);
  const requests = [];
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.NODE_ENV = 'production';
  if (missingKey) delete process.env.SERTZ_BACKUP_KEY;
  else process.env.SERTZ_BACKUP_KEY = wrongKey ? 'incorrect-key' : secret;
  globalThis.fetch = async (url, opts = {}) => {
    const path = new URL(url).pathname.split('/contents/')[1];
    const method = opts.method ?? 'GET';
    requests.push({ path, method });
    if (failure) return Response.json({}, { status: failure });
    if (method === 'PUT') {
      const body = JSON.parse(opts.body);
      assert.ok(path.startsWith(prefix), 'writes cannot touch the archived generation');
      files.set(path, Buffer.from(body.content, 'base64').toString());
      return Response.json({ content: { sha: 'saved-sha' } });
    }
    if (!files.has(path)) return Response.json({}, { status: 404 });
    return Response.json({ sha: 'fixture-sha', content: Buffer.from(files.get(path)).toString('base64') });
  };
  try {
    const db = await import(`../src/lib/ghdb.ts?fixture=${serial++}`);
    const relay = await import(`../src/lib/relaydb.ts?fixture=${serial++}`);
    await run({ db, relay, requests, files, secret });
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [name, value] of [['GITHUB_TOKEN', previous.token], ['SERTZ_BACKUP_KEY', previous.key], ['NODE_ENV', previous.node]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
}

test('new account, cloud save, market and relay writes share one generation and leave the old ciphertext intact', async () => {
  await fixture(async ({ db, relay, requests, files, secret }) => {
    assert.equal(storage.generation, 'lilac-v1');
    assert.deepEqual((await db.loadDb()).db.users, {});
    const response = await db.mutateDb(data => {
      data.users.player = { id: 'player', name: '플레이어', provider: 'local', salt: 'fixture', hash: 'fixture', createdAt: 1 };
      data.saves.player = { data: { lv: 1, gold: 100 }, updatedAt: 1 };
      return { resp: { status: 200, body: { ok: true } } };
    });
    assert.equal(response.status, 200);
    const saved = decrypt(files.get(prefix + 'accounts.enc'), secret);
    assert.equal(saved.saves.player.data.gold, 100);
    assert.deepEqual(saved.market.listings, {});
    assert.equal(relay.CHAT_PATH, prefix + 'relay-chat.json');
    assert.equal(relay.PARTY_PATH, prefix + 'relay-parties.json');
    assert.deepEqual((await relay.loadRelay(relay.CHAT_PATH)).data.global, []);
    await relay.mutateRelay(relay.PARTY_PATH, data => { data.parties.fixture = { members: {} }; return null; });
    assert.ok(JSON.parse(files.get(relay.PARTY_PATH)).parties.fixture);
    assert.equal(files.get('db-backup/accounts.enc'), 'unreadable-legacy-archive');
    assert.ok(requests.every(r => r.path.startsWith(prefix)), 'never fall back to the old game');
  });
});

test('production refuses a missing encryption key before reading or writing any data', async () => {
  await fixture(async ({ db, requests }) => {
    await assert.rejects(db.loadDb(), /SERTZ_BACKUP_KEY/);
    assert.equal(requests.length, 0);
  }, { missingKey: true });
});

test('wrong key, missing DB and denied access cannot become an empty database or trigger a legacy import', async () => {
  for (const options of [{ wrongKey: true }, { failure: 404 }, { failure: 403 }, { failure: 500 }]) {
    await fixture(async ({ db, requests }) => {
      await assert.rejects(db.loadDb());
      assert.ok(requests.every(r => r.method === 'GET' && r.path.startsWith(prefix)));
    }, options);
  }
});

test('relay rejects missing credentials and missing files instead of presenting a successful empty channel', async () => {
  await fixture(async ({ relay, requests }) => {
    delete process.env.GITHUB_TOKEN;
    await assert.rejects(relay.loadRelay(relay.CHAT_PATH), e => e instanceof relay.RelayAccessError && e.status === 503);
    assert.equal(requests.length, 0);
  });
  await fixture(async ({ relay }) => {
    await assert.rejects(relay.loadRelay(relay.PARTY_PATH), e => e instanceof relay.RelayAccessError && e.status === 404);
  }, { failure: 404 });
});
