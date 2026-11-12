import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
export async function boot(name = '검증') {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  await page.goto('http://127.0.0.1:3111', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: '캐릭터 생성' }).first().click({ timeout: 30000 });
  await page.waitForTimeout(2200);
  const input = page.locator('input').first(); await input.fill(name); await input.dispatchEvent('input'); await page.waitForTimeout(700);
  await page.getByRole('button', { name: '다음 — 외형 선택' }).click({ timeout: 20000 });
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: '모험가로 생성!' }).click({ timeout: 20000 });
  await page.getByRole('button', { name: '이 캐릭터로 시작' }).first().waitFor({ state: 'visible', timeout: 60000 });
  await page.getByRole('button', { name: '이 캐릭터로 시작' }).first().click({ timeout: 30000 });
  await ready(page);
  return { browser, page, errors };
}
export async function ready(page) {
  await page.waitForFunction(() => window.__SERTZ_SCENE__?.assetsReady && window.__SERTZ_SCENE__?.player?.active, null, { timeout: 240000 });
  await page.waitForTimeout(2500);
  for (let i = 0; i < 30; i++) { const busy = await page.evaluate(() => !!window.__SERTZ_SCENE__.dialoguing); if (!busy && i > 2) break; await page.keyboard.press('Escape'); await page.waitForTimeout(600); }
}
/** 검증용 강제 이동 — 튜토리얼·서사 게이트를 끄고 이동한다(정상 플레이 아님). */
export async function warp(page, stage, extra) {
  await page.evaluate(([st, ex]) => { const s = window.__SERTZ_SCENE__; s.tutorialDone = true; s.tut = null; s.youngPrincessCleared = true; s.cleared = true; s.dialoguing = false; s.transitioning = false; s.__warpFrom = s.stageDef.key; s.gotoStage(st, ex ?? undefined, true); }, [stage, extra ?? null]);
  await page.waitForFunction((st) => window.__SERTZ_SCENE__?.stageDef?.key === st && window.__SERTZ_SCENE__?.assetsReady && window.__SERTZ_SCENE__?.player?.active, stage, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(2500);
  for (let i = 0; i < 20; i++) { const busy = await page.evaluate(() => !!window.__SERTZ_SCENE__.dialoguing); if (!busy && i > 1) break; await page.keyboard.press('Escape'); await page.waitForTimeout(600); }
  return page.evaluate(() => window.__SERTZ_SCENE__.stageDef.key);
}
