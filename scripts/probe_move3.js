/* probe_move3 — 상태 기반 견고한 게임 진입 + 이동 실측 */
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

  const btnTexts = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).map((b) => b.textContent?.trim().slice(0, 36)).filter(Boolean));
  const clickBtn = (mode, needle) => page.evaluate(({ mode, needle }) => {
    const els = Array.from(document.querySelectorAll('button'));
    const t = els.find((x) => (mode === 'r' ? new RegExp(needle).test(x.textContent ?? '') : (x.textContent ?? '').includes(needle)));
    t?.click();
    return t ? (t.textContent ?? '').slice(0, 40) : null;
  }, { mode, needle });

  /** 클릭 시도 → 조건 만족까지 재시도 */
  const clickUntil = async (mode, needle, waitMs, tag) => {
    for (let i = 0; i < 6; i++) {
      const hit = await clickBtn(mode, needle);
      await page.waitForTimeout(waitMs);
      if (hit !== null) { console.log(`  [${tag}] 클릭됨: ${hit}`); return true; }
      console.log(`  [${tag}] 버튼 없음 (시도 ${i + 1}) — 현재: ${(await btnTexts()).slice(0, 6).join(' | ')}`);
      await page.waitForTimeout(800);
    }
    return false;
  };

  console.log('== 1. 로드');
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(7000);
  if (!(await clickUntil('i', '게임 시작', 1600, '게임시작'))) throw new Error('게임 시작 실패');

  console.log('== 2. 캐릭터 생성');
  // 슬롯 카드 또는 패널 버튼 — input 나타날 때까지 두 버전 모두 시도
  let entered = false;
  for (let i = 0; i < 8 && !entered; i++) {
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button')).filter((x) => (x.textContent ?? '').trim() === '캐릭터 생성');
      (els[els.length - 1] ?? els[0])?.click();
    });
    try { await page.waitForSelector('input', { timeout: 2500 }); entered = true; } catch { /* retry */ }
  }
  if (!entered) throw new Error('캐릭터 생성 진입 실패: ' + (await btnTexts()).join(' | '));
  console.log('  이름 입력 패널 진입');

  await page.locator('input').first().fill('프로브');
  await page.waitForTimeout(300);
  await clickUntil('i', '다음 — 직업 선택', 800, '직업단계');
  await clickUntil('i', '전사', 700, '전사카드');
  await clickUntil('i', '다음 — 외형 선택', 800, '외형단계');
  await clickUntil('r', '로 생성!', 900, '생성');
  await clickUntil('i', '이 캐릭터로 시작', 1200, '시작');

  console.log('== 3. 월드 부팅 대기');
  await page.waitForTimeout(9000);
  const sceneInfo = await page.evaluate(() => {
    const g = window.__SERTZ__?.game;
    return { scenes: g?.scene?.scenes?.map((s) => ({ key: s.scene?.key, active: s.scene?.isActive() })) };
  });
  console.log('씬:', JSON.stringify(sceneInfo));
  await page.screenshot({ path: OUT + '/w0_world.png' });

  const getPos = () => page.evaluate(() => {
    const w = window.__SERTZ__?.game?.scene?.getScene('world');
    return w?.player ? { x: Math.round(w.player.x), y: Math.round(w.player.y) } : null;
  });
  console.log('이동 전 좌표:', JSON.stringify(await getPos()));

  console.log('== 4. 이동 시뮬레이션 (12키스트로크)');
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
  console.log('== 5. 결과 ==');
  console.log('이동 중 에러:', durErr.length ? JSON.stringify(durErr.slice(0, 12), null, 1) : '0');
  console.log('네트워크 실패:', failed.length, [...new Set(failed)].slice(0, 8));
  console.log('HTTP>=400:', bad400.length, [...new Set(bad400)].slice(0, 8));
  const ctx = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const gl = c?.getContext('webgl2') || c?.getContext('webgl');
    return gl ? (gl.isContextLost() ? 'CONTEXT-LOST' : 'ok') : 'no-gl';
  });
  console.log('WebGL:', ctx);
  await browser.close();
})().catch((e) => { console.error('PROBE FAIL:', e.message); process.exit(1); });
