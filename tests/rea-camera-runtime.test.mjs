import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import ts from 'typescript';

// Execute the real director modules; Phaser's renderer is replaced by a deterministic scene.
const cache = new Map();
/* vc274 — `phaser` 는 대부분 **타입 전용**이지만, `EventBus.ts` 만은 런타임에
 *  `Phaser.Events.EventEmitter` 를 실제로 생성한다. 그 한 가지만 최소 스텁한다.
 *
 *  [왜 종전에 실패했나] 아래 require 리졸버가 모든 이름에 `.ts` 를 붙여 실제 파일로 풀었기
 *  때문에 패키지 이름 `phaser` 가 `src/components/game/phaser.ts` 라는 **없는 경로**가 되어
 *  ENOENT 로 죽었다. 이 테스트가 검증하려는 대상(연출 디렉터 4종)과는 무관한 실패였다. */
const PHASER_STUB = {
  Events: {
    EventEmitter: class EventEmitter {
      constructor() { this._h = new Map(); }
      on(k, f) { (this._h.get(k) ?? this._h.set(k, []).get(k)).push(f); return this; }
      once(k, f) { return this.on(k, f); }
      off(k, f) { const a = this._h.get(k); if (a) this._h.set(k, a.filter((x) => x !== f)); return this; }
      emit(k, ...a) { for (const f of this._h.get(k) ?? []) f(...a); return true; }
      removeAllListeners() { this._h.clear(); return this; }
    },
  },
};
const BARE_MODULE = new Set(['phaser', 'node:events', 'events']);
function load(relative) {
  const file = path.resolve(relative);
  if (cache.has(file)) return cache.get(file).exports;
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const module = { exports: {} };
  cache.set(file, module);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${js}\n})`, { console, Map, Set, WeakMap })(
    (name) => {
      if (name === 'phaser') return { __esModule: true, default: PHASER_STUB, ...PHASER_STUB };
      if (BARE_MODULE.has(name) || !name.startsWith('.')) return {};
      return load(path.resolve(path.dirname(file), name.endsWith('.json') ? name : `${name}.ts`));
    },
    module, module.exports,
  );
  return module.exports;
}
const { playAutoCutscene, autoCutscenePlaying } = load('src/game/fx/AutoCutscene.ts');
const { playStoryCutscene, storyCutscenePlaying } = load('src/game/fx/StoryCutscene.ts');
const { sceneCinematicPlaying, cancelSceneCinematic } = load('src/game/fx/sceneCinematic.ts');
const { LILAC_SCENARIOS } = load('src/game/lilacScenarios.ts');

test('cinematics hide obstructing portal art and restore exact visibility on skip', () => {
  const fake = fakeScene();
  const shown = { active: true, visible: true, setVisible(v) { this.visible = v; } };
  const hidden = { active: true, visible: false, setVisible(v) { this.visible = v; } };
  fake.scene.cinematicObstructions = () => [shown, hidden];
  playStoryCutscene(fake.scene, { shots: [{ x: 200, y: 200, holdMs: 5000 }] });
  assert.equal(shown.visible, false);
  fake.scene.input.keyboard.emit('keydown-ESC');
  assert.equal(shown.visible, true); assert.equal(hidden.visible, false);
  assertReleased(fake);
});

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
    cameras: { main: cam }, input, events, physics: { world },
    /* vc242 — waitForKey 가 scene.time.now 로 최소 감상 시간을 판정한다.
     *  종전 스텁엔 delayedCall 만 있어 now 가 undefined 였고, 키 입력이 항상 무시됐다. */
    time: { delayedCall, get now() { return now; } },
    textures: { exists: (key) => /^ch[mf]\d_idle0$/.test(key) || /^cast_[a-z_]+$/.test(key) },
    anims: { exists: (key) => /^ch[mf]\d-/.test(key) || /^cast_[a-z_]+-/.test(key) },
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
  /* 하루 v2 — 전체 스킵은 우상단 '건너뛰기' 영역(또는 ESC)뿐이다. 화면 아무 곳 터치는 '다음 단계'. */
  fake.scene.input.emit('pointerdown', { x: 790, y: 10 });
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
  /* vc242 (지시 #2) — 각 단계가 "키 입력 대기(상한 6초)" 로 바뀌었다. 종전 800ms 자동 진행이
   *  아니라 2단계 × (pan 300 + 대기 상한) 만큼 흘려야 끝난다. 키를 누르면 즉시 끝나는 것은
   *  아래 'advance key' 테스트에서 따로 검증한다. */
  fake.advance(30000); assertReleased(fake); assert.equal(completed, 1); assert.deepEqual(shown, ['intro']);
  fake.advance(10000); assert.equal(completed, 1);
});

test('Cinematic advance key moves exactly one shot at a time', () => {
  /* vc242 (지시 #2) — Space/Enter/E 로 다음 장면 한 단계씩. 전체 스킵이 아니다. */
  const fake = fakeScene(); const shown = []; let completed = 0; let pans = 0;
  assert.equal(playStoryCutscene(fake.scene, {
    shots: [
      { x: 100, y: 100, panMs: 120, holdMs: 100, dialogue: 'a' },
      { x: 200, y: 200, panMs: 120, holdMs: 100, dialogue: 'b' },
      { x: 300, y: 300, panMs: 120, holdMs: 100, dialogue: 'c' },
    ],
    onDone: () => completed++, showDialogue: (key) => { shown.push(key); return true; },
  }), true);
  const panCount = () => fake.cam.pans.length;
  pans = panCount();
  /* 첫 pan(120ms) 도착 후 키 대기. 최소 감상 시간(260ms)이 지나야 입력을 받는다. */
  fake.advance(500);
  const before = panCount();
  fake.scene.input.keyboard.emit('keydown', { code: 'Space' });
  fake.advance(30);
  assert.equal(panCount(), before + 1, '키 1회 = 다음 장면 1개');
  assert.equal(completed, 0, '아직 끝나지 않았다(전체 스킵이 아님)');
  /* vc242 — 각 장면은 minMs(260ms) 를 지나야 다음 입력을 받는다. 키 사이에 그만큼 흘린다. */
  fake.advance(420);
  fake.scene.input.keyboard.emit('keydown', { code: 'KeyE' });
  fake.advance(420);
  fake.scene.input.keyboard.emit('keydown', { code: 'Enter' });
  fake.advance(2000);
  assert.equal(completed, 1);
  assert.deepEqual(shown, ['a', 'b', 'c']);
  assert.equal(pans > 0, true);
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
  /* vc242 — holdMs:0 이어도 waitForKey 의 최소 감상 시간(260ms)과 무입력 상한(2600ms)을
   *  지나야 다음 단계로 간다. 종전엔 delay(0) 이라 300ms 면 끝났다.
   *  여기서 검증하려는 것은 "카메라 신호가 없어도 힐링이 유한하다"이므로 상한까지 흘린다. */
  interrupted.advance(4000); assertReleased(interrupted);
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

/* ───────── 하루 v2 — 연출 입력/대사 통합 회귀 ───────── */
/** 실제 Phaser 는 한 번의 키 입력에 'keydown-<NAME>' 과 'keydown' 을 둘 다 내보낸다(종전 스텁은 후자만 흉내냈다). */
function pressLikePhaser(fake, name, code) {
  fake.scene.input.keyboard.emit(`keydown-${name}`, { code });
  fake.scene.input.keyboard.emit('keydown', { code });
}

test('Space (default interact key) advances exactly one shot and never skips the whole cutscene', () => {
  const fake = fakeScene(); let completed = 0;
  playStoryCutscene(fake.scene, {
    shots: [{ x: 100, y: 100, panMs: 120, holdMs: 100 }, { x: 200, y: 200, panMs: 120, holdMs: 100 }, { x: 300, y: 300, panMs: 120, holdMs: 100 }],
    onDone: () => completed++,
  });
  fake.advance(500);
  const before = fake.cam.pans.length;
  pressLikePhaser(fake, 'SPACE', 'Space');
  fake.advance(30);
  assert.equal(completed, 0, 'Space must not end the cutscene');
  assert.equal(sceneCinematicPlaying(fake.scene), true);
  assert.equal(fake.cam.pans.length, before + 1, 'Space = next shot');
});

test('Tap outside the skip zone advances one step; tap in the top-right skip zone skips', () => {
  const fake = fakeScene(); let completed = 0;
  playStoryCutscene(fake.scene, {
    shots: [{ x: 100, y: 100, panMs: 120, holdMs: 100 }, { x: 200, y: 200, panMs: 120, holdMs: 100 }],
    onDone: () => completed++,
  });
  fake.advance(500);
  const before = fake.cam.pans.length;
  fake.scene.input.emit('pointerdown', { x: 400, y: 300 });
  fake.advance(30);
  assert.equal(fake.cam.pans.length, before + 1, 'tap = next shot');
  assert.equal(completed, 0);
  fake.advance(500);
  fake.scene.input.emit('pointerdown', { x: 790, y: 10 });
  assertReleased(fake); assert.equal(completed, 1, 'skip zone ends the cutscene');
});

test('Story dialogue plays while its shot is on screen, next shot waits for the player, skip closes the box', () => {
  const fake = fakeScene(); const log = []; let doneCb; let cancelled = 0; let completed = 0;
  playStoryCutscene(fake.scene, {
    shots: [{ x: 100, y: 100, panMs: 120, holdMs: 100, dialogue: 'a' }, { x: 200, y: 200, panMs: 120, holdMs: 100, dialogue: 'b' }],
    onDone: () => completed++,
    showDialogue: (key) => { log.push(`late:${key}`); return true; },
    playDialogue: (key, done) => { log.push(`play:${key}@pans=${fake.cam.pans.length}`); doneCb = done; return () => { cancelled++; }; },
  });
  fake.advance(300);
  assert.deepEqual(log, ['play:a@pans=1'], '대사는 첫 컷 카메라 도착 직후, 연출 도중에 재생');
  assert.equal(sceneCinematicPlaying(fake.scene), true);
  fake.advance(600000); /* 읽는 시간에는 상한이 없다 */
  assert.equal(sceneCinematicPlaying(fake.scene), true, 'idle watchdog must not cut a slow reader');
  assert.equal(fake.cam.pans.length, 1, 'next shot waits for the dialogue to end');
  doneCb(); fake.advance(300);
  assert.deepEqual(log, ['play:a@pans=1', 'play:b@pans=2']);
  fake.scene.input.keyboard.emit('keydown-ESC');
  assertReleased(fake);
  assert.equal(cancelled, 1, '스킵하면 열려 있던 대사창을 닫는다');
  assert.equal(completed, 1);
  assert.deepEqual(log.filter((l) => l.startsWith('late:')), [], '연출 뒤 몰아서 재생하지 않는다');
});

test('Auto cutscene routes say() to the shared dialogue window and waits for the player', () => {
  const fake = fakeScene(); const said = []; let doneCb; let cancelled = 0; let completed = 0;
  playAutoCutscene(fake.scene, spec([
    { t: 'enter', id: 'lilac', actor },
    { t: 'say', speaker: '라일락', lines: ['첫째 줄', '둘째 줄'] },
    { t: 'cam', rx: 0.5, ry: 0.5, panMs: 120 },
  ]), () => completed++, {
    say: (speaker, lines, done) => { said.push({ speaker, lines, pans: fake.cam.pans.length }); doneCb = done; return () => { cancelled++; }; },
  });
  fake.advance(400);
  assert.equal(said.length, 1);
  assert.deepEqual(said[0].lines, ['첫째 줄', '둘째 줄']);
  fake.advance(600000);
  assert.equal(sceneCinematicPlaying(fake.scene), true, 'no auto-advance and no watchdog while the dialogue box is open');
  assert.equal(fake.cam.pans.length, 0, 'next step waits');
  doneCb(); fake.advance(400);
  assert.equal(fake.cam.pans.length, 1, 'after the player finishes reading, direction continues');
  fake.advance(30000);
  assertReleased(fake); assert.equal(completed, 1);
});

test('skip while the shared dialogue box is open closes it', () => {
  const fake = fakeScene(); let cancelled = 0;
  playAutoCutscene(fake.scene, spec([{ t: 'enter', id: 'lilac', actor }, { t: 'say', speaker: '라일락', lines: ['x'] }]), undefined, {
    say: () => () => { cancelled++; },
  });
  fake.advance(400);
  fake.scene.input.keyboard.emit('keydown-ESC');
  assertReleased(fake); assert.equal(cancelled, 1); assert.equal(fake.pending(), 0);
});

// Full tutorial skip is a live skip, not scene shutdown: restore camera and physics.
test('programmatic live skip releases physics/camera and cancels pending dialogue', () => {
  const fake = fakeScene(); let completed = 0;
  playStoryCutscene(fake.scene, { shots: [{ x: 200, y: 200, holdMs: 5000 }], onDone: () => completed++ });
  assert.equal(fake.scene.physics.world.isPaused, true);
  cancelSceneCinematic(fake.scene, "skip");
  assertReleased(fake);
  assert.equal(completed, 1);
  fake.advance(20000);
  assert.equal(completed, 1);
});
