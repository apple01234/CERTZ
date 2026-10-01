const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(7000);
  // 캐릭터 없이 그냥 타이틀에서 elementFromPoint 확인 + 게임 입장 후 다시
  const el1 = await page.evaluate(() => {
    const e = document.elementFromPoint(200, 400);
    return e ? `${e.tagName}.${(e.className || '').toString().slice(0, 60)}` : 'none';
  });
  console.log('타이틀 (200,400):', el1);
  await browser.close();
})();
