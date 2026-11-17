/** Controlled original-engine fixture; not natural progression or physical-mobile QA. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.COMBAT_QA_URL??'http://127.0.0.1:3100',out=process.env.COMBAT_QA_OUT??'/dev/shm/certz-combat';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const results=[],errors=[];
try{
 for(const mobile of (process.env.COMBAT_QA_DESKTOP_ONLY? [false]:[false,true])){
  const context=await browser.newContext({viewport:mobile?{width:844,height:390}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.stack));
  await context.addInitScript(()=>{
   const save={v:3,storyRevision:'haru-evernote-v1',storyQuestMigration:{revision:1,credits:{}},stage:'village',lv:130,exp:0,maxHp:90000,maxMp:300,atk:123,cleared:true,youngPrincessCleared:true,playerName:'전투검증',gold:12345,weapon:'weapon_1',armor:'armor_1',owned:['weapon_1','armor_1'],questIdx:{},seen:[],tutorialDone:true,introSeen:true,lastSeen:Date.now()};
   localStorage.setItem('sertz_save_v2',JSON.stringify(save));localStorage.setItem('sertz_char_combat',JSON.stringify(save));localStorage.setItem('sertz_slots_v1',JSON.stringify({v:1,slots:8,activeId:'combat',chars:{combat:{id:'combat',name:save.playerName,lv:130,stage:'village',createdAt:Date.now(),lastSeen:Date.now()}}}));
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/게임 시작/}).first().click({timeout:120000});await page.getByRole('button',{name:'이 캐릭터로 시작'}).click();
  await page.waitForFunction(()=>window.__SERTZ_SCENE__?.assetsReady&&window.__SERTZ_SCENE__?.physics?.world,null,{timeout:120000});
  await page.waitForTimeout(800);
  await page.evaluate(()=>{
   const s=window.__SERTZ_SCENE__;window.__SERTZ_EB__.emit('dialogue:hide');window.__SERTZ_EB__.emit('dialogue:done');s.closeFeatureTutorial();s.pendingFeatureTuts=[];s.dialoguing=false;s.camCinema=false;s.agroHoldUntil=0;s.tutorialDone=true;
   s.spawnAffixSplits(s.player.x+150,s.player.y,'ll_goblin',88);s.__Enemy=s.enemies.at(-1).constructor;
   for(const e of s.enemies)e.destroy();s.enemies=[];s.camCinema=true;s.physics.world.pause();
   s.__qa=[];
  });
  const result={mode:mobile?'mobile-viewport':'desktop',motions:[]};results.push(result);
  for(const [i,key] of ['ll_goblin','ll_skeleton','ll_mushroom','ll_flyingeye'].entries()){
   const info=await page.evaluate(({key,i})=>{
    const s=window.__SERTZ_SCENE__,p=s.player,e=new s.__Enemy(s,p.x+90+i*85,p.y,key);s.__qa.push(e);
    const target={x:e.x+35,y:e.y,hp:99999,maxHp:99999,takeDamage(){},applyEnemyStatus(){}};e.__target=target;e.aiCtx.player=target;e.aiCtx.dist=35;e.aiCtx.toPlayer.set(1,0);e.modeTimer=340;e.ai.set('windup');
    e.tick(0,target);s.cameras.main.setZoom(1.6).centerOn(p.x+200,p.y);
    return{key,constructor:e.constructor.name,mode:e.ai.current,plan:e.attackPlan,warningObject:!!e.attackWarning,attack:s.anims.get(key+'-atk').frames.length,hit:s.anims.get(key+'-hit').frames.length,death:s.anims.get(key+'-death').frames.length,warning:e.attackWarning?.name,plan:e.attackPlan,anim:e.anims.currentAnim?.key,body:{w:e.body.width,h:e.body.height},hitbox:{w:e.hitW,h:e.hitH}};
   },{key,i});
   console.log('MOTION',JSON.stringify(info));assert.equal(info.attack,8);assert.equal(info.hit,4);assert.equal(info.death,4);assert.equal(info.warning,'enemy:attack-warning');assert.equal(info.anim,key+'-windup');result.motions.push(info);
  }
  await page.screenshot({path:out+'/'+result.mode+'-warnings.png'});
  result.lockedAim=await page.evaluate(()=>{
   const s=window.__SERTZ_SCENE__,e=s.__qa[0],t=e.__target;e.modeTimer=0;t.x=e.x-35;e.tick(0,t);
   return{mode:e.ai.current,anim:e.anims.currentAnim?.key,flip:e.flipX,angle:e.attackPlan.angle,warningGone:!e.attackWarning};
  });
  assert.equal(result.lockedAim.mode,'cooldown');assert.equal(result.lockedAim.anim,'ll_goblin-release');assert.equal(result.lockedAim.flip,false);assert.equal(result.lockedAim.angle,0);assert.ok(result.lockedAim.warningGone);
  await page.waitForTimeout(650);
  result.releaseRecovery=await page.evaluate(()=>{const e=window.__SERTZ_SCENE__.__qa[0];e.modeTimer=2000;e.tick(0,e.__target);return e.anims.currentAnim?.key;});
  assert.equal(result.releaseRecovery,'ll_goblin-run','a completed strike must not hold a frozen attack pose throughout recovery');
  result.stun=await page.evaluate(()=>{const e=window.__SERTZ_SCENE__.__qa[1];e.applyStun(400);return{mode:e.ai.current,warningGone:!e.attackWarning,released:e.attackReleased};});
  assert.equal(result.stun.mode,'cooldown');assert.ok(result.stun.warningGone);assert.equal(result.stun.released,false);
  result.damage=await page.evaluate(()=>{
   const s=window.__SERTZ_SCENE__,e=s.__qa[0],shown=[],original=s.spawnDamageText;s.spawnDamageText=(_x,_y,n)=>shown.push(n);
   e.def={...e.def,def:25,defPct:.25};e.hp=e.maxHp=200;e.takeDamage(100,{x:1,y:0},0,false,true);s.spawnDamageText=original;
   e.tick(0,e.__target);return{hp:e.hp,shown,anim:e.anims.currentAnim?.key,hitFlash:e.hitFlash};
  });
  assert.equal(result.damage.hp,144);assert.deepEqual(result.damage.shown,[56]);assert.equal(result.damage.anim,'ll_goblin-hit');
  await page.waitForTimeout(160);
  result.tint=await page.evaluate(()=>{const e=window.__SERTZ_SCENE__.__qa[0];e.tick(160,e.__target);return{isTinted:e.isTinted,mode:e.tintMode};});assert.equal(result.tint.isTinted,false);
  // Run original animations at their native rates, collecting actual rendered texture keys.
  for(const motion of ['atk','hit','death']){
   await page.evaluate(m=>{for(const e of window.__SERTZ_SCENE__.__qa)e.anims.timeScale=1,e.play(e.def.key+'-'+m);},motion);
   const frames=[new Set(),new Set(),new Set(),new Set()];
   for(let frame=0;frame<(motion==='atk'?35:motion==='hit'?12:23);frame++){
    const values=await page.evaluate(()=>window.__SERTZ_SCENE__.__qa.map(e=>e.texture.key));values.forEach((v,i)=>frames[i].add(v));await page.waitForTimeout(20);
   }
   const counts=frames.map(f=>f.size);result[motion+'Observed']=counts;assert.ok(counts.every(n=>n>=(motion==='atk'?6:3)),motion+' must show the actual multi-frame strip');
  }
  await page.screenshot({path:out+'/'+result.mode+'-death-poses.png'});
  if(!mobile){
   await page.evaluate(()=>{const s=window.__SERTZ_SCENE__;s.playRemoteAction({id:'qa-remote',kind:'s5',cls:'crusader',x:s.player.x+50,y:s.player.y,flip:false});});
   await page.waitForFunction(()=>window.__SERTZ_SCENE__.textures.exists('sunburst'),null,{timeout:15000});
   await page.evaluate(()=>{const s=window.__SERTZ_SCENE__;s.playRemoteAction({id:'qa-remote',kind:'s5f',cls:'crusader',x:s.player.x+50,y:s.player.y,flip:false});});
   result.remoteFinale=await page.evaluate(()=>window.__SERTZ_SCENE__.children.list.some(o=>o.active&&o.texture?.key==='sunburst'));
   assert.equal(result.remoteFinale,true);await page.screenshot({path:out+'/remote-ultimate-finale.png'});
  }
  const samples=[];const loops=mobile?Number(process.env.COMBAT_QA_SOAK_LOOPS??60):5;
  const cdp=await context.newCDPSession(page);
  for(let i=0;i<loops;i++){
   await page.evaluate(()=>{const s=window.__SERTZ_SCENE__,e=new s.__Enemy(s,s.player.x+100,s.player.y,'ll_goblin');e.takeDamage(999999,{x:1,y:0},0);});
   await page.waitForTimeout(600);
   if(i%10===0){await cdp.send('HeapProfiler.collectGarbage');samples.push({cycle:i,...await cdp.send('Runtime.getHeapUsage'),objects:await page.evaluate(()=>window.__SERTZ_SCENE__.children.list.length)});}
  }
  await page.evaluate(()=>{const s=window.__SERTZ_SCENE__;for(const e of s.__qa)e.destroy();s.__qa=[];});
  await page.waitForFunction(()=>!window.__SERTZ_SCENE__.children.list.some(o=>o.texture?.key.startsWith('ll_goblin_death')&&o.active),null,{timeout:5000});
  result.cleanup=await page.evaluate(()=>{const s=window.__SERTZ_SCENE__;return{warnings:s.children.list.filter(o=>o.name==='enemy:attack-warning').length,corpses:s.children.list.filter(o=>o.texture?.key.startsWith('ll_goblin_death')&&o.active).length};});
  assert.equal(result.cleanup.warnings,0);assert.equal(result.cleanup.corpses,0);result.soak={cycles:loops,samples,scope:'Controlled spawn/death cycles; mobile viewport uses desktop Chromium software WebGL, JS heap/backing storage only. No physical GPU measurement.'};
  assert.deepEqual(errors,[]);await context.close();console.log('PASS',result.mode);
 }
}finally{await writeFile(out+'/results.json',JSON.stringify({results,pageErrors:errors,scope:'Disposable fixture in original game engine; no natural-play or physical-device claim.'},null,2));await browser.close();}
