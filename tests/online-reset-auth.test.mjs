import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const nativeRequire = createRequire(import.meta.url);
function route(file, data, token = '') {
  const source = readFileSync(new URL('../src/app/api/auth/' + file + '/route.ts', import.meta.url), 'utf8');
  const script = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const require = name => {
    if (name === '@/lib/ghdb') return { loadDb: async () => ({ db: data }), mutateDb: async fn => fn(data) };
    if (name === '@/lib/sapi') return {
      json: (_req, status, body) => ({ status, body }), options: () => ({}),
      currentUser: () => data.users.current ?? null, extractToken: () => token,
      publicUser: user => user, rateLimit: () => true,
    };
    return nativeRequire(name);
  };
  vm.runInNewContext(`(function(require,module,exports){${script}\n})`, { process, console })(require, module, module.exports);
  return module.exports;
}

test('an empty new generation does not allow a public signup to become the first administrator', async () => {
  const data = { users: {} };
  const { POST } = route('register', data);
  for (const id of ['admin', 'apple01234']) {
    const result = await POST({ json: async () => ({ id, pw: 'test-fixture-password', name: '검증용' }) });
    assert.equal(result.status, 403);
    assert.equal(Object.keys(data.users).length, 0);
  }
});

test('a legacy token gets401 to clear old APK caches while guests and valid sessions retain200', async () => {
  const data = { users: {} };
  assert.equal((await route('me', data, 'old-token').GET({})).status, 401);
  const guest = await route('me', data).GET({});
  assert.equal(guest.status, 200);
  assert.equal(guest.body.user, null);
  data.users.current = { id: 'new-player', role: 'user' };
  const current = await route('me', data, 'new-token').GET({});
  assert.equal(current.status, 200);
  assert.equal(current.body.user.id, 'new-player');
});
