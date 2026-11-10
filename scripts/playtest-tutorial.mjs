import { chromium } from 'playwright';
const browser = await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport:{width:1280,height:800}}); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:3100',{waitUntil:'domcontentloaded',timeout:120000});
await page.getByRole('button',{name:/게임 시작/}).first().click({timeout:120000});
await page.getByRole('button',{name:'캐릭터 생성',exact:true}).first().click();
await page.locator('input').first().fill('수련검증'+String(Date.now()).slice(-4));
await page.getByRole('button',{name:/다음/}).click();
await page.getByRole('button',{name:'모험가로 생성!'}).click();
await page.getByRole('button',{name:'이 캐릭터로 시작'}).click();
await page.waitForFunction(()=>window.__SERTZ_SCENE__?.player,null,{timeout:120000});
const press = key => page.keyboard.press(key, { delay: 90 });
let shotLilac = false;
const state = () => page.evaluate(() => { const s=window.__SERTZ_SCENE__, t=s.tut, p=s.player; return { stage:s.stageDef.key, step:t?.currentId??null, cinema:s.camCinema, dialogue:s.dialoguing, paused:s.physics.world.isPaused, player:{x:p.x,y:p.y,mp:p.mp,gold:p.gold,potions:p.potions}, target:t?.target?{x:t.target.x,y:t.target.y}:null, enemy:t?.practice?{x:t.practice.x,y:t.practice.y,active:t.practice.active}:null, windup:!!t?.evadeOrigin, done:s.tutorialDone, near:s.nearInteract, allow:s.canPlayerAction("interact"), nav:s.panelNavOpen, pending:t?.pending, kb:s.input.keyboard.enabled }; });
async function settle() {
  for (let i=0;i<170;i++) {
    const s=await state();
    if (!s.cinema && !s.dialogue) { await page.waitForTimeout(220); if (!(await state()).cinema) return; }
    if (!shotLilac && await page.locator('img[src$="/lilac.png"]').isVisible()) { await page.screenshot({path:'/dev/shm/tutorial-real-lilac.png'}); shotLilac=true; }
    const choice = page.getByRole('button',{name:'두려움에 도망치는 사람',exact:true});
    if (await choice.isVisible()) await choice.click(); else await press('Space');
    await page.waitForTimeout(230);
  }
  throw Error('cinematic did not settle '+JSON.stringify(await state()));
}
async function walk(point, range=20) {
  const startingStep=(await state()).step;
  for(let i=0;i<100;i++) {
    const s=await state(); if(s.step!==startingStep)return;
    const dx=point.x-s.player.x,dy=point.y-s.player.y;
    if(Math.hypot(dx,dy)<=range)return;
    const keys=[];if(Math.abs(dx)>8)keys.push(dx>0?'ArrowRight':'ArrowLeft');if(Math.abs(dy)>8)keys.push(dy>0?'ArrowDown':'ArrowUp');
    for(const key of keys)await page.keyboard.down(key);
    await page.waitForTimeout(75);
    for(const key of keys)await page.keyboard.up(key);
  }
  throw Error('walk stuck '+JSON.stringify({point,s:await state()}));
}
async function waitStep(step) { await page.waitForFunction(step=>window.__SERTZ_SCENE__?.tut?.currentId===step,step,{timeout:15000}); console.log('STEP',step); }
await page.waitForTimeout(1800);
// During the real opening, force both UI and direct mobile events through their shared guards.
const before = await state();
await page.keyboard.down('ArrowRight'); await press('x'); await press('z'); await press('Shift');
await page.evaluate(()=>{for(const e of ['input:attack','input:skill1','input:dash','input:interact'])window.__SERTZ_EB__.emit(e);window.__SERTZ_EB__.emit('ui:panel',{panel:'inv'});window.__SERTZ_SCENE__.player.useSkill1();});
await page.waitForTimeout(350); await page.keyboard.up('ArrowRight');
const during=await state();
if(during.player.mp!==before.player.mp||Math.hypot(during.player.x-before.player.x,during.player.y-before.player.y)>1)throw Error('cinematic input leaked');
await page.screenshot({path:'/dev/shm/tutorial-real-opening.png'});
await settle(); await waitStep('move');
await walk((await state()).target); await waitStep('talk');
await walk((await state()).target,55); await press('Space');
await page.waitForTimeout(250);  if((await state()).step==='talk'){await press('Space'); await page.waitForTimeout(250); } await settle();
await page.waitForFunction(()=>window.__SERTZ_SCENE__?.stageDef.key==='howlrstone1x2',null,{timeout:20000});
await settle(); await waitStep('attack'); await settle();
// Re-open the same saved character to check practice recovery without granting anything.
await page.context().storageState({path:"/dev/shm/tutorial-practice-storage.json"});
await page.reload({waitUntil:'domcontentloaded'});
await page.getByRole('button',{name:/게임 시작/}).first().click({timeout:120000});
await page.getByRole('button',{name:'이 캐릭터로 시작'}).click();
await page.waitForFunction(()=>window.__SERTZ_SCENE__?.tut?.currentId==='attack',null,{timeout:120000});
await settle();console.log('PASS actual practice reload');

