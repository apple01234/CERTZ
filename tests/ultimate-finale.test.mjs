// Run: node tests/ultimate-finale.test.mjs
// Real production function, engine-only import replaced; deterministic scene clock.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const path = new URL('../src/game/fx/ultFinale.ts', import.meta.url);
let source = stripTypeScriptTypes(readFileSync(path, 'utf8'));
source = source.replace(/import Phaser from "phaser";/, 'const Phaser = { BlendModes: { ADD: 1 } };');
// Resolve local pure planner in the vm without requiring the browser engine.
source = source.replace(/import \{([^}]+)\} from "\.\/ultFinalePlan";/, (_, names) => {
  const planner = stripTypeScriptTypes(readFileSync(new URL('../src/game/fx/ultFinalePlan.ts', import.meta.url), 'utf8'));
  return planner.replace(/export /g, '') + `\nvoid [${names}];`;
}).replace(/export /g, '');
const api = vm.runInNewContext(source + ';({ runUltFinale });');
function capture(cls, slot, lite = false) {
  let now = 0;
  const timers = [], hits = [], images = [], shakes = [], drawing = [];
  // Fluent display objects: only the engine plumbing is stubbed.
  const image = (x, y, tex) => {
    const o = { x, y, tex };
    const proxy = new Proxy(o, { get(t, k) { return k in t ? t[k] : (...args) => { if (k === 'setRotation') t.rotation = args[0]; if (tex === 'geometry') drawing.push([k, ...args]); return proxy; }; } });
    images.push({ at: now, x, y, tex }); return proxy;
  };

  const scene = { textures: { exists: () => true }, add: { image, circle: image, rectangle: image, graphics: () => image(0, 0, 'geometry') },
    doShake: (...args) => shakes.push(args),
    tweens: { add: () => {} }, cameras: { main: { flash() {}, shake() { throw Error('direct camera shake forbidden'); } } },
    time: { delayedCall(ms, fn) { timers.push({ at: now + ms, fn }); } }, sfxSkill() {} };
  api.runUltFinale(scene, { x: 100, y: 200, cls, slot, hex: 0xffffff, aimAngle: 0, lite,
    roll: mul => ({ dmg: mul, crit: false }),
    hitAt: (x, y, dmg, crit, reach, geometry) => hits.push({ at: now, x, y, dmg, reach, geometry }) });
  while (timers.length) { timers.sort((a,b) => a.at-b.at); const t = timers.shift(); now = t.at; t.fn(); }
  return { hits: JSON.parse(JSON.stringify(hits)), images, shakes, drawing };
}
const classes = ['warbringer','crusader','deadeye','skylord','arclord','eternal','shadowlord','blademaster','seaking','dreadnought'];
const failures = [];
for (const cls of classes) {
  const a = capture(cls, 1), b = capture(cls, 2);
  // Deliberately exclude texture/tint/sound: mechanical distinction, not cosmetics.
  const signature = r => r.hits.map(({at,x,y,reach,geometry}) => ({at,x,y,reach,geometry}));
  try { assert.notDeepEqual(signature(a), signature(b), `${cls}: both slots share the same hit geometry/timing`); }
  catch (e) { failures.push(e.message.split('\n')[0]); }
}
assert.deepEqual(failures, [], `slot collisions: ${failures.join('; ')}`);
// Independent historical pulse contract, not derived from production definitions.
const schedules = {
  warbringer: [[0,80,160], 5.4], crusader: [[0,70,140,210], 6],
  deadeye: [[0,90,180], 5.1], skylord: [[0,80,160], 5.4],
  arclord: [[0], 2], eternal: [[0,70,140,210], 6],
  shadowlord: [[0,110,220,330], 5], blademaster: [[0,90,180], 5.1],
  seaking: [[0,80,160], 5.4], dreadnought: [[0,110,220,330], 5],
};
for (const cls of classes) for (const slot of [1,2]) {
  const r = capture(cls, slot), lite = capture(cls, slot, true);
  assert.deepEqual(r.hits.map(h => h.at), schedules[cls][0], `${cls}/${slot} pulse timing`);
  assert.ok(Math.abs(r.hits.reduce((s,h) => s+h.dmg, 0)-schedules[cls][1]) < 1e-10);
  assert.deepEqual(r.hits, lite.hits, 'lite cannot change damage');
  assert.equal(r.shakes.length, 1, 'shared shake path');
  assert.equal(lite.shakes[0][1], r.shakes[0][1]/2);
  assert.ok(r.drawing.length > 0, 'zone graphics rendered');
}
const plannerSrc = stripTypeScriptTypes(readFileSync(new URL('../src/game/fx/ultFinalePlan.ts', import.meta.url), 'utf8')).replace(/export /g, '');
const { finaleZoneContains: contains, finaleTargetOrder: order, ultimateFinalePlan: plan } = vm.runInNewContext(plannerSrc+';({finaleZoneContains,finaleTargetOrder,ultimateFinalePlan});');
assert.equal(contains({kind:'beam', x:0,y:0,angle:0,length:100,width:20}, 50,10), true);
assert.equal(contains({kind:'beam', x:0,y:0,angle:0,length:100,width:20}, 50,10.01), false);
assert.equal(contains({kind:'beam', x:0,y:0,angle:0,length:100,width:20}, -1,0), false);
assert.equal(contains({kind:'ring', x:0,y:0,radius:100,width:20}, 0,0), false);
assert.equal(contains({kind:'ring', x:0,y:0,radius:100,width:20}, 100,0), true);
assert.equal(contains({kind:'fan', x:0,y:0,radius:100,angle:0,arc:Math.PI/2}, -30,0), false);
assert.equal(contains({kind:'fan', x:0,y:0,radius:100,angle:0,arc:Math.PI/2}, 70,0), true);
assert.equal(order(plan('deadeye',1),100,200,Math.PI/2,100,1500),0);
assert.equal(order(plan('deadeye',1),100,200,0,100,500),-1);
// Execute the actual Player callback against inside/outside targets. The broad
// phase intentionally returns both; only narrow phase can reject the latter.
const playerSrc = readFileSync(new URL('../src/game/entities/Player.ts',import.meta.url),'utf8');
const callback = /hitAt: (\(bx, by, d, crit, reach, geometry\) => \{[\s\S]*?\n      \}),/.exec(playerSrc)?.[1];
assert.ok(callback, 'Player slot 1 geometry callback wired');
// Extract the entire real method using the TS AST, never a source-presence probe.
const playerAst = ts.createSourceFile('Player.ts', playerSrc, ts.ScriptTarget.Latest, true);
const playerClass = playerAst.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === 'Player');
const method = playerClass?.members.find(n => ts.isMethodDeclaration(n) && n.name.getText(playerAst) === 'useSkill5b');
assert.ok(method?.body, 'real Player.useSkill5b method found');
const secondSkill = stripTypeScriptTypes(`class ExtractedPlayer { ${method.getText(playerAst)} }`);
const finalContracts = {
  warbringer: { at:2590, mul:12, push:680, inside:[350,0], outside:[350,80] },
  crusader: { at:8130, mul:8.4, push:640, inside:[440,0], outside:[260,0] },
  deadeye: { at:3000, mul:3.2, push:480, inside:[500,0], outside:[500,140], crit:true },
  skylord: { at:5000, mul:7.2, push:600, inside:[360,0], outside:[200,0] },
  arclord: { at:2080, mul:11, push:660, inside:[560,0], outside:[0,0] },
  eternal: { at:1400, damage:2400, push:640, inside:[240,0], outside:[130,0], crit:true },
  shadowlord: { at:2220, mul:9.6, push:620, inside:[230,-140], outside:[0,0] },
  blademaster: { at:2785, mul:9.4, push:640, inside:[250,250], outside:[250,0] },
  seaking: { at:6000, mul:11, push:760, inside:[270,0], outside:[150,0] },
  dreadnought: { at:3060, mul:14.5, push:820, inside:[350,350], outside:[490,0] },
};
class Vector {
  constructor(x=0,y=0){ this.x=x;this.y=y; }
  set(x,y){this.x=x;this.y=y;return this;}
  normalize(){const n=Math.hypot(this.x,this.y)||1;this.x/=n;this.y/=n;return this;}
  rotate(a){const x=this.x;this.x=x*Math.cos(a)-this.y*Math.sin(a);this.y=x*Math.sin(a)+this.y*Math.cos(a);return this;}
  angle(){return Math.atan2(this.y,this.x);}
}
function capturePlayer(cls, { angle=0, lite=false, outside=false, ratio=1, log=1200, dead=false, snapshots=false, returnAll=false, count=2, positions:customPositions, lateTarget=false, methodSource=secondSkill }={}) {
  const contract=finalContracts[cls];
  let now=0, serial=0, targetCursor=0;
  const aim=angle;
  const timers=[], hits=[], rolls=[], cyclones=[], fields=[], finalCandidates=[];
  const noop=()=>{};
  const display=()=>{let o; o=new Proxy({}, { get:(_,k)=>k==='then'?undefined:()=>o }); return o;};
  const targets=Array.from({length:snapshots?3:count},(_,id)=>({id,active:true,hp:100000,x:100,y:200,
    applyDot:noop,applyStun:noop,
    takeDamage(dmg,away,push,crit){hits.push({at:now,id,dmg,push,crit,away:[away.x,away.y]});}}));
  const time={get now(){return now;}, delayedCall(ms,fn){timers.push({at:now+ms,fn,serial:serial++});}};
  const scene={time,fxLevel:lite?0:2,add:{circle:display,image:display,rectangle:display,graphics:display},
    tweens:{add:noop}, textures:{exists:()=>true}, cameras:{main:{flash:noop,scrollX:-400,scrollY:-100,width:1000,height:600}},
    impactFX:{shake:noop}, driveFx:new Proxy({}, {get:()=>noop}),
    fireCyclone:cfg=>cyclones.push({at:now,...cfg}),spawnField:cfg=>fields.push({at:now,...cfg}),
    ...Object.fromEntries(['sfxSkill','spawnPickupText','spawnBurstAt','vfx3dFx','spawnSlash','spawnCrack','spawnPillar','sfxCrit','spawnPurifyRing','spawnRuneRing','spawnHealFx','spawnHitSpark','spawnShockwave','fireShadowClone','spawnSpinSlash','emitHud','doShake'].map(k=>[k,noop]))};
  const family=()=>cls==='arclord'||cls==='eternal'?'mage':cls==='shadowlord'||cls==='blademaster'?'thief':cls==='deadeye'||cls==='skylord'?'archer':cls==='seaking'||cls==='dreadnought'?'pirate':'warrior';
  const context={Phaser:{BlendModes:{ADD:1},Math:{Vector2:Vector,Clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}},
    resolveSkill5Of:k=>k,SKILL5B_INFO:Object.fromEntries(classes.map(k=>[k,{name:k}])),familyOf:family,
    ult5bHoldOf:()=>10000,ult5HoldOf:()=>10000,finaleTargetOrder:order,ultimateFinalePlan:plan,
    cine3d:()=>({play:noop}),runUltFinale:api.runUltFinale,
    ...Object.fromEntries(['spawnUltIntroSig','spawnPentacle','playUltLayers','playUltCinematic','spawnRingPop','spawnFlarePop'].map(k=>[k,noop])),
    Math:Object.assign(Object.create(Math),{random:()=>0.5})};
  const Player=vm.runInNewContext(methodSource+';ExtractedPlayer;',context);
  const actor=Object.assign(new Player(),{scene,cls,x:100,y:200,state:'idle',skill5bUnlocked:true,skill5bCd:0,skill5bMax:120000,
    mp:1000,maxMp:1000,hp:500,maxHp:1000,iframes:0,atkTotal:100,ultSlot:0,hitSet:new Set(),recentDmgLog:[{t:0,v:log}],awayScratch:new Vector(),
    setVelocity:noop,netEmitAction:noop,clsHex:()=>0xffffff,ultKeyFor3D:()=>cls,recalcSpeed:noop,
    setPosition(x,y){this.x=x;this.y=y;return this;},aimDirFree:()=>new Vector(Math.cos(aim),Math.sin(aim)),
    nearestTargets(n){const active=targets.filter(t=>t.active);return cls==='deadeye'?[active[targetCursor++%active.length]]:active.slice(0,n);},
    getAllTargetsIn(radius){return targets.filter(t=>t.active&&(returnAll||Math.hypot(t.x-this.x,t.y-this.y)<=radius));},
    targetsAround(x,y,radius){const found=targets.filter(t=>t.active&&(returnAll||Math.hypot(t.x-x,t.y-y)<=radius));if(now===contract.at)finalCandidates.push(...found.map(t=>t.id));return found;},
    rollDamage(m,skill,forceCrit=false){assert.equal(this.ultSlot,2,'slot multiplier context');assert.equal(skill,true);rolls.push({at:now,m,forceCrit});return {dmg:m*500,crit:forceCrit};}});
  // Earlier attacks run normally; targets are placed independently immediately
  // before the real final callback. Rotation uses translated world coordinates.
  time.delayedCall(contract.at-1,()=>{
    actor.setPosition(100,200); actor.mp=1000*ratio;
    if(dead)actor.state='dead';
    const positions=customPositions??[contract.inside,outside?contract.outside:contract.inside,contract.inside];
    targets.forEach((t,i)=>{const [x,y]=positions[i]??contract.inside;t.x=100+x*Math.cos(angle)-y*Math.sin(angle);t.y=200+x*Math.sin(angle)+y*Math.cos(angle);});
    if(lateTarget)targets.push({...targets[0],id:targets.length,x:targets[1].x,y:targets[1].y,
      takeDamage(dmg,away,push,crit){hits.push({at:now,id:this.id,dmg,push,crit,away:[away.x,away.y]});}});
    if(snapshots){targets[0].active=false;targets[0].hp=0;}
    // Skylord's existing cyclone aims at its nearest target. Keep the impact
    // origin independent from our damage targets so off-zone rejection is real.
    if(cls==='skylord')actor.nearestTargets=()=>[{active:true,x:100,y:200}];
  });
  actor.useSkill5b();
  while(timers.length){timers.sort((a,b)=>a.at-b.at||a.serial-b.serial);const t=timers.shift();now=t.at;t.fn();}
  return {hits,rolls,cyclones,fields,actor,targets,finalCandidates};
}
const playerFailures=[];
for(const cls of classes){
  const c=finalContracts[cls];
  for(const angle of [0,Math.PI/2]) {
    const trace=capturePlayer(cls,{outside:true,angle,returnAll:true});
    if(!['deadeye','seaking'].includes(cls))assert.ok(trace.finalCandidates.includes(1),`${cls}: off-zone target reached narrowphase`);
    const finalHits=trace.hits.filter(h=>h.at===c.at&&h.push===c.push);
    try {
      assert.deepEqual(finalHits.map(h=>h.id),[0],`${cls}: actual slot2 finale must reject off-geometry target`);
      assert.equal(finalHits[0].dmg,c.damage??c.mul*500,`${cls}: historical damage`);
      assert.equal(finalHits[0].crit,Boolean(c.crit),`${cls}: historical crit`);
    } catch(e){playerFailures.push(e.message.split('\n')[0]);}
  }
}
assert.deepEqual(playerFailures,[],'Player slot2 runtime narrowphase failures: '+playerFailures.join('; '));

