/* verify_kdplant — kd_plant 수정 검증:
 *  마을 진입 후 ①__MISSING 텍스처 오브젝트 0개 ②kd_plant 텍스처가 실제 나무로 렌더되는지 ③글리치 픽셀 스캔 0건 */
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

  // 마을 전체를 카메라로 훑으면서 오브젝트 통계
  const stats = await page.evaluate(() => {
    const w = window.__SERTZ__?.game?.scene?.getScene('world');
    if (!w?.player) return null;
    // 나무 텍스처 사용 분포
    const texCount = {};
    let missing = 0;
    for (const o of w.children.list) {
      const k = o.texture?.key;
      if (!k) continue;
      if (k === '__MISSING' || k === '__DEFAULT') { missing++; continue; }
      if (k === 'kd_plant1' || k === 'kd_plant2' || k === 'kd_plant3' || k === 'tree' || k === 'pine') {
        texCount[k] = (texCount[k] ?? 0) + 1;
      }
    }
    return { stage: w.stageDef?.key, missing, texCount, kdPlantLoaded: ['kd_plant1', 'kd_plant2', 'kd_plant3'].map((k) => w.textures.exists(k)) };
  });
  console.log('① 오브젝트 통계:', JSON.stringify(stats, null, 1));
  const ok1 = stats && stats.missing === 0;
  const ok2 = stats && stats.kdPlantLoaded.every(Boolean) && (stats.texCount.kd_plant1 + stats.texCount.kd_plant2 + stats.texCount.kd_plant3) > 0;
  console.log('   → __MISSING 오브젝트:', ok1 ? '✓ 0개' : '✗ 존재');
  console.log('   → kd_plant 로드+배치:', ok2 ? '✓ 정상' : '✗ 실패', stats?.texCount);

  // ② 스크린샷으로 나무 렌더 확인 (kd_plant 근처로 이동)
  await page.evaluate(() => {
    const w = window.__SERTZ__?.game?.scene?.getScene('world');
    const t = w.children.list.find((o) => ['kd_plant1', 'kd_plant2', 'kd_plant3'].includes(o.texture?.key));
    if (t) {
      w.player.x = t.x - 50; w.player.y = t.y + 80;
      w.player.body?.reset(w.player.x, w.player.y);
    }
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/kdplant_fixed.png' });

  // ③ 캔버스 글리치 픽셀 스캔 (녹색 테두리+검정+대각선 패턴) — 마을 몇 곳 순회
  const W = await page.evaluate(() => window.__SERTZ__?.game?.scene?.getScene('world')?.stageW ?? 1500);
  const H = await page.evaluate(() => window.__SERTZ__?.game?.scene?.getScene('world')?.stageH ?? 950);
  let glitchHits = 0;
  for (let py = 160; py < H - 100; py += 300) {
    for (let px = 160; px < W - 100; px += 300) {
      await page.evaluate(({ x, y }) => {
        const w = window.__SERTZ__?.game?.scene?.getScene('world');
        w.player.x = x; w.player.y = y; w.player.body?.reset(x, y);
      }, { x: px, y: py });
      await page.waitForTimeout(260);
      await page.keyboard.press('Escape');
      const r = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        const t = document.createElement('canvas');
        t.width = c.width; t.height = c.height;
        const g = t.getContext('2d');
        g.drawImage(c, 0, 0);
        const d = g.getImageData(0, 0, t.width, t.height).data;
        const isG = (i) => d[i + 1] > 190 && d[i] < 170 && d[i + 2] < 130 && d[i + 3] > 200;
        const isB = (i) => d[i] < 40 && d[i + 1] < 40 && d[i + 2] < 40 && d[i + 3] > 200;
        const skipMinimap = (x, y) => x < 270 && y > t.height - 250;
        for (let y = 8; y < t.height - 60; y += 3) {
          for (let x = 8; x < t.width - 60; x += 3) {
            if (skipMinimap(x, y)) continue;
            const i = (y * t.width + x) * 4;
            if (!isG(i)) continue;
            let rx = x; while (rx < x + 220 && rx < t.width - 1 && isG(((y * t.width) + rx) * 4)) rx++;
            const bw = rx - x; if (bw < 40 || bw > 220) continue;
            let by = y; while (by < y + 220 && by < t.height - 1 && isG(((by * t.width) + x) * 4)) by++;
            const bh = by - y; if (bh < 40 || bh > 220) continue;
            let black = 0, total = 0;
            for (let yy = y + 8; yy < Math.min(y + bh - 8, t.height); yy += 3)
              for (let xx = x + 8; xx < Math.min(x + bw - 8, t.width); xx += 3) {
                total++; if (isB(((yy * t.width) + xx) * 4)) black++;
              }
            if (total <= 60 || black / total <= 0.6) continue;
            let diag = 0;
            for (let k = 3; k < 10; k++) {
              const dx = x + Math.round((bw - 8) * k / 10) + 4, dy = y + Math.round((bh - 8) * k / 10) + 4;
              let hitD = false;
              for (let oy = -3; oy <= 3 && !hitD; oy++) for (let ox = -3; ox <= 3 && !hitD; ox++) {
                const sx = dx + ox, sy = dy + oy;
                if (sx < 0 || sy < 0 || sx >= t.width || sy >= t.height) continue;
                if (isG(((sy * t.width) + sx) * 4)) hitD = true;
              }
              if (hitD) diag++;
            }
            if (diag >= 3) return { found: true, x, y };
          }
        }
        return { found: false };
      });
      if (r.found) { glitchHits++; console.log('   글리치 잔존 at', px, py, JSON.stringify(r)); }
    }
  }
  console.log('③ 캔버스 글리치 픽셀 스캔:', glitchHits === 0 ? '✓ 0건 (전 지점 클린)' : `✗ ${glitchHits}건`);
  await browser.close();
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });
