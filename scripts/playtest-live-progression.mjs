/** Continue the UI-created tutorial character. Reads state; all actions use normal controls. */
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {nextStepToward} from '../src/game/navigation.ts';
import assert from 'node:assert/strict';
const out=process.env.PROGRESSION_QA_OUT??'/dev/shm/certz-live-progression';
const storage=JSON.parse(await readFile(out+'/tutorial-complete-storage.json','utf8'));
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const history=[],errors=[];let final;
await mkdir(out,{recursive:true});
try{
 const context=await browser.newContext({storageState:storage,viewport:{width:1280,height:800}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://sertz.vercel.app?renderer=canvas',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:/게임 시작/}).first().click({timeout:60000});await page.getByRole('button',{name:'이 캐릭터로 시작'}).click();
 const state=()=>page.evaluate(()=>{
  const s=window.__SERTZ_SCENE__;if(!s?.assetsReady||!s.physics?.world)return null;
  const p=s.player,point=o=>o?.active?{x:o.x,y:o.y}:null,q=s.currentQuest();
  return {stage:s.stageDef.key,dialogue:s.dialoguing,cinema:s.camCinema,feature:s.featureTutOpen,panel:s.panelNavOpen,auto:s.autoHunt,
   p:{x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp,mp:p.mp,maxMp:p.maxMp,lv:p.lv,state:p.state,potions:p.potions,atk:p.atk},quest:q,hunt:s.huntCount,
   fragment:point(s.fragment),portal:s.portalActive?point(s.portal):null,boss:s.boss?.alive?{...point(s.boss),hp:s.boss.hp,maxHp:s.boss.maxHp,mode:s.boss.mode}:null,
   questIdx:s.questIdx,layout:s.layout?{cols:s.layout.cols,rows:s.layout.rows,open:s.layout.open,cellW:s.layout.cellW,cellH:s.layout.cellH}:null,
   enemies:s.enemies.filter(e=>e.active&&e.alive).map(e=>({x:e.x,y:e.y,key:e.def.key,hp:e.hp})),kills:s.totalKills};
 });
 let lastLog=0,lastStage,started=Date.now(),bossSeen=false;
 const press=key=>page.keyboard.press(key,{delay:60});
 async function move(s,target,range=16,away=false){
  let point=target;const l=s.layout;
  if(!away&&l){const cell=o=>Math.floor(o.y/l.cellH)*l.cols+Math.floor(o.x/l.cellW),from=cell(s.p),to=cell(target);if(from!==to){const next=nextStepToward(l,from,to);if(next!==null)point={x:(next%l.cols+.5)*l.cellW,y:(Math.floor(next/l.cols)+.5)*l.cellH};}}
  const dx=(point.x-s.p.x)*(away?-1:1),dy=(point.y-s.p.y)*(away?-1:1),keys=[];
  if(Math.hypot(dx,dy)<=range&&!away)return;
  if(Math.abs(dx)>8)keys.push(dx>0?'ArrowRight':'ArrowLeft');if(Math.abs(dy)>8)keys.push(dy>0?'ArrowDown':'ArrowUp');
  for(const key of keys)await page.keyboard.down(key);if(away)await press('Shift');await page.waitForTimeout(130);for(const key of keys)await page.keyboard.up(key);
 }
 while(Date.now()-started<15*60*1000){
  const s=await state();if(!s){await page.waitForTimeout(200);continue;}final=s;
  if(s.stage!==lastStage||Date.now()-lastLog>15000){const snap={...s};delete snap.layout;delete snap.enemies;history.push(snap);console.log('STATE',JSON.stringify(snap));lastLog=Date.now();if(s.stage!==lastStage)await page.screenshot({path:out+'/'+s.stage+'.png'});lastStage=s.stage;}
  if(s.p.state==='dead')throw Error('Natural character died: '+JSON.stringify(s.p));
  if(s.dialogue||s.cinema){await press('Space');await page.waitForTimeout(180);continue;}
  if(s.feature){const close=page.getByRole('button',{name:'닫기',exact:true});if(await close.last().isVisible())await close.last().click();continue;}
  if(s.panel){await press('Escape');continue;}
  if(s.auto)await press('b');
  if(s.stage==='howlrstone2x3'&&s.boss)bossSeen=true;
  if(bossSeen&&s.stage==='howlrstone2x3'&&!s.boss&&s.questIdx>0){await page.screenshot({path:out+'/first-boss-defeated.png'});console.log('PASS first boss defeated through normal controls');break;}
  if(s.p.hp<s.p.maxHp*.6&&s.p.potions.hp>0)await press('d');
  if(s.p.mp<20&&s.p.potions.mp>0)await press('f');
  if(s.portal){await move(s,s.portal);continue;}
  if(s.fragment){await move(s,s.fragment,5);continue;}
  const targets=s.boss?[s.boss]:s.enemies.filter(e=>s.quest?.type!=='hunt'||!(s.quest.targetKeys??[s.quest.targetKey]).filter(Boolean).length||(s.quest.targetKeys??[s.quest.targetKey]).includes(e.key));
  const target=targets.sort((a,b)=>Math.hypot(a.x-s.p.x,a.y-s.p.y)-Math.hypot(b.x-s.p.x,b.y-s.p.y))[0];
  if(target){
   if(s.boss&&/Tele|telegraph|chargeWind/.test(s.boss.mode)){await move(s,target,0,true);continue;}
   const distance=Math.hypot(target.x-s.p.x,target.y-s.p.y);
   if(distance>38)await move(s,target,20);
   if(distance<90){await press('x');await press('z');}
  }else await page.waitForTimeout(250);
 }
 assert.ok(bossSeen&&final.stage==='howlrstone2x3'&&!final.boss&&final.questIdx>0,'first boss clear not reached');
 assert.equal(errors.length,0,errors.join('\n'));
 await context.storageState({path:out+'/first-boss-storage.json'});
}finally{
 await writeFile(out+'/progression-results.json',JSON.stringify({history,final,pageErrors:errors,actions:'normal keyboard/UI only; no progress, stats, enemy HP or timers changed'},null,2));await browser.close();
}
