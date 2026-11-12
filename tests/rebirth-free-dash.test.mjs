import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { FREE_DASH, freeDashDirection, freeDashFraction } from '../src/game/combat/freeDash.ts';

const source = readFileSync('src/game/entities/Player.ts', 'utf8');
const ast = ts.createSourceFile('Player.ts', source, ts.ScriptTarget.Latest, true);
const player = ast.statements.find(n => ts.isClassDeclaration(n) && n.name.text === 'Player');
const names = new Set(['actionAllowed', 'useFreeDash', 'stopFreeDash', 'tickFreeDash', 'basicAttackLive']);
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
  assert.equal(FREE_DASH.cooldownMs, 1000);
  assert.equal(p.useFreeDash(), true);
  assert.deepEqual({ x: p.dashDir.x, y: p.dashDir.y }, { x: 0, y: -1 });
  assert.equal(p.mp, 0); assert.equal(p.iframes, FREE_DASH.iFrameMs); assert.equal(p.skill2Cd, 9999);
});

/* vc268 — 대시는 짧은 무적을 준다. 무적이 0이면 예고 공격을 "피하는" 입력이 피해를 막지 못한다. */
test('dash grants a short i-frame window shorter than the 600ms hit stun', () => {
  const p = subject();
  p.useFreeDash();
  assert.equal(p.iframes, FREE_DASH.iFrameMs);
  assert.ok(FREE_DASH.iFrameMs > FREE_DASH.durationMs, '무적은 대시 이동보다 길어야 한다');
  assert.ok(FREE_DASH.iFrameMs < 600, '무적은 피격 경직보다 짧아 무한 무적이 아니다');
});

/* vc268 — 기존 무적이 더 길면 대시가 그걸 줄이면 안 된다. */
test('dash never shortens a longer existing invulnerability', () => {
  const p = subject();
  p.iframes = 2200;
  p.useFreeDash();
  assert.equal(p.iframes, 2200);
});

