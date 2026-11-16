import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {FIRST_DIO,isFirstDio} from '../src/game/firstBoss.ts';
import {mitigateEnemyDamage} from '../src/game/combat/defense.ts';
import {recoveryMs,attacksAfter,telegraphMs} from '../src/game/entities/bossPhases.ts';

class V {constructor(x=0,y=0){this.x=x;this.y=y;}set(x,y){this.x=x;this.y=y;return this;}normalize(){const d=Math.hypot(this.x,this.y)||1;this.x/=d;this.y/=d;return this;}scale(n){this.x*=n;this.y*=n;return this;}clone(){return new V(this.x,this.y);}}
const text=readFileSync('src/game/entities/Boss.ts','utf8'),tree=ts.createSourceFile('Boss.ts',text,ts.ScriptTarget.Latest,true);
const boss=tree.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='Boss');
const methods=['startCharge','tick','doSummon','endAttack'].map(name=>boss.members.find(n=>n.name?.getText(tree)===name).getText(tree)).join('\n');
const Subject=new Function('FIRST_DIO','telegraphMs','recoveryMs','attacksAfter','Phaser',ts.transpile('class Subject{'+methods+'};return Subject;'))(FIRST_DIO,telegraphMs,recoveryMs,attacksAfter,{Math:{Vector2:V,Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}});
function rig(firstDio=true){
 const s=new Subject(),calls=[],g={setDepth(){return this;},setName(){return this;},lineStyle(){return this;},lineBetween(){return this;},destroy(){}};
 Object.assign(s,{firstDio,x:0,y:0,def:{atk:24},alive:true,entranceDone:true,countdown:0,phase:1,modeTimer:0,knockVec:new V(),chargeDir:new V(),chargeTarget:new V(),orbPool:[],nextAttackCd:0,
  scene:{stageW:2000,stageH:1000,add:{graphics:()=>g},sfxDash(){},enemies:[],requestSummon:(...args)=>calls.push(args),spawnBurstAt(){},showBanner(){}},
  setMode(mode,time){this.mode=mode;this.modeTimer=time;},vxWarnRing(){},setTint(){},clearTint(){},squash(){},setVelocity(x,y){this.velocity={x,y};},setBossAnim(){},animFor(){return'';},updatePhase(){},tickPoisonZones(){},setFlipX(){},bossFx(){}});
 return{s,calls};
}
test('starting sword with unspent AP can finish Dio without a prolonged damage wall',()=>{
 const damage=mitigateEnemyDamage(46,FIRST_DIO);
 assert.ok(FIRST_DIO.hp/damage<=110);
 assert.ok(316/(FIRST_DIO.atk*1.1)>=10);
 assert.equal(isFirstDio('lilacworld2x3','dio',true),true);
 assert.equal(isFirstDio('lilacworld2x3','dio',false),false);
 assert.equal(isFirstDio('tower','dio',true),false);
});
test('first Dio locks the displayed charge direction before the warning; replays keep their aim',()=>{
 for(const first of [true,false]){
  const{s}=rig(first),p={x:100,y:0,hp:100,takeDamage(){}};s.startCharge(p);
  assert.equal(s.modeTimer,first?1200:850);
  p.x=0;p.y=100;s.tick(1300,p);s.tick(16,p);
  assert.equal(s.velocity.x,first?360:0);assert.equal(s.velocity.y,first?0:520);
 }
});
test('Dio summon pressure stays capped; recovery gives a full two-second attack window',()=>{
 const{s,calls}=rig();s.def.summonKey='wraith';s.phase=3;s.lastAttack='summon';s.scene.enemies=[{active:true,alive:true},{active:true,alive:true}];
 s.doSummon();assert.equal(calls.length,0);assert.equal(s.mode,'recover');assert.equal(s.modeTimer,2000);
 s.scene.enemies.pop();s.doSummon();assert.equal(calls[0][1],1);
});
