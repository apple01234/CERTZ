/* probe_black_square — 스크린샷의 '검은 사각형+녹색 테두리+대각선' 아티팩트 재현 탐색.
 * 월드 진입 후 플레이어를 맵 그리드로 순간이동하며 캔버스를 픽셀 스캔해
 * 패턴 발견 시 그 위치의 display list 오브젝트를 덤프한다. */
const { chromium } = require('playwright');

(async () => {
  const BASE = process.env.PROBE_BASE || 'http://localhost:3000';
  const browser = await chromium.launch({
    executablePath: '/home/z/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true });
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 200)));

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

  // 월드 진입 확인
  let world = await page.evaluate(() => {
    const w = window.__SERTZ__?.game?.scene?.getScene('world');
    return w?.player ? { stage: w.stageDef?.key, W: w.stageW, H: w.stageH } : null;
  });
  if (!world) { console.log('WORLD_NOT_ENTERED'); await browser.close(); return; }
  console.log('WORLD:', JSON.stringify(world));

  /* 캔버스 픽셀 스캔 — 녹색 테두리 검은 사각형 검출 */
  const scan = () => page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    const w = c.width, h = c.height;
    const t = document.createElement('canvas');
    t.width = w; t.height = h;
    const g = t.getContext('2d');
    g.drawImage(c, 0, 0);
    let d;
    try { d = g.getImageData(0, 0, w, h).data; } catch { return { err: 'tainted' }; }
    // 스캔: 16px 간격 시드에서 녹색 픽셀 발견 시 주변 박스 검사
    // v2 — ①미니맵 영역(좌하단) 제외 ②4면 테두리 요구 ③대각선 녹색 요구
    const isG = (i) => d[i + 1] > 190 && d[i] < 170 && d[i + 2] < 130 && d[i + 3] > 200;
    const isB = (i) => d[i] < 40 && d[i + 1] < 40 && d[i + 2] < 40 && d[i + 3] > 200;
    const skipMinimap = (x, y) => x < 270 && y > h - 250;
    for (let y = 8; y < h - 60; y += 3) {
      for (let x = 8; x < w - 60; x += 3) {
        if (skipMinimap(x, y)) continue;
        const i = (y * w + x) * 4;
        if (!isG(i)) continue;
        // 녹색 시드 발견 — 오른쪽/아래로 녹색 라인 추적 (사각 테두리 후보)
        let rx = x; while (rx < x + 220 && rx < w - 1 && isG(((y * w) + rx) * 4)) rx++;
        const bw = rx - x; if (bw < 40 || bw > 220) continue;
        let by = y; while (by < y + 220 && by < h - 1 && isG(((by * w) + x) * 4)) by++;
        const bh = by - y; if (bh < 40 || bh > 220) continue;
        // 4면 테두리 검증 (상변+하변)
        let topG = 0, botG = 0;
        for (let xx = x; xx < rx; xx += 2) {
          if (isG(((y * w) + xx) * 4)) topG++;
          if (by < h - 1 && isG((((y + bh - 1) * w) + xx) * 4)) botG++;
        }
        if (topG < (bw / 2) * 0.5 || botG < (bw / 2) * 0.5) continue;
        // 내부 검정 비율
        let black = 0, total = 0;
        for (let yy = y + 8; yy < Math.min(y + bh - 8, h); yy += 3)
          for (let xx = x + 8; xx < Math.min(x + bw - 8, w); xx += 3) {
            total++; if (isB(((yy * w) + xx) * 4)) black++;
          }
        if (total <= 60 || black / total <= 0.6) continue;
        // 대각선(TL→BR) 근처 녹색 픽셀 검증
        let diag = 0;
        for (let t = 3; t < 10; t++) {
          const dx = x + Math.round((bw - 8) * t / 10) + 4;
          const dy = y + Math.round((bh - 8) * t / 10) + 4;
          let hitD = false;
          for (let oy = -3; oy <= 3 && !hitD; oy++)
            for (let ox = -3; ox <= 3 && !hitD; ox++) {
              const sx = dx + ox, sy = dy + oy;
              if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
              if (isG(((sy * w) + sx) * 4)) hitD = true;
            }
          if (hitD) diag++;
        }
        if (diag >= 3) return { found: true, x, y, bw, bh, blackRatio: +(black / total).toFixed(2), diag, shot: t.toDataURL('image/png').length ? t.toDataURL('image/png') : '' };
      }
    }
    return { found: false };
  });

  const W = world.W, H = world.H;
  const step = 320;
  let foundAt = [];
  for (let py = 160; py < H - 100; py += step) {
    for (let px2 = 160; px2 < W - 100; px2 += step) {
      await page.evaluate(({ x, y }) => {
        const w = window.__SERTZ__?.game?.scene?.getScene('world');
        if (!w?.player) return;
        w.player.x = x; w.player.y = y;
        w.player.body?.reset(x, y);
        w.cameras.main.centerOn(x, y);
      }, { x: px2, y: py });
      await page.waitForTimeout(280);
      // UI 패널(상점 등)이 열렸으면 닫기
      await page.keyboard.press('Escape');
      await page.waitForTimeout(120);
      const r = await scan();
      if (r?.found) {
        foundAt.push({ px: px2, py, ...r });
        console.log('ARTIFACT_FOUND at player', px2, py, JSON.stringify({ ...r, shot: r.shot ? r.shot.slice(0, 30) + '...' : null }));
        if (r.shot) {
          const fs = require('fs');
          fs.writeFileSync(`/home/z/my-project/scripts/glitch_shots/canvas_${px2}_${py}.png`, Buffer.from(r.shot.split(',')[1], 'base64'));
        }
        // 카메라 기준 월드좌표 + 근처 오브젝트 덤프
        const objs = await page.evaluate(({ x, y }) => {
          const w = window.__SERTZ__?.game?.scene?.getScene('world');
          if (!w) return null;
          const cam = w.cameras.main;
          const wx = Math.round(cam.midPoint.x - (cam.width / 2 - x) / cam.zoom);
          const wy = Math.round(cam.midPoint.y - (cam.height / 2 - y) / cam.zoom);
          const near = w.children.list
            .filter((o) => Math.abs((o.x ?? 1e9) - wx) < 300 && Math.abs((o.y ?? 1e9) - wy) < 300)
            .slice(0, 60)
            .map((o) => ({
              type: o.type, x: Math.round(o.x), y: Math.round(o.y),
              tex: o.texture?.key ?? null, depth: o.depth, alpha: +(+o.alpha).toFixed(2),
              blend: o.blendMode, scale: +(+o.scaleX).toFixed(2), wpx: o.width, hpx: o.height,
              visible: o.visible,
            }));
          return { wx, wy, camZoom: +cam.zoom.toFixed(2), camW: cam.width, camH: cam.height, objects: near };
        }, { x: r.x, y: r.y });
        console.log('CANVAS_POINT_WORLD:', JSON.stringify(objs, null, 1));
        if (foundAt.length >= 2) break;
      }
    }
    if (foundAt.length >= 3) break;
  }
  if (!foundAt.length) {
    console.log('NO_ARTIFACT_IN_GRID_SCAN — 스테이지:', world.stage);
    await page.screenshot({ path: '/home/z/my-project/scripts/glitch_shots/probe_last.png' });
  }
  await browser.close();
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });
