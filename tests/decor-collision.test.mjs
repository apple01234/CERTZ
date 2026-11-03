import test from 'node:test';
import assert from 'node:assert/strict';
import { decorCollisionBounds, decorFootprint, isSolidDecor } from '../src/game/decorObjects.ts';

test('measured feet rotate with furniture and remain below transparent canopy', () => {
  const key = 'obj_forest_tree_pink';
  const foot = decorFootprint(65, 80, key);
  const base = decorCollisionBounds(65, 80, key);
  assert.equal(base.width, foot.width);
  assert.equal(base.y, foot.offsetY + foot.height / 2 - 40);
  const turned = decorCollisionBounds(65, 80, key, Math.PI / 2);
  assert.ok(Math.abs(turned.width - base.height) < 1e-8);
  assert.ok(Math.abs(turned.height - base.width) < 1e-8);
  assert.ok(Math.abs(turned.x + base.y) < 1e-8);
  assert.ok(Math.abs(turned.y - base.x) < 1e-8);
  const furnished = decorCollisionBounds(65, 80, key, 0, .5, .9);
  assert.ok(Math.abs(furnished.y - (base.y - 32)) < 1e-8);
});

test('solid furniture blocks feet while rugs and flame decorations stay traversable', () => {
  for (const key of ['furn_crate_big', 'furn_chair', 'furn_barrel', 'obj_dungeon_bookshelf', 'obj_dungeon_table']) assert.ok(isSolidDecor(key), key);
  for (const key of ['obj_dungeon_carpet_v', 'obj_dungeon_pentagram', 'obj_dungeon_torch', 'flower_r']) assert.ok(!isSolidDecor(key), key);
});
