import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {StartupBundle} from '../src/game/startupBundle.ts';
import {assetUrl,isWorldAsset,STARTER_PIXELFX,pixelFxKey} from '../src/game/assetSelection.ts';
import {ADMITTED_PIXELFX} from '../src/game/fx/pixelFxSheets.ts';
const manifest=JSON.parse(readFileSync('public/assets/startup-bundle/manifest.json','utf8'));
test('concurrent image requests share bounded packages, preserve bytes and release decoded memory',async()=>{
 const original=globalThis.fetch,requests=new Map();
 for(const p of manifest.packages){assert.ok(p.decodedBytes<=2*1024*1024);assert.equal(createHash('sha256').update(readFileSync('public/'+p.url)).digest('hex'),p.sha256);}
 assert.deepEqual([...new Set(manifest.packages.map(p=>p.group))],['essential','effects']);
 globalThis.fetch=async url=>{requests.set(url,(requests.get(url)??0)+1);return new Response(readFileSync('public/'+url));};
 try{
  const bundle=new StartupBundle(),entries=Object.keys(manifest.images).filter((_,i)=>i%50===0);
  const urls=await Promise.all(entries.map(path=>bundle.image(path)));
  assert.ok(requests.size>1);assert.ok([...requests.values()].every(n=>n===1));
  assert.ok(bundle.retainedBytes>0);
  for(let i=0;i<urls.length;i++){
   assert.ok(urls[i]?.startsWith('blob:'));
   assert.deepEqual(Buffer.from(await(await original(urls[i])).arrayBuffer()),readFileSync('public/'+entries[i]));
   URL.revokeObjectURL(urls[i]);
  }
  bundle.release();assert.equal(bundle.retainedBytes,0);
 }finally{globalThis.fetch=original;}
});
test('a stalled package is aborted within a deadline and falls back; release aborts in-flight work',async()=>{
 const original=globalThis.fetch,timer=globalThis.setTimeout;let aborted=false;
 try{
  globalThis.setTimeout=(fn,ms)=>timer(fn,Math.min(ms,20));
  globalThis.fetch=(_url,{signal})=>new Promise((_ok,fail)=>signal.addEventListener('abort',()=>{aborted=true;fail(new Error('aborted'));},{once:true}));
  const path=Object.keys(manifest.images)[0],bundle=new StartupBundle();
  assert.equal(await bundle.image(path),null);assert.equal(aborted,true);assert.equal(bundle.retainedBytes,0);
  aborted=false;const pending=new StartupBundle(),job=pending.image(path);pending.release();
  assert.equal(await job,null);assert.equal(aborted,true);assert.equal(pending.retainedBytes,0);
 }finally{globalThis.fetch=original;globalThis.setTimeout=timer;}
});
test('a load gate releases each package as soon as its requested images have been copied',async()=>{
 const original=globalThis.fetch;let requests=0;
 globalThis.fetch=async url=>{requests++;return new Response(readFileSync('public/'+url));};
 try{
  const paths=Object.keys(manifest.images).filter(key=>manifest.images[key].package===0).slice(0,2),bundle=new StartupBundle();
  bundle.begin(paths);const a=await bundle.image(paths[0]);assert.ok(bundle.retainedBytes>0);
  const b=await bundle.image(paths[1]);assert.equal(bundle.retainedBytes,0);assert.equal(requests,1);
  assert.deepEqual(Buffer.from(await(await original(a)).arrayBuffer()),readFileSync('public/'+paths[0]));
  assert.deepEqual(Buffer.from(await(await original(b)).arrayBuffer()),readFileSync('public/'+paths[1]));
  URL.revokeObjectURL(a);URL.revokeObjectURL(b);
  assert.equal(await bundle.image(paths[0]),null,'retries use individual files instead of redownloading a consumed package');
  bundle.release();assert.equal(bundle.retainedBytes,0);
 }finally{globalThis.fetch=original;}
});
test('missing, unsupported or failed packages fall back without deleting any original asset',async()=>{
 const original=globalThis.fetch,decompress=globalThis.DecompressionStream,path=Object.keys(manifest.images)[0];let requests=0;
 try{
  globalThis.DecompressionStream=undefined;
  globalThis.fetch=async()=>{requests++;return new Response('',{status:503});};
  assert.equal(await new StartupBundle().image(path),null);assert.equal(requests,0);
  globalThis.DecompressionStream=decompress;
  const bundle=new StartupBundle();assert.equal(await bundle.image(path),null);assert.equal(await bundle.image(path),null);assert.equal(requests,1);
  assert.equal(await bundle.image('assets/unknown.png'),null);assert.ok(readFileSync('public/'+path).length);
 }finally{globalThis.fetch=original;globalThis.DecompressionStream=decompress;}
});
test('starter effects stay ready while unrelated boss art and expensive variations are demanded later',()=>{
 const scope={body:'hero',bodies:['hero'],monsters:[],allMonsters:[],demandFx:true,presentation:['cast_haru','cast_lilac']};
 const def=(key,url)=>({type:'atlas',key,urls:[url]});
 for(const key of STARTER_PIXELFX)assert.equal(isWorldAsset(def(key,'assets/fx/'+key+'.png'),scope),true);
 assert.equal(isWorldAsset(def('big-explosion','assets/fx/big-explosion.json'),scope),false);
 assert.equal(isWorldAsset(def('big-explosion__meta','assets/fx/big-explosion.json'),scope),false);
 assert.equal(isWorldAsset(def('story_jade','assets/story-bosses/jade.png'),scope),false);
 assert.equal(isWorldAsset(def('cast_haru','assets/cutscene-cast/haru.png'),scope),true);
 assert.equal(pixelFxKey('melee/sword-slash'),'sword-slash');
 const remap=assetUrl('assets/fx/','big-explosion.png');assert.match(remap,/optimized-startup/);
 assert.equal(assetUrl('', '/'+remap),'/'+remap);
});

