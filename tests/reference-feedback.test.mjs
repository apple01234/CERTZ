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
