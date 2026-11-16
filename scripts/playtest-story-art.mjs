/** Controlled local art QA: a fixture and summoned bosses; not natural progression. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { DIALOGUES } from '../src/game/data.ts';
import { LILAC_SCENARIOS } from '../src/game/lilacScenarios.ts';
const base=process.env.ART_QA_URL??'http://127.0.0.1:3100';
const out=process.env.ART_QA_OUT??'/dev/shm/certz-story-art'; await mkdir(out,{recursive:true});
const seen=[...Object.keys(DIALOGUES),...Object.values(LILAC_SCENARIOS).map(s=>'lilacCut_rea1_'+s.id)];
const old={v:3,storyRevision:'haru-evernote-v1',storyQuestMigration:{revision:1,credits:{}},stage:process.env.ART_QA_STAGE??'lilacworld2x2',lv:130,exp:0,maxHp:90000,maxMp:300,atk:123,cleared:true,youngPrincessCleared:true,playerName:'외형검증',gold:12345,weapon:'weapon_1',armor:'armor_1',owned:['weapon_1','armor_1'],questIdx:{},seen,tutorialDone:true,introSeen:true,lastSeen:Date.now()};
const raw=JSON.stringify(old), slots=JSON.stringify({v:1,slots:8,activeId:'art',chars:{art:{id:'art',name:old.playerName,cls:null,lv:130,stage:old.stage,cleared:true,lastSeen:old.lastSeen,createdAt:old.lastSeen,rebirths:0}}});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:800},storageState:{cookies:[],origins:[{origin:new URL(base).origin,localStorage:[{name:'sertz_save_v2',value:raw},{name:'sertz_char_art',value:raw},{name:'sertz_slots_v1',value:slots}]}]}});
const page=await context.newPage(), errors=[], failures=[],results=[];page.on('pageerror',e=>errors.push(e.stack));page.on('response',r=>{if(r.status()>=400&&/story-(?:enemies|bosses)/.test(r.url()))failures.push(r.url()+':'+r.status());});
async function ready(stage){await page.waitForFunction(stage=>{const s=window.__SERTZ_SCENE__;return s?.stageDef.key===stage&&s.assetsReady&&s.physics?.world&&!s.transitioning;},stage,{timeout:120000});}
async function transition(stage){await page.evaluate(({stage,seen})=>{const s=window.__SERTZ_SCENE__;s.boss?.destroyPool();s.boss?.destroy();s.boss=null;s.bossDef=null;s.dialoguing=false;s.camCinema=false;s.physics.world.resume();s.startTransition(stage,{save:{...s.buildSave(stage),seen,tutorialDone:true,introSeen:true,cleared:true,youngPrincessCleared:true}});},{stage,seen});await ready(stage);}
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/게임 시작/}).first().click({timeout:120000});await page.getByRole('button',{name:'이 캐릭터로 시작'}).click();await ready(old.stage);
 for(const [stage,expected] of (process.env.ART_QA_BOSSES?[]:[['lilacworld2x2','thought'],['lilacworld3x2','dokkaebi'],['lilacworld5x3','deckhand'],['dlcstargate8','virus'],['dlcprisma7','jadeclone'],['dlcreverse3','drone']])){
  if(stage!==old.stage)await transition(stage);
  await page.waitForTimeout(600);
  const actual=await page.evaluate(()=>{const s=window.__SERTZ_SCENE__;return {stage:s.stageDef.key,monsters:s.enemies.filter(e=>e.active).map(e=>({id:e.def.key,name:e.displayName,texture:e.texture.key,frame:e.frame.name,anim:e.anims.currentAnim?.key,hitW:e.hitW,hitH:e.hitH})),loaded:s.textures.getTextureKeys().filter(k=>k.startsWith('storymob_'))};});
  console.log('FIELD',stage,[...new Set(actual.monsters.map(e=>e.texture))].join(','));results.push(actual);assert.ok(actual.monsters.some(e=>e.texture==='storymob_'+expected),stage+':'+expected);
  if(stage==='lilacworld2x2'){
   const specials=await page.evaluate(()=>{const s=window.__SERTZ_SCENE__,Constructor=s.enemies[0].constructor,key=s.enemies[0].def.key;
    return [{displayName:'정예 원래 적'},{displayName:'시험 상대 — 룬 제령'},{dummy:true}].map(opts=>{const e=new Constructor(s,s.player.x+80,s.player.y,key,opts);const result={opts,texture:e.texture.key,name:e.displayName};e.destroy();return result;});});
   assert.equal(specials[0].texture,'storymob_thought');assert.match(specials[0].name,/^정예 사념체 · /);assert.notEqual(specials[1].texture,'storymob_thought');assert.notEqual(specials[2].texture,'storymob_thought');actual.specialSpawns=specials;
   const styles=await page.evaluate(()=>{const s=window.__SERTZ_SCENE__,Constructor=s.enemies[0].constructor;
    return ['minion','wraith','x2_stonegolem','x2_frog'].map((key,i)=>{const e=new Constructor(s,s.player.x+60+i*75,s.player.y,key);e.ai.set('chase');e.syncHpBar();e.combatBadge.setVisible(true);s.__styleQa??=[];s.__styleQa.push(e);return {key,name:e.displayName,mark:e.combatBadge.text,texture:e.texture.key,hitW:e.hitW,hitH:e.hitH};});});
   assert.equal(new Set(styles.map(s=>s.mark)).size,4);actual.styles=styles;
   await page.evaluate(()=>{const s=window.__SERTZ_SCENE__,cam=s.cameras.main;s.framedRoom=false;s.camCinema=true;cam.zoomEffect.reset();cam.panEffect.reset();s.tweens.killTweensOf(cam);cam.stopFollow();cam.setZoom(2).centerOn(s.player.x+170,s.player.y-10);for(const e of s.__styleQa){e.syncHpBar();e.combatBadge.setVisible(true);}});
   await page.waitForTimeout(100);await page.screenshot({path:out+'/combat-style-marks.png'});
   for(const motion of ['windup','attack']){
    await page.evaluate(motion=>{const s=window.__SERTZ_SCENE__,e=s.__styleQa[0];s.camCinema=true;e.play(e.texture.key+'-'+motion);},motion);
    const frames=[];for(let n=0;n<11;n++){await page.waitForTimeout(65);frames.push(await page.evaluate(()=>window.__SERTZ_SCENE__.__styleQa[0].frame.name));}
    assert.ok(new Set(frames).size>=(motion==='attack'?4:3));actual[motion+'Frames']=frames;
   }
   const cleanup=await page.evaluate(()=>{const s=window.__SERTZ_SCENE__,badges=s.__styleQa.map(e=>e.combatBadge);for(const e of s.__styleQa)e.destroy();s.__styleQa=[];s.camCinema=false;return badges.every(b=>!b.active);});assert.equal(cleanup,true);
  }
  await page.screenshot({path:out+'/'+stage+'.png'});
  if(process.env.ART_QA_MARKS_ONLY)break;
 }
 for(const [boss,stage,expected] of (process.env.ART_QA_MARKS_ONLY?[]:[['jade','dlcprisma10','story_jade'],['snorikaking','snorika5','story_snorikaking'],['verodin','lilacworld7x3','story_veronica'],['shadow','lilacworld10x2','story_thought']])){
  if(stage!==old.stage)await transition(stage);
  await page.evaluate(key=>{const s=window.__SERTZ_SCENE__;if(!s.boss)s.spawnGmBoss(key,true);s.boss.setAlpha(1);s.camCinema=true;const b=s.boss;s.player.setPosition(b.x-120,b.y+30);s.cameras.main.setZoom(1.3).centerOn(b.x,b.y);},boss);
  await page.waitForTimeout(350);
  await page.evaluate(()=>{const s=window.__SERTZ_SCENE__,cam=s.cameras.main;cam.zoomEffect.reset();cam.panEffect.reset();s.tweens.killTweensOf(cam);cam.stopFollow();cam.setZoom(1.3).centerOn(s.boss.x,s.boss.y);});
  const actual=await page.evaluate(()=>{const s=window.__SERTZ_SCENE__,b=s.boss;return {boss:b.def.key,texture:b.texture.key,frame:b.frame.name,anim:b.anims.currentAnim?.key,companions:s.children.list.filter(o=>o.name?.startsWith('story-boss:')).map(o=>({name:o.name,texture:o.texture?.key,anim:o.anims?.currentAnim?.key}))};});results.push(actual);console.log('BOSS',actual.boss,actual.texture);assert.equal(actual.texture,expected);
  if(boss==='verodin')assert.ok(actual.companions.some(c=>c.name==='story-boss:dean'&&c.texture==='story_dean'));
  await page.screenshot({path:out+'/'+boss+'-idle.png'});
  actual.firstFx=await page.evaluate(()=>{const s=window.__SERTZ_SCENE__,events=['intro','phase','pattern','charge','enrage','death','summon','telegraph'],probe=new s.pxFx.constructor(s);try{return events.map(ev=>{const before=probe.liveCount;probe.boss('boss.'+ev,s.player.x,s.player.y);return {ev,rendered:probe.liveCount>before};});}finally{probe.destroy();}});
  assert.ok(actual.firstFx.every(f=>f.rendered),'every first boss effect must render');
  await page.evaluate(()=>{const s=window.__SERTZ_SCENE__;s.__firstFxProbe=new s.pxFx.constructor(s);s.__firstFxProbe.boss('boss.intro',s.boss.x,s.boss.y);});
  await page.waitForTimeout(80);
  actual.introPixels=await page.evaluate(()=>{const s=window.__SERTZ_SCENE__;return [...s.__firstFxProbe.live].map(sp=>({active:sp.active,visible:sp.visible,texture:sp.texture.key,frame:sp.frame.name}));});
  assert.ok(actual.introPixels.some(sp=>sp.active&&sp.visible&&sp.texture==='sunburst'));
  await page.screenshot({path:out+'/'+boss+'-first-fx.png'});
  await page.evaluate(()=>{window.__SERTZ_SCENE__.__firstFxProbe.destroy();});
  const frames=[];
  await page.evaluate(()=>{const b=window.__SERTZ_SCENE__.boss;b.play(b.texture.key+'-release');});
  for(let n=0;n<5;n++){await page.waitForTimeout(80);frames.push(await page.evaluate(()=>window.__SERTZ_SCENE__.boss.frame.name));}
  assert.ok(new Set(frames).size>=2,boss+': attack must animate');actual.attackFrames=frames;
  await page.screenshot({path:out+'/'+boss+'-attack.png'});
  if(boss==='jade'){
   const clones=await page.evaluate(()=>{const s=window.__SERTZ_SCENE__;s.boss.story.start('jadeclones',s.player);return s.children.list.filter(o=>o.name==='story-boss:clone:jade').map(o=>({texture:o.texture.key,frame:o.frame.name,anim:o.anims.currentAnim?.key}));});actual.clones=clones;assert.equal(clones.length,2);assert.ok(clones.every(c=>c.texture==='story_jadeclone'));await page.screenshot({path:out+'/jade-clones.png'});
  }
  if(boss==='verodin'){
   await page.evaluate(()=>{const s=window.__SERTZ_SCENE__;s.boss.story.start('cursefield',s.player);});await page.waitForTimeout(200);actual.deanCast=await page.evaluate(()=>window.__SERTZ_SCENE__.children.list.find(o=>o.name==='story-boss:dean')?.anims.currentAnim.key);assert.equal(actual.deanCast,'story_dean-sp1');await page.screenshot({path:out+'/dean-cast.png'});
  }
 }
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(failures.length,0,failures.join('\n'));console.log('PASS controlled visual QA');
}catch(error){results.push({failure:String(error),state:await page.evaluate(()=>{const s=window.__SERTZ_SCENE__;return s?{stage:s.stageDef.key,loading:!s.assetsReady,transitioning:s.transitioning,dialogue:s.dialoguing,cinema:s.camCinema}:null;}).catch(()=>null)});throw error;}finally{await writeFile(out+'/results.json',JSON.stringify({results,errors,assetFailures:failures,scope:'Controlled art QA using a fixture, scene transitions and boss summons. Not natural-play or P0 crash verification.'},null,2));await browser.close();}