/* vc268 — 피격 경직 중에도 회피가 가능해야 한다(종전엔 state가 idle이 아니면 전부 거부). */
test('dash is allowed during hit stun but still blocked by an active dash', () => {
  const p = subject();
  p.iframes = 600; p.state = 'hurt';
  assert.equal(p.useFreeDash(), true);
  p.state = 'dash'; p.freeDashing = true;
  assert.equal(p.useFreeDash(), false);
});
test('active dash cannot stack or extend; cooldown starts at dash end, not dash start', () => {
  const p = subject(); p.useFreeDash();
  p.scene.time.now = 80;
  assert.equal(p.useFreeDash(), false); assert.equal(p.freeDashUntil, 180);
  p.scene.time.now = 180;
  assert.equal(p.useFreeDash(), false); // 이동이 끝나도 1000ms 쿨타임이 남아 있다
  p.scene.time.now = 1179;
  assert.equal(p.useFreeDash(), false);
  p.scene.time.now = 1180;
  assert.equal(p.useFreeDash(), true); assert.equal(p.freeDashUntil, 1360);
});
test('dead/attack and legacy dash are not interrupted; cancellation stops motion', () => {
  for (const state of ['dead', 'attack', 'dash']) {
    const p = subject(); p.state = state; assert.equal(p.useFreeDash(), false);
  }
  const p = subject(); p.useFreeDash(); p.stopFreeDash();
  assert.equal(p.state, 'idle'); assert.deepEqual(p.velocity, { x: 0, y: 0 });
  p.scene.time.now = 1180; // 쿨타임(대시 종료 180 + 1000) 경과
  assert.equal(p.useFreeDash(), true);
});
test('signature startup can cancel into dash without refund; other cast phases stay locked', () => {
  for (const phase of ['startup', 'release', 'recovery']) {
    const p = subject(); p.state = 'attack'; p.signatureCast = { phase };
    p.mp = 35; p.skill1Cd = 4500;
    let cancellations = 0;
    p.cancelSkillCast = () => { cancellations++; p.signatureCast = null; p.state = 'idle'; };
    assert.equal(p.useFreeDash(), phase === 'startup');
    assert.equal(cancellations, phase === 'startup' ? 1 : 0);
    assert.equal(p.mp, 35); assert.equal(p.skill1Cd, 4500);
    assert.equal(p.state, phase === 'startup' ? 'dash' : 'attack');
  }
});
test('basic attack recovery cancels into dash (CrossCode blockData.dash=0); skills stay locked', () => {
  const p = subject(); p.state = 'attack'; p.basicAttackState = true; p.basicAttackSeq = 3; p.lungeTime = 90;
  assert.equal(p.useFreeDash(), true); assert.equal(p.state, 'dash'); assert.equal(p.lungeTime, 0);
  assert.equal(p.basicAttackLive(3), false); // 캔슬된 공격의 남은 연타는 더 이상 판정하지 않는다
  const s = subject(); s.state = 'attack'; s.basicAttackState = false;
  assert.equal(s.useFreeDash(), false); assert.equal(s.state, 'attack');
  const c = subject(); c.state = 'attack'; c.basicAttackState = true; c.freeDashReadyAt = 100;
  assert.equal(c.useFreeDash(), false); assert.equal(c.state, 'attack'); // 쿨타임 중엔 공격을 버리지 않는다
});
test('a stale basic attack timer cannot act during the next attack', () => {
  const p = subject(); p.state = 'attack'; p.basicAttackState = true; p.basicAttackSeq = 4;
  assert.equal(p.basicAttackLive(4), true); assert.equal(p.basicAttackLive(3), false);
  p.basicAttackState = false; assert.equal(p.basicAttackLive(4), false);
});
test('scene dash gate and death cannot cancel a pending startup', () => {
  for (const state of ['attack', 'dead']) {
    const p = subject(); p.state = state; p.signatureCast = { phase: 'startup' };
    p.scene.canPlayerAction = () => false;
    p.cancelSkillCast = () => { throw Error('blocked action cancelled a cast'); };
    assert.equal(p.useFreeDash(), undefined); assert.equal(p.state, state);
  }
});
test('a cooling-down dash cannot discard a paid signature startup', () => {
  const p = subject(); p.state = 'attack'; p.signatureCast = { phase: 'startup' }; p.freeDashReadyAt = 100;
  p.cancelSkillCast = () => { throw Error('unavailable dash cancelled a cast'); };
  assert.equal(p.useFreeDash(), false); assert.equal(p.state, 'attack');
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
  assert.match(world, /listen\("input:dash", onDash\)/);
  assert.match(world, /unlisten\("input:dash", onDash\)/);
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
    assert.equal(p.freeDashing, false);
    p.scene.time.now = 1180; // 쿨타임 경과
    assert.equal(p.useFreeDash(), true);
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
  p.scene.time.now = 1180; // 쿨타임 경과
  assert.equal(p.useFreeDash(), true);
});
test('expired re-press flushes only the old remaining distance before starting next dash', () => {
  const p = subject(); p.scene.currentMoveVec = () => vector(1, 0); p.useFreeDash();
  p.scene.time.now = 180; assert.equal(p.useFreeDash(), false); // 쿨타임 대기
  assert.equal(p.x, 226); // 대시 종료 시점이라 잔여 이동만 먼저 반영된다
  p.scene.time.now = 1180; assert.equal(p.useFreeDash(), true); assert.equal(p.x, 226);
  p.scene.time.now = 1360; p.tickFreeDash(); assert.equal(p.x, 352);
});
test('death or external action cancels active movement without resurrection', () => {
  for (const state of ['dead', 'attack']) {
    const p = subject(); p.useFreeDash(); p.state = state; p.scene.time.now = 60;
    assert.equal(p.tickFreeDash(), false); assert.equal(p.x, 100); assert.equal(p.state, state);
    assert.equal(p.freeDashing, false);
  }
});
