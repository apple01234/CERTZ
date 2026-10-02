/* verify_tailwind — Tailwind UI 스킨 전환 검증: 타이틀/생성/월드 HUD/패널 스크린샷 */
const { chromium } = require('playwright');

(async () => {
  const BASE = process.env.PROBE_BASE || 'http://localhost:3000';
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 150)));
  const clickBtn = (needle) => page.evaluate((n) => {
    Array.from(document.querySelectorAll('button')).find((x) => (x.textContent ?? '').includes(n))?.click();
  }, needle);
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(7000);
  await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/tw_1_title.png' });
  await clickBtn('게임 시작'); await page.waitForTimeout(1800);
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button')).filter((x) => (x.textContent ?? '').trim() === '캐릭터 생성');
      (els[els.length - 1] ?? els[0])?.click();
    });
    try { await page.waitForSelector('input', { timeout: 2000 }); break; } catch { }
  }
  await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/tw_2_create.png' });
  await page.locator('input').first().fill('프로브'); await page.waitForTimeout(300);
  await clickBtn('다음 — 직업 선택'); await page.waitForTimeout(800);
  await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/tw_3_job.png' });
  await clickBtn('전사'); await page.waitForTimeout(600);
  await clickBtn('다음 — 외형 선택'); await page.waitForTimeout(800);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => /로 생성!/.test(x.textContent ?? ''))?.click();
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/tw_4_summary.png' });
  await clickBtn('이 캐릭터로 시작');
  await page.waitForTimeout(8000);
  await clickBtn('세로 화면으로 계속하기');
  await page.waitForTimeout(600);
  for (let i = 0; i < 24; i++) { await page.mouse.click(200, 400); await page.keyboard.press('Space'); await page.waitForTimeout(320); }
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/tw_5_world.png' });

  // 월드 HUD 상태(우상단 메뉴) 열어 패널 스킨 확인
  const opened = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const hud = btns.find((b) => (b.getAttribute('aria-label') ?? '').includes('설정') || (b.textContent ?? '').includes('더보기'));
    hud?.click();
    return !!hud;
  });
  await page.waitForTimeout(700);
  if (opened) await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/tw_6_panel.png' });
  // 패널 CSS 실측 — game-panel의 border/backdrop 적용 확인
  const style = await page.evaluate(() => {
    const p = document.querySelector('.game-panel');
    if (!p) return null;
    const cs = getComputedStyle(p);
    return { border: cs.borderTopColor, radius: cs.borderRadius, bg: cs.backgroundColor, backdrop: cs.backdropFilter ?? cs.webkitBackdropFilter };
  });
  console.log('game-panel style:', JSON.stringify(style));
  await browser.close();
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });
