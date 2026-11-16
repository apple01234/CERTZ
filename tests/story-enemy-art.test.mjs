import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { storyEnemyRole, STORY_ENEMY_ROLES, STORY_ENEMY_TEXTURES } from '../src/game/storyEnemyVisuals.ts';
import { preloadStoryEnemies, registerStoryEnemies } from '../src/game/fx/storyEnemyAssets.ts';
import { isWorldAsset } from '../src/game/assetSelection.ts';
import { BOSS_DEFS } from '../src/game/stages.ts';
import { execFileSync } from 'node:child_process';
import { pythonBin, pythonEnv } from './python.mjs';

test('story encounters bind the correct faction without changing stable enemy IDs', () => {
  for (const [stage, key, role] of [
    ['lilacworld2x2', 'x2_frog', 'thought'], ['lilacworld3x2', 'x2_frog', 'dokkaebi'],
    ['lilacworld5x3', 'x3_chort', 'deckhand'], ['lilacworld10x3', 'wraith', 'thought'],
    ['dlcstargate8', 'wraith', 'virus'], ['dlcprisma7', 'runegolem', 'jadeclone'],
    ['dlcprisma7', 'minion', 'robot'], ['dlcreverse3', 'minion', 'drone'], ['dlcreverse3', 'golem', 'robot'],
  ]) assert.equal(storyEnemyRole(stage, key), role);
  for (const stage of ['lilacworld1x1', 'lilacworld1x2', 'lilacworld4x4', 'lilacworld15x1', 'snorika5', 'park', 'tower', 'dlcmech1']) {
    assert.equal(storyEnemyRole(stage, 'golem'), null, `${stage}: tutorial, peace and optional content keep their art`);
  }
});

test('atlas registration waits for each regional sheet and never duplicates animations', () => {
  const loads = [], textures = new Set(), animations = new Map();
  const scene = {
    load: { atlas: (...args) => loads.push(args) }, textures: { exists: key => textures.has(key) },
    anims: { exists: key => animations.has(key), create: config => { assert.ok(!animations.has(config.key)); animations.set(config.key, config); } },
  };
  preloadStoryEnemies(scene);
  assert.equal(loads.length, Object.keys(STORY_ENEMY_ROLES).length);
  registerStoryEnemies(scene); assert.equal(animations.size, 0);
  textures.add('storymob_drone'); registerStoryEnemies(scene); registerStoryEnemies(scene);
  assert.equal(animations.size, 3);
  for (const [mode, count] of [['idle', 2], ['run', 4], ['attack', 2]]) {
    const animation = animations.get(`storymob_drone-${mode}`);
    assert.equal(animation.frames.length, count);
    const atlas = JSON.parse(readFileSync('public/assets/story-enemies/drone.json', 'utf8'));
    for (const { frame } of animation.frames) assert.ok(atlas.frames[frame]);
  }
  for (const [texture, png, json] of loads) {
    assert.ok(existsSync('public/assets/' + png)); assert.ok(existsSync('public/assets/' + json));
    const metadata = JSON.parse(readFileSync('public/assets/' + json, 'utf8'));
    assert.equal(Object.keys(metadata.frames).length, 8, texture);
  }
});

test('exact atlas keys stay regional rather than joining the shared initial download', () => {
  const scope = { body: 'hero', bodies: ['hero'], monsters: ['storymob_drone'], allMonsters: STORY_ENEMY_TEXTURES };
  for (const key of STORY_ENEMY_TEXTURES) assert.equal(isWorldAsset({ type: 'atlas', key, urls: [] }, scope), key === 'storymob_drone');
  assert.equal(isWorldAsset({ type: 'atlas', key: 'story_dean', urls: [] }, scope), true);
});

test('human ice king and thought-form boss use authored art; ice battle stats and patterns survive', () => {
  assert.equal(BOSS_DEFS.snorikaking.tex, 'story_snorikaking');
  assert.equal(BOSS_DEFS.shadow.tex, 'story_thought');
  assert.equal(BOSS_DEFS.snorikaking.hp, 28000);
  assert.equal(BOSS_DEFS.snorikaking.atk, 50);
  assert.equal(BOSS_DEFS.snorikaking.sig, 'frostnova');
  assert.deepEqual(BOSS_DEFS.snorikaking.patterns.p3, ['frostnova', 'zones', 'beam']);
});

test('new combat sheets have transparent padding, full poses and changing motion frames', () => {
  const script = `
import json, hashlib
from pathlib import Path
from PIL import Image
count=0
for directory, ids, size, baseline in [('story-enemies',['thought','dokkaebi','deckhand','virus','drone','robot','jadeclone'],64,62),('story-bosses',['thought','jade','jadeclone','snorikaking','dean'],256,238)]:
 for cid in ids:
  base=Path('public/assets')/directory
  image=Image.open(base/(cid+'.png'))
  atlas=json.loads((base/(cid+'.json')).read_text())
  assert image.mode=='RGBA' and len(atlas['meta']['sourceSHA256'])==64,cid
  hashes={}
  for name, data in atlas['frames'].items():
   box=data['frame']; assert box['w']==size and box['h']==size,(cid,name)
   cell=image.crop((box['x'],box['y'],box['x']+size,box['y']+size))
   alpha=cell.getchannel('A'); bounds=alpha.getbbox()
   assert bounds and bounds[0]>0 and bounds[1]>0 and bounds[2]<size and bounds[3]==baseline,(cid,name,bounds)
   assert set(alpha.getdata())=={0,255},(cid,name,'binary alpha')
   hashes[name]=hashlib.sha256(cell.tobytes()).hexdigest();count+=1
  for motion in {name.split('-')[0] for name in hashes}:
   assert len({value for name,value in hashes.items() if name.startswith(motion+'-')})>=2,(cid,motion,'static')
assert count==136,count
print('136 checked frames')
`;
  assert.match(execFileSync(pythonBin(), ['-c', script], { env: pythonEnv, encoding: 'utf8' }), /136 checked frames/);
});
