import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(new URL('../server.js', import.meta.url));
/* vc278 — `.pathname` 은 Windows 에서 `/C:/coding/...` 이라 아래 __dirname 으로 넘기면
 *  server.js 의 _readVer 가 `\C:\coding\...` 를 열려다 실패하고, 버전 폴백 상수 240 이
 *  그대로 나온다(테스트가 '코드 회귀'로 오독하게 만든다). fileURLToPath 가 정본. */
const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const android = JSON.parse(readFileSync('android-version.json', 'utf8'));
const release = `https://github.com/apple01234/CERTZ/releases/download/v${android.name}`;
const mirrors = [`${release}/SERTZ-vc${android.code}.apk`, `${release}/SERTZ-vc${android.code}-setup.exe`];

async function routeResponse(env, files = readFileSync) {
  const source = readFileSync('src/app/api/version/route.ts', 'utf8');
  const code = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext })
    .replace(/^import .*;\s*$/gm, '')
    .replace(/^export /gm, '');
  const get = new Function('NextResponse', 'pkg', 'readFileSync', 'process', `${code}\nreturn GET;`)(
    { json: body => body }, pkg, files, { env },
  );
  return get();
}

function customResponse(env) {
  const source = readFileSync('server.js', 'utf8');
  const start = source.indexOf('    let _pkgVer =');
  const end = source.indexOf('  /* v4.0.0', start);
  assert.ok(start > 0 && end > start);
  let body;
  const response = { writeHead() {}, end(value) { body = JSON.parse(value); } };
  new Function('require', '__dirname', 'res', 'process', 'APK_MIRROR', 'EXE_MIRROR',
    `const url = '/api/version';\n${source.slice(start, end)}`)(require, root, response, { env }, ...mirrors);
  return body;
}

test('actual version handlers agree on SHA priority, explicit build SHA, and honest unknown', async () => {
  const vercel = 'a'.repeat(40), explicit = 'b'.repeat(40);
  for (const [env, expected] of [
    [{ VERCEL_GIT_COMMIT_SHA: vercel, CERTZ_BUILD_SHA: explicit }, vercel],
    [{ CERTZ_BUILD_SHA: ` ${explicit} ` }, explicit],
    [{ VERCEL_GIT_COMMIT_SHA: ' ', CERTZ_BUILD_SHA: explicit }, explicit],
    [{}, null],
  ]) {
    const route = await routeResponse(env), custom = customResponse(env);
    assert.equal(route.commitSha, expected); assert.deepEqual(route, custom);
    assert.equal(route.latest, pkg.version); assert.equal(route.code, android.code);
    assert.equal(route.apk, mirrors[0]); assert.equal(route.exe, mirrors[1]);
    assert.ok(route.note.startsWith(`v${pkg.version} (vc${android.code})`));
    assert.doesNotMatch(route.note, /vc251|vc243/);
  }
});

test('Vercel route without android directory still derives release metadata and build SHA', async () => {
  const readWithoutAndroid = path => {
    if (String(path).startsWith('android/')) throw Error('android excluded from deployment');
    return readFileSync(path, 'utf8');
  };
  const response = await routeResponse({ VERCEL_GIT_COMMIT_SHA: 'c'.repeat(40) }, readWithoutAndroid);
  assert.equal(response.code, android.code); assert.equal(response.latest, android.name);
  assert.equal(response.apk, mirrors[0]); assert.equal(response.commitSha, 'c'.repeat(40));
});

test('release metadata and Android build provenance stay synchronized without new credentials', () => {
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  assert.equal(lock.version, pkg.version); assert.equal(lock.packages[''].version, pkg.version);
  const workflow = readFileSync('.github/workflows/android-build.yml', 'utf8');
  assert.match(workflow, /CERTZ_BUILD_SHA:\s*\$\{\{ github\.sha \}\}/);
  for (const name of ['SERTZ_KEYSTORE_BASE64', 'SERTZ_KEYSTORE_PASSWORD', 'SERTZ_KEY_PASSWORD', 'SERTZ_KEY_ALIAS']) {
    assert.ok(workflow.includes(`secrets.${name}`));
  }
  assert.ok(workflow.includes('upload "SERTZ-vc${CODE}.apk"'));
});
