import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import {pixelFxKey,STARTER_PIXELFX} from '../src/game/assetSelection.ts';import{ADMITTED_PIXELFX}from'../src/game/fx/pixelFxSheets.ts';
function rig(){
 const loaded=new Set(['sword-slash']),demands=[],sprites=[],scene={textures:{exists:key=>loaded.has(key)},time:{now:200}};
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('src/game/fx/PixelFxManager.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(`(function(require,module,exports){${code}})`,{navigator:{userAgent:'Desktop'},console})(id=>{
  if(id==='phaser')return{Utils:{Array:{GetRandom:xs=>xs[0]}}};
  if(id.endsWith('/assetSelection'))return{pixelFxKey};
  if(id==='./pixelFxSheets')return{ADMITTED_PIXELFX};
  if(id==='./pixelfxBridge')return{ensureFxSheet:async(_scene,key)=>{demands.push(key);return false;},playFx:(_scene,key,_x,_y,opts)=>{const s={key,width:360,height:300,scaleX:opts.scale??1,anims:{setRepeat(n){this.repeat=n;}},setScale(v){this.scaleX=v;return this;},complete:opts.onComplete,destroy(){this.destroyed=true;}};sprites.push(s);return s;}};
  throw Error(id);
 },module,module.exports);
 return{manager:new module.exports.PixelFxManager(scene),loaded,demands,sprites,scene};
}
test('existing event IDs resolve admitted texture names and ordinary hits retain a small visual budget',()=>{
 const r=rig();r.manager.play('hit.slash',1,2,{scale:.7});
 assert.equal(r.sprites[0].key,'sword-slash');assert.ok(r.sprites[0].width*r.sprites[0].scaleX<=44);
 assert.deepEqual(r.demands,['claw-swipe','spin-slash']);
 r.scene.time.now+=20;r.manager.play('hit.slash',1,2);assert.equal(r.sprites.length,1,'same-event throttle survives deferred loading');
});
test('on-demand loading does not reintroduce unadmitted giant FX into a boss encounter',()=>{
 const r=rig();r.manager.boss('boss.intro',1,2);
 assert.deepEqual(r.demands,['sunburst']);assert.ok(!r.demands.includes('nuke'));
 r.loaded.add('sunburst');r.scene.time.now+=200;r.manager.boss('boss.intro',1,2,{scale:4});
 assert.equal(r.sprites[0].key,'sunburst');assert.ok(r.sprites[0].width*r.sprites[0].scaleX<=220+1e-6);
});
test('every first boss event has a ready representative before optional downloads finish',()=>{
 const r=rig();r.scene.time.now=0;for(const k of STARTER_PIXELFX)r.loaded.add(k);
 for(const ev of ['intro','phase','pattern','charge','enrage','death','summon','telegraph']){
  r.scene.time.now+=200;const before=r.sprites.length;r.manager.boss('boss.'+ev,4,5);
  assert.equal(r.sprites.length,before+1,ev+' must render on its first call');
  assert.ok(r.sprites.at(-1).width*r.sprites.at(-1).scaleX<=220+1e-6);
  assert.equal(r.sprites.at(-1).anims.repeat,0,'looping sheets play once in this burst manager');
 }
 assert.ok(r.demands.every(k=>ADMITTED_PIXELFX.has(k)));
 for(const sp of r.sprites)sp.complete();assert.equal(r.manager.liveCount,0);assert.ok(r.sprites.every(s=>s.destroyed));
});
test('class FX cleanup preserves shared starter art and downloads only the selected class',()=>{
 const removed=[],demanded=[],module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('src/game/fx/ultPixelFx.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(`(function(require,module,exports){${code}})`,{})(id=>{
  if(id==='phaser')return{};if(id.endsWith('/assetSelection'))return{STARTER_PIXELFX};if(id==='../classes')return{};
  if(id==='./pixelfxBridge')return{unloadFxSheet:(_s,key)=>removed.push(key),ensureFxSheet:(_s,key)=>{demanded.push(key);return Promise.resolve(true);}};throw Error(id);
 },module,module.exports);
 const {prefetchUltFx}=module.exports;prefetchUltFx({},null);assert.ok(removed.length>0);assert.deepEqual(demanded,[]);
 prefetchUltFx({},'warbringer');assert.equal(demanded.length,4);prefetchUltFx({},'crusader');assert.equal(demanded.length,8);
 assert.ok(removed.every(key=>!STARTER_PIXELFX.includes(key)),'first boss and native weapon effects must survive class cleanup');
});
