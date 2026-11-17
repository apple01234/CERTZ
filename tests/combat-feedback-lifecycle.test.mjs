import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function method(file,cls,name){
 const tree=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),99,true);
 return tree.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text===cls).members.find(n=>n.name?.getText(tree)===name).getText(tree);
}
function impactRig(){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('src/game/fx/ImpactFX.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:99}}).outputText;
 vm.runInNewContext(`(function(require,module,exports){${code}})`,{})(()=>({}),module,module.exports);
 let pauses=0,resumes=0;const pending=[];
 const scene={time:{now:0,delayedCall(ms,fn){pending.push({at:scene.time.now+ms,fn});}},scene:{isActive:()=>true},physics:{world:{pause(){pauses++;},resume(){resumes++;}}}};
 const fx=new module.exports.ImpactFX(scene);
 const advance=to=>{for(;;){pending.sort((a,b)=>a.at-b.at);if(!pending.length||pending[0].at>to)break;const next=pending.shift();scene.time.now=next.at;next.fn();}scene.time.now=to;};
 return{fx,scene,advance,counts:()=>({pauses,resumes})};
}
test('real ImpactFX bounds a dense combo to 120ms and leaves 40ms for movement',()=>{
 const r=impactRig();r.fx.hitStop(65);
 for(const t of [30,60,90]){r.advance(t);r.fx.hitStop(65);}
 assert.equal(r.fx.hitStopEndsAt,120);r.advance(120);assert.deepEqual(r.counts(),{pauses:1,resumes:1});
 for(const t of [121,140,159]){r.advance(t);r.fx.hitStop(65);}
 assert.deepEqual(r.counts(),{pauses:1,resumes:1});r.advance(160);r.fx.hitStop(35);r.advance(195);
 assert.deepEqual(r.counts(),{pauses:2,resumes:2});
});
test('real ImpactFX never resumes physics owned by dialogue or a transition',()=>{
 for(const owner of ['dialoguing','transitioning']){const r=impactRig();r.fx.hitStop(35);r.scene[owner]=true;r.advance(35);assert.equal(r.counts().resumes,0);}
});
test('real remote receiver delivers first-frame cast and finale independently, with no damage calls',()=>{
 const body=method('src/game/scenes/WorldScene.ts','WorldScene','playRemoteAction');
 const finals=[],casts=[];
 const Subject=new Function('net','playUltFx','familyOf','classDef','Phaser',ts.transpile('class Subject{'+body+'};return Subject;'))(
  {netId:()=> 'self'},(_scene,cls,slot,phase,x,y,flip)=>finals.push({cls,slot,phase,x,y,flip}),()=> 'warrior',()=>({color:'#ffffff'}),{Math:{Vector2:class{}}});
 const s=new Subject();Object.assign(s,{time:{now:0},lastRemoteActAt:-Infinity,lastRemoteActById:new Map(),remotes:new Map(),playRemoteSkillFx:kind=>casts.push(kind)});
 const packet={id:'other',kind:'s5',cls:'berserker',x:12,y:34,flip:false};
 s.playRemoteAction(packet);assert.deepEqual(casts,['s5'],'a packet at scene time zero must be accepted');
 s.time.now=1;s.playRemoteAction({...packet,kind:'s5f'});s.playRemoteAction({...packet,kind:'s5f'});
 assert.equal(finals.length,1);assert.equal(finals[0].phase,'finale');assert.equal(finals[0].slot,1);
 s.playRemoteAction({...packet,kind:'s5bf'});assert.equal(finals[1].slot,2);
 s.playRemoteAction({...packet,id:'self',kind:'s5f'});assert.equal(finals.length,2);
 assert.equal(casts.length,1,'finale must never restart a cast');
});