// Primary attacks are independent historical contracts, not taken from the new
// helper. Two stationary targets are available until the final-placement step.
const primaryContracts = {
  warbringer:[[5,280,430,4.2,2,420]],
  crusader:[[12,300,640,3.6,2,460]],
  deadeye:[[100,260,26,1.15,1,60,true]],
  skylord:[[12,260,200,2.2,1,null],[10,2660,220,3.8,1,440]],
  arclord:[[5,300,320,4.4,2,460]],
  eternal:[],shadowlord:[[2,300,170,3.9,1,320]],
  blademaster:[[25,260,95,1.5,2,160]],seaking:[],
  dreadnought:[[12,730,170,3.2,2,400]],
};
for(const cls of classes){
  const c=finalContracts[cls], trace=capturePlayer(cls), lite=capturePlayer(cls,{lite:true});
  const expectedRolls=[],expectedHits=[];
  for(const [count,start,step,m,repeats,push,crit=false] of primaryContracts[cls]) {
    for(let i=0;i<count;i++)for(let j=0;j<repeats;j++){
      expectedRolls.push({at:start+i*step,m,forceCrit:crit});
      if(push!==null)expectedHits.push({at:start+i*step,dmg:m*500,push,crit});
    }
  }
  assert.deepEqual(trace.rolls.filter(r=>r.at<c.at),expectedRolls,`${cls}: primary roll count/coefficient/timestamps`);
  assert.deepEqual(trace.hits.filter(r=>r.at<c.at).map(({at,dmg,push,crit})=>({at,dmg,push,crit})),expectedHits,`${cls}: primary damage/timestamps unchanged`);
  const finalHits=trace.hits.filter(h=>h.at===c.at);
  assert.deepEqual(finalHits.map(h=>h.id),[0,1],`${cls}: union overlap cannot multiply final damage`);
  assert.ok(finalHits.every(h=>h.dmg===(c.damage?c.damage/2:c.mul*500)&&h.push===c.push&&h.crit===Boolean(c.crit)),`${cls}: existing final payload`);
  assert.equal(trace.hits.filter(h=>h.at>c.at).length,0,`${cls}: later visualization must not add damage`);
  const finalRolls=cls==='eternal'?[]:[...(cls==='skylord'?[{at:c.at,m:5.6,forceCrit:false}]:[]),
    ...Array.from({length:2},()=>({at:c.at,m:c.mul,forceCrit:Boolean(c.crit)}))];
  assert.deepEqual(trace.rolls.filter(r=>r.at>=c.at),finalRolls,`${cls}: no extra final rolls`);
  assert.deepEqual(trace.hits,lite.hits,`${cls}: actual Player lite damage parity`);
  assert.deepEqual(trace.rolls,lite.rolls,`${cls}: actual Player lite roll parity`);
  assert.equal(trace.actor.ultSlot,0,`${cls}: multiplier context restored`);
  assert.equal(trace.actor.state,'idle',`${cls}: no input lock`);
  const cancelled=capturePlayer(cls,{dead:true});
  assert.equal(cancelled.hits.filter(h=>h.at>=c.at).length,0,`${cls}: dead caster cancels final`);
  const residue=trace.fields.find(f=>f.dur===30000);
  assert.ok(residue,`${cls}: residue preserved`);
  assert.deepEqual(JSON.parse(JSON.stringify(residue.geometry)),{plan:JSON.parse(JSON.stringify(plan(cls,2))),angle:0},`${cls}: residue uses the slot2 plan`);
  assert.deepEqual([residue.at,residue.x,residue.y,residue.dps,residue.dur],[1500,100,200,55,30000],`${cls}: residue timing/origin/dps/duration preserved`);
}
for(const cls of ['arclord'])for(const ratio of [0,0.5,1]) {
  const trace=capturePlayer(cls,{ratio,outside:true});
  assert.equal(trace.hits.find(h=>h.at===finalContracts[cls].at).dmg,(7.5+3.5*ratio)*500,'arclord: MP-dependent final preserved');
  assert.equal(trace.actor.mp,0,'arclord: MP still consumed');
}
for(const log of [0,1200]) {
  const trace=capturePlayer('eternal',{log,outside:true});
  assert.equal(trace.hits.find(h=>h.at===1400).dmg,Math.max(600,log*2),'eternal: floor/log sum preserved');
}
const cyclone=capturePlayer('skylord').cyclones;
assert.equal(cyclone.length,13,'skylord: 12 main cyclones + existing final cyclone, no duplicates');
assert.deepEqual(cyclone.filter(c=>c.at<5000).map(c=>[c.at,c.dmg,c.speed,c.radius,c.life]),
  Array.from({length:12},(_,i)=>[260+i*200,1100,560,130,1600]));
