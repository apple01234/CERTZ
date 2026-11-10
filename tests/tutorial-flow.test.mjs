import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import ts from 'typescript';
import { TUTORIAL_STEPS, TUTORIAL_VERSION, tutorialAllows, tutorialResume, tutorialStage } from '../src/game/tutorialFlow.ts';

const code = fs.readFileSync('src/game/Tutorial.ts', 'utf8');
function harness(step) {
  const bus = new EventEmitter(), timers = [], rewards = { gold: 0, hp: 0, mp: 0, ticket: 0, done: 0 };
  const node = () => ({ setVisible() { return this; }, setText() { return this; }, setPosition(x, y) { this.x=x; this.y=y; return this; }, setScale(n) { this.scaleX=n; return this; }, destroy() {} });
  class Enemy {
    constructor(scene, x, y, key) { Object.assign(this, { scene, x, y, key, active: true, alive: true, def: {}, data: {} }); }
    setData(key, value) { this.data[key] = value; }
    setTutorialPaused(value) { this.paused = value; }
    destroy() { this.active = false; this.scene = null; }
  }
  const original = new Enemy({}, 800, 0, 'wolf');
  const scene = {
    time: { now: 0, delayedCall(ms, fn) { const timer = { due: scene.time.now + ms, fn, removed: false, remove() { this.removed = true; } }; timers.push(timer); return timer; } },
    enemyList: [original], stageDef: { key: tutorialStage(step) },
    playerRef: { x: 0, y: 0, mp: 100, addGold(n) { rewards.gold += n; }, addPotion(k) { rewards[k]++; } },
    tutorialPoint: (x, y) => ({ x, y }), tutorialNpc() {}, tutorialDrop(point) { this.drop = point; },
    tutorialRequest() { this.requested = true; }, tutorialTransition() { this.transitioned = true; },
    playTutorialCinematic(steps, done) { this.cineDone = done; bus.emit('cinematic:state', { active: true }); return true; },
    saveTutorialProgress(n) { this.saved = n; }, completeTutorialSave() { rewards.done++; }, grantTutorialRewards() { rewards.ticket++; },
    showBanner() {}, scale: { width: 800, height: 450, off() {} }, cameras: { main: { zoom: 1 } }, textures: { exists: () => false },
  };
  const imports = {
    phaser: { __esModule: true, default: { Math: { Clamp: (v, a, b) => Math.max(a, Math.min(b, v)), Distance: { Between: (x, y, a, b) => Math.hypot(x - a, y - b) } } } },
    '../components/game/EventBus': { EventBus: bus }, './entities/Enemy': { Enemy }, './cutsceneCast': { castActor: id => ({ character: id }) },
    './fx/sceneCinematic': { cancelSceneCinematic() { bus.emit('cinematic:state', { active: false }); } },
    './keymap': { keyLabel: x => x, loadKeyMap: () => ({}) }, './tutorialFlow': { TUTORIAL_STEPS },
  };
  const context = { exports: {}, require: key => { if (!(key in imports)) throw Error(key); return imports[key]; } };
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const Subject = context.exports.Tutorial;
  Subject.prototype.buildHud = function () { for (const key of ['hud', 'tTitle', 'tDesc', 'tKey', 'tPips', 'mkGlow', 'mkSpark']) this[key] = node(); };
  const tut = new Subject(scene, step); scene.tut = tut;
  function tick(ms = 100) {
    scene.time.now += ms;
    for (let n = 0; n < 20; n++) {
      const timer = timers.find(t => !t.removed && t.due <= scene.time.now);
      if (!timer) return;
      timer.removed = true; timer.fn();
    }
    throw Error('unbounded tutorial timers');
  }
  function closeCine() { const cb = scene.cineDone; scene.cineDone = null; bus.emit('cinematic:state', { active: false }); cb?.(); }
  tick(0);
  return { tut, scene, rewards, tick, closeCine, original, bus };
}

