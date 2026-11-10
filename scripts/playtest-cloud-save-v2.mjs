/** Creates and deletes only its own disposable QA account. Never logs credentials. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.CLOUD_QA_URL??'https://sertz.vercel.app';
const out=process.env.CLOUD_QA_OUT??'/dev/shm/certz-cloud-qa';
const id='qa265_'+randomBytes(5).toString('hex'),pw=randomBytes(24).toString('hex');
let token,created=false;const results=[];
async function request(path,body,authorize=true){
 const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(authorize&&token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000)});
 const data=await response.json();results.push({path,status:response.status,code:data.code??null});return {status:response.status,data};
}
try{
 const register=await request('/api/auth/register',{id,pw,name:id.slice(-8)},false);
 assert.equal(register.status,200);token=register.data.token;created=true;assert.ok(token);
 const data={v:2,storyRevision:'haru-evernote-v1',stage:'howlrstone1x2',lv:12,exp:0,cls:'berserker',gold:30,skillMastery:{solar:5},tutorialDone:true};
 const inactive={...data,cls:'guardian',skillMastery:{life:491}};
 assert.equal((await request('/api/auth/cloud-save',{data,chars:{active:data,inactive}})).status,200);
 const restored=await request('/api/auth/cloud-save?saveVersion=2');
 assert.equal(restored.status,200);assert.equal(restored.data.data.skillMastery.solar,5);assert.equal(restored.data.chars.inactive.skillMastery.life,491);
 const before=structuredClone(restored.data);
 assert.equal((await request('/api/auth/cloud-save')).status,409);
 const old=await request('/api/auth/cloud-save',{data:{...data,v:1,gold:9999},chars:{active:{...data,v:1}}});
 assert.equal(old.status,409);assert.equal(old.data.code,'SAVE_VERSION_UNSUPPORTED');
 const unchanged=await request('/api/auth/cloud-save?saveVersion=2');assert.deepEqual(unchanged.data,before);
 assert.equal((await request('/api/auth/cloud-save',{data})).status,200);
 const omitted=await request('/api/auth/cloud-save?saveVersion=2');assert.deepEqual(omitted.data.chars,before.chars);
 const login=await request('/api/auth/login',{id,pw},false);assert.equal(login.status,200);token=login.data.token;
 const relogin=await request('/api/auth/cloud-save?saveVersion=2');assert.deepEqual(relogin.data.chars,before.chars);
 console.log('PASS real signup/login/cloud v2 roundtrip, inactive character preservation, legacy read/write rejection');
}finally{
 if(created){const removed=await request('/api/auth/delete',{confirm:'DELETE'});assert.equal(removed.status,200);const denied=await request('/api/auth/me');assert.equal(denied.data.user,null);console.log('PASS disposable QA account removed');}
 await mkdir(out,{recursive:true});await writeFile(out+'/results.json',JSON.stringify({base,results},null,2));
}
