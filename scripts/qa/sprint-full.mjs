// 한 세션에서 끝까지: 생성 → 이 캐릭터로 시작 → 월드 진입 → 이동/공격
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
const bodyTxt = () => page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300));

await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForSelector('canvas', { timeout: 120000 });
await page.waitForTimeout(3500);
await page.getByRole('button', { name: '게임 시작' }).click();
await page.waitForTimeout(2200);

// 생성
const cb = await page.getByRole('button', { name: '캐릭터 생성' }).all();
await cb[0].click();
await page.waitForTimeout(1500);
await page.fill('input[placeholder*="캐릭터 이름"]', '검증용사');
await page.waitForTimeout(300);
await page.getByRole('button', { name: /다음/ }).click();
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /모험가로 생성/ }).click();
stamp('created');
await page.waitForTimeout(4000);

// 생성 후 목록 화면에서 '이 캐릭터로 시작'
let txt = await bodyTxt();
console.log('after create:', txt.slice(0, 160));
const startBtn = page.getByRole('button', { name: /이 캐릭터로 시작/ });
const n = await startBtn.count();
console.log('start buttons:', n);
if (!n) { console.log('STILL NO START BTN'); await page.screenshot({ path: `${OUT}/30-fail.png` }); await browser.close(); process.exit(1); }
await startBtn.first().click();
stamp('start clicked');

// 월드 진입 대기
let entered = false;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(2000);
  txt = await bodyTxt();
  if (i % 5 === 0) console.log(`  p${i}: ${txt.slice(0, 100)}`);
  if (!/캐릭터 선택|이 캐릭터로 시작|방금 전/.test(txt)) { entered = true; stamp('world entered'); break; }
}
console.log('entered =', entered);
await page.waitForTimeout(7000);
await page.screenshot({ path: `${OUT}/31-world.png` });

const st = await page.evaluate(() => ({
  text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 900),
  canvases: document.querySelectorAll('canvas').length,
  sceneText: (() => {
    const el = document.querySelector('[data-scene], .game-root, #game');
    return el ? el.className : null;
  })(),
}));
console.log('TXT:', st.text.slice(0, 600));
console.log('CANVASES:', st.canvases);

// 입력
await page.mouse.click(640, 360);
await page.waitForTimeout(500);
for (const k of ['KeyW', 'KeyD', 'KeyS', 'KeyA']) {
  await page.keyboard.down(k); await page.waitForTimeout(450); await page.keyboard.up(k);
}
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/32-moved.png` });
for (let i = 0; i < 6; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(420); }
await page.screenshot({ path: `${OUT}/33-attack.png` });
stamp('input done');

console.log('\nERRORS:', errors.slice(0, 10), 'count=', errors.length);
await browser.close();
