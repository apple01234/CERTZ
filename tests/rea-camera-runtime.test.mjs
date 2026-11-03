import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import ts from 'typescript';

// Execute the real director modules; Phaser's renderer is replaced by a deterministic scene.
const cache = new Map();
function load(relative) {
  const file = path.resolve(relative);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${js}\n})`, { console, Map, Set, WeakMap })(
    (name) => load(path.resolve(path.dirname(file), `${name}.ts`)), module, module.exports,
  );
  return module.exports;
}
const { playAutoCutscene, autoCutscenePlaying } = load('src/game/fx/AutoCutscene.ts');
const { playStoryCutscene, storyCutscenePlaying } = load('src/game/fx/StoryCutscene.ts');
const { sceneCinematicPlaying } = load('src/game/fx/sceneCinematic.ts');
const { LILAC_SCENARIOS } = load('src/game/lilacScenarios.ts');

function fakeScene({ paused = false, cameraSignals = true } = {}) {
  let now = 0;
  let order = 0;
  const timers = [];
  const objects = [];
  const events = new EventEmitter();
  const input = new EventEmitter();
  input.keyboard = new EventEmitter();
  input.keyboard.resetKeys = () => {};
  function delayedCall(ms, fn) {
    const timer = { at: now + ms, order: order++, active: true, remove() { this.active = false; }, fn };
    timers.push(timer); return timer;
  }
  function advance(ms) {
    const end = now + ms;
    for (let i = 0; i < 10000; i++) {
      const due = timers.filter((timer) => timer.active && timer.at <= end).sort((a, b) => a.at - b.at || a.order - b.order)[0];
      if (!due) { now = end; return; }
      due.active = false; now = due.at; due.fn();
    }
    throw new Error('Unbounded cutscene callback loop');
  }
  const cam = new EventEmitter();
  Object.assign(cam, { width: 800, height: 450, zoom: 2, midPoint: { x: 150, y: 300 }, pans: [], fx: [] });
  const cameraTimers = new Set();
  const cameraDelay = (ms, fn) => { const timer = delayedCall(ms, fn); cameraTimers.add(timer); };
  cam.pan = (x, y, ms) => {
    cam.pans.push({ x, y, ms });
    if (cameraSignals) cameraDelay(ms, () => { cam.midPoint = { x, y }; cam.emit('camerapancomplete', cam); });
    return cam;
  };
  let zoomTimer;
  cam.zoomTo = (zoom, ms) => { zoomTimer = delayedCall(ms, () => { cam.zoom = zoom; }); return cam; };
  // Match Phaser 4: resetFX resets pan/fade/flash/shake but leaves zoom running.
  cam.zoomEffect = { reset() { zoomTimer?.remove(); } };
  cam.setZoom = (zoom) => { cam.zoom = zoom; return cam; };
  cam.centerOn = (x, y) => { cam.midPoint = { x, y }; return cam; };
  cam.flash = () => { cam.fx.push('flash'); return cam; };
  cam.shake = () => { cam.fx.push('shake'); return cam; };
  cam.fadeIn = (ms) => { cam.fx.push('fadeIn'); cameraDelay(ms, () => cam.emit('camerafadeincomplete')); return cam; };
  cam.fadeOut = (ms) => { cam.fx.push('fadeOut'); cameraDelay(ms, () => cam.emit('camerafadeoutcomplete')); return cam; };
  cam.resetFX = () => { for (const timer of cameraTimers) timer.remove(); cam.fx.length = 0; return cam; };
  function object(kind, x = 0, y = 0, tex = '') {
    const obj = {
      kind, x, y, active: true, visible: true, children: [], texture: { key: tex }, played: [],
      setName(name) { this.name = name; return this; },
      setOrigin() { return this; }, setScrollFactor() { return this; },
      setDepth(v) { this.depth = v; return this; }, setAlpha(v) { this.alpha = v; return this; },
      setScale(v) { this.scale = v; return this; }, setFlipX(v) { this.flipX = v; return this; },
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      setVisible(v) { this.visible = v; return this; }, setText(v) { this.text = v; return this; },
      fillStyle() { return this; }, fillRoundedRect() { return this; }, lineStyle() { return this; }, strokeRoundedRect() { return this; },
      add(children) { this.children.push(...(Array.isArray(children) ? children : [children])); return this; },
      play(key) { this.played.push(key); this.texture.key = tex.replace('idle0', 'idle3'); return this; },
      destroy() { this.active = false; for (const child of this.children) child.destroy(); },
    };
    objects.push(obj); return obj;
  }
  const world = { isPaused: paused, resumes: 0, pause() { this.isPaused = true; }, resume() { this.isPaused = false; this.resumes++; } };
  const scene = {
    camCinema: false, dialoguing: false, baseZoom: 2, stageW: 1200, stageH: 700,
    player: { x: 180, y: 350, active: true },
    cameras: { main: cam }, input, events, physics: { world }, time: { delayedCall },
    textures: { exists: (key) => /^ch[mf]\d_idle0$/.test(key) }, anims: { exists: (key) => /^ch[mf]\d-/.test(key) },
    add: {
      rectangle: (x, y) => object('rectangle', x, y), text: (x, y, text) => object('text', x, y).setText(text),
      sprite: (x, y, tex) => object('sprite', x, y, tex), graphics: () => object('graphics'),
      container: (x, y, children = []) => object('container', x, y).add(children),
    },
    tweens: { add(config) {
      const timer = delayedCall(config.duration ?? 0, () => {
        for (const target of Array.isArray(config.targets) ? config.targets : [config.targets]) {
          for (const key of ['x', 'y', 'alpha']) if (config[key] !== undefined) target[key] = config[key];
        }
        config.onComplete?.();
      });
      return { remove() { timer.remove(); } };
    } },
  };
  return { scene, cam, objects, advance, world, pending: () => timers.filter((timer) => timer.active).length };
}
const spec = (steps) => ({ id: 'probe', stageW: 1200, stageH: 700,
  anchors: { entry: { x: 180, y: 350 }, feature: { x: 900, y: 320 } }, steps });
const actor = { tex: 'chf2_idle0', anim: 'chf2-idle', x: 0, y: 0, anchor: 'feature' };
function assertReleased(fake) {
  assert.equal(sceneCinematicPlaying(fake.scene), false);
  assert.equal(fake.scene.camCinema, false);
  assert.equal(fake.scene.dialoguing, false);
  assert.equal(fake.cam.zoom, 2);
  assert.equal(fake.world.isPaused, false);
  assert.equal(fake.scene.input.listenerCount('pointerdown'), 0);
  assert.equal(fake.scene.input.keyboard.listenerCount('keydown-SPACE'), 0);
  assert.equal(fake.scene.events.listenerCount('prerender'), 0);
  assert.equal(fake.objects.filter((object) => object.active).length, 0);
}

test('Auto skip during long dialogue immediately releases actors, letterbox, effects and input', () => {
  const fake = fakeScene(); let completed = 0;
  assert.equal(playAutoCutscene(fake.scene, spec([
    { t: 'enter', id: 'lilac', actor }, { t: 'cam', rx: 0, ry: 0, focus: 'lilac', zoom: 1.4, panMs: 300 },
    { t: 'say', speaker: '라일락', lines: ['긴 대사'], minHold: 5000 },
  ]), () => completed++), true);
  fake.advance(400);
  assert.equal(fake.scene.dialoguing, true);
  assert.equal(fake.cam.zoom, 2.8);
  assert.equal(fake.cam.pans[0].x, 900, 'camera focuses actual actor landmark');
  assert.equal(playStoryCutscene(fake.scene, { shots: [{ x: 10, y: 10 }] }), false);
  fake.scene.input.emit('pointerdown');
  assertReleased(fake); assert.equal(completed, 1);
  assert.equal(fake.pending(), 0);
  fake.advance(300000);
  assertReleased(fake); assert.equal(completed, 1);
});

test('Story pans complete on camera events and defer dialogue until ownership is released', () => {
  const fake = fakeScene(); const shown = []; let completed = 0;
  assert.equal(playStoryCutscene(fake.scene, {
    shots: [{ x: -500, y: -500, zoom: 0.8, panMs: 300, holdMs: 100, dialogue: 'intro' }, { x: 900, y: 350, zoom: 1.3, panMs: 300, holdMs: 100 }],
    onDone: () => completed++, showDialogue: (key) => { assertReleased(fake); shown.push(key); return true; },
  }), true);
  assert.equal(autoCutscenePlaying(fake.scene), true, 'directors share exclusion');
  assert.equal(fake.cam.pans[0].x, 250, 'clamps with target 1.6 zoom, not stale zoom2');
  assert.equal(fake.cam.pans[0].y, 140.625);
  fake.advance(799); assert.equal(storyCutscenePlaying(fake.scene), true);
  fake.advance(1); assertReleased(fake); assert.equal(completed, 1); assert.deepEqual(shown, ['intro']);
  fake.advance(10000); assert.equal(completed, 1);
});

test('skipping an active zoom cancels its future ticks before restoring baseZoom', () => {
  const fake = fakeScene();
  playStoryCutscene(fake.scene, { shots: [{ x: 900, y: 320, panMs: 1000, zoom: 1.4, holdMs: 5000 }] });
  fake.advance(50);
  fake.scene.input.keyboard.emit('keydown-ESC');
  assertReleased(fake);
  fake.advance(10000);
  assertReleased(fake);
  assert.equal(fake.pending(), 0, 'old zoom effect must not survive camera ownership');
});

test('shutdown cancels all pending timelines even after Phaser removes its main camera', () => {
  const fake = fakeScene(); let completed = 0; const endings = [];
  playAutoCutscene(fake.scene, spec([{ t: 'enter', id: 'lilac', actor }, { t: 'wait', ms: 5000 }]),
    () => completed++, { onFinish: (reason) => endings.push(reason) });
  fake.advance(1);
  fake.scene.cameras.main = undefined;
  fake.scene.events.emit('shutdown');
  assert.equal(sceneCinematicPlaying(fake.scene), false);
  assert.equal(fake.scene.camCinema, false); assert.equal(fake.scene.dialoguing, false);
  assert.equal(fake.pending(), 0); assert.equal(completed, 0); assert.deepEqual(endings, ['shutdown']);
  assert.equal(fake.world.resumes, 0, 'never resumes a dead scene');
  fake.advance(300000); assert.equal(completed, 0);
  assert.equal(fake.objects.filter((object) => object.active).length, 0);
});

test('preexisting physics pause survives skip; missing actor does not create placeholder rectangles', () => {
  const fake = fakeScene({ paused: true });
  playAutoCutscene(fake.scene, spec([{ t: 'enter', id: 'missing', actor: { ...actor, tex: 'not-preloaded' } }, { t: 'wait', ms: 5000 }]));
  assert.equal(fake.objects.filter((object) => object.kind === 'rectangle').length, 2, 'only letterbox bars exist');
  assert.equal(fake.objects.filter((object) => object.kind === 'sprite').length, 0);
  fake.scene.input.keyboard.emit('keydown-ESC');
  assert.equal(fake.world.isPaused, true); assert.equal(fake.world.resumes, 0); assert.equal(fake.pending(), 0);
});

test('interrupted camera event has bounded healing, and every authored sequence completes and cleans up', () => {
  const interrupted = fakeScene({ cameraSignals: false });
  playStoryCutscene(interrupted.scene, { shots: [{ x: 300, y: 300, panMs: 120, holdMs: 0 }] });
  interrupted.advance(300); assertReleased(interrupted);
  for (const scenario of Object.values(LILAC_SCENARIOS)) {
    const fake = fakeScene(); let completed = 0;
    playAutoCutscene(fake.scene, spec(scenario.steps), () => completed++);
    fake.advance(300000);
    assertReleased(fake); assert.equal(completed, 1, scenario.id);
    assert.equal(fake.pending(), 0, scenario.id);
    const sprites = fake.objects.filter((object) => object.kind === 'sprite');
    assert.ok(sprites.length > 0, `${scenario.id} has animated preloaded actors`);
    assert.ok(sprites.some((sprite) => sprite.played.some((key) => key.includes('-walk'))), `${scenario.id} walks during direction`);
  }
});
