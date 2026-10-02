/* dbg_missing_tex — __MISSING 텍스처의 실제 런타임 모습 + depth16 오브젝트 정체 확인 */
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

  const info = await page.evaluate(() => {
    const g = window.__SERTZ__?.game;
    const w = g?.scene?.getScene('world');
    if (!w) return null;
    const tm = g.textures;
    // __MISSING 텍스처 실물 확인
    const missing = tm.get('__MISSING');
    const src = missing?.source?.[0]?.image;
    let missingDesc = null;
    if (src) {
      const c = document.createElement('canvas');
      c.width = src.naturalWidth; c.height = src.naturalHeight;
      const cx = c.getContext('2d');
      cx.drawImage(src, 0, 0);
      const d = cx.getImageData(0, 0, c.width, c.height).data;
      const pts = [0, c.width * 4 * (c.height - 1), (c.width - 1) * 4, ((c.height - 1) * c.width + c.width - 1) * 4, ((c.height >> 1) * c.width + (c.width >> 1)) * 4];
      missingDesc = {
        w: c.width, h: c.height,
        corners: pts.map((i) => [d[i], d[i + 1], d[i + 2], d[i + 3]]),
      };
    }
    // __MISSING으로 렌더 중인 오브젝트 전수 조사
    const missingObjs = w.children.list
      .filter((o) => o.texture?.key === '__MISSING')
      .map((o) => ({
        type: o.type, x: Math.round(o.x), y: Math.round(o.y), depth: o.depth,
        wpx: o.width, hpx: o.height, scale: +(+o.scaleX).toFixed(2),
        alpha: +(+o.alpha).toFixed(2), originY: o.originY,
        scroll: o.scrollFactorX,
        name: o.name ?? null,
      }));
    // 전체 씬에서 depth 12~20 이미지 (스폰 플로우 추정)
    const depthBand = w.children.list
      .filter((o) => o.depth >= 12 && o.depth <= 20 && (o.type === 'Image' || o.type === 'Sprite'))
      .slice(0, 30)
      .map((o) => ({ tex: o.texture?.key, x: Math.round(o.x), y: Math.round(o.y), depth: o.depth }));
    return { missingDesc, missingObjs, depthBand, rendererType: g.renderer.type };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });
