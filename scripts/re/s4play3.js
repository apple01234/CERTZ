// sertz4: 정확한 버튼 좌표(640,250)로 시작 → 인게임 진입 → 지면 캡처 + 이동
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
  // 금색 "게임 시작" 버튼
  await canvas.click({ position: { x: 640, y: 250 }, force: true });
  await page.waitForTimeout(7000);
  await page.screenshot({ path: path.join(OUT, '10_after_start.png') });

  // 캐릭터 선택/확인 단계: 중앙·하단 클릭 + Enter
  for (let i = 0; i < 5; i++) {
    await page.mouse.click(640, 520);
    await page.waitForTimeout(1500);
  }
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(OUT, '11_ingame.png') });

  // 이동해서 카메라/지면 확인
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '12_ingame_moved.png') });

  console.log('errors:', errs.slice(0, 4));
  await browser.close();
})();
