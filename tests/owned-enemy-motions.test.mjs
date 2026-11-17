import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{createHash}from'node:crypto';
import{OWNED_ENEMY_MOTIONS,preloadOwnedEnemyFrames,registerOwnedEnemyAnimations}from'../src/game/fx/ownedEnemyMotions.ts';
test('owned monster motions use existing distinct attack art and complete native hit/death strips',()=>{
 const loads=[],textures=new Set(),anims=new Map(),scene={load:{image:(key,url)=>{assert.ok(fs.existsSync('public/assets/'+url));loads.push(key);textures.add(key);}},textures:{exists:key=>textures.has(key)},anims:{exists:key=>anims.has(key),create:config=>anims.set(config.key,config)}};
 preloadOwnedEnemyFrames(scene);registerOwnedEnemyAnimations(scene);
 assert.equal(anims.has('ll_goblin-atk'),false,'the full attack waits for its initial frame');
 for(const animation of anims.values())assert.ok(animation.frames.every(f=>textures.has(f.key)),'partial region loads may only register complete motions');
 for(const key of Object.keys(OWNED_ENEMY_MOTIONS)){
  for(const motion of ['idle','run','atk','hit','death'])for(let i=0;i<(motion==='atk'?8:motion==='run'?OWNED_ENEMY_MOTIONS[key].run:4);i++)textures.add(`${key}_${motion}${i}`);
  const hashes=Array.from({length:8},(_,i)=>createHash('sha256').update(fs.readFileSync(`public/assets/${key}_atk${i}.webp`)).digest('hex'));
  assert.ok(new Set(hashes).size>=6,'native strips include genuine unique poses, with their authored holds');
 }
 registerOwnedEnemyAnimations(scene);registerOwnedEnemyAnimations(scene);assert.equal(anims.size,28);
 for(const key of Object.keys(OWNED_ENEMY_MOTIONS)){
  assert.equal(anims.get(key+'-atk').frames.length,8);assert.equal(anims.get(key+'-hit').frames.length,4);assert.equal(anims.get(key+'-death').frames.length,4);
  const attack=[...anims.get(key+'-windup').frames,...anims.get(key+'-release').frames];
  assert.deepEqual(attack.map(f=>f.key),Array.from({length:8},(_,i)=>`${key}_atk${i}`));
  assert.equal(anims.get(key+'-release').repeat,0);
 }
});
