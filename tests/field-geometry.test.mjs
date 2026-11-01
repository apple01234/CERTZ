// node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs tests/field-geometry.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { ultimateFinalePlan, finaleTargetOrder, finalePlanReach } from '../src/game/fx/ultFinalePlan.ts';
const src=fs.readFileSync('src/game/scenes/WorldScene.ts','utf8');
const ast=ts.createSourceFile('scene.ts',src,ts.ScriptTarget.Latest,true);
const methods={};
function walk(n){if(ts.isMethodDeclaration(n))methods[n.name.getText(ast)]=n.getText(ast).replace(/^private\s+/, '');ts.forEachChild(n,walk)}walk(ast);
const build=ts.transpile(`function ${methods.tickFields}; function ${methods.spawnField}; result={tickFields,spawnField};`);
const ctx={result:null,Phaser:{Math:{Distance:{Between:(x,y,bx,by)=>Math.hypot(x-bx,y-by)}}},finaleTargetOrder,finalePlanReach};
vm.runInNewContext(build,ctx);
let hits=0;
const geometry={plan:ultimateFinalePlan('deadeye',2),angle:0};
const targets=[{x:500,y:0,active:true,takeDamage(){hits++}},{x:0,y:500,active:true,takeDamage(){hits++}}];
const actor={fields:[{x:0,y:0,radius:1000,dur:1000,tickAcc:0,dps:20,owner:'player',kind:'light',geometry}],getAllTargets:()=>targets,
 fieldAwayVec:{set(){return this},normalize(){return this}},time:{now:0}};
ctx.result.tickFields.call(actor,500);
assert.equal(hits,1,'slot2 residue must use directional geometry, not a shared circular field');
let oldCircles=0,graphicsCount=0;
const graphic=new Proxy({}, {get:(o,k)=>k==='destroy'?()=>{}:(...args)=>graphic});
const spawnActor={fields:[],add:{circle(){oldCircles++;return graphic},graphics(){graphicsCount++;return graphic}},
 tweens:{add(){}},yDepthFor:()=>5};
for(const cls of ['warbringer','crusader','deadeye','skylord','arclord','eternal','shadowlord','blademaster','seaking','dreadnought']){
 const plan=ultimateFinalePlan(cls,2);
 ctx.result.spawnField.call(spawnActor,{x:0,y:0,radius:240,dur:30000,dps:20,kind:'light',owner:'player',geometry:{plan,angle:0}});
 const field=spawnActor.fields.at(-1);
 assert.ok(field.radius>=Math.max(...plan.zones.map(z=>Math.hypot(z.x,z.y)+(z.kind==='beam'?Math.hypot(z.length,z.width/2):z.radius+(z.kind==='ring'?z.width/2:0)))),'broadphase cannot truncate geometry');
}
assert.equal(oldCircles,0,'slot2 geometry must not draw the old common circular field');
assert.equal(graphicsCount,10,'all ten residual fields draw their geometry');
console.log('PASS residual field exact geometry: inside hit / outside rejected; ten geometry renderers and unclipped broadphases');
