/* dbg_page — 현재 페이지 상태 캡처 */
const { chromium } = require('playwright');

(async () => {
  const BASE = process.env.PROBE_BASE || 'http://localhost:3000';
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 300)));
  page.on('console', (m) => { const t = m.text(); if (!t.startsWith('[') && !t.includes('Download')) console.log('CON:', t.slice(0, 180)); });
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/page_state.png' });
  const info = await page.evaluate(() => ({
    title: document.title,
    bodyLen: document.body.innerHTML.length,
    bodyPreview: document.body.innerText.replace(/\s+/g, ' ').slice(0, 400),
    canvas: !!document.querySelector('canvas'),
  }));
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });
