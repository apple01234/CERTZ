import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { FREE_DASH, freeDashDirection, freeDashFraction } from '../src/game/combat/freeDash.ts';

const source = readFileSync('src/game/entities/Player.ts', 'utf8');
const ast = ts.createSourceFile('Player.ts', source, ts.ScriptTarget.Latest, true);
const player = ast.statements.find(n => ts.isClassDeclaration(n) && n.name.text === 'Player');
const names = new Set(['useFreeDash', 'stopFreeDash', 'tickFreeDash']);
const methods = player.members.filter(n => names.has(n.name?.getText(ast))).map(n => n.getText(ast)).join('\n');
const Subject = new Function('FREE_DASH', 'freeDashDirection', ts.transpile(`class Subject { ${methods} } return Subject;`))(FREE_DASH, freeDashDirection);
function vector(x = 0, y = 0) { return { x, y, set(x, y) { this.x = x; this.y = y; } }; }
function subject() {
  const p = Object.assign(new Subject(), { x: 100, y: 100, state: 'idle', facing: vector(0, -1), dashDir: vector(), freeDashing: false,
    mp: 0, iframes: 0, skill2Cd: 9999, cls: null, silenceMs: 999,
    scene: { time: { now: 0 }, currentMoveVec: () => vector(), freeDashTravelFraction: () => 1 },
    ensureMoveAnim() {}, animKey(key) { return key; }, setFlipX(value) { this.flipX = value; },
    setVelocity(x, y) { this.velocity = { x, y }; },
  });
  p.body = { reset(x, y) { p.x = x; p.y = y; p.setVelocity(0, 0); } };
  return p;
}

test('creation: no class, zero MP, silence, existing S2 cooldown do not gate dash', () => {
  const p = subject();
  assert.equal(FREE_DASH.cooldownMs, 0);
  assert.equal(p.useFreeDash(), true);
  assert.deepEqual({ x: p.dashDir.x, y: p.dashDir.y }, { x: 0, y: -1 });
  assert.equal(p.mp, 0); assert.equal(p.iframes, 0); assert.equal(p.skill2Cd, 9999);
});
test('active dash cannot stack or extend; reuses at exact end without cooldown', () => {
  const p = subject(); p.useFreeDash();
  p.scene.time.now = 80;
  assert.equal(p.useFreeDash(), false); assert.equal(p.freeDashUntil, 180);
  p.scene.time.now = 180;
  assert.equal(p.useFreeDash(), true); assert.equal(p.freeDashUntil, 360);
});
test('dead/attack and legacy dash are not interrupted; cancellation stops motion', () => {
  for (const state of ['dead', 'attack', 'dash']) {
    const p = subject(); p.state = state; assert.equal(p.useFreeDash(), false);
  }
  const p = subject(); p.useFreeDash(); p.stopFreeDash();
  assert.equal(p.state, 'idle'); assert.deepEqual(p.velocity, { x: 0, y: 0 });
  assert.equal(p.useFreeDash(), true);
});
test('input direction is normalized, neutral uses facing, nonfinite input is safe', () => {
  const d = freeDashDirection({ x: 1, y: 1 }, { x: -1, y: 0 });
  assert.ok(Math.abs(Math.hypot(d.x, d.y) - 1) < 1e-12);
  assert.deepEqual(freeDashDirection({ x: NaN, y: 1 }, { x: 0, y: -2 }), { x: 0, y: -1 });
  assert.deepEqual(freeDashDirection({ x: 0, y: 0 }, { x: NaN, y: 0 }), { x: 1, y: 0 });
});
const bounds = { x: 0, y: 0, width: 1000, height: 1000 };
const half = { x: 10, y: 22 };
test('open travel is 126px; diagonal speed is not multiplied', () => {
  assert.equal(FREE_DASH.speed * FREE_DASH.durationMs / 1000, 126);
  assert.equal(freeDashFraction({ x: 100, y: 100 }, { x: 126, y: 0 }, half, bounds, []), 1);
});
test('sweep blocks thin walls even with endpoint beyond wall and preserves full body size', () => {
  const wall = { x: 150, y: 0, width: 1, height: 1000 };
  const f = freeDashFraction({ x: 100, y: 100 }, { x: 126, y: 0 }, half, bounds, [wall]);
  assert.ok(f > 0); assert.ok(100 + f * 126 < 140); assert.ok(100 + f * 126 > 139.99);
});
test('world edges, corner, initial overlap and invalid coordinates are blocked', () => {
  assert.ok(freeDashFraction({ x: 980, y: 500 }, { x: 126, y: 0 }, half, bounds, []) < 0.08);
  assert.ok(freeDashFraction({ x: 500, y: 970 }, { x: 0, y: 126 }, half, bounds, []) < 0.064);
  assert.equal(freeDashFraction({ x: 100, y: 100 }, { x: 126, y: 0 }, half, bounds,
    [{ x: 90, y: 90, width: 30, height: 30 }]), 0);
  assert.equal(freeDashFraction({ x: NaN, y: 1 }, { x: 126, y: 0 }, half, bounds, []), 0);
});
test('PC and mobile use same gate; listener cleanup, focus cancellation and walking frames wired', () => {
  const world = readFileSync('src/game/scenes/WorldScene.ts', 'utf8');
  const touch = readFileSync('src/components/game/TouchControls.tsx', 'utf8');
  assert.match(world, /JustDown\(this.keys.SHIFT\)\) this.tryFreeDash\(\)/);
  assert.match(world, /const onDash = \(\) => this.tryFreeDash\(\)/);
  assert.match(world, /EventBus.on\("input:dash", onDash\)/);
  assert.match(world, /EventBus.off\("input:dash", onDash\)/);
  assert.match(world, /this.player\?\.stopFreeDash\(\)/);
  assert.match(touch, /EventBus.emit\("input:dash"\)/);
  assert.match(source, /this.scene.freeDashTravelFraction/);
  assert.match(source, /this.state === "dead"\) \{ this.stopFreeDash\(\)/);
});

