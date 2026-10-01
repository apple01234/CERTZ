const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true });
  await page.goto(process.env.PROBE_BASE || 'http://localhost:3000', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(7000);
  const probe = await page.evaluate(() => ({
    coarse: window.matchMedia('(pointer: coarse)').matches,
    iw: window.innerWidth,
    hasTouchPlugin: 'ontouchstart' in window,
    maxTouch: navigator.maxTouchPoints,
  }));
  console.log('포인터 환경:', JSON.stringify(probe));
  await browser.close();
})();
