import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import ts from 'typescript';
import {makeDamage,resolveDamage,applyDamage} from '../src/game/combat/damageData.ts';
import {mitigateEnemyDamage} from '../src/game/combat/defense.ts';
const source=fs.readFileSync('src/game/entities/Enemy.ts','utf8'),tree=ts.createSourceFile('Enemy.ts',source,99,true);
const cls=tree.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='Enemy');
const method=cls.members.find(n=>n.name?.getText(tree)==='takeDamage').getText(tree);
const Subject=new Function('makeDamage','resolveDamage','applyDamage','mitigateEnemyDamage','elemAdvantage','elementReaction','trackDamage','receivedDamageMult','Phaser',ts.transpile('class Subject{'+method+'};return Subject;'))(makeDamage,resolveDamage,applyDamage,mitigateEnemyDamage,()=>1,()=>null,()=>{},()=>1,{TintModes:{FILL:1}});
function rig(def=25,defPct=.25,hp=200){
 const e=new Subject(),shown=[],reflected=[];
 Object.assign(e,{alive:true,x:0,y:0,hp,maxHp:200,defDef:def,defPctVal:defPct,elem:'none',debuffs:[],baseSX:1,baseSY:1,lastReactAt:0,
  scene:{time:{now:2000},spawnDamageText:(_x,_y,n)=>shown.push(n),spawnHitSpark(){},hitStop(){},doShake(){},tweens:{killTweensOf(){},add(){}},spawnShockwave(){},spawnCritSplat(){}},
  knockVec:{set(){}},setTint(){return this;},setTintMode(){return this;},setScale(){return this;},syncHpBar(){},tryThornReflect:n=>reflected.push(n),tryWardedShield(){},die(){this.alive=false;}});
 return{e,shown,reflected};
}
test('actual Enemy.takeDamage uses the mitigated amount for HP, text and reflection',()=>{
 for(const [def,pct,hp]of [[25,.25,200],[0,0,200],[500,.9,200],[25,.25,10]]){
  const{e,shown,reflected}=rig(def,pct,hp);e.takeDamage(100,{x:1,y:0},0,false,true);
  const dealt=mitigateEnemyDamage(100,{def,defPct:pct});
  assert.equal(shown[0],dealt);assert.equal(reflected[0],dealt);assert.equal(hp-e.hp,Math.min(hp,dealt),'displayed mitigation must reach the HP pipeline');
 }
});
test('white FILL expires even though its RGB equals the default white, and warnings keep MULTIPLY tint',()=>{
 const body=cls.members.find(n=>n.name?.getText(tree)==='refreshDamageTint').getText(tree);
 const Type=new Function('Phaser',ts.transpile('class S{'+body+'};return S;'))({TintModes:{MULTIPLY:0}});
 const e=new Type();Object.assign(e,{hitFlash:0,dummyTint:null,isTinted:true,ai:{current:'chase'},clearTint(){this.cleared=true;},setTint(color){this.color=color;return this;},setTintMode(mode){this.mode=mode;return this;}});
 e.refreshDamageTint();assert.equal(e.cleared,true);
 e.ai.current='windup';e.def={profile:{}};e.refreshDamageTint();assert.equal(e.color,0xffb0a0);assert.equal(e.mode,0);
 e.dummyTint=0x123456;e.refreshDamageTint();assert.equal(e.color,0x123456,'practice target colors survive hit recovery');
});
test('exhausted/blocked damage never creates hit feedback or drains an extra HP',()=>{
 const{e,shown}=rig();e.takeDamage(0,{x:1,y:0},0);assert.equal(e.hp,200);assert.deepEqual(shown,[]);
});