test('touching a wall permits travel away from it and along it, not into it', () => {
  const wall = { x: 150, y: 0, width: 1, height: 1000 };
  const start = { x: 140, y: 100 };
  assert.equal(freeDashFraction(start, { x: -126, y: 0 }, half, bounds, [wall]), 1);
  assert.equal(freeDashFraction(start, { x: 0, y: 126 }, half, bounds, [wall]), 1);
  assert.equal(freeDashFraction(start, { x: 126, y: 0 }, half, bounds, [wall]), 0);
});


test('actual Player step travels exactly 126px for fine, coarse and delayed frames', () => {
  for (const times of [[16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192], [60, 120, 180], [500]]) {
    const p = subject(); p.scene.currentMoveVec = () => vector(1, 0); p.useFreeDash();
    for (const now of times) { p.scene.time.now = now; p.tickFreeDash(); }
    assert.ok(Math.abs(p.x - 226) < 1e-9); assert.equal(p.y, 100);
    assert.equal(p.state, 'idle'); assert.deepEqual(p.velocity, { x: 0, y: 0 });
    assert.equal(p.freeDashing, false); assert.equal(p.useFreeDash(), true);
  }
});
test('step clips movement once at wall, stops, and never runs legacy dash end FX', () => {
  const p = subject(); p.scene.currentMoveVec = () => vector(1, 0);
  p.scene.freeDashTravelFraction = (dir, distance) => freeDashFraction(
    { x: p.x, y: p.y }, { x: dir.x * distance, y: dir.y * distance }, half, bounds,
    [{ x: 150, y: 0, width: 1, height: 1000 }]);
  p.useFreeDash(); p.scene.time.now = 100; p.tickFreeDash();
  assert.ok(p.x < 140 && p.x > 139.99); assert.equal(p.state, 'idle');
  const x = p.x; p.scene.time.now = 500; p.tickFreeDash(); assert.equal(p.x, x);
  assert.equal(p.useFreeDash(), true);
});
test('expired re-press flushes only the old remaining distance before starting next dash', () => {
  const p = subject(); p.scene.currentMoveVec = () => vector(1, 0); p.useFreeDash();
  p.scene.time.now = 180; assert.equal(p.useFreeDash(), true); assert.equal(p.x, 226);
  p.scene.time.now = 360; p.tickFreeDash(); assert.equal(p.x, 352);
});
test('death or external action cancels active movement without resurrection', () => {
  for (const state of ['dead', 'attack']) {
    const p = subject(); p.useFreeDash(); p.state = state; p.scene.time.now = 60;
    assert.equal(p.tickFreeDash(), false); assert.equal(p.x, 100); assert.equal(p.state, state);
    assert.equal(p.freeDashing, false);
  }
});
