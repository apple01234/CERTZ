/** Disposable local fixture. Uses the real Boss.endAttack and timer, not a natural boss clear. */
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.RECOVERY_QA_OUT??'/dev/shm/certz-v266-qa/recovery';
const storage=JSON.parse(await readFile(process.env.RECOVERY_QA_STORAGE??'/dev/shm/tutorial-complete-storage.json','utf8'));
const base=process.env.RECOVERY_QA_URL??'http://127.0.0.1:3100';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const results=[];
try {
 for(const mobile of [false,true]) {
  const context=await browser.newContext({storageState:storage,viewport:mobile?{width:844,height:390}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/게임 시작/}).first().click({timeout:120000});
  await page.getByRole('button',{name:'이 캐릭터로 시작'}).click();
  await page.waitForFunction(()=>window.__SERTZ_SCENE__?.assetsReady,null,{timeout:120000});
  await page.waitForTimeout(1600);
  await page.evaluate(()=>{
   const s=window.__SERTZ_SCENE__,p=s.player;
   window.__SERTZ_EB__.emit('dialogue:hide');window.__SERTZ_EB__.emit('dialogue:done');
   s.closeFeatureTutorial();s.pendingFeatureTuts=[];s.autoHunt=false;s.camCinema=false;s.dialoguing=false;s.physics.world.resume();
   s.introStep=2;s.agroHoldUntil=0;p.iframes=999999;
   s.enemies.forEach(e=>e.setTutorialPaused(true));
   s.stageDef={...s.stageDef,bossKey:'dio'};s.bossDiffPending=false;
   s.portalHome={x:p.x+100,y:p.y+10};s.spawnBoss(false);
  });
  await page.waitForFunction(()=>{const b=window.__SERTZ_SCENE__.boss;return b.entranceDone&&b.countdown===0;},null,{timeout:15000});
  const opened=await page.evaluate(()=>{
   const s=window.__SERTZ_SCENE__,b=s.boss;b.lastAttack='slam';b.endAttack(2000);
   return {mode:b.mode,ms:b.modeTimer,hp:b.hp,maxHp:b.maxHp};
  });
  await page.waitForFunction(()=>window.__SERTZ_SCENE__.boss.recoveryLabel?.visible);
  const cue=await page.evaluate(()=>{const b=window.__SERTZ_SCENE__.boss;return {text:b.recoveryLabel.text,visible:b.recoveryLabel.visible,x:b.recoveryLabel.x,y:b.recoveryLabel.y};});
  assert.equal(opened.mode,'recover');assert.equal(opened.ms,1600);assert.match(cue.text,/공격 기회 · 피해 \+15%/);
  await page.screenshot({path:out+'/'+(mobile?'touch':'keyboard')+'-recovery.png'});
  await page.waitForFunction(()=>{const b=window.__SERTZ_SCENE__.boss;return b.mode!=='recover'&&!b.recoveryLabel.visible;},null,{timeout:4000});
  const cleanup=await page.evaluate(()=>{const b=window.__SERTZ_SCENE__.boss,label=b.recoveryLabel;b.destroyPool();return {label:b.recoveryLabel,active:label.active};});
  assert.equal(cleanup.label,null);assert.equal(cleanup.active,false);assert.deepEqual(errors,[]);
  results.push({mode:mobile?'touch':'keyboard',opened,cue,cleanup,pageErrors:errors});
  console.log('PASS',mobile?'touch':'keyboard');await context.close();
 }
 await writeFile(out+'/results.json',JSON.stringify({fixture:'Boss spawned near disposable player; real endAttack(slam), normal ticking; no boss clear claimed',results},null,2));
} finally {await browser.close();}
