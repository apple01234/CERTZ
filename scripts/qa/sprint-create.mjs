// 캐릭터 생성 → 월드 진입 → 실제 플레이 가능 상태 검증
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
await page.waitForTimeout(3500);
await page.getByRole('button', { name: '게임 시작' }).click();
await page.waitForTimeout(2500);

const snap = async (tag, note = '') => {
  const s = await page.evaluate(() => ({
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1200),
    buttons: [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim()).filter(Boolean).slice(0, 40),
    inputs: [...document.querySelectorAll('input')].map(i => ({ ph: i.placeholder, type: i.type })).slice(0, 15),
    selects: [...document.querySelectorAll('select')].length,
  }));
  await page.screenshot({ path: `${OUT}/${tag}.png` });
  console.log(`\n### ${tag} (+${Date.now() - t0}ms) ${note}`);
  console.log('BTN:', JSON.stringify(s.buttons));
  console.log('INP:', JSON.stringify(s.inputs));
  console.log('TXT:', s.text.slice(0, 500));
  return s;
};

// "캐릭터 생성" 클릭 (첫 번째)
const createBtns = await page.getByRole('button', { name: '캐릭터 생성' }).all();
console.log('create buttons found:', createBtns.length);
if (createBtns.length) { await createBtns[0].click(); await page.waitForTimeout(2500); }
await snap('04-create');

console.log('\nERRORS:', errors.slice(0, 8));
await browser.close();
