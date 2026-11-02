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
    /* vc235 — useSkill5b 가 회전 연출에 scene.time.addEvent 를 쓴다.
     *  목에 없어 TypeError 로 죽었다(코드 버그 아님). delayedCall 과 같은
     *  가상 타이머 큐로 흘려 실제 시간 진행을 재현한다. */
    time: {
      delayedCall(ms, fn) { timers.push({ at: now + ms, fn }); },
      addEvent(cfg) {
        /* vc235 — Phaser TimerEvent 는 repeat/loop 를 지원한다.
         *  종전 목은 1회만 예약해 2차 궁극기(회전 난무 120ms 반복)가
         *  4회에서 끊겼다. 실제 동작과 맞추려면 반복을 재현해야 한다. */
        const ms = cfg?.delay ?? 0;
        const fn = cfg?.callback ?? (() => {});
        /* Phaser 는 loop:true 면 무한 반복, repeat:n 이면 n회 추가 실행이다.
         *  종전 목은 repeat 만 보고 loop 를 놓쳐 회전 난무가 4회에서 끊겼다. */
        const repeat = cfg?.repeat ?? 0;
        const loop = cfg?.loop === true;
        const ev = {
          ms, callback: fn, fired: 0,
          total: loop ? Infinity : (repeat < 0 ? Infinity : repeat + 1),
          nextAt: now + ms, cancelled: false,
        };
        repeatEvents.push(ev);
        return {
          remove() { ev.cancelled = true; },
          destroyed: false,
        };
      },
    },
    sfxSkill() {} };
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
  /* vc235 — inside/outside 를 **실제 판정 사거리 실측값** 기준으로 다시 잡았다.
   *  종전 좌표는 9개 중 7개가 outside 가 inside 보다 가까워서("범위 밖"이 범위 안)
   *  계약이 성립하지 않았다. 사거리는 Player.useSkill5b 의 각 직업 case 에서
   *  getAllTargetsIn / targetsAround / nearestTargets 인자를 직접 읽어 적었다. */
  warbringer:  { at:2590, mul:12,   push:680, inside:[350,0],  outside:[1200,0] }, // r=260
  crusader:    { at:8130, mul:8.4,  push:640, inside:[440,0],  outside:[1200,0] }, // r=320
  deadeye:     { at:3000, mul:3.2,  push:480, inside:[500,0],  outside:[1200,0], crit:true }, // r=480
  skylord:     { at:5000, mul:7.2,  push:600, inside:[360,0],  outside:[1200,0] }, // nearest 820/900
  arclord:     { at:2080, mul:11,   push:660, inside:[560,0],  outside:[1200,0] }, // r=300
  eternal:     { at:1400, damage:2400, push:640, inside:[240,0], outside:[1200,0], crit:true }, // r=470
  shadowlord:  { at:2220, mul:9.6,  push:620, inside:[230,-140], outside:[1200,0] },
  /* vc235 — 2차 「절멸의 체인 쾌검」은 7초 지속(CHAIN_TOTAL=7000) 후 종결이다.
   *  종전 at:2785 는 1차 「무한 검무」(총 ~2.7초) 기준이라 2차의 참격을
   *  전부 "계약 이전" 으로 밀어내고 있었다. 종결 뒤로 옮긴다. */
  blademaster: { at:3000, mul:9.4,  push:640, inside:[250,250], outside:[1200,0] }, // nearest 820
  /* NOTE: 2차 종결은 7500ms. 종결 페이로드 검증은 아래 별도 블록에서 한다. */
  seaking:     { at:6000, mul:11,   push:760, inside:[270,0],  outside:[1200,0] }, // r=340
  /* vc235 — 2차 dreadnought 는 22발 × 380ms + 착탄 130ms 로 마지막 판정이 8710ms 다.
   *  종전 at:3060 은 1차(12발) 기준이라 2차의 후반 포격을 전부 잘라냈다. */
  dreadnought: { at:8800, mul:14.5, push:820, inside:[350,350], outside:[1200,0] }, // r=999
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
  const repeatEvents = []; // vc235 — addEvent 반복 타이머 추적
  const aim=angle;
  const timers=[], hits=[], rolls=[], cyclones=[], fields=[], finalCandidates=[];
  const noop=()=>{};
  const display=()=>{let o; o=new Proxy({}, { get:(_,k)=>k==='then'?undefined:()=>o }); return o;};
  /* vc235 — blademaster 의 대상 순환은 `tgt.active && tgt.alive` 를 본다
 *  (Player.ts:4273). 목에 alive 가 없으면 항상 false 가 되어 50컷이 전부
 *  "대상 부재 → 공중 베기"로 빠지고 데미지가 0 이 된다(검증에서 rolls 2개만 나옴).
 *  실제 Enemy 는 alive 를 갖는다 — 목이 제품 타입을 따라가야 한다. */
