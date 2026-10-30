// sertz4: 게임 시작 버튼 클릭 → 캐릭터 선택 → 인게임 지면 캡처
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = '/root/.hermes/cache/scratch/deploy/s4play';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const shuffles = [];
  page.on('pageerror', (e) => shuffles.push(String(e).slice(0, 160)));

  await page.goto('https://sertz4.space-z.ai/', { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(28000);

  // "게임 시작" 버튼 텍스트로 찾기
  const started = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button, div, a, span')];
    const t = els.find((e) => (e.textContent || '').includes('게임 시작') && e.offsetParent);
    if (t) { t.click(); return t.textContent.trim().slice(0, 60); }
    return null;
  });
  console.log('start button:', started);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(OUT, '04_charselect.png') });

  // 캐릭터 선택 화면: 캔버스/버튼 클릭 여러 번
  for (let i = 0; i < 6; i++) {
    await page.mouse.click(640, 360 + (i % 3) * 60);
    await page.waitForTimeout(1200);
  }
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(OUT, '05_ingame_attempt1.png') });

  // 이동 시도
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft']) {
    await page.keyboard.down(k); await page.waitForTimeout(700); await page.keyboard.up(k);
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, '06_ingame_move.png') });

  // 게임 내부 상태 덤프 시도
  const dump = await page.evaluate(() => {
    const out = {};
    try {
      const games = [];
      for (const k of Object.keys(window)) {
        const v = window[k];
        if (v && v.constructor && /Game/.test(v.constructor.name) && v.scene) games.push(k);
      }
      out.gameKeys = games;
      const g = games.length ? window[games[0]] : null;
      if (g) {
        out.scenes = g.scene.scenes.map((s) => ({ key: s.scene.key, active: s.scene.isActive() }));
      }
    } catch (e) { out.err = String(e).slice(0, 200); }
    return out;
  });
  console.log(JSON.stringify(dump, null, 2));
  console.log('errors:', shuffles.slice(0, 4));
  await browser.close();
})();
