/* dbg_confirm2 — 플레이어를 __MISSING 위치로 이동 → 스크린샷 → 제거 → 스크린샷 */
const { chromium } = require('playwright');

(async () => {
  const BASE = process.env.PROBE_BASE || 'http://localhost:3000';
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true });
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

  // ① 플레이어를 __MISSING(1014,165) 자리로 텔레포트
  const pos = await page.evaluate(() => {
    const w = window.__SERTZ__?.game?.scene?.getScene('world');
    const ts = w.children.list.filter((o) => o.texture?.key === '__MISSING');
    const t = ts.find((o) => Math.abs(o.x - 1014) < 40) ?? ts[0];
    if (!t) return null;
    w.player.x = t.x - 40; w.player.y = t.y + 60;
    w.player.body?.reset(w.player.x, w.player.y);
    w.cameras.main.centerOn(w.player.x, w.player.y);
    return { tx: t.x, ty: t.y, count: ts.length, all: ts.map((o) => [Math.round(o.x), Math.round(o.y), o.depth]) };
  });
  console.log('targets:', JSON.stringify(pos));
  await page.waitForTimeout(900);
  await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/c2_before.png' });

  // ② 해당 오브젝트만 제거
  await page.evaluate(() => {
    const w = window.__SERTZ__?.game?.scene?.getScene('world');
    w.children.list
      .filter((o) => o.texture?.key === '__MISSING' && Math.abs(o.x - window.__target?.x < 1e9))
      .forEach((o) => o.destroy());
    w.children.list.filter((o) => o.texture?.key === '__MISSING').forEach((o) => o.destroy());
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/c2_after.png' });
  console.log('done');
  await browser.close();
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });
