import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.LOADING_QA_URL??'http://127.0.0.1:3100';
const out=process.env.LOADING_QA_OUT??'/dev/shm/certz-loading-qa';
const storage=JSON.parse(await readFile('/dev/shm/tutorial-complete-storage.json','utf8'));
storage.origins=storage.origins.map(o=>({...o,origin:new URL(base).origin}));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const results=[];
try {
 for(const mode of (process.env.LOADING_QA_MODES??'canvas-slow,webgl,title-failure,world-failure').split(',')) {
  const context=await browser.newContext({storageState:storage,viewport:{width:1280,height:800}});
  const page=await context.newPage(), errors=[];
  await page.addInitScript(()=>performance.setResourceTimingBufferSize(10000));
  page.on('pageerror',e=>errors.push(e.message));
  const cdp=await context.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  if(mode==='canvas-slow') await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:60,downloadThroughput:500000,uploadThroughput:125000});
  const pattern=mode==='title-failure'?'**/assets/glow.webp':'**/assets/ground/ground_meadow.png';
  if(mode.endsWith('failure')) await context.route(pattern,route=>route.abort());
  const started=Date.now();
  await page.goto(base+'?renderer='+(mode==='webgl'?'webgl':'canvas'),{waitUntil:'domcontentloaded',timeout:120000});
  async function enter(){
   await page.getByRole('button',{name:/게임 시작/}).first().click({timeout:45000});
   await page.getByRole('button',{name:'이 캐릭터로 시작'}).click();
  }
  if(mode!=='title-failure') await enter();
  if(mode.endsWith('failure')) {
   await page.getByRole('button',{name:'다시 시도',exact:true}).waitFor({timeout:35000});
   const failure=await page.evaluate(()=>({progress:window.__SERTZ_LOAD__,ready:!!window.__SERTZ_SCENE__?.assetsReady,chars:Object.keys(localStorage).filter(k=>k.startsWith('sertz_char_'))}));
   assert.ok(failure.progress.error); assert.equal(failure.ready,false); assert.ok(failure.chars.length);
   await page.screenshot({path:`${out}/${mode}.png`});
   await context.unroute(pattern);
   await page.getByRole('button',{name:'다시 시도',exact:true}).click();
   await enter();
   await page.waitForFunction(()=>window.__SERTZ_LOAD__?.phase==='world-ready'||!!window.__SERTZ_LOAD__?.error,null,{timeout:40000});
   assert.equal(errors.length,0,errors.join('\n'));
   results.push({mode,failure,recovered:true,pageErrors:errors});
  }else{
   await page.waitForFunction(()=>window.__SERTZ_LOAD__?.phase==='world-ready'||!!window.__SERTZ_LOAD__?.error,null,{timeout:40000});
   const timing=await page.evaluate(()=>({progress:window.__SERTZ_LOAD__,resources:performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/')).reduce((a,e)=>({count:a.count+1,bytes:a.bytes+e.decodedBodySize}),{count:0,bytes:0}),history:window.__SERTZ_LOAD_HISTORY__,renderer:window.__SERTZ_SCENE__?.game?.renderer.type,stage:window.__SERTZ_SCENE__?.stageDef?.key,anims:['hero-idle','hero-walk'].map(k=>({key:k,exists:window.__SERTZ_SCENE__?.anims?.exists(k)}))}));
   console.log('TIMING',mode,JSON.stringify(timing));
   await page.screenshot({path:`${out}/${mode}-checkpoint.png`});
   assert.equal(timing.progress.phase,'world-ready');
   assert.equal(errors.length,0,errors.join('\n'));
   assert.ok(timing.history.filter(p=>p.phase==='world-assets').every(p=>p.elapsedMs<30000));
   assert.equal(timing.renderer,mode==='webgl'?2:1);
   await page.screenshot({path:`${out}/${mode}.png`});
   results.push({mode,elapsedMs:Date.now()-started,...timing,pageErrors:errors});
  }
  console.log('PASS',mode,JSON.stringify(results.at(-1)));
  await context.close();
 }
 await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
} finally { await browser.close(); }
