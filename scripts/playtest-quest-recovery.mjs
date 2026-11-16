/** Controlled legacy-save fixture; recovery itself uses the quest UI and normal NPC interaction. */
import{chromium}from'playwright';import{mkdir,writeFile}from'node:fs/promises';import assert from'node:assert/strict';
const base=process.env.RECOVERY_QA_URL??'http://127.0.0.1:3100';const out=process.env.RECOVERY_QA_OUT??'/dev/shm/certz-quest-recovery';await mkdir(out,{recursive:true});
const old={v:3,storyRevision:'haru-evernote-v1',stage:'dlcstargate2',lv:130,exp:3456,maxHp:2100,maxMp:300,atk:123,cleared:true,youngPrincessCleared:true,playerName:'모호저장검증',gold:12345,emerald:67,weapon:'weapon_1',armor:'armor_1',owned:['weapon_1','armor_1'],questIdx:{dlcstargate2:1},questAccepted:{dlcstargate2:1},seen:[],cutsceneSeen:['stage:dlcstargate2'],tutorialDone:true,introSeen:true,lastSeen:Date.now()};
const raw=JSON.stringify(old),slots=JSON.stringify({v:1,slots:8,activeId:'review',chars:{review:{id:'review',name:old.playerName,lv:130,stage:old.stage,cleared:true,lastSeen:old.lastSeen,createdAt:old.lastSeen,rebirths:0}}});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:800},storageState:{cookies:[],origins:[{origin:new URL(base).origin,localStorage:[{name:'sertz_save_v2',value:raw},{name:'sertz_char_review',value:raw},{name:'sertz_slots_v1',value:slots}]}]}}),page=await context.newPage(),errors=[],result={errors};page.on('pageerror',e=>errors.push(e.stack));
const state=()=>page.evaluate(()=>{const s=window.__SERTZ_SCENE__;return s?.assetsReady?{stage:s.stageDef.key,idx:s.questIdx,q:s.currentQuest(),p:{x:s.player.x,y:s.player.y,gold:s.player.gold,exp:s.player.exp,lv:s.player.lv},target:s.interactables.find(it=>it.dlg==='storyTalk|gpBoundary'),dialogue:s.dialoguing,cinema:s.camCinema,save:s.buildSave(),backup:localStorage.getItem('sertz:migration-backup:v3:quest-layout:sertz_char_review')}:null;});
async function enter(){await page.getByRole('button',{name:/게임 시작/}).first().click({timeout:120000});await page.getByRole('button',{name:'이 캐릭터로 시작'}).click();await page.waitForFunction(()=>window.__SERTZ_SCENE__?.assetsReady&&window.__SERTZ_SCENE__.physics?.world,null,{timeout:120000});}
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});await enter();result.before=await state();assert.equal(result.before.idx,1);assert.ok(result.before.save.storyQuestMigration.review.includes(old.stage));assert.equal(result.before.backup,raw);
 await page.getByRole('button',{name:/퀘스트 로그 열기/}).click();await page.waitForTimeout(400);await page.screenshot({path:out+'/quest-review.png'});await page.getByRole('button',{name:'이 구역 목표 다시 열기',exact:true}).click();await page.keyboard.press('Escape');result.recovered=await state();assert.equal(result.recovered.idx,0);assert.equal(result.recovered.p.gold,result.before.p.gold);assert.equal(result.recovered.p.exp,result.before.p.exp);
 for(let i=0;i<150;i++){
  const s=await state();if(s.idx===1){result.complete=s;break;}
  if(s.dialogue||s.cinema){await page.keyboard.press('Space',{delay:60});await page.waitForTimeout(260);continue;}
  assert.ok(s.target);const dx=s.target.x-s.p.x,dy=s.target.y-s.p.y;
  if(Math.hypot(dx,dy)<50){await page.keyboard.press('Space',{delay:60});await page.waitForTimeout(300);continue;}
  const keys=[];if(Math.abs(dx)>8)keys.push(dx>0?'ArrowRight':'ArrowLeft');if(Math.abs(dy)>8)keys.push(dy>0?'ArrowDown':'ArrowUp');for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(80);for(const k of keys)await page.keyboard.up(k);
 }
 assert.ok(result.complete);assert.equal(result.complete.p.gold,result.before.p.gold);assert.equal(result.complete.p.exp,result.before.p.exp);assert.equal(result.complete.save.storyQuestMigration.credits[old.stage],undefined);await page.screenshot({path:out+'/recovered-objective.png'});
 await page.waitForTimeout(600);await page.reload({waitUntil:'domcontentloaded'});await enter();result.restored=await state();assert.equal(result.restored.idx,1);assert.ok(!result.restored.save.storyQuestMigration.review.includes(old.stage));assert.equal(result.restored.backup,raw);assert.equal(errors.length,0);console.log('PASS ambiguous save recovery, no duplicate reward, reload and original backup');
}finally{await writeFile(out+'/results.json',JSON.stringify(result,null,2));await browser.close();}
