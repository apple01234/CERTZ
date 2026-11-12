// 마지막 관문: '이 캐릭터로 시작' → 월드 씬 진입 → 이동/공격 실제 확인
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
await page.waitForTimeout(3500);
await page.getByRole('button', { name: '게임 시작' }).click();
await page.waitForTimeout(2200);

// 이미 만든 캐릭터가 있으면 바로 시작 버튼
const startBtn = page.getByRole('button', { name: /이 캐릭터로 시작/ });
const hasExisting = await startBtn.count();
console.log('existing character start button:', hasExisting);
if (hasExisting) {
  await startBtn.first().click();
  stamp('start clicked');
} else {
  console.log('NO EXISTING CHARACTER — aborts');
  await browser.close();
  process.exit(0);
}

// 월드 진입 판정 — 로비 텍스트가 사라지는 시점
let entered = false;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(2000);
  const txt = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200));
  if (i % 4 === 0) console.log(`  probe${i}: ${txt.slice(0, 100)}`);
  if (!/캐릭터 선택|이 캐릭터로 시작/.test(txt)) { entered = true; stamp('world entered'); break; }
}
console.log('entered =', entered);
await page.waitForTimeout(6000);
await page.screenshot({ path: `${OUT}/20-world.png` });

const st = await page.evaluate(() => ({
  text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 800),
  canvasCount: document.querySelectorAll('canvas').length,
  canvas: (() => { const c = document.querySelector('canvas'); return c ? { w: c.width, h: c.height, cw: c.clientWidth } : null; })(),
}));
console.log('TXT:', st.text.slice(0, 500));
console.log('CANVAS:', JSON.stringify(st.canvas), 'count=', st.canvasCount);

// 이동 + 공격
for (const k of ['KeyW', 'KeyD', 'KeyS', 'KeyA']) {
  await page.keyboard.down(k); await page.waitForTimeout(400); await page.keyboard.up(k);
}
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/21-moved.png` });
for (let i = 0; i < 5; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(400); }
await page.screenshot({ path: `${OUT}/22-attack.png` });
stamp('input done');

console.log('\nERRORS:', errors.slice(0, 10), 'count=', errors.length);
await browser.close();
