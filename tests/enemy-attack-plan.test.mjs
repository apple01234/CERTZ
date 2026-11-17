import test from 'node:test';import assert from 'node:assert/strict';
import{enemyAttackPlan,enemyMeleeConnects}from'../src/game/combat/enemyAttack.ts';
test('committed melee warnings describe the actual sector, allowing a side or rear dodge',()=>{
 const p=enemyAttackPlan(undefined,1,0);
 assert.equal(enemyMeleeConnects(p,50,0),true);assert.equal(enemyMeleeConnects(p,59,0),false);
 assert.equal(enemyMeleeConnects(p,0,40),false);assert.equal(enemyMeleeConnects(p,-30,0),false);
 assert.equal(enemyMeleeConnects(p,0,0),true);assert.equal(p.angle,0,'target movement does not retarget the original plan');
});
test('ranged aim and charge footprints are derived from real combat profiles',()=>{
 assert.deepEqual(enemyAttackPlan({ranged:{range:260}},0,1),{kind:'ranged',angle:Math.PI/2,reach:260,halfAngle:Math.PI/3});
 assert.equal(enemyAttackPlan({charge:{speed:320,time:640}},1,0).reach,204.8);
});
