/** Three-minute controlled input sample; not a natural-progression balance study. */
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.MASTERY_QA_URL??'http://127.0.0.1:3100',out='/dev/shm/certz-mastery-cadence';
const storage=JSON.parse(await readFile('/dev/shm/tutorial-complete-storage.json','utf8'));
const profiles={berserker:'solar',guardian:'life',sniper:'lightning',windrunner:'chakram',archmage:'book',sage:'art',assassin:'shadow',swashbuckler:'copy',corsair:'water',raider:'hammer'};
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});const results=[],errors=[];
try{
 const context=await browser.newContext({storageState:storage});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'?renderer=canvas',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:/게임 시작/}).first().click({timeout:60000});await page.getByRole('button',{name:'이 캐릭터로 시작'}).click();
 await page.waitForFunction(()=>window.__SERTZ_SCENE__?.assetsReady,null,{timeout:40000});
 await page.waitForTimeout(1000);
 await page.evaluate(()=>{const s=window.__SERTZ_SCENE__;window.__SERTZ_EB__.emit('dialogue:hide');window.__SERTZ_EB__.emit('dialogue:done');s.closeFeatureTutorial();s.pendingFeatureTuts=[];s.camCinema=false;s.dialoguing=false;s.autoHunt=false;s.physics.world.resume();s.agroHoldUntil=s.time.now+999999;document.activeElement?.blur();});
 for(const [cls,style] of Object.entries(profiles)){
  await page.evaluate(({cls,style})=>{const s=window.__SERTZ_SCENE__,p=s.player;p.cancelSkillCast();p.state='idle';p.cls=cls;p.skillMastery={[style]:0};p.mp=p.maxMp;p.skill1Cd=0;p.iframes=999999;p.facing.set(1,0);}, {cls,style});
  const started=Date.now();let attempts=0;
  while(Date.now()-started<18000){
   const ready=await page.evaluate(()=>{const s=window.__SERTZ_SCENE__,p=s.player;return s.canPlayerAction('skill1')&&p.state==='idle'&&p.skill1Cd<=0&&p.mp>=15;});
   if(ready){await page.keyboard.press('z',{delay:50});attempts++;}
   await page.waitForTimeout(100);
  }
  await page.waitForTimeout(600);
  const measured=await page.evaluate(()=>{const p=window.__SERTZ_SCENE__.player;return {...p.skill1Mastery,mp:p.mp,cooldownMs:p.skill1MaxEff};});
  assert.ok(measured.uses>0&&measured.uses<=attempts);assert.ok(measured.level<=10&&measured.powerBonusPct<=20);
  results.push({cls,style,elapsedMs:Date.now()-started,attempts,...measured});console.log('PROFILE',JSON.stringify(results.at(-1)));
 }
 assert.equal(errors.length,0,errors.join('\n'));await mkdir(out,{recursive:true});await writeFile(out+'/results.json',JSON.stringify({sample:'10 × 18-second controlled input windows, original cooldown/MP regeneration',results,pageErrors:errors},null,2));
}finally{await browser.close();}