test('replacement combat textures load with transparency and boss sheets keep their frames', async () => {
  const source = readFileSync('src/game/assetSelection.ts', 'utf8');
  const aliases = source.slice(source.indexOf('const transparentFxUrls'), source.indexOf('export function assetUrl'));
  const replacements = [...aliases.matchAll(/\["(assets\/[^"]+)", "(assets\/[^"]+)"\]/g)];
  assert.ok(replacements.length > 0);
  for (const [, original] of replacements) {
    const resolved = assetUrl('', original);
    assert.notEqual(resolved, original);
    const image = sharp('public/' + resolved);
    assert.equal((await image.metadata()).hasAlpha, true, resolved);
    const alpha = (await image.stats()).channels[3];
    assert.equal(alpha.min, 0, resolved);
    assert.ok(alpha.max > 64, resolved);
    const { data, info: { width, height } } = await image.raw().toBuffer({ resolveWithObject: true });
    const corners = [0, width - 1, width * (height - 1), width * height - 1];
    assert.ok(corners.every(i => data[4 * i + 3] === 0), resolved);
  }
  for (const key of ['impact-frame', 'pixel-dissolve']) assert.equal(ADMITTED_PIXELFX.has(key), false);

  const scope = { body: 'hero', bodies: [], monsters: [], allMonsters: [], demandFx: true };
  const boot = readFileSync('src/game/scenes/BootScene.ts', 'utf8');
  for (const [key, sourceKey] of [
    ['vx_bolt', 'spark-arc'], ['vx_elec', 'zap-hit'], ['vx_expcore', 'plasma-explosion'], ['vx_fire', 'fireball'],
  ]) {
    const url = assetUrl('assets/', key + '.webp');
    assert.equal(isWorldAsset({ type: 'spritesheet', key, urls: [url] }, scope), true);
    const { frameSize, frames } = JSON.parse(readFileSync(`public/assets/fx/${sourceKey}.json`)).meta.pixelfx;
    assert.ok(boot.includes(`["${key}", ${frameSize.join(', ')}]`), key);
    assert.ok(boot.includes(`, "${key}", 0, `) && new RegExp(`"${key}", 0, \\d+, \\d+, ${frames}\\]`).test(boot), key);
  }
});
