/* vercel 이동 실측 v2 — 정확한 생성 플로우 + 이동 중 캡처 */
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
  const bad400 = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 300)); });
  page.on('requestfailed', (r) => failed.push(`${r.url().slice(0, 130)} :: ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) bad400.push(`${r.status()} ${r.url().slice(0, 130)}`); });

  const clickBtn = async (pred) => {
    await page.evaluate((p) => {
      // p는 "includes:" 또는 "regex:" 접두사
      const [, mode, ...rest] = p.split(':');
      const needle = rest.join(':');
      Array.from(document.querySelectorAll('button')).find((x) => {
        const t = x.textContent ?? '';
        return mode === 'r' ? new RegExp(needle).test(t) : t.includes(needle);
      })?.click();
    }, pred);
  };

  console.log('== 로드');
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(6000);
  await clickBtn('i:게임 시작');
  await page.waitForTimeout(1500);
  await clickBtn('i:캐릭터 생성');
  await page.waitForSelector('input', { timeout: 15000 });
  await page.locator('input').first().fill('프로브');
  await page.waitForTimeout(300);
  await clickBtn('i:다음 — 직업 선택');
  await page.waitForTimeout(700);
  await clickBtn('i:전사');           // 직업 카드
  await page.waitForTimeout(500);
  await clickBtn('i:다음 — 외형 선택');
  await page.waitForTimeout(500);
  await clickBtn('r:로 생성!');        // 전사로 생성!
  await page.waitForTimeout(2500);
  await clickBtn('i:이 캐릭터로 시작');
  await page.waitForTimeout(10000);

  const sceneInfo = await page.evaluate(() => {
    const g = window.__SERTZ__?.game;
    return {
      scenes: g?.scene?.scenes?.map((s) => ({ key: s.scene?.key, active: s.scene?.isActive() })),
    };
  });
  console.log('씬:', JSON.stringify(sceneInfo));
  await page.screenshot({ path: OUT + '/w0_world.png' });

  // 플레이어 좌표 샘플
  const getPos = () => page.evaluate(() => {
    const w = window.__SERTZ__?.game?.scene?.getScene('world');
    return w?.player ? { x: Math.round(w.player.x), y: Math.round(w.player.y), anim: w.player.animKey ?? '' } : null;
  });
  console.log('이동 전 좌표:', JSON.stringify(await getPos()));

  console.log('== 이동 시뮬레이션');
  const errBefore = errors.length;
  const moveKeys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
  let shot = 0;
  for (let round = 0; round < 3; round++) {
    for (const key of moveKeys) {
      await page.keyboard.down(key);
      await page.waitForTimeout(650);
      await page.keyboard.up(key);
      await page.waitForTimeout(150);
      if (shot % 3 === 0) await page.screenshot({ path: `${OUT}/mv${String(shot).padStart(2, '0')}.png` });
      shot++;
    }
  }
  console.log('이동 후 좌표:', JSON.stringify(await getPos()));
  await page.screenshot({ path: OUT + '/w1_after.png' });

  const durErr = errors.slice(errBefore);
  console.log('== 결과 ==');
  console.log('이동 중 에러:', durErr.length ? JSON.stringify(durErr.slice(0, 12), null, 1) : '0');
  console.log('네트워크 실패:', failed.length, [...new Set(failed)].slice(0, 10));
  console.log('HTTP>=400:', bad400.length, [...new Set(bad400)].slice(0, 10));
  const ctx = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const gl = c?.getContext('webgl2') || c?.getContext('webgl');
    return gl ? (gl.isContextLost() ? 'CONTEXT-LOST' : 'ok') : 'no-gl';
  });
  console.log('WebGL:', ctx);
  await browser.close();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
