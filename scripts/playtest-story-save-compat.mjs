/** e713366 이전 저장(해롤드 5-4·베로딘 7-3·에스테반 마을)으로 실제 게임에 들어가 이어하기를 확인한다. 저장은 임시 브라우저 저장소에만 넣는다. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.SAVE_QA_URL ?? 'http://127.0.0.1:3100';
const out = process.env.SAVE_QA_OUT ?? '/dev/shm/certz-story-save-compat';
await mkdir(out, { recursive: true });
const oldSave = (stage, questIdx, extra = {}) => ({ v: 3, storyRevision: 'haru-evernote-v1', storyQuestMigration: { revision: 2, credits: {}, review: [] },
  stage, lv: 48, exp: 0, maxHp: 9000, maxMp: 300, atk: 400, cleared: false, playerName: '구저장검증', gold: 5000, weapon: 'weapon_1', armor: 'armor_1',
  owned: ['weapon_1', 'armor_1'], questIdx, questAccepted: {}, seen: [], tutorialDone: true, introSeen: true,
  cutsceneSeen: ['lilacworld5', 'lilacworld7', ...Array.from({ length: 5 }, (_, i) => `stage:lilacworld7:${i + 1}`), ...Array.from({ length: 4 }, (_, i) => `stage:lilacworld5:${i + 1}`)],
  lastSeen: Date.UTC(2026, 10, 18, 10), ...extra });
const cases = [
  { name: 'village5v', save: oldSave('lilacworld5v', { lilacworld4x4: 1 }), expect: { stage: 'lilacworld5x1' } },
  { name: 'verodin-killed-at-7x3', save: oldSave('lilacworld7x3', { lilacworld5x4: 2, lilacworld7x3: 1 }),
    expect: { stage: 'lilacworld7x3', idx: 0, boss: 'harold', saved74: 1, credit: { gold: 451, exp: 18504 } } },
  { name: 'old-7x4-collect', save: oldSave('lilacworld7x4', { lilacworld5x4: 2, lilacworld7x3: 2, lilacworld7x4: 0 }),
    expect: { stage: 'lilacworld7x3', idx: 0, boss: 'harold', saved74: 1 } },
  { name: 'past-chapter-7', save: oldSave('lilacworld8x1', { lilacworld5x4: 2, lilacworld7x3: 2, lilacworld7x4: 1, lilacworld7x5: 2 }),
    expect: { stage: 'lilacworld8x1', saved73: 2, saved74: 2 } },
];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const c of cases) {
    const raw = JSON.stringify(c.save);
    const slots = JSON.stringify({ v: 1, slots: 8, activeId: 'old', chars: { old: { id: 'old', name: c.save.playerName, lv: c.save.lv, stage: c.save.stage, cleared: false, lastSeen: c.save.lastSeen, createdAt: c.save.lastSeen, rebirths: 0 } } });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, storageState: { cookies: [], origins: [{ origin: new URL(base).origin,
      localStorage: [{ name: 'sertz_save_v2', value: raw }, { name: 'sertz_char_old', value: raw }, { name: 'sertz_slots_v1', value: slots }] }] } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const enter = async () => {
      await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
      await page.getByRole('button', { name: '이 캐릭터로 시작' }).click();
      await page.waitForFunction(() => window.__SERTZ_SCENE__?.assetsReady && window.__SERTZ_SCENE__.physics?.world, null, { timeout: 120000 });
    };
    const state = () => page.evaluate(() => { const s = window.__SERTZ_SCENE__, save = s.buildSave();
      return { stage: s.stageDef.key, name: s.stageDef.name, idx: s.questIdx, quest: s.currentQuest()?.type ?? null, boss: s.bossDef?.key ?? null, bossHp: s.boss?.maxHp ?? null,
        saved: save.questIdx, credit: save.storyQuestMigration?.credits?.lilacworld7x3 ?? null, revision: save.storyQuestMigration?.revision, gold: s.player.gold, exp: s.player.exp }; });
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await enter();
      // 보스 복구 스폰은 입장 900ms 뒤
      await page.waitForTimeout(2500);
      const s = await state();
      await page.screenshot({ path: `${out}/${c.name}.png` });
      assert.equal(s.stage, c.expect.stage, c.name);
      if ('idx' in c.expect) assert.equal(s.idx, c.expect.idx, `${c.name} idx`);
      if (c.expect.boss) {
        await page.waitForFunction(() => window.__SERTZ_SCENE__?.bossDef, null, { timeout: 20000 });
        assert.equal((await state()).boss, c.expect.boss, `${c.name} boss`);
      }
      const after = await state();
      if ('saved73' in c.expect) assert.equal(after.saved.lilacworld7x3, c.expect.saved73, `${c.name} 7x3`);
      if ('saved74' in c.expect) assert.equal(after.saved.lilacworld7x4, c.expect.saved74, `${c.name} 7x4`);
      if (c.expect.credit) assert.deepEqual(after.credit, c.expect.credit, `${c.name} credit`);
      // 저장 후 다시 불러와도 같은 상태
      await page.evaluate(() => window.__SERTZ_SCENE__.save());
      await page.waitForTimeout(500);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await enter();
      const reloaded = await state();
      assert.equal(reloaded.stage, after.stage, `${c.name} reload stage`);
      assert.deepEqual([reloaded.saved.lilacworld7x3, reloaded.saved.lilacworld7x4], [after.saved.lilacworld7x3, after.saved.lilacworld7x4], `${c.name} reload idx`);
      assert.equal(errors.length, 0, errors.join('\n'));
      results.push({ case: c.name, ok: true, state: after, reloaded: { stage: reloaded.stage, saved: reloaded.saved } });
      console.log('PASS', c.name, after.stage, after.name, 'boss=', after.boss, after.bossHp, '7x3/7x4=', after.saved.lilacworld7x3, after.saved.lilacworld7x4);
    } catch (e) {
      results.push({ case: c.name, ok: false, error: String(e), errors });
      console.log('FAIL', c.name, String(e).split('\n')[0]);
      process.exitCode = 1;
    } finally { await context.close(); }
  }
} finally { await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2)); await browser.close(); }
