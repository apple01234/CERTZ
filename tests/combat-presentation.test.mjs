import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { UltimateSequence } from '../src/game/combat/ultimateSequence.ts';

function clock() {
  let now = 0;
  const timers = [];
  return { get now() { return now; }, delayedCall(ms, callback) { const event={at:now+ms, callback}; timers.push(event); return event; },
    flush() { while(timers.length) { timers.sort((a,b)=>a.at-b.at); const e=timers.shift(); now=e.at; e.callback(); } } };
}
test('ultimate finale waits for nested impacts and leaves movement state alone', () => {
  const time=clock(), hits=[], actor={state:'idle'};
  const sequence=new UltimateSequence(time,()=>actor.state!=='dead');
  sequence.after(100,()=>{hits.push(time.now); sequence.after(300,()=>hits.push(time.now));});
  sequence.after(200,()=>hits.push(time.now));
  sequence.complete(()=>hits.push(['finale',time.now,sequence.phase]));
  assert.equal(sequence.phase,'startup'); time.flush();
  assert.deepEqual(hits,[100,200,400,['finale',400,'recovery']]);
  assert.equal(sequence.phase,'idle'); assert.equal(actor.state,'idle');
});
test('death cancels deferred ultimate hits and the finale', () => {
  const time=clock(); let alive=true, hits=0;
  const sequence=new UltimateSequence(time,()=>alive);
  sequence.after(100,()=>hits++); sequence.after(300,()=>hits++);
  sequence.complete(()=>hits++); time.delayedCall(150,()=>{alive=false;}); time.flush();
  assert.equal(hits,1); assert.equal(sequence.phase,'idle');
});

let source=stripTypeScriptTypes(readFileSync(new URL('../src/game/fx/DissolveFX.ts',import.meta.url),'utf8'))
  .replace('import Phaser from "phaser";', 'const Phaser={WEBGL:2,Display:{Color:{IntegerToColor:()=>({red:255,green:180,blue:90})}}};').replace(/export /g,'');
const fx=vm.runInNewContext(source+';({spawnDissolve,activeDissolveCount});');
function dissolveScene(frame) {
  const uniforms={}, shaders=[], tweens=[];
  const texture={has:name=>name==='7',get:()=>frame};
  const scene={game:{renderer:{type:2}},textures:{exists:()=>true,get:()=>texture},
    add:{shader(config,x,y,w,h,textures){
      const events={}; const obj={config,x,y,w,h,textures,
        setTextureCoordinatesFromFrame(f){this.frame=f;},setOrigin(){},setDepth(){},setScale(x,y){this.sx=x;this.sy=y;},setPosition(x,y){this.x=x;this.y=y;},
        setUniform(k,v){uniforms[k]=v;}, once(k,fn){events[k]=fn;},destroy(){events.destroy?.();}};
      shaders.push(obj); config.setupUniforms((k,v)=>{uniforms[k]=v;}); return obj;
    }},tweens:{add:t=>tweens.push(t)}};
  return {scene,shaders,uniforms,tweens};
}
test('death shader binds its own samplers and the current atlas frame at native size', () => {
  const frame={width:32,height:48,realWidth:64,realHeight:80,x:8,y:20,rotated:false,sourceIndex:0,u0:.25,v0:.5,u1:.375,v1:.75};
  const {scene,shaders,uniforms}=dissolveScene(frame);
  const handle=fx.spawnDissolve(scene,'enemy-atlas',100,200,{frame:7,scale:2,scaleY:3,flipX:true});
  assert.ok(handle); const obj=shaders[0];
  assert.deepEqual(Array.from(obj.textures),['enemy-atlas','vc214_dissolve_noise']);
  assert.equal(uniforms.uTex,0); assert.equal(uniforms.uNoise,1);
  assert.equal(obj.frame,frame); assert.equal(obj.w,32); assert.equal(obj.h,48);
  assert.equal(obj.sx,-2); assert.equal(obj.sy,3); assert.equal(obj.x,116); assert.equal(obj.y,212);
  handle.setAmount(.6); obj.config.setupUniforms((k,v)=>{uniforms[k]=v;});
  assert.equal(uniforms.uAmount,.6,'per-render setup must preserve the tween progress');
  assert.equal(fx.activeDissolveCount(),1); obj.destroy(); handle.destroy(); assert.equal(fx.activeDissolveCount(),0);
  assert.equal(fx.spawnDissolve(scene,'enemy-atlas',0,0,{frame:'missing'}),null,'never fall back to full sheet');
});
test('rotated and multi-source death atlases safely keep the ordinary death burst',()=>{
  for (const extra of [{rotated:true,sourceIndex:0},{rotated:false,sourceIndex:1}]) {
    const {scene,shaders}=dissolveScene(extra);
    assert.equal(fx.spawnDissolve(scene,'atlas',0,0,{frame:7}),null); assert.equal(shaders.length,0);
  }
});
