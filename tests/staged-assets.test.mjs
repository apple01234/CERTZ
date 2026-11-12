import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { assetUrl, isWorldAsset } from '../src/game/assetSelection.ts';
import { BODY_PREFIXES, STAGES, ENEMIES, BOSS_DEFS, resolveStage } from '../src/game/data.ts';
import { resolveBodyPrefix } from '../src/game/characterAppearance.ts';
import { tutorialResume, tutorialStage } from '../src/game/tutorialFlow.ts';

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

test('stage selection defers unrelated bodies/enemies but keeps all shared presentation', () => {
  const scope = { body:'hero', bodies:['hero','job'], monsters:['rat'], allMonsters:['rat','wolf'] };
  const selected = key => isWorldAsset({ key, type:'image', urls:[] }, scope);
  for (const key of ['hero_walk2','rat_run0','story_dio','story_other','ground_meadow','gvb_glow_white','aura_ring','vx_big','cutscene_lilac','chapter_terrain']) assert.equal(selected(key), true, key);
  for (const key of ['job_idle0','job_walk2','wolf_run0']) assert.equal(selected(key), false, key);
  assert.equal(isWorldAsset({key:'sound',type:'audio',urls:[]}, scope),true);
  assert.equal(isWorldAsset({key:'big-explosion',type:'atlas',urls:['assets/fx/big-explosion.png']},scope),true);
});

