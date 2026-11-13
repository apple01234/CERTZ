/* 정본 대사가 실제 화면에 도달하는지 — 브라우저 실측 (검증 전용 워프 사용) */
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const URL_BASE = 'http://127.0.0.1:3141';
const readDialogue = `(() => {
  const box = document.querySelector('[class*="dialogue" i], [data-dialogue]');
  const t = (box?.innerText || '').trim();
  const s = window.__SERTZ_SCENE__;
  return { text: t.slice(0, 400), dialoguing: !!s?.dialoguing, stage: s?.stageDef?.key ?? null };
})()`;

const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));

await page.goto(URL_BASE, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 180000 });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: '캐릭터 생성' }).first().click({ timeout: 60000 });
await page.waitForTimeout(2200);
const input = page.locator('input').first();
await input.fill('검증'); await input.dispatchEvent('input'); await page.waitForTimeout(600);
await page.getByRole('button', { name: '다음 — 외형 선택' }).click({ timeout: 40000 });
await page.waitForTimeout(2000);
await page.getByRole('button', { name: '모험가로 생성!' }).click({ timeout: 40000 });
await page.getByRole('button', { name: '이 캐릭터로 시작' }).first().waitFor({ state: 'visible', timeout: 90000 });
await page.getByRole('button', { name: '이 캐릭터로 시작' }).first().click({ timeout: 40000 });

await page.waitForFunction(() => window.__SERTZ_SCENE__?.assetsReady && window.__SERTZ_SCENE__?.player?.active, null, { timeout: 300000 });
await page.waitForTimeout(3000);

/* 1장 인트로 대사창 문구 수집 — Escape 로 넘기지 않고 첫 화면을 그대로 읽는다. */
const first = await page.evaluate(readDialogue);
console.log('첫 진입 상태:', JSON.stringify(first));

/* seenSet 을 비워 1장 인트로를 다시 띄운다 → 실제 대사 문구를 읽는다. */
const introText = await page.evaluate(async () => {
  const s = window.__SERTZ_SCENE__;
  try { s.seenSet?.clear?.(); } catch {}
  s.dialoguing = false;
  s.showDialogueOnce?.('chapterIntroHowlrstone1');
  await new Promise((r) => setTimeout(r, 1800));
  const t = document.body.innerText || '';
  return t.replace(/\s+/g, ' ').slice(0, 1200);
});
console.log('\n=== 1장 인트로 화면 텍스트 ===\n' + introText);

const doneText = await page.evaluate(async () => {
  const s = window.__SERTZ_SCENE__;
  for (let i = 0; i < 25 && s.dialoguing; i++) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await new Promise((r) => setTimeout(r, 300)); }
  s.dialoguing = false;
  try { s.seenSet?.clear?.(); } catch {}
  s.showDialogueOnce?.('howlrstone1Done');
  await new Promise((r) => setTimeout(r, 1800));
  return (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1200);
});
console.log('\n=== 1장 완료 화면 텍스트 ===\n' + doneText);

console.log('\npageerrors:', errors.length, errors.slice(0, 3));
await page.screenshot({ path: '/tmp/canon-check.png' });
await browser.close();
