import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/lib/saveVersionPolicy.ts';
import * as access from '../src/lib/saveAccess.ts';
import { saveFingerprint } from '../src/lib/saveCodec.ts';

function route(record) {
  const db = { users: { current: { id: 'current' } }, saves: record ? { current: record } : {} };
  const source = readFileSync('src/app/api/auth/cloud-save/route.ts', 'utf8');
  const script = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const require = name => {
    if (name === '@/lib/ghdb') return {
      loadDb: async () => ({ db }),
      mutateDb: async fn => { const result = fn(db); return result.resp ?? result; },
    };
    if (name === '@/lib/sapi') return {
      currentUser: () => db.users.current, rateLimit: () => true, options: () => ({}),
      json: (_req, status, body) => ({ status, body }),
      escrowedCounts: () => ({}), deductEscrow: () => 0,
    };
    if (name === '@/lib/saveAccess') return access;
    if (name === '@/lib/saveCodec') return { saveFingerprint };
    if (name === '@/lib/saveVersionPolicy') return policy;
    throw Error('Unexpected route dependency: ' + name);
  };
  vm.runInNewContext(`(function(require,module,exports){${script}\n})`, { console })(require, module, module.exports);
  const req = (payload, version) => ({
    nextUrl: new URL('https://sertz.test/api/auth/cloud-save' + (version === undefined ? '' : '?saveVersion=' + version)),
    json: async () => payload,
  });
  return { db, get: version => module.exports.GET(req(null, version)), post: payload => module.exports.POST(req(payload)) };
}

test('legacy GET cannot read a newer active or inactive character, even in compressed records', async () => {
  for (const data of [{ v: 2, skillMastery: { solar: 491 } }, { v: 1 }]) {
    const record = access.packSaveRec(data, { chars: { inactive: { v: 2, skillMastery: { life: 491 } } }, updatedAt: 42 });
    const api = route(record), before = JSON.stringify(api.db);
    const legacy = await api.get();
    assert.equal(legacy.status, 409); assert.equal(legacy.body.code, 'SAVE_VERSION_UNSUPPORTED');
    assert.equal(legacy.body.minimumSaveVersion, 2); assert.equal(legacy.body.data, undefined);
    assert.equal((await api.get(2)).status, 200);
    assert.equal(JSON.stringify(api.db), before);
  }
});

test('old POST and per-character downgrade reject before mutating saved currency or characters', async () => {
  const record = access.packSaveRec({ v: 2, gold: 120, emerald: 4 }, {
    chars: { trained: { v: 2, skillMastery: { solar: 491 } } }, updatedAt: 42,
  });
  const api = route(record), before = JSON.stringify(api.db);
  for (const payload of [
    { data: { gold: 999999 } },
    { data: { v: 1, gold: 999999 }, chars: {} },
    { data: { v: 2, gold: 999999 }, chars: { trained: { v: 1 } } },
  ]) {
    const response = await api.post(payload);
    assert.equal(response.status, 409); assert.equal(response.body.minimumSaveVersion, 2);
    assert.equal(JSON.stringify(api.db), before);
  }
});

test('v2 upload preserves decoded omitted characters and server-owned currency without double packing', async () => {
  const chars = { trained: { v: 2, skillMastery: { solar: 491 }, owned: Array(100).fill('weapon_1') } };
  const api = route(access.packSaveRec({ v: 2, gold: 120, emerald: 4 }, { chars, updatedAt: 42 }));
  const response = await api.post({ data: { v: 2, gold: 999999, emerald: 999999, skillMastery: { life: 13 } } });
  assert.equal(response.status, 200);
  const saved = access.unpackSaveRec(api.db.saves.current);
  assert.equal(saved.data.gold, 120); assert.equal(saved.data.emerald, 4);
  assert.deepEqual(saved.data.skillMastery, { life: 13 });
  assert.deepEqual(saved.chars, chars);
  const restored = await api.get(2);
  assert.equal(restored.status, 200); assert.deepEqual(restored.body.chars, chars);
});

