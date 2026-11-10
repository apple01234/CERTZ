import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TUTORIAL_STEPS } from '../src/game/tutorialFlow.ts';
const src = fs.readFileSync('src/game/Tutorial.ts', 'utf8');
test('one short current objective instead of an upfront text dump', () => {
  assert.ok(TUTORIAL_STEPS.every(s => s.desc.length <= 45));
  assert.equal(new Set(TUTORIAL_STEPS.map(s => s.id)).size, TUTORIAL_STEPS.length);
  assert.ok((src.match(/showBanner\(/g) ?? []).length <= 2);
  assert.match(src, /this\.tDesc.setText\(st.desc\)/);
});
test('practice key badges use the active mapping; no forced settings/potion lessons', () => {
  assert.match(src, /keyLabel\(loadKeyMap\(\)\[action\]\)/);
  for (const id of ['shader', 'contrast', 'pot']) assert.equal(TUTORIAL_STEPS.some(s => s.id === id), false);
  assert.match(src, /\$\{this.stepIdx \+ 1\}\/\$\{STEPS.length\}/);
});
