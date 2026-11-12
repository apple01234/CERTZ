// SERTZ 실제 브라우저 진입 검증 — 타이틀 → 게임 캔버스 → 로딩 시간 계측
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/root/workspace/CERTZ/docs/qa/2026-11-12/sprint';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

const errors = [];
const logs = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });

const t0 = Date.now();
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded', timeout: 120000 });
const tDom = Date.now() - t0;

// 캔버스 등장 대기
let canvasMs = null;
try {
  await page.waitForSelector('canvas', { timeout: 90000 });
  canvasMs = Date.now() - t0;
} catch { /* none */ }

await page.waitForTimeout(6000);

const state = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return {
    title: document.title,
    canvas: c ? { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight } : null,
    bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 500),
    buttons: [...document.querySelectorAll('button')].slice(0, 25).map(b => (b.innerText || '').trim()).filter(Boolean),
    webgl: (() => { try { const t = document.createElement('canvas'); return !!(t.getContext('webgl2') || t.getContext('webgl')); } catch { return false; } })(),
  };
});

await page.screenshot({ path: `${OUT}/01-boot.png` });
fs.writeFileSync(`${OUT}/01-boot.json`, JSON.stringify({ tDom, canvasMs, state, errors, logs }, null, 2));

console.log(JSON.stringify({ tDom, canvasMs, canvas: state.canvas, webgl: state.webgl, title: state.title, buttons: state.buttons.slice(0, 12), errors: errors.slice(0, 5), errCount: errors.length, conLogCount: logs.length, bodyText: state.bodyText.slice(0, 200) }, null, 2));

await browser.close();
