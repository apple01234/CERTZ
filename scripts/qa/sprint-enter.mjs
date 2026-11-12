// 게임 진입 흐름 탐색 — 게임 시작 → 캐릭터 선택 → 월드 진입
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/root/workspace/CERTZ/docs/qa/2026-11-12/sprint';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));

const t0 = Date.now();
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('canvas', { timeout: 90000 });
await page.waitForTimeout(4000);

const snap = async (tag) => {
  const s = await page.evaluate(() => ({
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 900),
    buttons: [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim()).filter(Boolean).slice(0, 40),
    inputs: [...document.querySelectorAll('input')].map(i => ({ ph: i.placeholder, type: i.type, val: i.value })).slice(0, 15),
  }));
  await page.screenshot({ path: `${OUT}/${tag}.png` });
  fs.writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(s, null, 2));
  console.log(`\n### ${tag} (+${Date.now() - t0}ms)`);
  console.log('BTN:', JSON.stringify(s.buttons));
  console.log('TXT:', s.text.slice(0, 350));
  return s;
};

await snap('02-title');

// 게임 시작 클릭
await page.getByRole('button', { name: '게임 시작' }).click();
await page.waitForTimeout(3500);
await snap('03-after-start');

console.log('\nERRORS:', errors.slice(0, 6));
await browser.close();
