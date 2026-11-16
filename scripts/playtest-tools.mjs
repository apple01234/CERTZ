/** Independent editor pages: real UI editing and JSON round trips without starting the game. */
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.TOOLS_QA_URL??'http://127.0.0.1:3100';
const out=process.env.TOOLS_QA_OUT??'/dev/shm/certz-tools';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage(),errors=[],requests=[],results=[];
page.on('pageerror',e=>errors.push(e.stack??e.message));page.on('request',r=>requests.push(r.url()));
try{
 await page.goto(base+'/tools',{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'제작 도구',exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:/맵 메이커/}).getAttribute('href'),'/editor');
 assert.equal(await page.getByRole('link',{name:/스킬 에디터/}).getAttribute('href'),'/skill-editor');
 await page.screenshot({path:out+'/tools.png'});
 await page.evaluate(()=>localStorage.setItem('sertz_char_editor-sentinel','editor must not change game saves'));
 for(const [kind,path] of [['map','/editor'],['skill','/skill-editor']]){
  await page.goto(base+path,{waitUntil:'networkidle'});
  await page.locator('canvas').first().waitFor();
  const result={kind,path};
  if(kind==='map')await page.getByRole('button',{name:'새 20×12',exact:true}).click();
  else await page.getByRole('textbox',{name:'문서 이름',exact:true}).fill('standalone-editor-qa');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:kind==='map'?'JSON 저장':'저장',exact:true}).click();
  const file=await download;const target=out+'/'+kind+'.json';await file.saveAs(target);
  const json=JSON.parse(await readFile(target,'utf8'));result.savedKeys=Object.keys(json);
  if(kind==='skill'){assert.equal(json.name,'standalone-editor-qa');assert.ok(json.skills.length>=12);}
  else{assert.ok(JSON.stringify(json).includes('20'));await page.getByRole('button',{name:'새 15×9',exact:true}).click();}
  await page.locator('input[type=file]').first().setInputFiles(target);
  await page.waitForTimeout(300);
  if(kind==='map')await page.getByText(/20×12 ·/).waitFor();
  else assert.equal(await page.getByRole('textbox',{name:'문서 이름',exact:true}).inputValue(),'standalone-editor-qa');
  result.game=await page.evaluate(()=>({scene:!!window.__SERTZ_SCENE__,game:!!window.__SERTZ_GAME__,sentinel:localStorage.getItem('sertz_char_editor-sentinel')}));
  assert.equal(result.game.scene,false);assert.equal(result.game.game,false);assert.equal(result.game.sentinel,'editor must not change game saves');
  await page.screenshot({path:out+'/'+kind+'-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/'+kind+'-mobile.png'});await page.setViewportSize({width:1440,height:1000});
  results.push(result);
 }
 assert.ok(!requests.some(url=>url.includes('node_modules_phaser')),'editors must not load the Phaser runtime; their asset preview thumbnails are allowed');
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS independent editors and file round trips');
}finally{await writeFile(out+'/results.json',JSON.stringify({base,results,pageErrors:errors,requests},null,2));await browser.close();}
