/** Actual transport + MQTT/WebSocket wire test. Legacy protocol clients are not APK devices. */
import mqtt from 'mqtt';
import packet from 'mqtt-packet';
import {WebSocketServer} from 'ws';
import ts from 'typescript';
import vm from 'node:vm';
import fs from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {rekeyLegacy,legacyStageKeys} from '../src/game/legacyKeys.ts';
const out=process.env.MQTT_QA_OUT??'/dev/shm/certz-mqtt-wire';await mkdir(out,{recursive:true});
const clients=[],intervals=[],timeouts=[],buses=[],result={scope:'Actual MqttBus implementation over MQTT 3.1.1/WebSocket; old protocol clients use mqtt.js, not an Android APK.',events:[]};
const nonce=Date.now().toString(36),stage='qa_'+nonce;let seq=0;
const module={exports:{}};
const code=ts.transpileModule(fs.readFileSync('src/game/mpMqtt.ts','utf8')+'\nexport {MqttBusImpl};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const servers=[],sockets=[];
const urls=['wss://broker.emqx.io:8084/mqtt','wss://broker.hivemq.com:8884/mqtt'];
if(process.env.MQTT_QA_LOCAL==='1'){
 result.scope+=' Controlled local brokers replace the two public endpoints.';
 for(let i=0;i<2;i++){
  const server=new WebSocketServer({host:'127.0.0.1',port:0});servers.push(server);
  await new Promise(r=>server.once('listening',r));
  const peers=new Set();
  const publish=(topic,payload)=>{for(const p of peers)if(p.topics.has(topic)&&p.ws.readyState===1)p.ws.send(packet.generate({cmd:'publish',topic,payload,qos:0,retain:false}));};
  server.on('connection',ws=>{
   sockets.push(ws);const p={ws,topics:new Set(),will:null};peers.add(p);
   const parser=packet.parser();ws.on('message',b=>parser.parse(b));
   parser.on('packet',m=>{
    if(m.cmd==='connect'){p.will=m.will;ws.send(packet.generate({cmd:'connack',returnCode:0,sessionPresent:false}));}
    if(m.cmd==='subscribe'){for(const sub of m.subscriptions)p.topics.add(sub.topic);ws.send(packet.generate({cmd:'suback',messageId:m.messageId,granted:m.subscriptions.map(()=>0)}));}
    if(m.cmd==='unsubscribe'){for(const t of m.unsubscriptions)p.topics.delete(t);ws.send(packet.generate({cmd:'unsuback',messageId:m.messageId}));}
    if(m.cmd==='publish')publish(m.topic,m.payload);
    if(m.cmd==='pingreq')ws.send(packet.generate({cmd:'pingresp'}));
    if(m.cmd==='disconnect'){p.will=null;ws.close();}
   });
   ws.on('close',()=>{peers.delete(p);if(p.will)publish(p.will.topic,p.will.payload);});
  });
 }
}
const realConnect=mqtt.connect.bind(mqtt);
const connect=(url,options)=>{const idx=urls.indexOf(url);const c=realConnect(servers.length?'ws://127.0.0.1:'+servers[idx].address().port:url,options);clients.push(c);return c;};
vm.runInNewContext(`(function(require,module,exports){${code}})`,{Buffer,console,Date,setInterval:(...args)=>{const t=setInterval(...args);intervals.push(t);return t;},setTimeout:(...args)=>{const t=setTimeout(...args);timeouts.push(t);return t;},window:{addEventListener(){},localStorage:{getItem(){return null;}}}})(name=>{
 if(name==='mqtt')return{connect};if(name==='./legacyKeys')return{rekeyLegacy,legacyStageKeys};if(name==='./account')return{getCachedUser:()=>null,getAuthToken:()=>null};if(name==='./server')return{resolveApiBase:()=>''};if(name==='./playerIdentity')return{presenceSessionId:()=>'qa_'+nonce+'_'+(++seq)};throw Error(name);
},module,module.exports);
async function until(fn,label,ms=20000){const start=Date.now();while(!fn()){if(Date.now()-start>ms)throw Error('Timed out: '+label);await new Promise(r=>setTimeout(r,100));}}
try{
 const a=new module.exports.MqttBusImpl(),b=new module.exports.MqttBusImpl();buses.push(a,b);
 await until(()=>a.liveLinks.size===2&&b.liveLinks.size===2,'both current clients connected to both existing public brokers');
 result.connectedBrokers=[...a.links.keys()];
 const join={stage,name:'통신QA',lv:1,x:10,y:20};a.emit('join',join);b.emit('join',join);await new Promise(r=>setTimeout(r,1500));
 const seen={act:[],boss:[],trade:[]};for(const ev of Object.keys(seen))b.on(ev,p=>seen[ev].push(p));
 a.emit('act',{kind:'s5',x:10,y:20});a.emit('act',{kind:'s5f',x:10,y:20});a.emit('boss',{n:123});a.tradeSend(b.id,{k:'treq',name:'통신QA'});
 await until(()=>seen.act.length>=2&&seen.boss.length&&seen.trade.length,'current double-broker commands');await new Promise(r=>setTimeout(r,1000));
 assert.equal(seen.act.length,2);assert.equal(seen.boss.length,1);assert.equal(seen.trade.length,1);result.current=seen;
 for(const [idx,url]of urls.entries()){
  const old=connect(url,{clientId:'oldqa_'+nonce+'_'+idx,reconnectPeriod:0,connectTimeout:8000}),oldActs=[];
  old.on('message',(_t,p)=>{const m=JSON.parse(p);if(m.k==='act'&&m.pid===a.id)oldActs.push(m);});
  await until(()=>old.connected,'legacy protocol connection '+idx);await old.subscribeAsync('sertz/mp/v2/stage/'+stage);
  old.publish('sertz/mp/v2/stage/'+stage,JSON.stringify({k:'hi',pid:'oldqa'+idx,name:'LegacyQA',stage,x:30,y:40}));
  await until(()=>a.peers.has('oldqa'+idx),'old protocol -> current on broker '+idx);
  const kind=idx===0?'s1':'s2';
  a.emit('act',{kind,x:10,y:20});await until(()=>oldActs.some(m=>m.kind===kind),'current -> old protocol '+idx);
  result.events.push({broker:idx,legacyToCurrent:true,currentToLegacy:true});
 }
 // One dropped link must not make either peer disappear while the other continues.
 a.sendState(true);await new Promise(r=>setTimeout(r,800));a.links.get(0).end(true);
 await until(()=>a.liveLinks.size===1,'one broker disconnect');a.sendState(true);await new Promise(r=>setTimeout(r,1000));
 assert.ok(a.connected);assert.ok(b.peers.has(a.id));result.singleBrokerSurvival=true;result.passed=true;
 console.log('PASS real MQTT/WebSocket wire test');
}catch(e){result.failure=e.stack;console.error(result.failure);process.exitCode=1;}
finally{
 for(const t of intervals)clearInterval(t);for(const t of timeouts)clearTimeout(t);
 for(const c of clients)c.end(true);for(const socket of sockets)socket.terminate();for(const server of servers)server.close();await writeFile(out+'/results.json',JSON.stringify(result,null,2));
}
