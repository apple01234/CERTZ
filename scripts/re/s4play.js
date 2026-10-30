// sertz4 실제 게임 화면 캡처 (타이틀 → 시작 → 인게임 지면)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = '/root/.hermes/cache/scratch/deploy/s4play';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  await page.goto('https://sertz4.space-z.ai/', { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(30000);
  await page.screenshot({ path: path.join(OUT, '01_title.png') });

  // 캔버스 클릭으로 시작 시도 (여러 지점)
  const canvas = page.locator('canvas').first();
  for (const [x, y] of [[640, 400], [640, 480], [640, 300], [640, 550]]) {
    await canvas.click({ position: { x, y }, force: true }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: path.join(OUT, '02_after_click.png') });

  // Enter / Space 로도 시도
  for (const key of ['Enter', 'Space', 'Enter']) {
    await page.keyboard.press(key).catch(() => {});
    await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(OUT, '03_after_keys.png') });

  const info = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    return {
      canvas: c ? { w: c.width, h: c.height, cw: c.getBoundingClientRect().width, ch: c.getBoundingClientRect().height } : null,
      dpr: window.devicePixelRatio,
      title: document.title,
    };
  });
  console.log(JSON.stringify({ info, errors: errors.slice(0, 5) }, null, 2));
  await browser.close();
})();
