import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import {pixelFxKey} from '../src/game/assetSelection.ts';import{ADMITTED_PIXELFX}from'../src/game/fx/pixelFxSheets.ts';
function rig(){
 const loaded=new Set(['sword-slash']),demands=[],sprites=[],scene={textures:{exists:key=>loaded.has(key)},time:{now:200}};
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('src/game/fx/PixelFxManager.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(`(function(require,module,exports){${code}})`,{navigator:{userAgent:'Desktop'},console})(id=>{
  if(id==='phaser')return{Utils:{Array:{GetRandom:xs=>xs[0]}}};
  if(id.endsWith('/assetSelection'))return{pixelFxKey};
  if(id==='./pixelFxSheets')return{ADMITTED_PIXELFX};
  if(id==='./pixelfxBridge')return{ensureFxSheet:async(_scene,key)=>{demands.push(key);return false;},playFx:(_scene,key,_x,_y,opts)=>{const s={key,width:360,height:300,scaleX:opts.scale??1,setScale(v){this.scaleX=v;return this;},destroy(){}};sprites.push(s);return s;}};
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
