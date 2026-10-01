/* 씬 상태 상세 덤프 */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
  await page.goto('https://sertz11.vercel.app/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(6000);
  await page.getByText('게임 시작').first().click();
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('캐릭터 생성'))?.click();
  });
  await page.waitForTimeout(900);
  await page.locator('input').first().fill('프로브');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('다음 — 직업 선택'))?.click();
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => /로 생성!/.test(x.textContent ?? ''))?.click();
  });
  await page.waitForTimeout(2500);
  const btns = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((b) => b.textContent?.trim().slice(0, 40)).filter(Boolean));
  console.log('생성후 버튼:', JSON.stringify(btns));
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('이 캐릭터로 시작'))?.click();
  });
  await page.waitForTimeout(9000);
  const dump = await page.evaluate(() => {
    const g = window.__SERTZ__?.game;
    if (!g) return { has: false };
    const mgr = g.scene;
    return {
      has: true,
      scenes: mgr.scenes.map((s) => ({ key: s.scene?.key ?? s.sceneKey, status: s.scene?.status, active: s.scene?.isActive(), visible: s.scene?.isVisible() })),
    };
  });
  console.log('씬 덤프:', JSON.stringify(dump, null, 1));
  await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/s_final.png' });
  await browser.close();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
