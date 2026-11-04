// vc239 검증 — 영프편 비트 대사 22키 + bossDone 15 + intro 15 가 실제 화면에 뜨는지.
// showDialogueOnce 는 키가 없으면 조용히 false 를 돌려준다. 그래서 반환값과
// 씬 상태(dialoguing)를 함께 본다 — 둘 다 통과해야 "실제로 뜬다"고 말할 수 있다.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const out = process.env.QA_OUT ?? "/root/.hermes/cache/scratch/qa-vc239-prod";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
await page.goto(process.env.QA_URL ?? 'http://127.0.0.1:3100', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.locator('button', { hasText: '게임 시작' }).first().click({ timeout: 120000 });
await page.getByRole('button', { name: '캐릭터 생성', exact: true }).first().click();
await page.locator('input').first().fill(`대사${String(Date.now()).slice(-5)}`);
await page.getByRole('button', { name: /다음/ }).click();
await page.getByRole('button', { name: '모험가로 생성!' }).click({ timeout: 30000 });
await page.getByRole('button', { name: '이 캐릭터로 시작' }).click({ timeout: 30000 });
await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });
await page.evaluate(() => { const s = window.__SERTZ_SCENE__; for (const o of [...s.children.list]) if (o.text === '건너뛰기') o.emit('pointerdown'); s.tutorialDone = true; s.tutStep = -1; });
await page.evaluate(stage => window.__SERTZ_SCENE__.startTransition(stage), 'howlrstone1x2');
await page.waitForFunction(() => { const s = window.__SERTZ_SCENE__; return s?.stageDef?.key === 'howlrstone1x2' && !s.transitioning; }, { timeout: 30000 });
await page.waitForTimeout(700);

const KEYS = [
  'howlBook','howlLetter','howlWar','howlAri','howlDokkaebi','howlAlliance',
  'howlLuci','howlGolem','howlRiande','howlSwords','howlLilac','howlFourDoors','howlWindDoor',
  'howlBalloon','howlIon','howlCurse','howlSunMark','howlEndTime','howlTimeRuler',
  'howlNewBeginning','howlSerniumCall',
  ...Array.from({ length: 15 }, (_, i) => `howlrstone${i + 1}Done`),
  ...Array.from({ length: 15 }, (_, i) => `chapterIntroHowlrstone${i + 1}`),
];

const results = { checked: [], pageErrors };
try {
  for (const key of KEYS) {
    const r = await page.evaluate(async (key) => {
      const s = window.__SERTZ_SCENE__;
      if (s.seenSet?.delete) s.seenSet.delete(key); // once 가드 해제
      const shown = s.showDialogueOnce(key);
      await new Promise(res => setTimeout(res, 260));
      const dialoguing = !!s.dialoguing;
      // 화면에 실제 텍스트가 있는지 (대사창은 DOM 오버레이)
      const txt = (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400);
      // 닫기
      if (dialoguing) {
        for (const o of [...s.children.list]) if (o.text === '▼') o.emit('pointerdown');
        if (s.closeDialogue) { try { s.closeDialogue(); } catch { /* 무시 */ } }
      }
      await new Promise(res => setTimeout(res, 140));
      return { shown, dialoguing, textLen: txt.length };
    }, key);
    results.checked.push({ key, ...r });
  }
} finally {
  await writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
const bad = results.checked.filter(c => !c.shown);
console.log(`검사 ${results.checked.length}개 — 표시 성공 ${results.checked.length - bad.length}, 실패 ${bad.length}`);
if (bad.length) console.log('실패:', bad.map(b => b.key).join(', '));
console.log('dialoguing 확인된 수:', results.checked.filter(c => c.dialoguing).length);
console.log('pageErrors:', results.pageErrors.length, results.pageErrors.slice(0, 2));
