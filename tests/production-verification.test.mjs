import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyDeployment } from '../scripts/check_deploy_status.js';
const a='a'.repeat(40), b='b'.repeat(40);
test('matching production and stable main pass', async()=>{
 const result=await verifyDeployment({readMain:async()=>a,readVersion:async()=>({commitSha:a,latest:'2.2.9',code:265})});
 assert.equal(result.ok,true);assert.equal(result.actualSha,a);
});
test('missing SHA and a stale deployment never pass',async()=>{
 for(const commitSha of [null,undefined,'',b]){
  const result=await verifyDeployment({readMain:async()=>a,readVersion:async()=>({commitSha})});assert.equal(result.ok,false);assert.ok(result.reason);
 }
});
test('deployment delay and HTTP failures recover only within the retry budget',async()=>{
 let calls=0,waits=0;
 const result=await verifyDeployment({readMain:async()=>a,readVersion:async()=>{calls++;if(calls===1)throw Error('HTTP 503');return {commitSha:calls===2?b:a};},attempts:3,wait:async()=>waits++});
 assert.equal(result.ok,true);assert.equal(calls,3);assert.equal(waits,2);
});
test('main advancing during a matching response is rechecked, not falsely accepted',async()=>{
 let reads=0,versions=0;
 const result=await verifyDeployment({readMain:async()=>++reads===1?a:b,readVersion:async()=>({commitSha:++versions===1?a:b}),attempts:2});
 assert.equal(result.ok,true);assert.equal(result.expectedSha,b);assert.equal(result.attempt,2);
});
test('missing GitHub main metadata and exhausted retries fail closed',async()=>{
 const invalid=await verifyDeployment({readMain:async()=>undefined,readVersion:async()=>({commitSha:a})});assert.equal(invalid.ok,false);
 let waits=0;
 const stale=await verifyDeployment({readMain:async()=>b,readVersion:async()=>({commitSha:a}),attempts:2,wait:async()=>waits++});
 assert.equal(stale.ok,false);assert.equal(stale.attempt,2);assert.equal(waits,1);
});
