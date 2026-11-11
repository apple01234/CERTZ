import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { assetUrl, isWorldAsset } from '../src/game/assetSelection.ts';

// Execute the real scheduler against controlled network/cache ports.
const source = readFileSync(new URL('../src/game/stagedAssets.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('stagedAssets.ts', source, ts.ScriptTarget.Latest, true);
const body = ast.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'AssetManager').getText(ast);
const javascript = ts.transpile(body, { target: ts.ScriptTarget.ES2022 });
function harness(keys, deadline = 1000) {
  const updates = [], cache = new Set(), starts = [], releases = new Map(), metadataRequests = [];
  const window = { setTimeout, clearTimeout };
  const { Manager, retry } = new Function('publish', 'window', 'PHASE_LIMIT_MS', 'json', 'let retryAction; ' + javascript + '; return { Manager: AssetManager, retry: () => retryAction?.() };')(p => updates.push(structuredClone(p)), window, deadline, async url => { metadataRequests.push(url); return { frames: {} }; });
  const game = { events: new EventEmitter(), textures: { exists: key => cache.has(key) } };
  const restarts = [];
  const scene = { events: new EventEmitter(), sys: { isActive: () => true }, registry: { get: () => ({ fresh: true }) }, scene: { restart: data => restarts.push(data) } };
  const definitions = keys.map(key => ({ type: 'image', key, urls: [key] }));
  const manager = new Manager(game, definitions, () => {});
  manager.fetch = async def => { starts.push(def.key); await new Promise(resolve => releases.set(def.key, () => { cache.add(def.key); resolve(); })); };
  return { manager, scene, definitions, updates, starts, releases, cache, retry, restarts, metadataRequests };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('paths preserve rooted/external URLs and relative atlas metadata', () => {
  for (const url of ['/assets/a.png', 'https://cdn.test/a.png', '//cdn/a', 'data:image/png,x', 'blob:x', 'capacitor://localhost/a']) assert.equal(assetUrl('assets/', url), url);
  assert.equal(assetUrl('assets/', 'atlas/a.json'), 'assets/atlas/a.json');
});

test('stage selection helper retains selected body/enemy/boss', () => {
  const scope = { body:'hero', bodies:['hero','job'], monsters:['rat'], allMonsters:['rat','wolf'], bosses:['story_dio'], highTier:false };
  const selected = key => isWorldAsset({ key, type:'image', urls:[] }, scope);
  for (const key of ['hero_walk2','job_idle0','rat_run0','story_dio','ground_meadow']) assert.equal(selected(key), true, key);
  for (const key of ['job_walk2','wolf_run0','story_other']) assert.equal(selected(key), false, key);
  assert.equal(isWorldAsset({key:'vx_big',type:'image',urls:[]},{...scope,bosses:[]}),false);
  assert.equal(selected('vx_big'),true,'boss rooms retain boss flourishes');
  assert.equal(isWorldAsset({key:'sound',type:'audio',urls:[]}, scope),false);
});

test('six concurrent requests, critical priority, and shared jobs without duplicate downloads', async () => {
  const h = harness(['a','b','c','d','e','f','background','critical']);
  for (const def of h.definitions) void h.manager.request(def, h.scene, false);
  assert.equal(h.starts.length,6);
  const done = h.manager.ensure(h.scene, ['critical','critical'], 'world-assets');
  h.releases.get('a')(); await tick();
  assert.equal(h.starts[6],'critical');
  h.releases.get('critical')(); await done;
  assert.equal(h.starts.filter(key => key==='critical').length,1);
  for(const release of h.releases.values()) release();
  await tick();
  h.releases.get('background')?.(); await tick();
});

test('missing definition fails explicitly instead of reporting a ready world', async () => {
  const h=harness([]);
  await assert.rejects(h.manager.ensure(h.scene,['missing'],'world-assets'),/definitions missing/);
  assert.deepEqual(h.updates.at(-1).failed,['missing']);
  assert.ok(h.updates.at(-1).error);
});

test('deadline remains visible after a late download finishes', async () => {
  const h=harness(['slow'],10);
  await assert.rejects(h.manager.ensure(h.scene,['slow'],'world-assets'),/deadline/);
  const count=h.updates.length;
  assert.ok(h.updates.at(-1).error);
  h.releases.get('slow')(); await tick();
  assert.equal(h.updates.length,count);
  assert.ok(h.updates.at(-1).error);
});

test('scene shutdown cancels waiting and never registers completion', async () => {
  const h=harness(['slow']);
  const result=h.manager.ensure(h.scene,['slow'],'world-assets');
  h.scene.events.emit('shutdown');
  await assert.rejects(result,{name:'AbortError'});
  const count=h.updates.length;
  h.releases.get('slow')(); await tick();
  assert.equal(h.updates.length,count);
  assert.equal(h.scene.events.listenerCount('shutdown'),0);
});


test('atlas frames and effect metadata share one JSON request', async () => {
  const h = harness([]);
  const frames = h.manager.metadataFor('effect.json');
  const effect = h.manager.metadataFor('effect.json');
  assert.equal(frames, effect);
  await frames;
  assert.deepEqual(h.metadataRequests, ['effect.json']);
});

test('gameplay gate waits for the complete original catalog including deferred assets', async () => {
  const gate = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ensureWorldAssets').getText(ast).replace(/^export /, '');
  const h = harness(['hero', 'later-boss', 'later-costume', 'item-icon', 'skill-sound']);
  let ready = false;
  const ensure = new Function('managers', 'publish', 'lastProgress', ts.transpile(gate, { target: ts.ScriptTarget.ES2022 }) + '; return ensureWorldAssets;')(new WeakMap([[h.scene.game = {}, h.manager]]), () => { ready = true; }, {});
  const done = ensure(h.scene, { stage: 'village' });
  assert.equal(ready, false);
  for (const key of ['hero', 'later-boss', 'later-costume', 'item-icon']) h.releases.get(key)();
  await tick();
  assert.equal(ready, false, 'a loaded initial map must not open gameplay before the last queued asset');
  h.releases.get('skill-sound')(); await done;
  assert.equal(ready, true);
  assert.equal(h.updates.at(-1).complete, 5);
});

test('a progressing full load may exceed the inactivity deadline', async () => {
  const h = harness(['a', 'b', 'c'], 80);
  const done = h.manager.ensure(h.scene, ['a', 'b', 'c'], 'game-assets');
  await new Promise(resolve => setTimeout(resolve, 45)); h.releases.get('a')();
  await new Promise(resolve => setTimeout(resolve, 45)); h.releases.get('b')();
  await new Promise(resolve => setTimeout(resolve, 45)); h.releases.get('c')();
  await done;
  assert.equal(h.updates.at(-1).complete, 3);
  assert.equal(h.updates.at(-1).error, undefined);
});

test('failed asset retry restarts the gated scene and reuses completed cache entries', async () => {
  const h = harness(['good', 'bad']);
  h.manager.fetch = async def => { h.starts.push(def.key); if (def.key === 'bad') throw new Error('HTTP 404'); h.cache.add(def.key); };
  await assert.rejects(h.manager.ensure(h.scene, ['good', 'bad'], 'game-assets'), /404/);
  assert.deepEqual(h.updates.at(-1).failed, ['bad']);
  h.retry(); assert.deepEqual(h.restarts, [{ fresh: true }]);
  h.manager.fetch = async def => { h.starts.push(def.key); h.cache.add(def.key); };
  await h.manager.ensure(h.scene, ['good', 'bad'], 'game-assets');
  assert.equal(h.starts.filter(key => key === 'good').length, 1, 'successful assets remain cached on retry');
  assert.equal(h.updates.at(-1).complete, 2);
  assert.equal(h.updates.at(-1).error, undefined);
});

test('late body frames register missing motions without poisoning or replacing existing animations', () => {
  const source=readFileSync(new URL('../src/game/textures.ts',import.meta.url),'utf8');
  const tree=ts.createSourceFile('textures.ts',source,ts.ScriptTarget.Latest,true);
  const functions=tree.statements.filter(n=>ts.isFunctionDeclaration(n)&&['loadedAnimations','registerBodyAnims'].includes(n.name?.text)).map(n=>n.getText(tree).replace(/^export /,'')).join('\n');
  const register=new Function(ts.transpile(functions,{target:ts.ScriptTarget.ES2022})+'; return registerBodyAnims;')();
  const textures=new Set(), animations=new Map();
  const scene={textures:{exists:key=>textures.has(key)},anims:{exists:key=>animations.has(key),create:config=>{assert.equal(animations.has(config.key),false);animations.set(config.key,config);}}};
  for(let i=0;i<4;i++) textures.add('hero_idle'+i);
  register(scene,['hero']);
  assert.equal(animations.size,1);assert.ok(animations.has('hero-idle'));
  textures.add('hero_walk0');register(scene,['hero']);
  assert.equal(animations.has('hero-walk'),false);
  for(let i=1;i<4;i++)textures.add('hero_walk'+i);
  register(scene,['hero']);register(scene,['hero']);
  assert.equal(animations.size,2);assert.equal(animations.get('hero-walk').frames.length,4);
});