assert.deepEqual(cyclone.filter(c=>c.at===5000).map(c=>[c.at,c.dmg,c.speed,c.radius,c.life]),[[5000,2800,0,220,3200]],'skylord: secondary final cyclone unchanged');
// Snapshot-only finales must not acquire a fresh enemy at the finishing instant.
for(const cls of ['deadeye','seaking']) {
  const trace=capturePlayer(cls,{snapshots:true,lateTarget:true});
  assert.deepEqual(trace.hits.filter(h=>h.at===finalContracts[cls].at).map(h=>h.id),[1,2],`${cls}: live historical snapshot only`);
}
assert.equal(capturePlayer('deadeye',{count:15}).hits.filter(h=>h.at===3000).length,12,'deadeye: existing 12-target cap');
// A crossed-blade intersection belongs to both beams but is hit only once.
const crossed=capturePlayer('blademaster',{positions:[[0,0],[250,0]],outside:true});
assert.deepEqual(crossed.hits.filter(h=>h.at===2785).map(h=>h.id),[0],'blademaster: overlapping zones form one damage union');
// Run a realistic broadphase as well: distant beam/corner hits cannot be lost to
// the old local circle before narrowphase even gets to see them.
for(const cls of ['warbringer','deadeye','arclord','blademaster','dreadnought']) {
  const distant={warbringer:[750,160],deadeye:[820,0],arclord:[560,0],blademaster:[410,410],dreadnought:[420,420]}[cls];
  const trace=capturePlayer(cls,{positions:[distant,finalContracts[cls].outside],outside:true});
  assert.deepEqual(trace.hits.filter(h=>h.at===finalContracts[cls].at).map(h=>h.id),[0],`${cls}: broadphase covers full slot2 geometry`);
}

