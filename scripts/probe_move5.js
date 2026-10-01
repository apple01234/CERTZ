/* probe_move5 — 로테이트 프롬프트 닫기 + 이동 중 resize/zoom 변화 계측 */
const { chromium } = require('playwright');

(async () => {
  const BASE = process.env.PROBE_BASE || 'https://sertz11.vercel.app';
  const TAG = process.env.PROBE_TAG || 'vercel';
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 200)); });

  // resize/zoom 계측 설치 (게임 시작 전에)
  await page.addInitScript(() => {
    window.__RESIZE_LOG = [];
    window.addEventListener('resize', () => {
      window.__RESIZE_LOG.push({ t: Date.now(), w: window.innerWidth, h: window.innerHeight });
    });
  });

  const clickBtn = (needle) => page.evaluate((n) => {
    const els = Array.from(document.querySelectorAll('button'));
    els.find((x) => (x.textContent ?? '').includes(n))?.click();
  }, needle);

  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(7000);
  await clickBtn('게임 시작');
  await page.waitForTimeout(1500);
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button')).filter((x) => (x.textContent ?? '').trim() === '캐릭터 생성');
      (els[els.length - 1] ?? els[0])?.click();
    });
    try { await page.waitForSelector('input', { timeout: 2000 }); break; } catch { /* retry */ }
  }
  await page.locator('input').first().fill('프로브');
  await page.waitForTimeout(300);
  await clickBtn('다음 — 직업 선택'); await page.waitForTimeout(700);
  await clickBtn('전사'); await page.waitForTimeout(600);
  await clickBtn('다음 — 외형 선택'); await page.waitForTimeout(700);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => /로 생성!/.test(x.textContent ?? ''))?.click();
  });
  await page.waitForTimeout(2500);
  await clickBtn('이 캐릭터로 시작');
  await page.waitForTimeout(8000);

  // 로테이트 프롬프트 닫기 (세로 유지)
  const rotate = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => (x.textContent ?? '').includes('세로 화면으로 계속하기'));
    if (b) { b.click(); return true; }
    return false;
  });
  console.log('로테이트 프롬프트 표시됨:', rotate, '→ 닫기');
  await page.waitForTimeout(1000);

  const dump = (tag) => page.evaluate((t) => {
    const w = window.__SERTZ__?.game?.scene?.getScene('world');
    return {
      tag: t,
      paused: w?.physics?.world?.isPaused ?? null,
      dlg: w?.dialoguing ?? null,
      x: w?.player ? Math.round(w.player.x) : null,
      y: w?.player ? Math.round(w.player.y) : null,
      zoom: w?.cameras?.main?.zoom?.toFixed(3),
      resizes: window.__RESIZE_LOG?.length,
    };
  }, tag);
  console.log('프롬프트 닫은 후:', JSON.stringify(await dump('S0')));
  await page.screenshot({ path: `/home/z/my-project/scripts/glitch_shots/${TAG}_s0.png` });

  // 프롤로그/챕터카드(캔버스 클릭) + 대사(캔버스 클릭 = DOM 홀드) 스킵
  for (let i = 0; i < 24; i++) {
    await page.mouse.click(200, 400);
    await page.keyboard.press('Space');
    await page.waitForTimeout(380);
  }
  await page.waitForTimeout(800);
  console.log('클릭/Space 후:', JSON.stringify(await dump('S1')));
  await page.screenshot({ path: `/home/z/my-project/scripts/glitch_shots/${TAG}_s1.png` });

  // 조이스틱 드래그 — CDP 터치 (모바일 실측 동일)
  const cdp = await page.context().newCDPSession(page);
  const hold = async (dx, dy, ms) => {
    // 조이스틱 영역 상태 확인
    const top = await page.evaluate(() => {
      const e = document.elementFromPoint(90, 700);
      return e ? e.tagName + '|' + (e.className || '').toString().slice(0, 40) : 'none';
    });
    console.log('  (90,700) 최상위 요소:', top);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 700 }] });
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90 + (dx * i) / steps, y: 700 + (dy * i) / steps }] });
      await page.waitForTimeout(40);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90 + dx, y: 700 + dy }] });
    await page.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(250);
  };
  await hold(55, 0, 1100);
  console.log('우 이동 후:', JSON.stringify(await dump('M1')));
  await hold(0, 55, 1100);
  console.log('하 이동 후:', JSON.stringify(await dump('M2')));
  await hold(-55, 0, 1100);
  console.log('좌 이동 후:', JSON.stringify(await dump('M3')));

  console.log('resize 로그:', JSON.stringify((await page.evaluate(() => window.__RESIZE_LOG)).slice(0, 10)));
  console.log('에러:', errors.length ? JSON.stringify([...new Set(errors)].slice(0, 8)) : '0');
  await browser.close();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