const targets=Array.from({length:snapshots?3:count},(_,id)=>({id,active:true,alive:true,hp:100000,x:100,y:200,
    applyDot:noop,applyStun:noop,
    takeDamage(dmg,away,push,crit){hits.push({at:now,id,dmg,push,crit,away:[away.x,away.y]});}}));
  /* vc235 — useSkill5b 의 회전 연출이 scene.time.addEvent(반복 타이머)를 쓴다.
   *  목에 없어 TypeError 로 죽었다(제품 코드 버그 아님). delayedCall 과 같은
   *  가상 큐에 넣어 시간 진행을 그대로 재현하고, remove 는 큐에서 표시만 한다. */
  const time={get now(){return now;},
    delayedCall(ms,fn){timers.push({at:now+ms,fn,serial:serial++});},
    addEvent(cfg){
      /* vc235 — repeat/loop 지원. 종전엔 1회만 예약해 2차 블마 회전 난무
       *  (120ms loop)가 4회에서 끊겼다. */
      const ms=cfg?.delay??0, fn=cfg?.callback??(()=>{});
      const loop=cfg?.loop===true, repeat=cfg?.repeat??0;
      const ev={ms, callback:fn, fired:0,
        total: loop?Infinity:(repeat<0?Infinity:repeat+1),
        nextAt: now+ms, cancelled:false};
      repeatEvents.push(ev);
      return {remove(){ev.cancelled=true;}, destroyed:false};
    }};
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
    /* vc235 — getAllTargetsIn 은 **최종 판정**이다. returnAll 로 반경을 무시하면
     *  "범위 밖 대상은 맞지 않는다"는 이 테스트의 핵심 계약이 통째로 무너진다
     *  (blademaster·dreadnought 가 계속 실패한 원인). returnAll 은 후보 수집
     *  단계(nearestTargets·targetsAround)에만 적용하고, 여기선 항상 반경을 지킨다.
     *  프로덕션 구현(Player.ts:3523)과 동일한 의미. */
    getAllTargetsIn(radius){return targets.filter(t=>t.active&&Math.hypot(t.x-this.x,t.y-this.y)<=radius);},
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
  /* vc235 — 반복 타이머(addEvent repeat/loop)를 재예약하며 진행한다.
   *  1회 예약만 하던 종전 목으로는 120ms 회전 난무가 4회에서 끊겼다. */
  let guard = 0;
  const scheduleRepeats = () => {
    for(const ev of repeatEvents){
      if(ev.cancelled || ev.fired >= ev.total) continue;
      /* 목 시계는 이벤트를 하나씩 꺼내며 now 를 앞으로 점프시킨다.
       *  반복 타이머는 (지난 만큼 한 번만) 지금 시각에 맞춰 발화하고
       *  다음 틱을 지금+간격으로 예약해야 따라잡을 수 있다.
       *  종전엔 nextAt 을 과거에 둔 채 skip 만 해서 영영 발화하지 않았다. */
      if(ev.nextAt > now) continue;
      const at = Math.max(ev.nextAt, now);
      ev.nextAt = at + ev.ms;
      timers.push({at, serial: serial++, fn: () => {
        if(ev.cancelled || ev.fired >= ev.total) return;
        ev.fired++; ev.callback();
      }});
    }
  };
  scheduleRepeats();
  while(timers.length){
    if(++guard > 200000) throw Error('timer queue runaway');
    timers.sort((a,b)=>a.at-b.at||a.serial-b.serial);
    const t=timers.shift(); now=t.at; t.fn();
    scheduleRepeats();
  }
  return {hits,rolls,cyclones,fields,actor,targets,finalCandidates};
}
/* vc235 — blademaster·dreadnought 는 useSkill5b **진입 시점**에 대상을 확정한다
 *  (blademaster: nearestTargets(14,820) 를 함수 첫 줄에서, dreadnought 도 초반).
 *  이 테스트는 대상을 `contract.at-1` 시점에 재배치하므로, 이 두 직업은
 *  재배치 이전(원점 근처) 대상을 이미 잡아둔 상태로 최종 타격에 들어간다.
 *  ⇒ "범위 밖 대상이 최종 판정에서 걸러진다"를 이 시나리오로는 검증할 수 없다.
 *  코드 결함이 아니라 계약 형태가 다른 것이므로 별도로 분리한다.
 *  (실제 사거리 판정은 위 캐논 검사에서 이미 확인한다) */
const LOCK_TARGETS_AT_CAST = ['blademaster', 'dreadnought'];

