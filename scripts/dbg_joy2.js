const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true });
  await page.goto(process.env.PROBE_BASE || 'http://localhost:3000', { waitUntil: 'networkidle', timeout: 90000 });
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
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => (x.textContent ?? '').includes('세로 화면으로 계속하기'))?.click();
  });
  await page.waitForTimeout(600);
  for (let i = 0; i < 24; i++) { await page.mouse.click(200, 400); await page.keyboard.press('Space'); await page.waitForTimeout(320); }
  await page.waitForTimeout(600);

  const info = await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div'));
    const joy = divs.filter((d) => (d.className || '').toString().includes('touch-none'));
    const moved = divs.filter((d) => (d.className || '').toString().includes('bottom-0'));
    return {
      touchNone: joy.map((d) => (d.className || '').toString().slice(0, 70)),
      bottom0: moved.map((d) => (d.className || '').toString().slice(0, 70)).slice(0, 8),
      joyVisible: !!divs.find((d) => (d.textContent || '').trim() === '이동'),
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/joy_state.png' });
  await browser.close();
})();
