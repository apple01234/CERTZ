import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {StartupBundle} from '../src/game/startupBundle.ts';
import {assetUrl,isWorldAsset,STARTER_PIXELFX,pixelFxKey} from '../src/game/assetSelection.ts';
const manifest=JSON.parse(readFileSync('public/assets/startup-bundle/manifest.json','utf8'));
test('concurrent image requests share one package and preserve their original bytes',async()=>{
 const original=globalThis.fetch;let requests=0;
 const packed=readFileSync('public/'+manifest.url);
 assert.equal(createHash('sha256').update(packed).digest('hex'),manifest.sha256);
 globalThis.fetch=async url=>{assert.equal(url,manifest.url);requests++;return new Response(packed);};
 try{
  const bundle=new StartupBundle(),entries=Object.keys(manifest.images).filter((_,i)=>i%50===0);
  const urls=await Promise.all(entries.map(path=>bundle.image(path)));
  assert.equal(requests,1);
  for(let i=0;i<urls.length;i++){
   assert.ok(urls[i]?.startsWith('blob:'));
   assert.deepEqual(Buffer.from(await(await original(urls[i])).arrayBuffer()),readFileSync('public/'+entries[i]));
   URL.revokeObjectURL(urls[i]);
  }
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
