// sertz4: 캐릭터 생성 → 인게임 진입 → 지면/카메라 캡처
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = '/root/.hermes/cache/scratch/deploy/s4play';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));

  await page.goto('https://sertz4.space-z.ai/', { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(28000);

  const canvas = page.locator('canvas').first();
  await canvas.click({ position: { x: 640, y: 250 }, force: true });   // 게임 시작
  await page.waitForTimeout(7000);
  await canvas.click({ position: { x: 1090, y: 200 }, force: true });  // 캐릭터 생성(우측)
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT, '20_create1.png') });

  // 생성 확인 흐름: 이름 입력 or 직업 선택 단계 대응
  for (let i = 0; i < 4; i++) {
    await page.mouse.click(640, 560);
    await page.waitForTimeout(1500);
  }
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT, '21_create2.png') });

  for (let i = 0; i < 4; i++) {
    await page.mouse.click(640, 600 - i * 40);
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(OUT, '22_ingame.png') });

  // 이동하며 지면 확인
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(2000); await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '23_moved.png') });
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '24_moved2.png') });

  console.log('errors:', errs.slice(0, 4));
  await browser.close();
})();
