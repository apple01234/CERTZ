/** Existing-save fixtures are cloned from the normal UI full-run, never production accounts. */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const original=JSON.parse(await readFile('/dev/shm/tutorial-complete-storage.json','utf8'));
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const results=[];
const mobileOnly=['mobile','portrait','quest'].includes(process.env.QA_RECOVERY_MODE);
async function open(patch, viewport={width:1280,height:800}, mobile=false) {
  const storage=structuredClone(original);
  for(const origin of storage.origins) for(const item of origin.localStorage) if(item.name==='sertz_save_v2'||item.name.startsWith('sertz_char_')) {
    const value=JSON.parse(item.value);patch(value);item.value=JSON.stringify(value);
  }
  const context=await browser.newContext({storageState:storage,viewport,isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3100',{waitUntil:'domcontentloaded',timeout:120000});
  if(mobile&&viewport.height>viewport.width)await page.getByRole('button',{name:'세로 화면으로 계속하기'}).click({timeout:120000});
  await page.getByRole('button',{name:/게임 시작/}).first().click({timeout:120000});
  await page.getByRole('button',{name:'이 캐릭터로 시작'}).click();
  await page.waitForFunction(()=>window.__SERTZ_SCENE__?.player,null,{timeout:120000}).catch(async e=>{console.log("BOOT_FAILURE",errors,(await page.locator("body").innerText()).slice(0,500));throw e;});
  await page.waitForTimeout(1200);console.log("OPEN",await page.evaluate(()=>window.__SERTZ_SCENE__?.tut?.currentId??"normal"));
  return {context,page,errors};
}
const inspect=p=>p.evaluate(()=>{const s=window.__SERTZ_SCENE__,v=s.buildSave();return {step:s.tut?.currentId??null,cinema:s.camCinema,paused:s.physics.world.isPaused,stage:s.stageDef.key,done:v.tutorialDone,gold:v.gold,potions:v.potions,tickets:v.gachaTickets,choices:v.storyChoices,owned:v.owned};});
try {
  if(process.env.QA_RECOVERY_MODE==='quest') {
    const h=await open(v=>{v.tutorialVersion=2;v.tutorialDone=false;v.tutStep=10;v.introSeen=false;});
    await h.page.getByRole('button',{name:'퀘스트 확인',exact:true}).click();
    await h.page.getByText('레지스터의 수련 의뢰',{exact:true}).waitFor();
    await h.page.getByText(/수련용 쥐 0\/1/).waitFor();
    await h.page.screenshot({path:'/dev/shm/tutorial-real-quest.png'});
    await h.page.keyboard.press('Escape',{delay:90});
    assert.equal((await inspect(h.page)).step,'mission');assert.equal(h.errors.length,0);
    console.log('PASS real lesson quest panel below normal unlock level');await h.context.close();
  }
  for(const kind of (mobileOnly?[]:['completed','legacy'])) {
    const h=await open(v=>{if(kind==='legacy'){delete v.tutorialVersion;delete v.introSeen;v.tutorialDone=false;v.tutStep=4;} v.cutsceneSeen=[...(v.cutsceneSeen??[]),'lilacCut_rea1_lilac00','howlrstone1:stage2'];});
    assert.equal((await inspect(h.page)).step,null);assert.equal(h.errors.length,0);results.push({kind,result:await inspect(h.page)});console.log("PASS",kind);await h.context.close();
  }
  for(const step of (mobileOnly?[]:[4,10,11,12])) {
    const h=await open(v=>{v.tutorialVersion=2;v.tutorialDone=false;v.tutStep=step;v.introSeen=false;});
    const first=await inspect(h.page);assert.equal(first.step,['attack','mission','reward','ending'][[4,10,11,12].indexOf(step)]);
    await h.page.reload({waitUntil:'domcontentloaded'});await h.page.getByRole('button',{name:/게임 시작/}).first().click({timeout:120000});await h.page.getByRole('button',{name:'이 캐릭터로 시작'}).click();await h.page.waitForFunction(()=>window.__SERTZ_SCENE__?.player,null,{timeout:120000});await h.page.waitForTimeout(600);
    assert.equal((await inspect(h.page)).step,first.step);
    const before=await inspect(h.page);await h.page.evaluate(()=>window.__SERTZ_SCENE__.tut.skip());await h.page.waitForTimeout(100);
    const after=await inspect(h.page);assert.equal(after.done,true);assert.equal(after.step,null);assert.equal(after.cinema,false);assert.equal(after.paused,false);assert.equal(after.gold,before.gold+500);assert.equal(after.tickets,before.tickets+1);assert.equal(h.errors.length,0);
    results.push({kind:`reload-skip-${step}`,result:after});console.log("PASS reload-skip",step);await h.context.close();
  }
  // Actual mobile pointer events, including a held joystick plus a second pointer dash.
  for(const viewport of (process.env.QA_RECOVERY_MODE==='quest'?[]:process.env.QA_RECOVERY_MODE==='portrait'?[{width:390,height:844}]:[{width:844,height:390},{width:390,height:844}])) {
    const h=await open(v=>{v.tutorialVersion=2;v.tutorialDone=false;v.tutStep=5;v.introSeen=false;},viewport,true);

    if(viewport.height>viewport.width) {const buttons=await h.page.getByRole('button').allTextContents();console.log('PORTRAIT_BUTTONS',buttons);}
    assert.equal(await h.page.evaluate(()=>window.__SERTZ_SCENE__.minimap.visible),false);
    await h.page.screenshot({path:`/dev/shm/tutorial-mobile-cinematic-${viewport.width}.png`});
    await h.page.keyboard.press('Escape',{delay:90});await h.page.waitForTimeout(600);
    const dash=h.page.getByRole('button',{name:/돌진 —/});await dash.waitFor({state:'visible'});
    const projection=await h.page.evaluate(()=>{const s=window.__SERTZ_SCENE__,h=s.tut.hud,z=s.cameras.main.zoom,w=s.scale.width;return {left:h.x*z+w/2*(1-z)-331*h.scaleX*z/2,right:h.x*z+w/2*(1-z)+331*h.scaleX*z/2,width:w};});
    assert.ok(projection.left>=-0.5&&projection.right<=projection.width+0.5);
    const box=await dash.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width&&box.y+box.height<=viewport.height);
    assert.equal(await h.page.evaluate(()=>window.__SERTZ_SCENE__.minimap.visible),false);
    const before=await h.page.evaluate(()=>{const p=window.__SERTZ_SCENE__.player;return {x:p.x,y:p.y,mp:p.mp};});
    const cdp=await h.context.newCDPSession(h.page);
    const joystick=await h.page.locator('[data-tutorial-control="move"]').boundingBox();assert.ok(joystick);
    const finger={x:joystick.x+70,y:joystick.y+joystick.height-80,id:1};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger]});
    finger.x+=55;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger]});
    await h.page.waitForTimeout(120);
    const dashFinger={x:box.x+box.width/2,y:box.y+box.height/2,id:2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger,dashFinger]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[finger]});
    await h.page.waitForTimeout(270);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger,dashFinger]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[finger]});
    await h.page.waitForTimeout(270);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const after=await h.page.evaluate(()=>{const p=window.__SERTZ_SCENE__.player;return {x:p.x,y:p.y,mp:p.mp,state:p.state};});assert.equal(after.mp,before.mp);assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>50);
    await h.page.screenshot({path:`/dev/shm/tutorial-mobile-${viewport.width}.png`});assert.equal(h.errors.length,0);results.push({kind:`mobile-${viewport.width}`,dash:after});console.log("PASS mobile",viewport.width);await h.context.close();
  }
  console.log(JSON.stringify(results,null,2));
} finally {await browser.close();}
