// 네트워크 증거: 무스펠헤임 진입 시 실제로 로드되는 tile_* 파일
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = '/root/.hermes/cache/scratch/deploy/texproof';
const SAVE_KEY = 'sertz_save_v2';

function makeSave(stage) {
  return { stage, lv: 40, exp: 0, maxHp: 3000, atk: 200, cleared: false,
    gold: 5000, potions: { hp: 5, mp: 5 }, maxMp: 300, playerName: 'TEST', questLog: [], inv: {}, owned: [] };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();

  const tiles = new Set();
  page.on('response', async (r) => {
    const u = r.url();
    const m = u.match(/\/(tile_[a-z0-9_]+)\.webp/);
    if (m) tiles.add(m[1] + '  ' + r.status());
  });

  await page.addInitScript(({ k, v }) => {
    try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }, { k: SAVE_KEY, v: makeSave('muspelheim1') });

  await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(16000);
  console.log('=== 로드된 tile_* (부팅 시) ===');
  console.log([...tiles].sort().join('\n'));

  await page.screenshot({ path: path.join(OUT, 'n1_title.png') });
  const canvas = page.locator('canvas').first();
  await canvas.click({ position: { x: 640, y: 252 }, force: true });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: path.join(OUT, 'n2_charselect.png') });
  await page.mouse.click(1090, 200);
  await page.waitForTimeout(4000);
  await page.mouse.click(640, 560);
  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(OUT, 'n3_world.png') });

  console.log('\n=== 최종 로드 tile_* ===');
  console.log([...tiles].sort().join('\n'));
  await browser.close();
})();
