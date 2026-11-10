import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source=readFileSync('src/game/entities/Drop.ts','utf8');
const ast=ts.createSourceFile('Drop.ts',source,ts.ScriptTarget.Latest,true);
const cls=ast.statements.find(n=>ts.isClassDeclaration(n));
const methods=cls.members.filter(n=>['tick','release'].includes(n.name?.getText(ast))).map(n=>n.getText(ast)).join('\n');
const Phaser={Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)},Angle:{Between:(x,y,a,b)=>Math.atan2(b-y,a-x)}}};
const Subject=new Function('Phaser',ts.transpile(`class Subject { ${methods} }; return Subject;`))(Phaser);
function supply(manual, distance) {
  const calls=[], p=Object.assign(new Subject(),{active:true,x:distance,y:0,bornAt:0,kind:'potion_hp',amount:1,manual,
    scene:{time:{now:1000},player:{pet:'pet_atlas'},collectDrop(...a){calls.push(a)},tweens:{killTweensOf(){}}},
    body:{velocity:{x:0,y:0},setVelocity(x,y){this.velocity={x,y}},reset(){}},
    getData(){return this.manual},setData(k,v){this.manual=v},setActive(v){this.active=v;return this},setVisible(){return this},setScale(){},clearTint(){}});
  return {p,calls};
}
test('tutorial supply cannot magnetize, including an atlas pet; normal drops retain magnet',()=>{
  const a=supply(true,90),b=supply(false,90);
  a.p.tick(16,0,0);b.p.tick(16,0,0);
  assert.equal(a.p.body.velocity.x,0);assert.equal(a.calls.length,0);assert.ok(b.p.body.velocity.x<0);
});
test('actual proximity collects manual supply once and clears its pooled marker',()=>{
  const {p,calls}=supply(true,29);p.tick(16,0,0);p.tick(16,0,0);
  assert.equal(calls.length,1);assert.equal(p.active,false);assert.equal(p.manual,false);
});
test('pet collector skips instructor supply and completion cleans uncollected supply',()=>{
  const world=readFileSync('src/game/scenes/WorldScene.ts','utf8');
  assert.match(world,/d.active && !d.getData\("tutorialSupply"\) && this.pet/);
  assert.match(world,/drop.active && drop.getData\("tutorialSupply"\)\) drop.release\(\)/);
});
