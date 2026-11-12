import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import sharp from 'sharp';
import { resolveVillageNpcTexture } from '../src/game/villageNpcAssets.ts';
import { parseStage, stageIntro } from '../src/game/stages.ts';
import { stageIntroSeenKey } from '../src/game/storyCutscenes.ts';
import { lilacScenarioIdAt } from '../src/game/lilacScenarios.ts';

const source = readFileSync('src/game/scenes/WorldScene.ts', 'utf8');
const tree = ts.createSourceFile('WorldScene.ts', source, ts.ScriptTarget.Latest, true);
const world = tree.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === 'WorldScene');
function methods(names) { return world.members.filter(n => names.includes(n.name?.getText(tree))).map(n => n.getText(tree)).join('\n'); }
function loadingSubject(ensure) {
  const Subject = new Function('ensureWorldAssets', 'markWorldReady', 'reportLoadingFailure', 'localStorage',
    ts.transpile(`class Subject { ${methods(['create'])} }; return Subject;`))(ensure, () => {}, () => {}, { removeItem() {} });
  return Object.assign(new Subject(), {
    worldLoadAttempt: 0, input: { enabled: true }, time: { paused: false, now: 10, delayedCall() {} },
    physics: { world: { paused: false, pause() { this.paused = true; }, resume() { this.paused = false; } } },
    cameras: { main: { fadeIn() {} } }, sys: { isActive: () => true }, registry: new Map([['initData', { fresh: true }]]),
    creates: 0, createInner() { this.creates++; this.physics.world.pause(); this.time.paused = true; },
  });
}
test('selected-region loading freezes simulation and restores before the intro takes ownership', async () => {
  let release; const p = loadingSubject(() => new Promise(r => { release = r; }));
  const before = Date.now(); const done = p.create();
  assert.equal(p.input.enabled, false); assert.equal(p.time.paused, true); assert.equal(p.physics.world.paused, true);
  assert.equal(p.creates, 0); release(); await done;
  assert.equal(p.creates, 1); assert.equal(p.assetsReady, true); assert.equal(p.input.enabled, true);
  assert.equal(p.time.paused, true); assert.equal(p.physics.world.paused, true);
  assert.ok(p.registry.get('runStart') >= before);
});
test('failed and superseded region loads cannot initialize a playable world', async () => {
  const failed = loadingSubject(async () => { throw Error('network'); }); await failed.create();
  assert.equal(failed.creates, 0); assert.equal(failed.input.enabled, false); assert.equal(failed.physics.world.paused, true);
  const releases = []; const p = loadingSubject(() => new Promise(r => releases.push(r)));
  const old = p.create(), latest = p.create(); releases[0](); await old; assert.equal(p.creates, 0);
  releases[1](); await latest; assert.equal(p.creates, 1);
});
test('completed custom intro suppresses chapter and legacy fallback on revisit', () => {
  const Subject = new Function('parseStage', 'stageIntro', 'stageIntroSeenKey', 'lilacScenarioIdAt',
    ts.transpile(`class Subject { ${methods(['stagePresentationSeen', 'rememberStagePresentation'])} }; return Subject;`))(
    parseStage, stageIntro, stageIntroSeenKey, lilacScenarioIdAt);
  const p = Object.assign(new Subject(), { cutsceneSeen: [], seenSet: new Set(), saveSoon() {} });
  assert.equal(p.stagePresentationSeen('howlrstone1x1'), false);
  const scenario = lilacScenarioIdAt('howlrstone1', 1);
  assert.ok(scenario); p.cutsceneSeen.push(`lilacCut_rea1_${scenario}`);
  assert.equal(p.stagePresentationSeen('howlrstone1x1'), true);
  p.rememberStagePresentation('howlrstone1x2'); p.rememberStagePresentation('howlrstone1x2');
  assert.equal(p.cutsceneSeen.filter(k => k === 'stage:howlrstone1x2').length, 1);
  p.seenSet.clear(); assert.equal(p.stagePresentationSeen('howlrstone1x2'), true);
});
test('privileged auth ignores an offline cached admin; ordinary offline accounts still work', async () => {
  const raw = readFileSync('src/game/account.ts', 'utf8');
  const ast = ts.createSourceFile('account.ts', raw, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'authMe').getText(ast).replace(/^export /, '');
  let response = { ok: false, data: {} }; const cached = { role: 'admin' }; let writes = 0;
  const auth = new Function('get', 'getCachedUser', 'setCachedUser', ts.transpile(fn + ';return authMe;'))(
    async () => response, () => cached, () => writes++);
  assert.equal(await auth({ requireServer: true }), null); assert.equal(await auth(), cached);
  response = { ok: true, data: { user: { role: 'user' } } };
  assert.equal((await auth({ requireServer: true })).role, 'user'); assert.equal(writes, 1);
});
test('original SPUM takes priority and portraits are exact original image regions', async () => {
  assert.equal(resolveVillageNpcTexture('spum_knight', () => true, 'npcbody_knight'), 'spum_knight');
  assert.equal(resolveVillageNpcTexture('spum_knight', k => k === 'npcbody_knight', 'npcbody_knight'), 'npcbody_knight');
  const manifest = JSON.parse(readFileSync('docs/assets_license/spum_merge_crops.json'));
  for (const a of manifest.assets) {
    const expected = await sharp('public' + a.source).extract(a.crop).raw().toBuffer();
    const actual = await sharp(`public/assets/npcportrait/${a.key}.png`).raw().toBuffer();
    assert.deepEqual(actual, expected, a.key);
  }
});

test('NPC focus uses the shared camera owner and skip closes only its own dialogue', () => {
  let busy = false, onFinish, position, resumed = 0;
  const session = { pan(...args) { position = args.slice(0, 4); } };
  const Subject = new Function('sceneCinematicPlaying', 'beginSceneCinematic',
    ts.transpile(`class Subject { ${methods(['focusNpcDialogue'])} }; return Subject;`))(
    () => busy, (_scene, callback) => { onFinish = callback; return session; });
  const p = Object.assign(new Subject(), { interactables: [{ npcId: 'spum_mage', x: 120, y: 60 }],
    player: { x: 80, y: 100 }, resumeFromDialogue() { resumed++; } });
  p.focusNpcDialogue('missing'); assert.equal(p.npcDialogueSession, undefined);
  busy = true; p.focusNpcDialogue('spum_mage'); assert.equal(p.npcDialogueSession, undefined);
  busy = false; p.focusNpcDialogue('spum_mage'); assert.equal(p.npcDialogueSession, session);
  assert.deepEqual(position, [100, 80, 280, 1.08]);
  onFinish('shutdown'); assert.equal(resumed, 0); assert.equal(p.npcDialogueSession, null);
  p.focusNpcDialogue('spum_mage'); onFinish('skip'); assert.equal(resumed, 1);
});
