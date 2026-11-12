// 캐릭터 실제 생성 → 월드 진입 → 플레이어 이동/전투 가능 여부 검증
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
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('canvas', { timeout: 90000 });
await page.waitForTimeout(3500);
await page.getByRole('button', { name: '게임 시작' }).click();
await page.waitForTimeout(2000);
const createBtns = await page.getByRole('button', { name: '캐릭터 생성' }).all();
await createBtns[0].click();
await page.waitForTimeout(1500);

// 이름 입력
await page.fill('input[placeholder*="캐릭터 이름"]', '테스트용사');
await page.waitForTimeout(400);
await page.getByRole('button', { name: /다음/ }).click();
await page.waitForTimeout(1500);

let s = await page.evaluate(() => ({
  text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1200),
  buttons: [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim()).filter(Boolean).slice(0, 40),
}));
console.log('### 05-job (+' + (Date.now() - t0) + 'ms)');
console.log('BTN:', JSON.stringify(s.buttons));
console.log('TXT:', s.text.slice(0, 600));
await page.screenshot({ path: `${OUT}/05-job.png` });

// 직업 선택 — 첫 직업 버튼류 클릭 시도
const jobCandidates = s.buttons.filter(b => /전사|궁수|마법사|도적|성직자|직업|선택/.test(b) );
console.log('jobCandidates:', JSON.stringify(jobCandidates));

console.log('\nERRORS:', errors.slice(0, 8));
await browser.close();
