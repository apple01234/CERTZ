/* probe_move4 — 조이스틱 터치 이동 + 화면 깨짐 탐지 (Vercel vs 로컬 비교) */
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.PROBE_BASE || 'https://sertz11.vercel.app';
const OUT = '/home/z/my-project/scripts/glitch_shots';
const TAG = process.env.PROBE_TAG || 'vercel';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true });
  const errors = [];
  const bad400 = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 300)); });
  page.on('response', (r) => { if (r.status() >= 400) bad400.push(`${r.status()} ${r.url().slice(0, 120)}`); });

  const clickBtn = (mode, needle) => page.evaluate(({ mode, needle }) => {
    const els = Array.from(document.querySelectorAll('button'));
    const t = els.find((x) => (mode === 'r' ? new RegExp(needle).test(x.textContent ?? '') : (x.textContent ?? '').includes(needle)));
    t?.click();
    return t ? true : false;
  }, { mode, needle });
  const clickUntil = async (mode, needle, waitMs, tag) => {
    for (let i = 0; i < 6; i++) {
      if (await clickBtn(mode, needle)) { await page.waitForTimeout(waitMs); return true; }
      await page.waitForTimeout(700);
    }
    return false;
  };

  console.log(`== 로드 (${TAG})`);
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(7000);
  await clickUntil('i', '게임 시작', 1500, '게임시작');
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
  await clickUntil('i', '다음 — 직업 선택', 700, '직업');
  await clickUntil('i', '전사', 600, '전사');
  await clickUntil('i', '다음 — 외형 선택', 700, '외형');
  await clickUntil('r', '로 생성!', 800, '생성');
  await clickUntil('i', '이 캐릭터로 시작', 1000, '시작');
  await page.waitForTimeout(9000);

  const getPos = () => page.evaluate(() => {
    const w = window.__SERTZ__?.game?.scene?.getScene('world');
    return w?.player ? { x: Math.round(w.player.x), y: Math.round(w.player.y) } : null;
  });
  console.log('씬/좌표:', JSON.stringify(await page.evaluate(() => ({
    active: window.__SERTZ__?.game?.scene?.scenes?.filter((s) => s.scene?.isActive()).map((s) => s.scene?.key),
  }))), JSON.stringify(await getPos()));

  // 프롤로그 시네마틱 스킵 — "건너뛰기"는 Phaser 내부 텍스트라 DOM 클릭 불가 → 캔버스 중앙 6회 탭
  console.log('== 프롤로그 탭 통과');
  for (let i = 0; i < 6; i++) {
    await page.mouse.click(200, 400);
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(1500);
  console.log('프롤로그 후 좌표:', JSON.stringify(await getPos()));

  // 조이스틱 영역: 좌하단 (46% x 55%) → (90, 700) 근처에서 드래그
  const joyX = 90, joyY = 700;
  console.log('== 조이스틱 터치 이동 (우로 2.5초, 하로 2.5초)');
  const errBefore = errors.length;

  await page.touchscreen.tap(joyX, joyY); // 일단 탭해서 isTouch 활성화
  await page.waitForTimeout(500);

  // pointer 이벤트 직접 디스패치 (touchscreen API는 드래그가 안 되므로 CDP Input.dispatchTouch 사용)
  const cdp = await page.context().newCDPSession(page);
  const drag = async (dx, dy, steps, stepMs) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: joyX, y: joyY }] });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: joyX + (dx * i) / steps, y: joyY + (dy * i) / steps }],
      });
      await page.waitForTimeout(stepMs);
    }
    // 마지막 위치 유지하며 대기 (조이스틱 홀드)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: joyX + dx, y: joyY + dy }],
    });
    await page.waitForTimeout(1200);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
  };

  await drag(60, 0, 8, 60);   // 우로 드래그 후 홀드
  const p1 = await getPos();
  await page.screenshot({ path: `${OUT}/${TAG}_move1.png` });
  await drag(0, 60, 8, 60);   // 하로 드래그 후 홀드
  const p2 = await getPos();
  await page.screenshot({ path: `${OUT}/${TAG}_move2.png` });
  await drag(-60, 0, 8, 60);
  const p3 = await getPos();
  await drag(0, -60, 8, 60);
  const p4 = await getPos();

  console.log('좌표 추이:', JSON.stringify([p1, p2, p3, p4]));
  await page.screenshot({ path: `${OUT}/${TAG}_final.png` });

  const durErr = errors.slice(errBefore);
  console.log('== 결과 ==');
  console.log('이동 중 에러:', durErr.length ? JSON.stringify([...new Set(durErr)].slice(0, 10), null, 1) : '0');
  console.log('HTTP>=400 (unique):', [...new Set(bad400)].length, [...new Set(bad400)].slice(0, 6));
  // 캔버스 픽셀 무결성: 같은 위치 두 번 캡처 비교는 생략, WebGL 상태만
  const ctx = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const gl = c?.getContext('webgl2') || c?.getContext('webgl');
    return gl ? (gl.isContextLost() ? 'CONTEXT-LOST' : 'ok') : 'no-gl';
  });
  console.log('WebGL:', ctx);
  await browser.close();
})().catch((e) => { console.error('PROBE FAIL:', e.message); process.exit(1); });