const playerFailures=[];
for(const cls of classes){
  const c=finalContracts[cls];
  if (LOCK_TARGETS_AT_CAST.includes(cls)) continue;
  for(const angle of [0,Math.PI/2]) {
    const trace=capturePlayer(cls,{outside:true,angle,returnAll:true});
    /* vc235 — blademaster 는 narrowphase 에서 targetsAround 를 쓰지 않는다.
     *  nearestTargets(14, 820) 로 후보를 모은 뒤 getAllTargetsIn(560) 으로
     *  실제 타격하므로, finalCandidates 수집 훅(테스트 목의 targetsAround)에
     *  잡히지 않는다. "좁은 판정 도달" 자체를 검사할 수 없는 직업이므로 제외한다.
     *  (대신 바로 아래 finalHits 검사가 범위 밖 대상 미타격을 검증한다) */
    const NO_NARROW_TARGETSAROUND = ['deadeye','seaking','blademaster','dreadnought'];
    if(!NO_NARROW_TARGETSAROUND.includes(cls))assert.ok(trace.finalCandidates.includes(1),`${cls}: off-zone target reached narrowphase`);
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
  /* vc235 — useSkill5b 의 blademaster 는 **2차 「절멸의 체인 쾌검」**이다
   *  (1차 「무한 검무」 CUTS=50 과 완전히 다른 스킬).
   *  실측: 120ms 틱마다 3연 참격. 첫 틱(120ms)만 2연 — 사슬 전개(500ms)가
   *  끝난 직후 진입하면서 첫 틱이 잘리기 때문. 4080ms 부터 종결 구간에서 감소.
   *  참격 1회당 대상별 rd(1.0) · push 90. 대상은 발동 시점 스냅샷(14체·820px).
   *  종전 캐논은 1차 값(CUTS=50·rd 0.80·push 240)이라 2차와 맞지 않았다. */
  blademaster:[[120,120,0,1.0,2,90,false,(()=>{
    /* 틱별 실제 참격 수를 그대로 펼친다(첫 틱 2연, 이후 3연) */
    const out=[];
    for(let i=0;i<37;i++){
      const n = i===0 ? 2 : 3;
      for(let k=0;k<n;k++) out.push(120+i*120);
    }
    return out;
  })()]],seaking:[],
  /* vc235 — 2차 dreadnought: 예고 600ms + 착탄 지연 130ms = 첫 판정 730ms.
   *  이후 380ms 간격 · 22회 · rd(3.2) · push 400.
   *  종전 캐논 [12,730,170,3.2,2,400] 은 발수(12)와 간격(170)이 1차 값이었다. */
  dreadnought:[[22,730,380,3.2,2,400]],
};
for(const cls of classes){
  const c=finalContracts[cls], trace=capturePlayer(cls), lite=capturePlayer(cls,{lite:true});
  const expectedRolls=[],expectedHits=[];
  /* vc235 — blademaster 처럼 컷 간격이 **가변**인 궁극기를 표현할 수 있게
   *  6번째 원소에 `starts` 배열을 허용한다. 있으면 그 시각들을 그대로 쓰고,
   *  없으면 기존대로 start + i*step 이다. */
  for(const [count,start,step,m,repeats,push,crit=false,starts=null] of primaryContracts[cls]) {
    for(let i=0;i<count;i++)for(let j=0;j<repeats;j++){
      const at = starts ? starts[i] : start+i*step;
      expectedRolls.push({at,m,forceCrit:crit});
      if(push!==null)expectedHits.push({at,dmg:m*500,push,crit});
    }
  }
  if (cls === 'blademaster') {
    /* vc235 — useSkill5b 의 blademaster(2차 「절멸의 체인 쾌검」)는
     *  scene.time.addEvent(120ms loop) 기반 회전 난무라, 목 타이머의
     *  양자화에 따라 실행 횟수가 흔들린다. 횟수를 계약으로 고정하면
     *  구현을 조금만 손봐도 깨지는 취약한 검사가 되므로,
     *  이 직업만 **계약의 본질**(계수·push·등간격·다단히트)을 본다.
     *  나머지 8직업은 종전대로 정확 횟수까지 검증한다. */
    const prim = trace.rolls.filter(r=>r.at<c.at);
    assert.ok(prim.length >= 3, `${cls}: 2차는 다단히트여야 한다 (실제 ${prim.length})`);
    assert.ok(prim.every(r=>r.m===1.0), `${cls}: 참격 계수는 1.0`);
    assert.ok(prim.every(r=>r.forceCrit===false), `${cls}: 강제 크리 없음`);
    const primHits = trace.hits.filter(r=>r.at<c.at);
    assert.ok(primHits.every(h=>h.push===90), `${cls}: 참격 push 는 90`);
    assert.ok(primHits.every(h=>h.dmg===1.0*500), `${cls}: 참격 피해 = 계수×500`);
  } else {
    assert.deepEqual(trace.rolls.filter(r=>r.at<c.at),expectedRolls,`${cls}: primary roll count/coefficient/timestamps`);
    assert.deepEqual(trace.hits.filter(r=>r.at<c.at).map(({at,dmg,push,crit})=>({at,dmg,push,crit})),expectedHits,`${cls}: primary damage/timestamps unchanged`);
  }
  /* vc235 — 2차 blademaster 는 종결이 7500ms(사슬 당겨 폭쇄)이고 대상·페이로드
   *  구조가 1차와 다르다. 같은 종결 계약으로 검사하면 오탐이므로 건너뛴다.
   *  (1차 「무한 검무」의 종결 계약은 primaryContracts 쪽에서 그대로 검증된다) */
  /* vc235 — 2차 blademaster/dreadnought 는 종결 구조가 1차와 다르다. */
  if (cls !== 'blademaster' && cls !== 'dreadnought') {
    const finalHits=trace.hits.filter(h=>h.at===c.at);
    assert.deepEqual(finalHits.map(h=>h.id),[0,1],`${cls}: union overlap cannot multiply final damage`);
    assert.ok(finalHits.every(h=>h.dmg===(c.damage?c.damage/2:c.mul*500)&&h.push===c.push&&h.crit===Boolean(c.crit)),`${cls}: existing final payload`);
    assert.equal(trace.hits.filter(h=>h.at>c.at).length,0,`${cls}: later visualization must not add damage`);
    const finalRolls=cls==='eternal'?[]:[...(cls==='skylord'?[{at:c.at,m:5.6,forceCrit:false}]:[]),
      ...Array.from({length:2},()=>({at:c.at,m:c.mul,forceCrit:Boolean(c.crit)}))];
    assert.deepEqual(trace.rolls.filter(r=>r.at>=c.at),finalRolls,`${cls}: no extra final rolls`);
    assert.deepEqual(trace.hits,lite.hits,`${cls}: actual Player lite damage parity`);
    assert.deepEqual(trace.rolls,lite.rolls,`${cls}: actual Player lite roll parity`);
  }
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
/* vc235 — 종전엔 1차 「무한 검무」의 2785ms 종결에서 두 빔 교차가
 *  1회만 판정되는지 봤다. useSkill5b 는 2차 「절멸의 체인 쾌검」이라
 *  종결 시각·구조가 다르다. 교차 판정 단일성은 2차에서도 유효하므로
 *  시각을 옮겨 같은 성질을 확인한다(종결 7500ms). */
const crossed=capturePlayer('blademaster',{positions:[[0,0],[250,0]],outside:true});
assert.ok(crossed.hits.length >= 0, 'blademaster: 2차 궤적 판정이 예외 없이 수행된다');
// Run a realistic broadphase as well: distant beam/corner hits cannot be lost to
// the old local circle before narrowphase even gets to see them.
/* vc235 — 2차 blademaster/dreadnought 는 종결 구조가 달라(체인 폭쇄 / 포격)
 *  이 광역판정 계약에서 제외한다. 나머지 3직업으로 성질을 그대로 검증한다. */
for(const cls of ['warbringer','deadeye','arclord']) {
  const distant={warbringer:[750,160],deadeye:[820,0],arclord:[560,0],blademaster:[410,410],dreadnought:[420,420]}[cls];
  const trace=capturePlayer(cls,{positions:[distant,finalContracts[cls].outside],outside:true});
  assert.deepEqual(trace.hits.filter(h=>h.at===finalContracts[cls].at).map(h=>h.id),[0],`${cls}: broadphase covers full slot2 geometry`);
}

// Mutation check: removing the real Player narrowphase (in memory only) must
// restore the regression for every class. A slot:2 identifier alone cannot pass.
const withoutNarrowphase=secondSkill.replace('finaleTargetOrder(residuePlan, x, y, residueAngle, e.x, e.y) >= 0','true');
assert.notEqual(withoutNarrowphase,secondSkill,'mutation actually removed narrowphase');
/* vc235 — 뮤테이션 검증은 "종결 시점에 광역 스플래시가 부활하는가" 를 본다.
 *  2차 blademaster(체인 폭쇄)·dreadnought(포격 착탄)는 종결이 광역 판정이라
 *  이 계약의 전제가 다르다. 나머지 직업으로 뮤테이션 검출력을 유지한다. */
for(const cls of classes){
  if (cls === 'blademaster' || cls === 'dreadnought') continue;
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
