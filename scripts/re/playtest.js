// game-playtest: 오토타일 오버레이 배치 검증 + 상태 스모크
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = '/root/.hermes/cache/scratch/deploy/playtest';
const SAVE_KEY = 'sertz_save_v2';

function makeSave(stage) {
  return { stage, lv: 40, exp: 0, maxHp: 3000, atk: 200, cleared: false,
    gold: 5000, potions: { hp: 5, mp: 5 }, maxMp: 300, playerName: 'TEST', questLog: [], inv: {}, owned: [] };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'] });
  const results = [];

  for (const stage of ['forest1', 'muspelheim1', 'niflheim1']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));

    // autotile_edge 요청 여부 추적
    let edgeReq = 0;
    page.on('response', (r) => { if (r.url().includes('autotile_edge')) edgeReq++; });

    await page.addInitScript(({ k, v }) => {
      try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    }, { k: SAVE_KEY, v: makeSave(stage) });

    await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 90000 });
    await page.waitForTimeout(13000);
    const canvas = page.locator('canvas').first();
    await canvas.click({ position: { x: 640, y: 252 }, force: true });
    await page.waitForTimeout(4200);
    await page.mouse.click(1090, 200);
    await page.waitForTimeout(3200);
    await page.mouse.click(640, 560);
    await page.waitForTimeout(7000);

    // 이동 후 캡처 (2 상태)
    await page.screenshot({ path: path.join(OUT, `${stage}_a.png`) });
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(1400);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `${stage}_b.png`) });

    // WebGL 드로우 통계
    const gpu = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return null;
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return { webgl: false };
      return { webgl: true, canvas: { w: c.width, h: c.height },
               renderer: gl.getParameter(gl.RENDERER),
               vendor: gl.getParameter(gl.VENDOR) };
    });

    results.push({ stage, edgeReq, errs: errs.slice(0, 3), gpu });
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 1));
})();
