/* dbg_confirm_missing — __MISSING 오브젝트 제거 실험 + 정체 추적 */
const { chromium } = require('playwright');

(async () => {
  const BASE = process.env.PROBE_BASE || 'http://localhost:3000';
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true });
  page.on('console', (m) => { const t = m.text(); if (t.includes('[SERTZ]')) console.log('CON:', t.slice(0, 220)); });
  const clickBtn = (needle) => page.evaluate((n) => {
    Array.from(document.querySelectorAll('button')).find((x) => (x.textContent ?? '').includes(n))?.click();
  }, needle);
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(7000);
  await clickBtn('게임 시작'); await page.waitForTimeout(1500);
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button')).filter((x) => (x.textContent ?? '').trim() === '캐릭터 생성');
      (els[els.length - 1] ?? els[0])?.click();
    });
    try { await page.waitForSelector('input', { timeout: 2000 }); break; } catch { }
  }
  await page.locator('input').first().fill('프로브'); await page.waitForTimeout(300);
  await clickBtn('다음 — 직업 선택'); await page.waitForTimeout(700);
  await clickBtn('전사'); await page.waitForTimeout(600);
  await clickBtn('다음 — 외형 선택'); await page.waitForTimeout(700);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => /로 생성!/.test(x.textContent ?? ''))?.click();
  });
  await page.waitForTimeout(2500);
  await clickBtn('이 캐릭터로 시작');
  await page.waitForTimeout(8000);
  await clickBtn('세로 화면으로 계속하기');
  await page.waitForTimeout(600);
  for (let i = 0; i < 24; i++) { await page.mouse.click(200, 400); await page.keyboard.press('Space'); await page.waitForTimeout(320); }
  await page.waitForTimeout(800);

  // ① __MISSING 오브젝트 앞으로 카메라 이동 + 스크린샷
  await page.evaluate(() => {
    const w = window.__SERTZ__?.game?.scene?.getScene('world');
    const t = w.children.list.find((o) => o.texture?.key === '__MISSING');
    if (t) { w.cameras.main.centerOn(t.x, t.y); window.__target = { x: t.x, y: t.y }; }
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/before_destroy.png' });

  // ② 제거 후 스크린샷
  await page.evaluate(() => {
    const w = window.__SERTZ__?.game?.scene?.getScene('world');
    const ts = w.children.list.filter((o) => o.texture?.key === '__MISSING');
    ts.forEach((o) => o.destroy());
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/after_destroy.png' });
  console.log('done — before/after destroy screenshots saved');
  await browser.close();
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });
