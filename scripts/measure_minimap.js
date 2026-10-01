// v1.4.12 미니맵 화면 위치 실측 — 골드 테두리(#ffd76a) 픽셀 스캔
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 800 } }); // 모바일 세로
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.getByText('게임 시작').first().click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('캐릭터 생성'))?.click();
  });
  await page.waitForTimeout(700);
  await page.locator('input').first().fill('세라MM');
  await page.waitForTimeout(300);
  for (const label of ['직업 선택', '외형 선택']) {
    await page.evaluate((lb) => {
      Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes(lb))?.click();
    }, label);
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('생성!'))?.click();
  });
  await page.waitForTimeout(1400);
  await page.evaluate(() => { document.querySelector('.cursor-pointer')?.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('이 캐릭터로 시작'))?.click();
  });
  await page.waitForTimeout(3000);
  for (let i = 0; i < 4; i++) { await page.mouse.click(200, 300); await page.waitForTimeout(400); }
  for (let i = 0; i < 30; i++) {
    const d = await page.evaluate(() => window.__SERTZ__?.game?.scene?.getScene('world')?.dialoguing);
    if (!d) break;
    await page.mouse.click(200, 300);
    await page.waitForTimeout(360);
  }
  const inWorld = await page.evaluate(() => !!(window.__SERTZ__?.game?.scene?.getScene('world')?.player));
  console.log('inWorld:', inWorld);
  await page.waitForTimeout(2000);

  // 스크린샷 캡처(WebGL 포함) → 골드 테두리 픽셀 스캔
  await page.screenshot({ path: '/home/z/my-project/scripts/mm_shot.png' });
  // 게임 오브젝트 직접 검사 — 미니맵 존재/좌표/카메라 상태
  const obj = await page.evaluate(() => {
    const g = window.__SERTZ__?.game;
    const ws = g?.scene?.getScene('world');
    if (!ws || !ws.minimap) return { have: false };
    const mm = ws.minimap;
    const cam = ws.cameras.main;
    const z = cam.zoom || 1;
    return {
      have: true,
      mm: { x: Math.round(mm.x), y: Math.round(mm.y), scrollF: mm.scrollFactorX + '/' + mm.scrollFactorY },
      cam: { w: cam.width, h: cam.height, zoom: z, scrollY: Math.round(cam.scrollY) },
      visible: mm.visible, alpha: mm.alpha, depth: mm.depth,
      stageH: ws.stageH, playerY: Math.round(ws.player?.y ?? -1),
    };
  });
  console.log('minimap:', JSON.stringify(obj, null, 1));
  console.log('errors:', errors.slice(0, 3));
  await browser.close();
})();