test('tutorial migration preserves legacy and completed saves; new version resumes safely', () => {
  for (const save of [{}, { lv: 200, tutStep: 4 }, { introSeen: true, tutorialDone: false }, { introSeen: false, tutorialDone: true }, { tutorialVersion: 2, tutorialDone: true }]) assert.equal(tutorialResume(save), null);
  assert.equal(tutorialResume(null), 0); assert.equal(tutorialResume({ introSeen: false }), 0);
  for (const [value, expected] of [[-1, 0], [6, 6], [999, 12], [NaN, 0], [Infinity, 0]]) assert.equal(tutorialResume({ tutorialVersion: TUTORIAL_VERSION, tutStep: value }), expected);
  assert.equal(tutorialStage(2), 'howlrstone1x1'); assert.equal(tutorialStage(3), 'howlrstone1x2');
});
test('cinematic stages reject general controls; practice exposes only taught controls', () => {
  for (const step of ['opening', 'training', 'ending']) for (const action of ['move', 'attack', 'skill1', 'interact', 'inv', 'quest', 'dash']) assert.equal(tutorialAllows(step, action), false);
  assert.equal(tutorialAllows('attack', 'dash'), true); assert.equal(tutorialAllows('evade', 'attack'), false);
  assert.equal(tutorialAllows('inventory', 'inv'), true); assert.equal(tutorialAllows('inventory', 'job'), false);
  assert.equal(tutorialAllows(null, 'skill5'), true);
});
test('actual movement to marker is required; unrelated interact cannot advance', () => {
  const h = harness(1); h.tut.notify('move'); h.tick(); assert.equal(h.tut.currentId, 'move');
  h.scene.playerRef.x = 140; h.tut.update(); h.tick(); assert.equal(h.tut.currentId, 'talk');
  h.tut.notify('talk'); h.tut.interact('register'); h.tick(); assert.equal(h.tut.currentId, 'talk');
  h.tut.interact('lilac'); h.closeCine(); h.tick(); assert.equal(h.tut.currentId, 'training'); assert.equal(h.scene.transitioned, true);
});
test('attack/skill require actual hit on designated target after a successful cast', () => {
  for (const [step, action, next] of [[4, 'attack', 'evade'], [6, 'skill', 'pickup']]) {
    const h = harness(step); h.closeCine();
    h.tut.notify(action); h.tick(); assert.equal(h.tut.currentId, TUTORIAL_STEPS[step].id);
    h.tut.notify('hit', { enemy: h.original }); h.tick(); assert.equal(h.tut.currentId, TUTORIAL_STEPS[step].id);
    h.tut.notify('hit', { enemy: h.tut.practice }); h.tick(); assert.equal(h.tut.currentId, next);
  }
});
test('evade requires a real missed windup and displacement, not an input or idle distance', () => {
  const h = harness(5); h.closeCine(); const enemy = h.tut.practice;
  h.tut.notify('evade_resolved', { enemy, missed: true }); h.tick(); assert.equal(h.tut.currentId, 'evade');
  h.tut.notify('evade_windup', { enemy }); h.tut.notify('evade_resolved', { enemy, missed: true }); h.tick(); assert.equal(h.tut.currentId, 'evade');
  h.tut.notify('evade_windup', { enemy }); h.scene.playerRef.x += 90; h.tut.notify('evade_resolved', { enemy, missed: true }); h.tick(); assert.equal(h.tut.currentId, 'skill');
});
test('pickup must be manual potion; inventory needs actual open and close', () => {
  const h = harness(7); h.closeCine();
  for (const data of [{ kind: 'gold' }, { kind: 'potion_hp', viaPet: true }]) { h.tut.notify('pickup', data); h.tick(); assert.equal(h.tut.currentId, 'pickup'); }
  h.tut.notify('pickup', { kind: 'potion_hp', viaPet: false }); h.tick(); h.closeCine();
  assert.equal(h.tut.currentId, 'inventory'); h.tut.notify('inventory_close'); h.tick(); assert.equal(h.tut.currentId, 'inventory');
  h.tut.notify('inventory_open'); h.tick(); assert.equal(h.tut.currentId, 'inventory');
  h.tut.notify('inventory_close'); h.tick(); assert.equal(h.tut.currentId, 'accept');
});
test('mission requires designated kill; report is separate and only then ending', () => {
  const h = harness(10); h.tut.notify('kill', { enemy: h.original }); h.tick(); assert.equal(h.tut.currentId, 'mission');
  h.tut.notify('kill', { enemy: h.tut.practice }); h.tick(); assert.equal(h.tut.currentId, 'reward');
  h.tut.interact('register'); assert.equal(h.scene.requested, true); h.tut.notify('reward'); h.tick(); assert.equal(h.tut.currentId, 'ending');
  assert.equal(h.rewards.done, 0); h.closeCine(); assert.equal(h.rewards.done, 1);
});
test('skip at every stage grants once, restores originals and cancels late callbacks', () => {
  for (let step = 0; step < TUTORIAL_STEPS.length; step++) {
    const h = harness(step); assert.equal(h.original.paused, true);
    h.tut.skip(); h.tut.skip(); h.closeCine(); h.tick(10000);
    assert.equal(h.rewards.gold, 500); assert.equal(h.rewards.hp, 3); assert.equal(h.rewards.mp, 3);
    assert.equal(h.rewards.ticket, 1); assert.equal(h.rewards.done, 1); assert.equal(h.original.paused, false);
    assert.equal(h.bus.listenerCount('cinematic:state'), 0);
  }
});
test('destroy on scene transition never grants completion rewards', () => {
  const h = harness(4); h.tut.destroy(); h.closeCine(); h.tick(5000);
  assert.equal(h.rewards.gold, 0); assert.equal(h.rewards.done, 0); assert.equal(h.original.paused, false);
});

test('actual HUD projection fits portrait/landscape screens at the game camera zoom', () => {
  const h=harness(1);
  for(const width of [360,390,844,1280]) for(const zoom of [1,1.6,2.5,3]) {
    h.scene.scale.width=width;h.scene.scale.height=844;h.scene.cameras.main.zoom=zoom;
    h.tut.layoutHud();const hud=h.tut.hud;
    const centerX=hud.x*zoom+width/2*(1-zoom), halfWidth=331*hud.scaleX*zoom/2;
    assert.ok(centerX-halfWidth>=0);assert.ok(centerX+halfWidth<=width);
    const centerY=hud.y*zoom+844/2*(1-zoom),halfHeight=84*hud.scaleX*zoom/2;
    assert.equal(Math.round(centerY),100);assert.ok(centerY-halfHeight>=0);
  }
});

test('HUD release tolerates Phaser disposing the camera before scene shutdown', () => {
  const h=harness(4);h.scene.cameras.main=null;
  assert.doesNotThrow(()=>h.closeCine());h.tut.destroy();
});
