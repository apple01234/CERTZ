// 최종 관문: 모험가 생성 → 월드 진입 → 렌더/이동/전투 확인
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
stamp('canvas');
await page.waitForTimeout(3500);
await page.getByRole('button', { name: '게임 시작' }).click();
await page.waitForTimeout(2200);
const cb = await page.getByRole('button', { name: '캐릭터 생성' }).all();
await cb[0].click();
await page.waitForTimeout(1500);
await page.fill('input[placeholder*="캐릭터 이름"]', '테스트용사');
await page.waitForTimeout(300);
await page.getByRole('button', { name: /다음/ }).click();
await page.waitForTimeout(2000);

// 모험가로 생성!
await page.getByRole('button', { name: /모험가로 생성/ }).click();
stamp('create clicked');

// 월드 진입 대기 — 캔버스가 게임 씬으로 전환될 때까지
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    return { txt: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200), cw: c?.clientWidth ?? 0 };
  });
  if (i % 3 === 0) console.log(`  probe${i}: ${st.txt.slice(0, 90)}`);
  // 로비 UI가 사라지면 월드 진입으로 판단
  if (!/캐릭터 생성|모험가로 생성/.test(st.txt)) { stamp('world entered'); break; }
}
await page.waitForTimeout(5000);
await page.screenshot({ path: `${OUT}/11-world.png` });

const final = await page.evaluate(() => ({
  text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 600),
  canvas: (() => { const c = document.querySelector('canvas'); return c ? { w: c.width, h: c.height } : null; })(),
}));
console.log('TXT:', final.text.slice(0, 400));
console.log('CANVAS:', JSON.stringify(final.canvas));

// 이동 테스트 — WASD
for (const k of ['KeyW', 'KeyD', 'KeyS', 'KeyA']) {
  await page.keyboard.down(k); await page.waitForTimeout(350); await page.keyboard.up(k);
}
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/12-moved.png` });
stamp('moved');

// 전투 테스트 — Space
for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(450); }
await page.screenshot({ path: `${OUT}/13-attack.png` });
stamp('attacked');

console.log('\nERRORS:', errors.slice(0, 10), 'count=', errors.length);
await browser.close();