test('legacy accounts still read/write v1 until upgraded, while unknown future uploads cannot overwrite', async () => {
  const fresh = route();
  assert.equal((await fresh.post({ data: { stage: 'village', gold: 3 } })).status, 200);
  assert.equal((await fresh.get()).status, 200);
  const before = JSON.stringify(fresh.db);
  const future = await fresh.post({ data: { v: 3, gold: 999 } });
  assert.equal(future.status, 409); assert.equal(future.body.minimumSaveVersion, 3);
  assert.equal(JSON.stringify(fresh.db), before);
  const newer = route(access.packSaveRec({ v: 3 }, { updatedAt: 1 }));
  assert.equal((await newer.get(2)).status, 409);
  assert.equal((await newer.post({ data: { v: 2 } })).status, 409);
});

test('a malformed existing backup is reported as unavailable and never replaced with a fresh save', async () => {
  for (const record of [{ data: 'BR:not-a-backup' }, { data: { v: 2 }, chars: 'BR:broken' }]) {
    const api = route(record), before = JSON.stringify(api.db);
    assert.equal((await api.get(2)).status, 503);
    assert.equal((await api.post({ data: { v: 2 } })).status, 503);
    assert.equal(JSON.stringify(api.db), before);
  }
});

test('Node middleware delegates cloud GET/POST to the protected Next route', () => {
  const source = readFileSync('accounts/index.js', 'utf8');
  const start = source.indexOf('function attachAccountsBefore(');
  const end = source.indexOf('\n/* vc205 — 이중 구현 제거.', start);
  const factory = new Function('corsHeadersFor', `${source.slice(start, end)}; return attachAccountsBefore;`)(() => ({}));
  for (const method of ['GET', 'POST']) {
    let delegated = 0;
    const req = { url: '/api/auth/cloud-save?saveVersion=2', method };
    const res = {};
    factory((actualReq, actualRes) => { assert.equal(actualReq, req); assert.equal(actualRes, res); delegated++; })(req, res);
    assert.equal(delegated, 1);
  }
});

test('client download declares capability and ignored upload failures still display the update notice', async () => {
  const source = readFileSync('src/game/account.ts', 'utf8');
  const tree = ts.createSourceFile('account.ts', source, ts.ScriptTarget.Latest, true);
  const names = new Set(['post', 'get', 'cloudFailure', 'cloudSaveUpload', 'cloudSaveDownload']);
  const methods = tree.statements.filter(n => ts.isFunctionDeclaration(n) && names.has(n.name?.text)).map(n => n.getText(tree)).join('\n');
  const urls = [], notices = [];
  const functions = new Function('Capacitor', 'navigator', 'getToken', 'setToken', 'apiBase', 'fetch', 'reportSaveFailure', 'saveSchema', ts.transpile(
    methods.replace(/export /g, '') + '\nreturn {cloudSaveUpload,cloudSaveDownload};', { target: ts.ScriptTarget.ES2022 },
  ))({ isNativePlatform: () => true }, { userAgent: 'APK QA' }, () => 'fixtureSession123456', () => {}, () => 'https://sertz.test',
    async url => { urls.push(url); return { ok: false, status: 409, json: async () => ({ code: 'SAVE_VERSION_UNSUPPORTED', minimumSaveVersion: 2, error: '업데이트 필요' }) }; },
    text => notices.push(text), { version: 2 });
  const download = await functions.cloudSaveDownload();
  assert.equal(new URL(urls[0]).searchParams.get('saveVersion'), '2');
  assert.equal(new URL(urls[0]).searchParams.get('token'), 'fixtureSession123456');
  assert.equal(download.code, 'SAVE_VERSION_UNSUPPORTED');
  assert.equal(download.minimumSaveVersion, 2); assert.equal(download.data, null);
  const upload = await functions.cloudSaveUpload({ v: 2 });
  assert.equal(upload.code, 'SAVE_VERSION_UNSUPPORTED'); assert.equal(upload.error, '업데이트 필요');
  assert.deepEqual(notices, ['업데이트 필요', '업데이트 필요']);
  const panel = readFileSync('src/components/game/AuthPanel.tsx', 'utf8');
  assert.doesNotMatch(panel, /cloudSaveUpload\(JSON\.parse/);
});