console.log('PRACTICE_SAVE',await page.evaluate(()=>{const s=window.__SERTZ_SCENE__.buildSave();return {step:s.tutStep,version:s.tutorialVersion,stage:s.stage};}));
await walk((await state()).enemy,42);
for(let i=0;i<7&&(await state()).step==='attack';i++){await press('x');await page.waitForTimeout(380);}
await waitStep('evade');await settle();
for(let i=0;i<120&&(await state()).step==='evade';i++){
  const s=await state();
  if(s.windup){await page.keyboard.down('ArrowRight');await page.waitForTimeout(680);await page.keyboard.up('ArrowRight');}
  else await page.waitForTimeout(120);
}
await waitStep('skill');await settle();await walk((await state()).enemy,42);await press('z');
await waitStep('pickup');await settle();await walk((await state()).target,10);
await waitStep('inventory');await settle();
await page.getByRole('button',{name:'가방 확인',exact:true}).click();await page.waitForTimeout(500);
await page.screenshot({path:'/dev/shm/tutorial-real-inventory.png'});
await press('i');await waitStep('accept');await settle();await walk((await state()).target,55);await press('Space');await page.waitForTimeout(400);
for(let i=0;i<15;i++){const b=page.getByRole('button',{name:'[의뢰 받기]',exact:true});if(await b.isVisible()){await b.click();break;}await press('Space');await page.waitForTimeout(250);}
await waitStep('mission');await settle();
await page.getByRole('button',{name:'퀘스트 확인',exact:true}).click();
await page.getByText('레지스터의 수련 의뢰',{exact:true}).waitFor();
await press('Escape');
await page.screenshot({path:'/dev/shm/tutorial-real-mission.png'});
await walk((await state()).enemy,42);
for(let i=0;i<16&&(await state()).step==='mission';i++){await press('x');await page.waitForTimeout(380);}
await waitStep('reward');await walk((await state()).target,55);await press('Space');await waitStep('ending');await settle();
await page.waitForFunction(()=>window.__SERTZ_SCENE__?.tutorialDone&&!window.__SERTZ_SCENE__.tut,{timeout:15000});
console.log('DONE',await state());
if(await page.evaluate(()=>window.__SERTZ_SCENE__.featureTutOpen))throw Error('duplicate feature tutorial after completion');
await page.keyboard.down('ArrowRight');await page.waitForTimeout(200);await page.keyboard.up('ArrowRight');await press('Shift');await page.waitForTimeout(250);await press('Shift');await page.waitForTimeout(250);
await page.screenshot({path:'/dev/shm/tutorial-real-finished.png'});
console.log('ERRORS',errors);if(errors.length)throw Error(errors.join('\n'));
await page.context().storageState({path:'/dev/shm/tutorial-complete-storage.json'});
await browser.close();
