/* vercel_glitch_probe — Vercel 배포에서 이동 시 "화면 깨짐" 실측 진단
 * 1) 로드 → 네트워크 실패/콘솔 에러 전수 수집
 * 2) 게임 진입 (캐릭터 생성)
 * 3) 이동 전/후 스크린샷 + 이동 중 다수 프레임 캡처
 * 4) WebGL 컨텍스트/렌더러 정보 수집
 */
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
  const failed = [];
  const responses404 = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 300));
  });
  page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url().slice(0, 140)} :: ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) responses404.push(`${r.status()} ${r.url().slice(0, 140)}`); });

  console.log('== 1. 로드:', BASE);
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(6000);

  console.log('== 2. 게임 진입');
  await page.getByText('게임 시작').first().click();
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).filter((x) => x.textContent?.trim() === '캐릭터 생성')[1]?.click();
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
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('이 캐릭터로 시작'))?.click();
  });
  await page.waitForTimeout(9000); // 월드 씬 부팅 대기

  const sceneInfo = await page.evaluate(() => {
    const g = window.__SERTZ__?.game;
    if (!g) return { has: false };
    const active = g.scene?.scenes?.filter((s) => s.scene?.isActive())?.map((s) => s.scene?.key) || [];
    const r = g.renderer;
    return {
      has: true, active,
      renderer: r?.type === 2 ? 'WEBGL' : r?.type === 1 ? 'CANVAS' : String(r?.type),
      webgl2: !!r?.gl && !!(r.gl instanceof WebGL2RenderingContext),
      maxTex: r?.gl?.getParameter?.(r.gl.MAX_TEXTURE_SIZE),
    };
  });
  console.log('씬/렌더러:', JSON.stringify(sceneInfo));

  await page.screenshot({ path: OUT + '/v1_before_move.png' });

  console.log('== 3. 이동 시뮬레이션 (방향키 12초 + 캡처)');
  const moveKeys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
  const errorsBeforeMove = errors.length;
  let shotIdx = 0;
  for (let round = 0; round < 3; round++) {
    for (const key of moveKeys) {
      await page.keyboard.down(key);
      await page.waitForTimeout(700);
      await page.keyboard.up(key);
      if (shotIdx % 3 === 0) {
        await page.screenshot({ path: `${OUT}/m${String(shotIdx).padStart(2, '0')}_${key.replace('Arrow', '')}.png` });
      }
      shotIdx++;
    }
  }
  const errorsDuringMove = errors.slice(errorsBeforeMove);
  await page.screenshot({ path: OUT + '/v2_after_move.png' });

  console.log('== 4. 결과');
  console.log('페이지/콘솔 에러 (이동 중):', errorsDuringMove.length);
  errorsDuringMove.slice(0, 15).forEach((e) => console.log('  ⚠', e));
  console.log('네트워크 실패 (전체):', failed.length);
  failed.slice(0, 15).forEach((e) => console.log('  ✗', e));
  console.log('HTTP >=400 (전체):', responses404.length);
  const uniq404 = [...new Set(responses404)];
  uniq404.slice(0, 25).forEach((e) => console.log('  ✗', e));

  // WebGL 컨텍스트 손실 여부
  const ctxLost = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return 'no-canvas';
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return gl ? (gl.isContextLost() ? 'CONTEXT-LOST' : 'ok') : 'no-gl';
  });
  console.log('WebGL 컨텍스트:', ctxLost);

  await browser.close();
})().catch((e) => { console.error('PROBE FAIL:', e.message); process.exit(1); });
