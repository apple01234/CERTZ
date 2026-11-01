// node tests/settings-render-regression.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const store = new Map([['sertz_fx', JSON.stringify({ intensity: 55 })]]);
const window = { localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } };
function loadModule(file, deps = {}) {
  const source = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, window, require: (id) => {
    if (!(id in deps)) throw new Error(`Unexpected dependency ${id}`);
    return deps[id];
  } });
  return module.exports;
}
let failures = 0, passes = 0;
function test(name, fn) {
  try { fn(); passes++; console.log(`PASS ${name}`); }
  catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
}
const toon = loadModule('src/game/fx/ToonFX.ts', { '../config': { loadFx: () => JSON.parse(store.get('sertz_fx')) } });
function camera() {
  const calls = [];
  const bloom = { kind: 'bloom' };
  const list = [bloom];
  return { calls, bloom, filters: { external: {
    list,
    addBlocky(config) { calls.push(['blocky', config]); const f = { kind: 'blocky' }; list.push(f); return f; },
    addColorMatrix() {
      const f = { kind: 'matrix', colorMatrix: {} };
      for (const op of ['contrast', 'saturate', 'brightness']) f.colorMatrix[op] = (value, multiply) => calls.push([op, value, multiply]);
      list.push(f); return f;
    },
    remove(f) { const at = list.indexOf(f); if (at >= 0) list.splice(at, 1); },
  } } };
}
test('toon grades color without spatial pixelation', () => {
  const cam = camera(); toon.applyToonCamera(cam);
  assert.equal(cam.calls.some(([op]) => op === 'blocky'), false, 'Blocky downsamples the image rather than quantizing colors');
});
test('toon composes saturation and brightness with contrast', () => {
  const cam = camera(); toon.applyToonCamera(cam);
  for (const op of ['saturate', 'brightness']) assert.equal(cam.calls.find(([name]) => name === op)?.[2], true, `${op} must not reset the preceding matrix`);
});
test('toon removal leaves the active bloom intact for 20 toggles', () => {
  const cam = camera();
  assert.equal(typeof toon.clearToonCamera, 'function');
  for (let i = 0; i < 20; i++) {
    const own = toon.applyToonCamera(cam);
    toon.clearToonCamera(cam, own);
    assert.equal(cam.filters.external.list.length, 1);
    assert.equal(cam.filters.external.list[0], cam.bloom);
  }
});
test('intensity zero creates no camera filter', () => {
  store.set('sertz_fx', JSON.stringify({ intensity: 0 }));
  const cam = camera(); assert.equal(toon.applyToonCamera(cam), null);
  assert.equal(cam.filters.external.list.length, 1);
  store.set('sertz_fx', JSON.stringify({ intensity: 55 }));
});
const scene = read('src/game/scenes/WorldScene.ts');
const ast = ts.createSourceFile('WorldScene.ts', scene, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let shakeHandler;
function visit(n) {
  if (ts.isVariableDeclaration(n) && n.name.getText(ast) === 'onFxShake') shakeHandler = n.initializer?.getText(ast);
  ts.forEachChild(n, visit);
}
visit(ast);
test('panel shake event has an on/off listener pair', () => {
  assert.ok(/EventBus\.on\("fx:shake", onFxShake\)/.test(scene), 'fx:shake listener missing');
  assert.ok(/EventBus\.off\("fx:shake", onFxShake\)/.test(scene), 'fx:shake cleanup missing');
});
test('real scene handler saves the selected value and cancels an active shake', () => {
  assert.ok(shakeHandler, 'onFxShake handler is missing');
  const shake = loadModule('src/game/fx/shakeScale.ts');
  let cancelled = 0, resets = 0;
  const self = { cameras: { main: { shakeEffect: { reset() { cancelled++; } } } }, ultShake: { reset() { resets++; } } };
  const code = ts.transpileModule(`const handler = ${shakeHandler}; handler('off'); handler('strong');`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { setShakeScale: shake.setShakeScale, ...self }, { filename: 'shake-handler.js' });
  assert.equal(shake.getShakeScale(), 'strong');
  assert.equal(cancelled, 1); assert.equal(resets, 1);
});
console.log(`\n${passes} PASS / ${failures} FAIL`);
process.exitCode = failures ? 1 : 0;