test('24 concurrent requests, critical priority, and shared jobs without duplicate downloads', async () => {
  const filler = Array.from({ length: 24 }, (_, i) => i === 0 ? 'a' : `f${i}`);
  const h = harness([...filler,'background','critical']);
  for (const def of h.definitions) void h.manager.request(def, h.scene, false);
  assert.equal(h.starts.length,24);
  const done = h.manager.ensure(h.scene, ['critical','critical'], 'world-assets');
  h.releases.get('a')(); await tick();
  assert.equal(h.starts[24],'critical');
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

function worldGate(h) {
  const gate = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ensureWorldAssets').getText(ast).replace(/^export /, '');
  const ports = { BODY_PREFIXES, STAGES, ENEMIES, BOSS_DEFS, resolveStage, resolveBodyPrefix, tutorialResume, tutorialStage, isWorldAsset };
  return new Function('managers', 'publish', 'lastProgress', ...Object.keys(ports), ts.transpile(gate, { target: ts.ScriptTarget.ES2022 }) + '; return ensureWorldAssets;')(new WeakMap([[h.scene.game = {}, h.manager]]), () => {}, {}, ...Object.values(ports));
}

test('region gate waits for selected body, shared FX and sound, not other costumes', async () => {
  const h = harness(['chf2_idle0', 'chf2_walk0', 'chm2_walk0', 'jobf_guardian_idle0', 'cutscene_lilac', 'gvb_glow_white', 'skill-sound']);
  const ensure = worldGate(h);
  let ready = false;
  const done = ensure(h.scene, { save: { gender: 'f', skinIdx: 2 } }).then(() => { ready = true; });
  assert.equal(ready, false);
  assert.equal(h.releases.has('chm2_walk0'),false);
  assert.equal(h.releases.has('jobf_guardian_idle0'),false);
  for (const key of ['chf2_idle0','chf2_walk0','cutscene_lilac','gvb_glow_white']) h.releases.get(key)();
  await tick();
  assert.equal(ready, false, 'shared audio must also finish before the region opens');
  h.releases.get('skill-sound')(); await done;
  assert.equal(ready, true);
  assert.equal(h.updates.at(-1).complete, 5);
});

test('every region gates its own enemies and elites; tutorial redirect matches WorldScene', async () => {
  for (const key of ['howlrstone1x1','howlrstone1x2','howlrstone10x3','howlrstone11x1','dlcocean1','r1','tower','park','gate','praid','village','invalid-old-save']) {
    const stage = STAGES[resolveStage(key)];
    const keys = Object.keys(ENEMIES).map(key => `${key}_idle0`);
    const h = harness(keys);
    h.manager.fetch = async def => { h.starts.push(def.key); h.cache.add(def.key); };
    await worldGate(h)(h.scene,{stage:key,save:{tutorialDone:true}});
    for (const enemy of [...stage.enemies, ...(stage.elite ? [stage.elite] : [])]) assert.ok(h.cache.has(`${enemy.key}_idle0`),`${key}: ${enemy.key}`);
    for (const boss of Object.values(BOSS_DEFS)) if (boss.summonKey) assert.ok(h.cache.has(`${boss.summonKey}_idle0`),`${key}: summon ${boss.summonKey}`);
    if (['tower','park','gate','praid','village','invalid-old-save'].includes(key)) assert.equal(h.cache.size,keys.length,`${key}: dynamic wave safety`);
  }
  const h = harness(['dx_hornrabbit_idle0','x2_rat_idle0']);
  h.manager.fetch = async def => { h.starts.push(def.key); h.cache.add(def.key); };
  await worldGate(h)(h.scene,{stage:'tower',save:{introSeen:false}});
  assert.deepEqual(h.starts,['x2_rat_idle0'],'fresh characters load the tutorial, not a stale destination');
});

test('region transition fetches new enemies once and keeps cached common assets', async () => {
  const h = harness(['dx_hornrabbit_idle0','x2_rat_idle0','glow']);
  h.manager.fetch = async def => { h.starts.push(def.key); h.cache.add(def.key); };
  const ensure = worldGate(h);
  await ensure(h.scene,{save:{introSeen:false}});
  assert.equal(h.cache.has('dx_hornrabbit_idle0'),false);
  await ensure(h.scene,{stage:'park',save:{tutorialDone:true}});
  assert.equal(h.cache.has('dx_hornrabbit_idle0'),true);
  assert.equal(h.starts.filter(key=>key==='glow').length,1);
  assert.equal(h.starts.filter(key=>key==='x2_rat_idle0').length,1);
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

test('an idle-only costume still loads all 28 frames before it is ready', async () => {
  const source = readFileSync(new URL('../src/game/textures.ts',import.meta.url),'utf8');
  const tree = ts.createSourceFile('textures.ts',source,ts.ScriptTarget.Latest,true);
  const declarations = tree.statements.filter(n=>ts.isVariableStatement(n) && n.declarationList.declarations.some(d=>d.name.getText(tree)==='BODY_FRAME_NAMES') || ts.isFunctionDeclaration(n)&&['bodyFramesReady','loadBodyPrefix'].includes(n.name?.text)).map(n=>n.getText(tree).replace(/^export /,'')).join('\n');
  const cache = new Set(['cost_royal_idle0']), requests = [];
  const { ready, load } = new Function('loadImageRaw','registerBodyAnims',ts.transpile(declarations,{target:ts.ScriptTarget.ES2022})+';return {ready:bodyFramesReady,load:loadBodyPrefix};')(async (_scene,key)=>{requests.push(key);cache.add(key);},()=>{});
  const scene = { textures: { exists: key=>cache.has(key) } };
  assert.equal(ready(scene,'cost_royal'),false);
  await load(scene,'cost_royal');
  assert.equal(requests.length,27);
  assert.equal(ready(scene,'cost_royal'),true);
  await load(scene,'cost_royal');
  assert.equal(requests.length,27,'completed sheets are reused');
});

test('Player keeps the fallback until every motion of a late costume has arrived', () => {
  const source = readFileSync(new URL('../src/game/entities/Player.ts',import.meta.url),'utf8');
  const tree = ts.createSourceFile('Player.ts',source,ts.ScriptTarget.Latest,true);
  const player = tree.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='Player');
  const method = player.members.find(n=>n.name?.getText(tree)==='tickBodyPending').getText(tree);
  const frames = ['idle','walk','walkside','walkup','atk','atkdown','atkup'].flatMap(m=>[0,1,2,3].map(i=>`${m}${i}`));
  const cache = new Set(['cost_royal_idle0']);
  const tickBody = new Function('bodyFramesReady','loadBodyPrefix',ts.transpile(`class Subject { ${method} };return Subject.prototype.tickBodyPending;`))((_scene,prefix)=>frames.every(f=>cache.has(`${prefix}_${f}`)),()=>{});
  let applied = 0;
  const p = { bodyPending:'cost_royal',bodyPrefix:'',bodyKickAt:1,bodyKickCount:0,scene:{time:{now:1}},applyBodyLook(){applied++;} };
  tickBody.call(p);
  assert.equal(p.bodyPending,'cost_royal');
  assert.equal(p.bodyPrefix,'');
  for (const frame of frames) cache.add(`cost_royal_${frame}`);
  tickBody.call(p);
  assert.equal(p.bodyPending,null);
  assert.equal(p.bodyPrefix,'cost_royal');
  assert.equal(applied,1);
});
