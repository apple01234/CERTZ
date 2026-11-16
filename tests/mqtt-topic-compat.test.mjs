import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {rekeyLegacy,legacyStageKeys} from '../src/game/legacyKeys.ts';
function rig(){
 const clients=[],sent=[];let now=10000;
 class Clock extends Date{static now(){return now;}}
 const connect=()=>{const c={events:{},topics:new Set(),on(ev,fn){this.events[ev]=fn;},subscribe(keys){for(const k of [keys].flat())this.topics.add(k);},unsubscribe(keys){for(const k of [keys].flat())this.topics.delete(k);},publish(topic,payload){sent.push({topic,data:JSON.parse(payload)});for(const x of clients)if(x.topics.has(topic))x.events.message?.(topic,Buffer.from(payload));},end(){}};clients.push(c);return c;};
 const code=ts.transpileModule(fs.readFileSync('src/game/mpMqtt.ts','utf8')+'\nexport { MqttBusImpl };',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};let id=0;
 vm.runInNewContext(`(function(require,module,exports){${code}})`,{console,Buffer,Date:Clock,setInterval:()=>0,setTimeout:()=>0,window:{addEventListener(){},localStorage:{getItem(){return null;}}}})(name=>{
  if(name==='mqtt')return{connect};if(name==='./legacyKeys')return{rekeyLegacy,legacyStageKeys};
  if(name==='./account')return{getCachedUser:()=>null,getAuthToken:()=>null};if(name==='./server')return{resolveApiBase:()=>''};
  if(name==='./playerIdentity')return{presenceSessionId:()=>'current'+(++id)};throw Error(name);
 },module,module.exports);
 const make=()=>{const b=new module.exports.MqttBusImpl();clients.at(-1).events.connect();return b;};
 return{make,clients,sent,advance:()=>{now+=1000;}};
}
test('old APK map topics work in both directions while current clients receive each effect once',()=>{
 const r=rig(),a=r.make(),b=r.make(),prefix='sertz/mp/v2/stage/';
 const join={stage:'lilacworld2x3',name:'QA',lv:13,x:10,y:20};a.emit('join',join);b.emit('join',join);
 const aliases=legacyStageKeys(join.stage);assert.equal(aliases.length,2);
 let actionsA=0,actionsB=0,boss=0;a.on('act',()=>actionsA++);b.on('act',()=>actionsB++);b.on('boss',()=>boss++);
 a.emit('act',{kind:'s1',x:10,y:20});assert.equal(actionsA,0);assert.equal(actionsB,1);
 const oldHi={k:'st',pid:'old-apk',name:'Legacy',lv:13,stage:aliases[1],x:34,y:56};
 for(const c of r.clients)c.events.message(prefix+aliases[1],Buffer.from(JSON.stringify(oldHi)));
 assert.equal(a.peers.get('old-apk').stage,join.stage);assert.equal(b.peers.get('old-apk').x,34);
 r.advance();a.emit('state',{...join,x:72});
 const oldCopy=r.sent.findLast(m=>m.topic===prefix+aliases[1]&&m.data.k==='st');assert.ok(oldCopy);assert.equal(oldCopy.data.stage,aliases[1]);
 r.advance();a.emit('boss',{n:10});assert.equal(boss,1,'shared boss damage must not be duplicated across aliases');
 r.advance();a.emit('boss',{hp:100,max:3600});assert.equal(boss,2,'host HP is received once');
 const oldAct=Buffer.from(JSON.stringify({k:'act',pid:'old-apk',kind:'s5b',x:34,y:56}));
 for(const c of r.clients)c.events.message(prefix+aliases[1],oldAct);
 assert.equal(actionsA,1);assert.equal(actionsB,2);
 a.emit('state',{...join,stage:'village'});
 assert.ok(!r.clients[0].topics.has(prefix+aliases[1]));assert.ok(r.clients[0].topics.has(prefix+'village'));
 r.clients[0].events.message(prefix+aliases[1],oldAct);assert.equal(actionsA,1,'old-map messages are ignored after moving');
 r.clients[0].events.connect();assert.ok(r.clients[0].topics.has(prefix+'village'));
});
test('only stage prefixes have reverse aliases; ordinary words and unrelated regions stay unchanged',()=>{
 for(const stage of ['village','snorika5','help','shell','dlcstargate2'])assert.deepEqual(legacyStageKeys(stage),[stage]);
 for(const stage of ['lilacworld1x1','fairyglade2x1','emberland1x3','frostland4x1','forgehall2x2','duskrealm3x1']){
  assert.ok(legacyStageKeys(stage).length>1);for(const key of legacyStageKeys(stage))assert.equal(rekeyLegacy(key),stage);
 }
});
