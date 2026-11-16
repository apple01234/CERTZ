/** Injected local error events test diagnostics/downloads, not a production-crash reproduction. */
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.CRASH_QA_URL??'http://127.0.0.1:3100',out=process.env.CRASH_QA_OUT??'/dev/shm/certz-crash';
const storage=JSON.parse(await readFile(process.env.CRASH_QA_STORAGE??'/dev/shm/certz-opening/Space-storage.json','utf8'));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const result={scope:'Injected diagnostic events only; no character-save mutation.'};
try{
 const context=await browser.newContext({storageState:storage,viewport:{width:1280,height:800}}),page=await context.newPage();
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:/게임 시작/}).first().click({timeout:120000});await page.getByRole('button',{name:'이 캐릭터로 시작'}).click();
 await page.waitForFunction(()=>window.__SERTZ_SCENE__?.assetsReady,null,{timeout:120000});
 const sentinel='QA <img id="unsafe-crash-qa" src=x onerror="alert(1)">';
 const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('sertz_char_'))));
 await page.evaluate(message=>{for(let n=0;n<3;n++)window.dispatchEvent(new ErrorEvent('error',{message,error:new Error(message)}));},sentinel);
 await page.locator('[data-sertz-crash="1"]').waitFor();
 assert.equal(await page.locator('#unsafe-crash-qa').count(),0);assert.equal(await page.locator('#sertz-crash-detail').innerText(),sentinel);
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'오류 기록 내려받기'}).click()]);
 await download.saveAs(out+'/client-error.json');const report=JSON.parse(await readFile(out+'/client-error.json','utf8'));
 assert.equal(report.message,sentinel);assert.match(report.stack,/QA/);assert.ok(report.stage);assert.ok(report.stack.length<=8000);
 assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('sertz_char_')))),before);
 result.report={stage:report.stage,dialogue:report.dialogue,cinema:report.cinema,stackLength:report.stack.length};result.passed=true;
 await page.screenshot({path:out+'/recovery.png'});console.log('PASS local stack download and text-safe recovery');
}finally{await writeFile(out+'/results.json',JSON.stringify(result,null,2));await browser.close();}
