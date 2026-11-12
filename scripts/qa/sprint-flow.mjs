// 끝까지 검증: 캐릭터 생성 → 외형 → 월드 진입 → 이동 → 전투
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/root/workspace/CERTZ/docs/qa/2026-11-12/sprint';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 400)));

const t0 = Date.now();
const stamp = (m) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForSelector('canvas', { timeout: 120000 });
stamp('canvas ready');
await page.waitForTimeout(3500);

await page.getByRole('button', { name: '게임 시작' }).click();
await page.waitForTimeout(2200);

const createBtns = await page.getByRole('button', { name: '캐릭터 생성' }).all();
await createBtns[0].click();
await page.waitForTimeout(1500);

await page.fill('input[placeholder*="캐릭터 이름"]', '테스트용사');
await page.waitForTimeout(300);
await page.getByRole('button', { name: /다음/ }).click();
await page.waitForTimeout(1800);
stamp('job step');

const readUi = async () => page.evaluate(() => ({
  text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1400),
  buttons: [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim()).filter(Boolean).slice(0, 40),
}));

let ui = await readUi();
console.log('BTN:', JSON.stringify(ui.buttons));
console.log('TXT:', ui.text.slice(0, 700));
await page.screenshot({ path: `${OUT}/10-job.png` });
fs.writeFileSync(`${OUT}/10-job.json`, JSON.stringify(ui, null, 2));

console.log('\nERRORS:', errors.slice(0, 8), 'count=', errors.length);
await browser.close();
