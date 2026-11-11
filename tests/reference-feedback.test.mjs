import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute production methods with tiny engine doubles, including their cleanup path.
function methods(file, names) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const cls = source.statements.find(ts.isClassDeclaration);
  const selected = names.map(name => cls.members.find(m => m.name?.getText(source) === name).getText(source));
  const js = ts.transpileModule(`class Subject { ${selected.join('\n')} }; Subject`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return vm.runInNewContext(js);
}

test('shared PC/touch dash path reports only accepted dashes to tutorial', () => {
  const Subject = methods('src/game/scenes/WorldScene.ts', ['tryFreeDash']);
  const s = new Subject(); let allowed = false, committed = false, attempts = 0, taught = 0, fx = 0;
  s.freeDashInputAllowed = () => allowed;
  s.player = { useFreeDash() { attempts++; return committed; } };
  s.tut = { notify(event) { assert.equal(event, 'dash'); taught++; } };
  s.freeDashFx = () => fx++;
  s.tryFreeDash(); assert.equal(attempts, 0);
  allowed = true; s.tryFreeDash(); assert.equal(taught, 0); assert.equal(fx, 0);
  committed = true; s.tryFreeDash(); assert.equal(taught, 1); assert.equal(fx, 1);
  s.tut = null; s.tryFreeDash(); assert.equal(fx, 2); // Completed tutorials remain unaffected.
});

test('boss recovery cue tracks the real window, reuses one label and clears on disposal', () => {
  const Subject = methods('src/game/entities/Boss.ts', ['updateRecoveryCue', 'destroyPool']);
  let created = 0, destroyed = 0;
  const label = {};
  for (const name of ['setVisible', 'setText', 'setDepth']) label[name] = function(v) { this[name.slice(3)] = v; return this; };
  label.setOrigin = () => label;
  label.setPosition = (x,y) => { label.position = [x,y]; return label; };
  label.destroy = () => destroyed++;
  const b = new Subject();
  Object.assign(b, { scene: { add: { text() { created++; return label; } } }, alive: true, mode: 'idle', modeTimer: 1500,
    x: 300, y: 200, depth: 20, orbPool: [], teleRings: [], zoneRings: [] });
  b.updateRecoveryCue(); assert.equal(created, 0);
  b.mode = 'recover'; b.updateRecoveryCue(); assert.equal(created, 1);
  assert.equal(label.Text, '공격 기회 · 피해 +15% · 1.5초'); assert.equal(label.Visible, true);
  assert.deepEqual(label.position, [300,126]); assert.equal(label.Depth, 21);
  b.x = 350; b.modeTimer = 401; b.updateRecoveryCue(); assert.equal(label.Text.endsWith('0.5초'), true);
  assert.deepEqual(label.position, [350,126]); assert.equal(created, 1);
  for (const mode of ['counterTele', 'staggered', 'dead', 'idle']) {
    b.mode = mode; b.updateRecoveryCue(); assert.equal(label.Visible, false);
  }
  b.mode = 'recover'; b.modeTimer = 0; b.updateRecoveryCue(); assert.equal(label.Visible, false);
  b.modeTimer = 1000; b.alive = false; b.updateRecoveryCue(); assert.equal(label.Visible, false);
  b.alive = true; b.updateRecoveryCue(); assert.equal(label.Visible, true); assert.equal(created, 1);
  b.destroyPool(); assert.equal(destroyed, 1); assert.equal(b.recoveryLabel, null);
  b.destroyPool(); assert.equal(destroyed, 1);
});

test('engaged enemies show full HP before a hit; warning color follows real attack readiness', () => {
  const Subject = methods('src/game/entities/Enemy.ts', ['syncHpBar']);
  let created = 0;
  const rectangle = () => {
    created++;
    return {
      visible: true, fillColor: 0xe84a5a,
      setDepth() { return this; }, setAlpha() { return this; },
      setPosition(x,y) { this.x=x; this.y=y; return this; },
      setVisible(v) { this.visible=v; return this; }, setFillStyle(v) { this.fillColor=v; return this; },
    };
  };
  const e = new Subject();
  Object.assign(e, { scene: { add: { rectangle }, time: { now: 1000 }, isPrologueSafe: false },
    ai: { current: 'wander' }, hp: 100, maxHp: 100, alive: true, active: true, visible: true,
    dummy: false, flee: false, morale: 'fight', stunUntil: 0, x: 80, y: 100, displayHeight: 512, hitH: 32,
    hpBar: null, hpBarBg: null, shadow: null, tutorialPause: null });
  e.syncHpBar(); assert.equal(created, 0); // Idle populations keep lazy allocation.
  e.ai.current = 'chase'; e.syncHpBar(); assert.equal(created, 2); assert.equal(e.hpBar.visible, true);
  assert.equal(e.hpBar.width, 24); assert.equal(e.hpBar.y, 76);
  e.ai.current = 'windup'; e.syncHpBar(); assert.equal(e.hpBar.fillColor, 0xffb45c);
  e.stunUntil = 1200; e.syncHpBar(); assert.equal(e.hpBar.fillColor, 0xe84a5a); // Interrupted warning.
  e.stunUntil = 0; e.ai.current = 'chargeDash'; e.syncHpBar(); assert.equal(e.hpBar.fillColor, 0xffb45c);
  e.ai.current = 'cooldown'; e.syncHpBar(); assert.equal(e.hpBar.visible, true); assert.equal(e.hpBar.fillColor, 0xe84a5a);
  e.ai.current = 'wander'; e.syncHpBar(); assert.equal(e.hpBar.visible, false);
  e.hp = 50; e.syncHpBar(); assert.equal(e.hpBar.visible, true); assert.equal(e.hpBar.width, 12);
  e.hp = 100; e.ai.current = 'windup'; e.scene.isPrologueSafe = true; e.syncHpBar(); assert.equal(e.hpBar.visible, false);
  e.scene.isPrologueSafe = false;
  for (const field of ['dummy', 'flee']) { e[field] = true; e.syncHpBar(); assert.equal(e.hpBar.visible, false); e[field] = false; }
  for (const field of ['alive', 'active', 'visible']) { e[field] = false; e.syncHpBar(); assert.equal(e.hpBar.visible, false); e[field] = true; }
  e.tutorialPause = {}; e.syncHpBar(); assert.equal(e.hpBar.visible, false);
  e.tutorialPause = null; e.syncHpBar(); assert.equal(e.hpBar.visible, true); assert.equal(created, 2);
});
