// 보스 실측: GM 으로 보스 스테이지 진입 → 보스 렌더 상태 캡처
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = '/root/.hermes/cache/scratch/deploy/boss';
const SAVE_KEY = 'sertz_save_v2';

// 챕터별 보스 스테이지 (10번 = 보스)
const CASES = [
  { stage: 'muspelheim10', label: 'surt (무스펠헤임)' },
  { stage: 'niflheim10', label: 'fenrir (니플헤임)' },
  { stage: 'nidavellir10', label: 'skoll (니다벨리르)' },
  { stage: 'abyss10', label: 'abudditos (세계수 뿌리)' },
  { stage: 'forest10', label: 'guardian (숲의 신전)' },
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

    let bossReq = [];
    page.on('response', (r) => {
      const u = r.url();
      const m = u.match(/(atl_boss[a-z0-9_]*)\.webp/);
      if (m) bossReq.push(m[1] + ':' + r.status());
    });

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
    await page.waitForTimeout(9000);

    // 보스 아레나로 이동 시도 (오른쪽으로)
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(6000);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, `${cs.stage}.png`) });

    report.push({ ...cs, bossReq: [...new Set(bossReq)], errs: errs.slice(0, 2) });
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(report, null, 1));
})();
