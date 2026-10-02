/* dbg_entry — 진입 플로우 디버그: 각 단계 화면 텍스트 덤프 */
const { chromium } = require('playwright');

(async () => {
  const BASE = process.env.PROBE_BASE || 'http://localhost:3000';
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 200)));
  page.on('console', (m) => { const t = m.text(); if (t.startsWith('[')) console.log(t); });

  const dump = (tag) => page.evaluate((t) => {
    const btns = Array.from(document.querySelectorAll('button')).map((b) => (b.textContent ?? '').trim().slice(0, 30)).filter(Boolean);
    const hasInput = !!document.querySelector('input');
    console.log(`[${t}] inputs=${hasInput} btns=`, JSON.stringify(btns.slice(0, 12)));
  }, tag);

  const clickBtn = (needle) => page.evaluate((n) => {
    Array.from(document.querySelectorAll('button')).find((x) => (x.textContent ?? '').includes(n))?.click();
  }, needle);

  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(7000);
  await dump('initial');
  await clickBtn('게임 시작'); await page.waitForTimeout(1800);
  await dump('after-start');
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(600);
    await dump('loop' + i);
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button')).filter((x) => (x.textContent ?? '').trim() === '캐릭터 생성');
      (els[els.length - 1] ?? els[0])?.click();
    });
    try { await page.waitForSelector('input', { timeout: 2000 }); console.log('INPUT_OK at loop', i); break; } catch { /* retry */ }
  }
  await browser.close();
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });
