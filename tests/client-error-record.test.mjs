import test from 'node:test';
import assert from 'node:assert/strict';
import {recordClientError,installCrashGuard,showRecoveryOverlay} from '../src/components/game/crashGuard.ts';
test('local exception records preserve a bounded stack and scene context without copying a save',()=>{
 const oldWindow=globalThis.window,oldStorage=globalThis.sessionStorage;let raw;
 try{
  globalThis.window={__SERTZ_SCENE__:{stageDef:{key:'lilacworld1x1'},dialoguing:true,camCinema:true,tut:{currentId:'move'},save:{token:'secret',playerName:'private name'}}};
  globalThis.sessionStorage={setItem(key,value){assert.equal(key,'sertz.lastclienterror');raw=value;}};
  recordClientError({message:'first Space',stack:'stack line\n'.repeat(2000)});
  const r=JSON.parse(raw);assert.equal(r.stage,'lilacworld1x1');assert.equal(r.dialogue,true);assert.equal(r.cinema,true);assert.equal(r.stack.length,8000);
  assert.ok(!raw.includes('secret'));assert.ok(!raw.includes('private name'));
  globalThis.sessionStorage={setItem(){throw Error('quota');}};assert.doesNotThrow(()=>recordClientError(Error('storage unavailable')));
 }finally{globalThis.window=oldWindow;globalThis.sessionStorage=oldStorage;}
});
test('the first unhandled runtime exception is recorded even before the repeated-error overlay threshold',()=>{
 const oldWindow=globalThis.window,oldStorage=globalThis.sessionStorage,handlers={};let raw;
 try{
  globalThis.window={addEventListener:(event,fn)=>{handlers[event]=fn;}};
  globalThis.sessionStorage={setItem:(_key,value)=>{raw=value;}};
  installCrashGuard();handlers.error({message:'opening failed',error:Error('opening failed')});
  assert.equal(JSON.parse(raw).message,'opening failed');assert.match(JSON.parse(raw).stack,/opening failed/);
  const before=raw;handlers.unhandledrejection({reason:Error('network fetch failed')});assert.equal(raw,before);
 }finally{globalThis.window=oldWindow;globalThis.sessionStorage=oldStorage;}
});
test('recovery details are inserted as text rather than interpreted as HTML',()=>{
 const old=globalThis.document,nodes=new Map(),root={style:{},setAttribute(){},querySelector(key){if(!nodes.has(key))nodes.set(key,{addEventListener(){}});return nodes.get(key);}};
 try{
  globalThis.document={createElement(){return root;},body:{appendChild(){}}};
  const detail='<img src=x onerror=alert(1)>';showRecoveryOverlay('QA',detail,'saved');
  assert.ok(!root.innerHTML.includes(detail));assert.equal(nodes.get('#sertz-crash-detail').textContent,detail);
  assert.equal(nodes.get('#sertz-crash-title').textContent,'QA');
 }finally{globalThis.document=old;}
});
