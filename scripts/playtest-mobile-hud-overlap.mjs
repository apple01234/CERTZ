/** 터치 가로 화면에서 우하단 버튼(자동·물약·돌진·스킬·공격)이 하단 중앙 미니맵을 덮는지 잰다.
 *  미니맵 위치는 WorldScene.redrawMinimap 과 같은 식으로 계산한다. 새 임시 캐릭터를 쓴다.
 *  실행: CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/playtest-mobile-hud-overlap.mjs */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.HUD_QA_URL ?? 'http://127.0.0.1:3100';
const out = process.env.HUD_QA_OUT ?? '/dev/shm/certz-hud-overlap';
await mkdir(out, { recursive: true });
const sizes = [[844, 390], [667, 375], [740, 360], [800, 360], [932, 430]];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const report = [];
try {
  for (const [w, h] of sizes) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
    await page.getByRole('button', { name: '캐릭터 생성', exact: true }).first().click();
    await page.locator('input').first().fill('겹침' + String(Date.now()).slice(-4));
    await page.getByRole('button', { name: /다음/ }).click();
    await page.getByRole('button', { name: '모험가로 생성!' }).click();
    await page.getByRole('button', { name: '이 캐릭터로 시작' }).click();
    await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, null, { timeout: 120000 });
    await page.evaluate(() => window.__SERTZ_SCENE__.tut?.skip());
    await page.waitForTimeout(1500);
    // 스킬·궁극기가 다 열린 상태(가장 넓은 행)로 잰다.
    await page.evaluate(() => { const s = window.__SERTZ_SCENE__; window.__SERTZ_EB__.emit('dialogue:done'); s.player.lv = 200; s.startTransition('lilacworld3v'); });
    await page.waitForFunction(() => { const s = window.__SERTZ_SCENE__; return s?.stageDef?.key === 'lilacworld3v' && s.assetsReady; }, null, { timeout: 90000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/${w}x${h}-tutorial.png` });
    // 안내창을 닫고 버튼만 잰다.
    await page.evaluate(() => window.__SERTZ_EB__.emit('featTut:close'));
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__, cam = s.cameras.main, canvas = document.querySelector('canvas').getBoundingClientRect();
      const k = canvas.width / cam.width;
      const gw = cam.width < 900 ? 128 : 156, gh = cam.width < 900 ? 72 : 88, bottom = cam.width < 700 ? 56 : 14;
      const mm = { left: canvas.left + (cam.width / 2 - gw / 2) * k, right: canvas.left + (cam.width / 2 + gw / 2) * k,
        top: canvas.top + (cam.height - bottom - gh) * k, bottom: canvas.top + (cam.height - bottom) * k };
      const buttons = [...document.querySelectorAll('button')].filter(b => /돌진|공격|자동|물약|HP|MP|스킬|궁극/.test(b.getAttribute('aria-label') ?? b.textContent ?? ''))
        .map(b => { const r = b.getBoundingClientRect(); return { name: (b.getAttribute('aria-label') ?? b.textContent).slice(0, 14), left: r.left, right: r.right, top: r.top, bottom: r.bottom }; })
        .filter(r => r.right > r.left);
      const hit = buttons.filter(r => r.left < mm.right && r.right > mm.left && r.top < mm.bottom && r.bottom > mm.top);
      const dash = buttons.find(r => r.name.startsWith('돌진'));
      return { minimap: mm, overlaps: hit.map(r => r.name), dash, leftmost: Math.min(...buttons.map(r => r.left)) };
    });
    await page.screenshot({ path: `${out}/${w}x${h}-hud.png` });
    report.push({ size: `${w}x${h}`, ...m, errors });
    console.log(`${w}x${h} minimap x ${m.minimap.left.toFixed(0)}~${m.minimap.right.toFixed(0)} y ${m.minimap.top.toFixed(0)}~${m.minimap.bottom.toFixed(0)} | buttons from x ${m.leftmost.toFixed(0)} | overlaps: ${m.overlaps.join(', ') || 'none'} | errors ${errors.length}`);
    if (m.overlaps.length || errors.length) process.exitCode = 1;
    await page.close();
  }
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
