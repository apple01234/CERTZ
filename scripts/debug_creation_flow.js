/* debug_creation_flow — 캐릭터 생성 흐름 단계별 스크린샷 디버그 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.PROBE_BASE || 'https://sertz11.vercel.app';
const OUT = '/home/z/my-project/scripts/glitch_shots';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 200)); });

  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: OUT + '/d0_loaded.png' });

  // 버튼 목록 덤프
  const dumpButtons = async (tag) => {
    const btns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map((b) => b.textContent?.trim().slice(0, 30)).filter(Boolean),
    );
    console.log(`[${tag}] 버튼:`, JSON.stringify(btns.slice(0, 20)));
  };

  await dumpButtons('로드후');

  await page.getByText('게임 시작').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + '/d1_after_start.png' });
  await dumpButtons('시작후');

  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('캐릭터 생성'))?.click();
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/d2_after_create.png' });
  await dumpButtons('생성클릭후');

  const inputCount = await page.evaluate(() => document.querySelectorAll('input').length);
  console.log('input 개수:', inputCount);
  if (inputCount > 0) {
    await page.locator('input').first().fill('프로브');
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: OUT + '/d3_name_filled.png' });

  for (const label of ['직업 선택', '외형 선택']) {
    await page.evaluate((lb) => {
      Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes(lb))?.click();
    }, label);
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: OUT + '/d4_job_look.png' });
  await dumpButtons('직업외형후');

  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('생성!'))?.click();
  });
  await page.waitForTimeout(10000);
  await page.screenshot({ path: OUT + '/d5_after_create_click.png' });

  const sceneInfo = await page.evaluate(() => {
    const g = window.__SERTZ__?.game;
    if (!g) return { has: false };
    const active = g.scene?.scenes?.filter((s) => s.scene?.isActive())?.map((s) => s.scene?.key) || [];
    return { has: true, active };
  });
  console.log('씬:', JSON.stringify(sceneInfo));
  console.log('에러:', errors.length ? JSON.stringify(errors.slice(0, 10), null, 1) : '없음');

  await browser.close();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
