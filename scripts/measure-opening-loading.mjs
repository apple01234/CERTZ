/** One cold first-region load under 40ms / 2.5MB per second, followed by actual opening input. */
/** Real guest UI and inputs only; saves are inspected without changing game state. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.OPENING_QA_URL ?? 'http://127.0.0.1:3100';
const out = process.env.OPENING_QA_OUT ?? '/dev/shm/certz-opening';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const mode of ['Space']) {
    const mobile = process.env.LOADING_QA_MOBILE === '1';
    const context = await browser.newContext({ viewport: mobile ? { width: 844, height: 390 } : { width: 1280, height: 800 },
      isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    if(process.env.LOADING_QA_BUNDLE_FAIL==='1')await page.route('**/assets/startup-bundle/*.bin',route=>route.abort('failed'));
    const result = { mode, pageErrors: [] }; await page.addInitScript(()=>performance.setResourceTimingBufferSize(20000));
    results.push(result);
    page.on('pageerror', e => result.pageErrors.push(e.stack ?? e.message));
    const start = async () => {
      const cdp=await context.newCDPSession(page);
      await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
      await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:2500000,uploadThroughput:1250000});
      const samples=[];
      const sampler=process.env.LOADING_QA_MEMORY==='1'?setInterval(()=>{void cdp.send('Runtime.getHeapUsage').then(s=>samples.push(s)).catch(()=>{});},250):null;
      try{
        result.started=Date.now();await page.getByRole('button', { name: '이 캐릭터로 시작' }).click();
        await page.waitForFunction(()=>window.__SERTZ_SCENE__?.assetsReady,null,{timeout:120000});
        result.load={wallMs:Date.now()-result.started,...await page.evaluate(()=>({progress:window.__SERTZ_LOAD__,entries:performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/')).map(r=>({url:r.name,bytes:r.encodedBodySize,duration:r.duration}))}))};
        if(samples.length){
          clearInterval(sampler);await cdp.send('HeapProfiler.collectGarbage');
          result.memory={scope:'Chromium mobile viewport emulation; JS heap/backing storage only, not GPU or a physical phone',peakUsedBytes:Math.max(...samples.map(s=>s.usedSize)),peakBackingBytes:Math.max(...samples.map(s=>s.backingStorageSize??0)),afterGc:await cdp.send('Runtime.getHeapUsage')};
        }
      }finally{if(sampler)clearInterval(sampler);}
      await page.getByText('하루 · 회상', { exact: true }).waitFor({ timeout: 120000 });
    };
    const slots = () => page.evaluate(() => JSON.parse(localStorage.getItem('sertz_slots_v1')));
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
      await page.getByRole('button', { name: '캐릭터 생성', exact: true }).first().click();
      const name = '입력' + String(Date.now()).slice(-5);
      await page.locator('input').first().fill(name);
      await page.getByRole('button', { name: /다음/ }).click();
      await page.getByRole('button', { name: '모험가로 생성!' }).click();
      await page.getByRole('button', { name: '이 캐릭터로 시작' }).waitFor();
      const created = Object.values((await slots()).chars).find(c => c.name === name);
      assert.ok(created, 'new guest must be persisted before world entry');
      result.character = { id: created.id, name };
      if (mode === 'created-reload') {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
        await page.getByText(name, { exact: true }).first().click();
      }
      await start();
      if (mode === 'opening-reload') {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
        await start();
      }
      await page.screenshot({ path: `${out}/${mode}-opening.png` });
      if (mode === 'Tab') for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
      if (mode === 'Escape') await page.keyboard.press('Escape');
      const deadline = Date.now() + 80000;
      while (Date.now() < deadline && !result.pageErrors.length) {
        const state = await page.evaluate(() => {
          const s = window.__SERTZ_SCENE__;
          return s?.assetsReady && s.physics?.world ? { step: s.tut?.currentId, dialogue: s.dialoguing,
            cinema: s.camCinema, paused: s.physics.world.isPaused, stage: s.stageDef.key } : null;
        });
        if (state?.step === 'move') { result.final = state; break; }
        const choice = page.getByRole('button', { name: '두려움에 도망치는 사람', exact: true });
        if (await choice.isVisible()) await choice.click();
        else if (mobile) await page.touchscreen.tap(415, 330);
        else if (mode === 'held-space') await page.keyboard.down('Space');
        else await page.keyboard.press('Space', { delay: 50 });
        await page.waitForTimeout(mode === 'held-space' ? 100 : 300);
      }
      await page.keyboard.up('Space');
      assert.ok(result.final, 'opening must finish');
      assert.equal(result.final.cinema, false);
      assert.equal(result.final.dialogue, false);
      assert.equal(result.final.paused, false);
      const saved = await page.evaluate(id => JSON.parse(localStorage.getItem(`sertz_char_${id}`)), created.id);
      assert.equal(saved.playerName, name);
      assert.equal((await slots()).activeId, created.id);
      assert.deepEqual(result.pageErrors, []);
      result.passed = true;
      await page.screenshot({ path: `${out}/${mode}-complete.png` });
    } catch (error) {
      result.failure = error.stack ?? String(error);
      await page.screenshot({ path: `${out}/${mode}-failure.png` }).catch(() => {});
    } finally {
      console.log(mode, result.passed ? 'PASS' : 'FAIL', result.failure ?? result.final);
      await context.storageState({ path: `${out}/${mode}-storage.json` }).catch(() => {});
      await context.close();
      await writeFile(`${out}/results.json`, JSON.stringify({ base, results }, null, 2));
    }
  }
} finally {
  await browser.close();
}
assert.ok(results.every(r => r.passed), 'opening regressions failed; see results.json for stacks and screenshots');
