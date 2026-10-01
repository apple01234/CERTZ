/* dbg_frozen — 월드 진입 후 내부 상태 덤프 + 탭/키 입력 후 상태 변화 관찰 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true });
  await page.goto(process.env.PROBE_BASE || 'http://localhost:3000/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(7000);
  const clickBtn = (needle) => page.evaluate((n) => {
    const els = Array.from(document.querySelectorAll('button'));
    els.find((x) => (x.textContent ?? '').includes(n))?.click();
  }, needle);
  await clickBtn('게임 시작');
  await page.waitForTimeout(1500);
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
  await clickBtn('다음 — 직업 선택'); await page.waitForTimeout(700);
  await clickBtn('전사'); await page.waitForTimeout(600);
  await clickBtn('다음 — 외형 선택'); await page.waitForTimeout(700);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => /로 생성!/.test(x.textContent ?? ''))?.click();
  });
  await page.waitForTimeout(2500);
  await clickBtn('이 캐릭터로 시작');
  await page.waitForTimeout(9000);

  const dump = (tag) => page.evaluate((t) => {
    const w = window.__SERTZ__?.game?.scene?.getScene('world');
    if (!w) return { tag: t, err: 'no-world' };
    return {
      tag: t,
      physicsPaused: w.physics?.world?.isPaused ?? null,
      dialoguing: w.dialoguing ?? null,
      introStep: w.introStep ?? null,
      prologue: w.prologueActive ?? null,
      playerX: w.player ? Math.round(w.player.x) : null,
      playerY: w.player ? Math.round(w.player.y) : null,
      bodyEnable: w.player?.body?.enable ?? null,
      keysLeft: w.keys?.left?.isDown ?? null,
      scaleW: w.scale?.gameSize?.width,
      scaleH: w.scale?.gameSize?.height,
    };
  }, tag);

  console.log('A 진입직후:', JSON.stringify(await dump('A')));
  await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/f_A.png' });
  const domInfo = await page.evaluate(() => ({
    topAtCenter: (() => { const e = document.elementFromPoint(200, 400); return e ? e.tagName + '|' + (e.className || '').toString().slice(0, 50) : 'none'; })(),
    topAtBottom: (() => { const e = document.elementFromPoint(200, 700); return e ? e.tagName + '|' + (e.className || '').toString().slice(0, 50) : 'none'; })(),
    dialogueOpen: !!document.querySelector('.z-30 .game-panel'),
    bodyText: (document.querySelector('.z-30')?.textContent || '').slice(0, 80),
  }));
  console.log('DOM 상태:', JSON.stringify(domInfo));
  // 프롤로그(Phaser SPACE) + 구역 대사(DOM Space) 전부 스페이스로 통과
  for (let i = 0; i < 20; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(420); }
  await page.waitForTimeout(1200);
  console.log('B 스페이스후:', JSON.stringify(await dump('B')));
  await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/f_B.png' });
  // 키보드 시도
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(800);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(300);
  console.log('C 키보드후:', JSON.stringify(await dump('C')));
  // 조이스틱 pointer 시뮬레이션 (mouse 기반 pointerdown/move/up)
  await page.mouse.move(90, 700);
  await page.mouse.down();
  await page.mouse.move(150, 700, { steps: 6 });
  await page.waitForTimeout(900);
  console.log('D 포인터홀드중:', JSON.stringify(await dump('D')));
  await page.mouse.up();
  await page.waitForTimeout(300);
  console.log('E 종료:', JSON.stringify(await dump('E')));

  await browser.close();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
