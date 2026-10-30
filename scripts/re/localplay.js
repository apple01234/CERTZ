// 로컬 서버에서 실제 인게임 지면 캡처 (세이브 주입 → 바로 월드 진입)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = '/root/.hermes/cache/scratch/deploy/localplay';

const SAVE_KEY = 'sertz_save_v2';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));

  // 1) 먼저 로드해서 저장소 구조 파악
  await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(15000);

  const probe = await page.evaluate(() => {
    const out = { keys: Object.keys(localStorage) };
    try {
      const g = [];
      for (const k of Object.keys(window)) {
        try {
          const v = window[k];
          if (v && v.constructor && v.constructor.name === 'Game' && v.scene) g.push(k);
        } catch (e) { /* cross-origin */ }
      }
      out.gameKeys = g;
      if (g.length) {
        const G = window[g[0]];
        out.scenes = G.scene.scenes.map((s) => ({ key: s.scene.key, active: s.scene.isActive() }));
      }
    } catch (e) { out.err = String(e).slice(0, 150); }
    return out;
  });
  console.log('probe:', JSON.stringify(probe, null, 1));

  await page.screenshot({ path: path.join(OUT, '00_boot.png') });
  console.log('errors:', errs.slice(0, 3));
  await browser.close();
})();
