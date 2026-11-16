/** Reopen and reload the character produced by a real-input playthrough. No save mutations. */
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.RECONNECT_QA_URL??'https://sertz.vercel.app';
const out=process.env.RECONNECT_QA_OUT??'/dev/shm/certz-reconnect';
const storage=JSON.parse(await readFile(process.env.RECONNECT_QA_STORAGE??out+'/first-boss-storage.json','utf8'));
const local=storage.origins.find(o=>o.origin===new URL(base).origin)?.localStorage;
assert.ok(local,'storage must belong to the site being tested');
const slots=JSON.parse(local.find(r=>r.name==='sertz_slots_v1').value),key='sertz_char_'+slots.activeId;
const saved=JSON.parse(local.find(r=>r.name===key).value);
assert.equal(saved.stage,'lilacworld2x3');assert.equal(saved.questIdx[saved.stage],1);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
await mkdir(out,{recursive:true});const result={base,errors:[],checks:[]};
try{
 const context=await browser.newContext({storageState:storage,viewport:{width:1280,height:800}}),page=await context.newPage();
 page.on('pageerror',e=>result.errors.push(e.stack??e.message));
 for(const mode of ['reconnect','reload']){
  if(mode==='reload')await page.reload({waitUntil:'domcontentloaded'});else await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/게임 시작/}).first().click({timeout:120000});
  await page.getByRole('button',{name:'이 캐릭터로 시작'}).click();
  await page.waitForFunction(()=>window.__SERTZ_SCENE__?.assetsReady,null,{timeout:120000});
  const state=await page.evaluate(()=>{const s=window.__SERTZ_SCENE__,p=s.player;return{stage:s.stageDef.key,idx:s.questIdx,lv:p.lv,ap:p.ap,gold:p.gold,weapon:p.weapon,armor:p.armor,boss:s.boss?.alive??false,save:s.buildSave(),slots:JSON.parse(localStorage.getItem('sertz_slots_v1'))};});
  assert.equal(state.stage,saved.stage);assert.equal(state.idx,1);assert.equal(state.boss,false);
  for(const field of ['lv','ap','gold','weapon','armor'])assert.equal(state[field],saved[field],field);
  assert.equal(state.save.playerName,saved.playerName);assert.equal(state.slots.activeId,slots.activeId);
  result.checks.push({mode,stage:state.stage,idx:state.idx,lv:state.lv,ap:state.ap,gold:state.gold,boss:state.boss});
  await page.screenshot({path:out+'/'+mode+'.png'});
 }
 result.version=await page.evaluate(async()=>{const r=await fetch('/api/version');return r.json();});
 assert.deepEqual(result.errors,[]);result.passed=true;console.log('PASS save reconnect and reload',result.checks);
}finally{await writeFile(out+'/reconnect-results.json',JSON.stringify(result,null,2));await browser.close();}