// Mutation check: removing the real Player narrowphase (in memory only) must
// restore the regression for every class. A slot:2 identifier alone cannot pass.
const withoutNarrowphase=secondSkill.replace('finaleTargetOrder(residuePlan, x, y, residueAngle, e.x, e.y) >= 0','true');
assert.notEqual(withoutNarrowphase,secondSkill,'mutation actually removed narrowphase');
for(const cls of classes){
  const trace=capturePlayer(cls,{outside:true,returnAll:true,methodSource:withoutNarrowphase});
  assert.ok(trace.hits.some(h=>h.at===finalContracts[cls].at&&h.id===1),`${cls}: inverse check catches old circular/snapshot splash`);
}

let damageCalls=0;
const target = (x,y) => ({active:true,x,y,takeDamage(){damageCalls++;}});
const actor = {targetsAround:()=>[target(500,200),target(100,500)],
  awayScratch:{set(){return this;},normalize(){return this;}},scene:{sfxCrit(){}}};
// Arrow must close over actor as `this`, so re-evaluate inside a bound function.
const invoke = vm.runInNewContext('(function(){return ('+callback+');})',{finaleTargetOrder:order}).call(actor);
invoke(100,200,2,false,1401,{plan:plan('deadeye',1),angle:0});
assert.equal(damageCalls,1,'off-beam target must not take circular splash damage');

console.log(`ALL CHECKS PASS: ${classes.length} classes / ${classes.length*2} slot traces / slot collisions 0`);
console.log('PASS: independent geometry boundaries / historical schedules+damage / lite parity / shared shake / Player slot 1 narrowphase');
console.log('PASS: actual AST-extracted Player.useSkill5b / 10 classes × 2 angles inside+outside / primary+final coefficient/time/crit/knockback contracts / no duplicate damage / snapshots+cap / distant broadphase / lite+death / residue geometry / inverse mutation');
export { capture, classes, capturePlayer, finalContracts, secondSkill };
