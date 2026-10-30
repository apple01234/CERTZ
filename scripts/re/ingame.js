// 로컬 서버: 최소 세이브 주입 → 무스펠헤임/숲/니플헤임 지면 캡처
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = '/root/.hermes/cache/scratch/deploy/localplay';
const SAVE_KEY = 'sertz_save_v2';

const STAGES = [
  { key: 'forest1', label: 'forest1 (숲)', stage: 'forest1' },
  { key: 'muspelheim1', label: 'muspelheim1 (꽃게타일)', stage: 'muspelheim1' },
  { key: 'niflheim1', label: 'niflheim1 (니플헤임)', stage: 'niflheim1' },
];

function makeSave(stage) {
  return {
    stage, lv: 40, exp: 0, maxHp: 3000, atk: 200, cleared: false,
    gold: 5000, potions: { hp: 5, mp: 5 },
    maxMp: 300, playerName: 'TEST', questLog: [], inv: {}, owned: [],
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'] });

  for (const st of STAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));

    // 세이브를 먼저 심고 페이지 로드
    await page.addInitScript(({ k, v }) => {
      try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    }, { k: SAVE_KEY, v: makeSave(st.stage) });

    await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 90000 });
    await page.waitForTimeout(14000);
    await page.screenshot({ path: path.join(OUT, `${st.key}_title.png`) });

    // 게임 시작
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    console.log(st.key, 'canvas box', box);
    if (box) {
      await canvas.click({ position: { x: Math.round(box.width / 2), y: Math.round(box.height * 0.35) }, force: true });
      await page.waitForTimeout(5000);
      await page.screenshot({ path: path.join(OUT, `${st.key}_after_start.png`) });

      // 캐릭터 선택 → 입장 시도
      await page.mouse.click(box.width * 0.85, box.height * 0.28);
      await page.waitForTimeout(4000);
      await page.mouse.click(box.width / 2, box.height * 0.78);
      await page.waitForTimeout(6000);
      await page.screenshot({ path: path.join(OUT, `${st.key}_world.png`) });

      // 이동
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(1800);
      await page.keyboard.up('ArrowRight');
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, `${st.key}_world2.png`) });
    }
    console.log(st.key, 'errors:', errs.slice(0, 2));
    await ctx.close();
  }
  await browser.close();
})();
