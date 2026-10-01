/* dbg_touch_chain — 터치→React 핸들러→EventBus→이동 체인 단계별 검증 */
const { chromium } = require('playwright');

(async () => {
  const BASE = process.env.PROBE_BASE || 'http://localhost:3000';
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true });
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(7000);
  const clickBtn = (needle) => page.evaluate((n) => {
    Array.from(document.querySelectorAll('button')).find((x) => (x.textContent ?? '').includes(n))?.click();
  }, needle);
  await clickBtn('게임 시작'); await page.waitForTimeout(1500);
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button')).filter((x) => (x.textContent ?? '').trim() === '캐릭터 생성');
      (els[els.length - 1] ?? els[0])?.click();
    });
    try { await page.waitForSelector('input', { timeout: 2000 }); break; } catch { /* retry */ }
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
  // 로테이트 닫기
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => (x.textContent ?? '').includes('세로 화면으로 계속하기'))?.click();
  });
  await page.waitForTimeout(800);
  // 프롤로그/대사 통과
  for (let i = 0; i < 24; i++) {
    await page.mouse.click(200, 400);
    await page.keyboard.press('Space');
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(800);

  // 1. EventBus 직접 발사 → 이동 확인
  const p0 = await page.evaluate(() => Math.round(window.__SERTZ__?.game?.scene?.getScene('world')?.player?.x));
  await page.evaluate(() => window.__SERTZ_EB__.emit('input:move', { x: 1, y: 0 }));
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__SERTZ_EB__.emit('input:move', { x: 0, y: 0 }));
  const p1 = await page.evaluate(() => Math.round(window.__SERTZ__?.game?.scene?.getScene('world')?.player?.x));
  console.log(`1. EventBus 직접 이동: ${p0} → ${p1} ${p0 !== p1 ? '✓ 이동경로 정상' : '✗ 이동 안됨'}`);

  // 2. 조이스틱 영역에 리스너 장착 → CDP 터치로 이벤트 실측
  await page.evaluate(() => {
    window.__TOUCH_LOG = [];
    const zone = Array.from(document.querySelectorAll('div')).find((d) =>
      (d.className || '').toString().includes('touch-none') && (d.className || '').toString().includes('w-[46%]'));
    if (!zone) { window.__TOUCH_LOG.push('zone-not-found'); return; }
    for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove']) {
      zone.addEventListener(ev, (e) => window.__TOUCH_LOG.push(`${ev}:${e.pointerType ?? 'touch'}`), { passive: true });
    }
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 700 }] });
  await page.waitForTimeout(80);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 130, y: 700 }] });
  await page.waitForTimeout(80);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  const log = await page.evaluate(() => window.__TOUCH_LOG);
  console.log('2. CDP 터치 이벤트 로그:', JSON.stringify(log));

  // 3. Playwright touchscreen API (tap) 확인
  await page.evaluate(() => { window.__TOUCH_LOG = []; });
  await page.touchscreen.tap(90, 700);
  await page.waitForTimeout(300);
  console.log('3. touchscreen.tap 로그:', JSON.stringify(await page.evaluate(() => window.__TOUCH_LOG)));

  await browser.close();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
