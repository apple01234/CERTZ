// 보스 실측 2: 대화 스킵 후 보스 등장 → 렌더 상태/잘림 캡처
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = '/root/.hermes/cache/scratch/deploy/boss';
const SAVE_KEY = 'sertz_save_v2';

const CASES = [
  { stage: 'muspelheim10', label: 'surt' },
  { stage: 'niflheim10', label: 'fenrir' },
  { stage: 'nidavellir10', label: 'skoll' },
  { stage: 'forest10', label: 'guardian' },
];

function makeSave(stage) {
  return { stage, lv: 120, exp: 0, maxHp: 60000, atk: 3000, cleared: false,
    gold: 999999, potions: { hp: 20, mp: 20 }, maxMp: 5000, playerName: 'GM',
    questLog: [], inv: {}, owned: [] };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'] });
  const report = [];

  for (const cs of CASES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));

    await page.addInitScript(({ k, v }) => {
      try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    }, { k: SAVE_KEY, v: makeSave(cs.stage) });

    await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 90000 });
    await page.waitForTimeout(13000);
    const canvas = page.locator('canvas').first();
    await canvas.click({ position: { x: 640, y: 252 }, force: true });
    await page.waitForTimeout(4000);
    await page.mouse.click(1090, 200);
    await page.waitForTimeout(3000);
    await page.mouse.click(640, 560);
    await page.waitForTimeout(8000);

    // 대화 스킵: Space/Enter 반복 + 화면 클릭
    for (let i = 0; i < 18; i++) {
      await page.keyboard.press('Space').catch(() => {});
      await page.keyboard.press('Enter').catch(() => {});
      await page.waitForTimeout(420);
    }
    await page.screenshot({ path: path.join(OUT, `${cs.label}_after_dialog.png`) });

    // 보스 아레나로 이동
    for (let k = 0; k < 4; k++) {
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(1800);
      await page.keyboard.up('ArrowRight');
      await page.waitForTimeout(700);
      await page.keyboard.press('Space').catch(() => {});
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, `${cs.label}_arena.png`) });

    report.push({ ...cs, errs: errs.slice(0, 2) });
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(report, null, 1));
})();
