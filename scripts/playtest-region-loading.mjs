import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.REGION_QA_URL ?? 'http://127.0.0.1:3000';
const out = process.env.REGION_QA_OUT ?? '/tmp/certz-region-loading';
await mkdir(out, { recursive: true });
const browserOptions = {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
};
const results = [];

async function inspect(page) {
  return page.evaluate(() => {
    const s = window.__SERTZ_SCENE__, p = s.player;
    const frames = ['idle', 'walk', 'walkside', 'walkup', 'atk', 'atkdown', 'atkup'];
    return {
      stage: s.stageDef.key, progress: window.__SERTZ_LOAD__, body: p.bodyPrefix,
      bodyComplete: frames.every(m => [0, 1, 2, 3].every(i => s.textures.exists(`${p.bodyPrefix}_${m}${i}`))),
      walk: s.anims.exists(`${p.bodyPrefix}-walk`),
      common: ['gvb_glow_white', 'cast_lilac', 'chapter_terrain', 'big-explosion'].every(key => s.textures.exists(key)),
      missing: s.children.list.filter(c => c.texture?.key === '__MISSING').map(c => c.name),
      enemies: s.enemies.filter(e => e.active).map(e => ({ key: e.def.key, texture: e.texture.key })),
    };
  });
}

for (const mode of (process.env.REGION_QA_MODES ?? 'desktop,mobile').split(',')) {
  // Isolate decoded textures/GPU memory between the two device checks.
  const browser = await chromium.launch(browserOptions);
  try {
    const mobile = mode === 'mobile';
    const context = await browser.newContext({
      viewport: mobile ? { width: 844, height: 390 } : { width: 1280, height: 800 },
      isMobile: mobile, hasTouch: mobile,
    });
    try {
      const page = await context.newPage(), errors = [], requests = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => { if (r.url().includes('/assets/')) requests.push(r.url()); });
      await page.addInitScript(() => performance.setResourceTimingBufferSize(15000));
      await page.goto(`${base}?renderer=${mobile ? 'webgl' : 'canvas'}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
      await page.getByRole('button', { name: '캐릭터 생성', exact: true }).first().click();
      await page.locator('input').first().fill(`로딩검증${mobile ? '폰' : 'PC'}`);
      await page.getByRole('button', { name: /다음/ }).click();
      await page.getByRole('button', { name: '모험가로 생성!' }).click();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 2500000, uploadThroughput: 1250000 });
      const started = Date.now();
      await page.getByRole('button', { name: '이 캐릭터로 시작' }).click();
      await page.waitForFunction(() => window.__SERTZ_SCENE__?.assetsReady, null, { timeout: 180000 });
      const initial = await inspect(page);
      initial.clickToWorldMs = Date.now() - started;
      assert.equal(initial.stage, 'howlrstone1x1');
      assert.ok(initial.bodyComplete && initial.walk && initial.common);
      assert.deepEqual(initial.missing, []);
      assert.ok(initial.progress.total < 1500);
      assert.ok(!requests.some(url => /\/(?:costm_royal|dx_hornrabbit)_/.test(url)), 'unrelated assets are not background-downloaded');
      await page.screenshot({ path: `${out}/${mode}-initial.png` });

      // Use the game's own skip and outfit switch, not texture cache injection.
      const fallback = await page.evaluate(() => {
        const s = window.__SERTZ_SCENE__;
        s.tut?.skip(); s.player.iframes = 999999;
        s.player.outfit = 'outfit_royal'; s.player.applyBodyLook();
        return { pending: s.player.bodyPending, body: s.player.bodyPrefix, texture: s.player.texture.key };
      });
      assert.equal(fallback.pending, 'costm_royal');
      assert.equal(fallback.body, '');
      assert.notEqual(fallback.texture, '__MISSING');
      await page.waitForFunction(() => window.__SERTZ_SCENE__?.player?.bodyPrefix === 'costm_royal', null, { timeout: 35000 });
      const outfit = await inspect(page);
      assert.ok(outfit.bodyComplete && outfit.walk);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${out}/${mode}-outfit.png` });

      const regions = [];
      for (const target of ['howlrstone10x3', 'dlcocean1', 'park', 'howlrstone1x1']) {
        await page.evaluate(target => {
          const s = window.__SERTZ_SCENE__;
          s.cleared = true; s.youngPrincessCleared = true;
          s.startTransition(target, { delay: 0, save: { ...s.buildSave(), tutorialDone: true, introSeen: true, stage: target } });
        }, target);
        await page.waitForFunction(target => window.__SERTZ_SCENE__?.assetsReady && window.__SERTZ_SCENE__.stageDef.key === target, target, { timeout: 45000 });
        const state = await inspect(page);
        assert.deepEqual(state.missing, [], target);
        assert.ok(state.common && state.bodyComplete && state.walk, target);
        assert.ok(state.enemies.every(e => e.texture !== '__MISSING'), target);
        regions.push(state);
        await page.screenshot({ path: `${out}/${mode}-${target}.png` });
      }
      assert.deepEqual(errors, []);
      const result = { mode, network: { latencyMs: 40, downloadBytesPerSecond: 2500000, browserCache: false }, initial, fallback, outfit, regions, pageErrors: errors };
      results.push(result);
      await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
      console.log('PASS', mode, JSON.stringify({ initial: initial.progress, clickToWorldMs: initial.clickToWorldMs, regions: regions.map(r => ({ stage: r.stage, loadMs: r.progress.elapsedMs, total: r.progress.total })) }));
    } finally { await context.close(); }
  } finally { await browser.close(); }
}
