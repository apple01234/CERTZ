/* verify_fix — v1.4.18 3종 수정 검증 (Vercel 라이브)
 * ① (90,700)이 조이스틱 영역으로 반환되는지 (물약 겹침 제거)
 * ② socket.io 재시도가 4회 후 멈추는지 (30초 관찰 — 이전은 무한 404)
 * ③ 조이스틱 터치로 실제 이동되는지
 */
const { chromium } = require('playwright');

(async () => {
  const BASE = process.env.PROBE_BASE || 'https://sertz11.vercel.app';
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true });
  const bad400 = [];
  page.on('response', (r) => { if (r.status() >= 400) bad400.push(Date.now() + '|' + r.status() + ' ' + r.url().slice(8, 60)); });
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 150)));

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
  await clickBtn('세로 화면으로 계속하기');
  await page.waitForTimeout(600);
  for (let i = 0; i < 24; i++) { await page.mouse.click(200, 400); await page.keyboard.press('Space'); await page.waitForTimeout(320); }
  await page.waitForTimeout(800);

  // ① 조이스틱 겹침 검증 — (90,700) 및 조이스틱 우측 하단 (150,740)
  const hit = await page.evaluate(() => {
    const pick = (x, y) => {
      const e = document.elementFromPoint(x, y);
      return e ? (e.className || '').toString().slice(0, 55) : 'none';
    };
    return { at90_700: pick(90, 700), at150_740: pick(150, 740) };
  });
  console.log('① 터치 히트 테스트:', JSON.stringify(hit, null, 1));
  const overlapFixed = hit.at90_700.includes('w-[46%]') && hit.at150_740.includes('w-[46%]');
  console.log('   → 조이스틱 겹침 제거:', overlapFixed ? '✓ 성공' : '✗ 실패');

  // ② socket.io 재시도 스톰 관찰 (이미 게임 진입 후 30초+ 경과 — 4회 소진 후 소식 없어야)
  const sock = await page.evaluate(() => {
    const s = window.__SERTZ_NET__;
    return s ? { connected: s.connected, canReconnect: s.canReconnect?.() ?? 'n/a' } : null;
  });
  console.log('② 소켓 상태:', JSON.stringify(sock));
  const cnt30s = bad400.filter((x) => x.includes('socket.io')).length;
  console.log('   socket.io 4xx 개수(세션 전체):', cnt30s, cnt30s <= 12 ? '✓ 재시도 소진 후 정지(4회×2transport 수준)' : '✗ 여전히 스톰');

  // ③ 조이스틱 터치 이동
  const getPos = () => page.evaluate(() => {
    const w = window.__SERTZ__?.game?.scene?.getScene('world');
    return w?.player ? { x: Math.round(w.player.x), y: Math.round(w.player.y), zoom: +w.cameras.main.zoom.toFixed(2) } : null;
  });
  const p0 = await getPos();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 700 }] });
  for (let i = 1; i <= 5; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90 + i * 10, y: 700 }] });
    await page.waitForTimeout(40);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 140, y: 700 }] });
  await page.waitForTimeout(1500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  const p1 = await getPos();
  console.log('③ 조이스틱 이동:', JSON.stringify(p0), '→', JSON.stringify(p1), p0 && p1 && p1.x > p0.x ? '✓ 이동 성공' : '✗ 이동 실패');

  // 리사이즈 줌 안정성: 높이 60px 변경 → 줌 불변이어야 함
  const z0 = (await getPos())?.zoom;
  await page.setViewportSize({ width: 400, height: 745 });
  await page.waitForTimeout(900);
  await page.setViewportSize({ width: 400, height: 800 });
  await page.waitForTimeout(900);
  const z1 = (await getPos())?.zoom;
  console.log('④ 주소창 토글 수준 resize 후 줌:', z0, '→', z1, z0 === z1 ? '✓ 안정' : '✗ 점프');

  await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/verify_final.png' });
  await browser.close();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
