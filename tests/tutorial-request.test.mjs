import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source=readFileSync('src/game/scenes/WorldScene.ts','utf8'),ast=ts.createSourceFile('WorldScene.ts',source,ts.ScriptTarget.Latest,true);
const cls=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='WorldScene');
const method=cls.members.find(n=>n.name?.getText(ast)==='openFieldNpcRequest').getText(ast);
function setup(){
 const bus=new EventEmitter(),audio={sfx:{questAccept(){},reward(){}}},ENEMIES={x2_rat:{name:'궁전 뒷쥐'}};
 const Subject=new Function('EventBus','audio','ENEMIES','DIALOGUES','Phaser',ts.transpile(`class Subject { ${method} } return Subject;`))(bus,audio,ENEMIES,{},{});
 const saves=[],s=Object.assign(new Subject(),{events:new EventEmitter(),fieldReq:null,fieldReqBonus:0,tutStep:9,tut:{currentId:'accept',notify(){}},stageDef:{enemies:[]},player:{lv:1,gold:0,exp:0,addGold(n){this.gold+=n},gainExp(n){this.exp+=n}},
  showDialogueRaw(){},showDialogue(){},refreshFieldReqLabel(){},showBanner(){},emitQuestLog(){},emitRpgState(){},flushSave(){saves.push({step:this.tutStep,gold:this.player.gold})},saveTutorialProgress(step){this.tutStep=step;this.flushSave()}});
 return {bus,s,saves};
}
test('real request accepts one target; dismissal and shutdown remove the pending choice',()=>{
 for(const close of ['dialogue:done','shutdown']){
  const {s,bus}=setup();s.openFieldNpcRequest('','레지스터','수련');assert.equal(bus.listenerCount('dialogue:choice'),1);
  (close==='shutdown'?s.events:bus).emit(close);assert.equal(bus.listenerCount('dialogue:choice'),0);assert.equal(s.fieldReq,null);
 }
 const {s,bus}=setup();s.openFieldNpcRequest('','레지스터','수련');bus.emit('dialogue:choice',{id:'fieldreq_accept'});
 assert.equal(s.fieldReq.need,1);assert.equal(s.fieldReq.mob,'x2_rat');assert.equal(bus.listenerCount('dialogue:choice'),0);assert.equal(bus.listenerCount('dialogue:done'),0);
});
test('actual report stores the post-reward checkpoint in the same transaction',()=>{
 const {s,saves}=setup();s.tut.currentId='reward';s.tutStep=11;s.fieldReq={mob:'x2_rat',mobName:'수련용 쥐',need:1,count:1,gold:48,exp:40,npcName:'레지스터'};
 s.openFieldNpcRequest('','레지스터','수련');assert.equal(s.player.gold,48);assert.equal(s.fieldReq,null);
 assert.ok(saves.length>0);assert.ok(saves.every(v=>v.step===12&&v.gold===48));
 s.openFieldNpcRequest('','레지스터','수련');assert.equal(s.player.gold,48);
});
