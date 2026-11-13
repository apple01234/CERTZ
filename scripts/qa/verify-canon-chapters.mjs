/* 정본 대사·퀘스트 동선 브라우저 실측 — 검증 전용 워프 사용(정상 플레이 아님) */
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL_BASE = 'http://127.0.0.1:3151';

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
await input.fill('검증2'); await input.dispatchEvent('input'); await page.waitForTimeout(600);
await page.getByRole('button', { name: '다음 — 외형 선택' }).click({ timeout: 40000 });
await page.waitForTimeout(2000);
await page.getByRole('button', { name: '모험가로 생성!' }).click({ timeout: 40000 });
await page.getByRole('button', { name: '이 캐릭터로 시작' }).first().waitFor({ state: 'visible', timeout: 90000 });
await page.getByRole('button', { name: '이 캐릭터로 시작' }).first().click({ timeout: 40000 });
await page.waitForFunction(() => window.__SERTZ_SCENE__?.assetsReady && window.__SERTZ_SCENE__?.player?.active, null, { timeout: 300000 });
await page.waitForTimeout(3000);

const clearDialogue = async () => {
  for (let i = 0; i < 30; i++) {
    const busy = await page.evaluate(() => !!window.__SERTZ_SCENE__.dialoguing);
    if (!busy) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(220);
  }
};

/* 각 장 인트로/완료 대사가 실제 대사창에 뜨는 문구를 그대로 읽는다. */
async function readKeys(keys) {
  const out = {};
  for (const key of keys) {
    const text = await page.evaluate(async (k) => {
      const s = window.__SERTZ_SCENE__;
      s.dialoguing = false; s.queuedDialogue = null;
      try { s.seenSet?.clear?.(); } catch {}
      s.showDialogueOnce?.(k);
      await new Promise((r) => setTimeout(r, 1500));
      return (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 320);
    }, key);
    out[key] = text;
    await clearDialogue();
    await page.evaluate(() => { window.__SERTZ_SCENE__.dialoguing = false; });
  }
  return out;
}

const intro = await readKeys(['chapterIntroHowlrstone3', 'chapterIntroHowlrstone5', 'chapterIntroHowlrstone9']);
for (const [k, v] of Object.entries(intro)) console.log(`\n[${k}]\n${v}`);

const done = await readKeys(['howlrstone3Done', 'howlrstone5Done', 'howlrstone9Done']);
for (const [k, v] of Object.entries(done)) console.log(`\n[${k}]\n${v}`);

/* 1장 퀘스트 동선: 1-2 에서 reach 퀘스트로 차원문이 열리는지 확인 */
const warp = async (stage) => page.evaluate(async (st) => {
  const s = window.__SERTZ_SCENE__;
  s.tutorialDone = true; s.tut = null; s.youngPrincessCleared = true; s.cleared = true;
  s.dialoguing = false; s.transitioning = false;
  s.gotoStage(st, undefined, true);
  await new Promise((r) => setTimeout(r, 4000));
  return { stage: s.stageDef?.key, quest: s.currentQuest?.()?.type ?? null, quests: s.stageDef?.quests?.length ?? 0 };
}, stage);

for (const st of ['howlrstone1x1', 'howlrstone1x2', 'howlrstone1x3', 'howlrstone3x2', 'howlrstone5x2', 'howlrstone9x2']) {
  const r = await warp(st);
  console.log(`\nwarp ${st} ->`, JSON.stringify(r));
  await page.waitForTimeout(600);
}

console.log('\npageerrors:', errors.length, errors.slice(0, 3));
await page.screenshot({ path: '/tmp/canon-chapters.png' });
await browser.close();
