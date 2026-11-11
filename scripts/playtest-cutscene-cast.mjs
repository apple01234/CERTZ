/** Browser QA on a disposable local save. Chapter jumps are internal test setup, not campaign completion. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { CUTSCENE_CAST, castPortrait } from '../src/game/cutsceneCast.ts';
import appearanceFrames from '../src/game/appearanceFrames.json' with { type: 'json' };

const url = process.argv[2] ?? 'http://127.0.0.1:3100';
const out = process.env.CAST_QA_OUT ?? '/dev/shm/cast-qa';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [], badAssets = [], shots = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => { if (r.url().includes('/cutscene-cast/') && !r.ok()) badAssets.push([r.status(), r.url()]); });
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
  await page.getByRole('button', { name: '캐릭터 생성', exact: true }).first().click();
  await page.locator('input').first().fill('배우검증' + String(Date.now()).slice(-4));
  await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: '모험가로 생성!' }).click();
  await page.getByRole('button', { name: '이 캐릭터로 시작' }).click();
  await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, null, { timeout: 120000 });
  // Fixture setup: finish onboarding before isolated chapter/cast jumps.
  await page.evaluate(() => window.__SERTZ_SCENE__.tut?.skip());
  console.log('Booted the original game');
  for (let n = 0; n < 9; n++) { await page.keyboard.press('Space'); await page.waitForTimeout(170); }
  const loaded = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    return s.textures.getTextureKeys().filter((k) => k.startsWith('cast_')).map((key) => ({ key, frames: s.textures.get(key).getFrameNames().length }));
  });
  assert.equal(loaded.length, CUTSCENE_CAST.length);
  assert.ok(loaded.every((c) => c.frames === 16));
  await page.evaluate(() => {
    window.__CAST_QA__ = { dialogues: [], last: null, animations: [], cast: [] };
    window.__SERTZ_EB__.on('dialogue:show', (d) => {
      const q = window.__CAST_QA__, s = window.__SERTZ_SCENE__;
      const actors = s.children.list.filter((a) => a.name?.startsWith('rea:actor:') || a.name?.startsWith('cast:'));
      q.last = d;
      q.dialogues.push({ speaker: d.speaker, lines: d.lines, actors: actors.map((a) => ({ name: a.name, texture: a.texture?.key, frame: a.frame?.name, anim: a.anims?.currentAnim?.key, x: a.x, y: a.y, visible: a.visible })) });
    });
  });
  // Exercise real authored direction, real map floors, the shared dialogue UI and real input.
  for (const [stage, id, expected] of [
    ['howlrstone1x1', 'pendant', 'cast_lilac'], ['howlrstone4x1', 'vellica', 'cast_vellica'],
    ['howlrstone6x1', 'injury', 'cast_lucy'], ['howlrstone8x1', 'relationship', 'cast_ari'],
  ]) {
    await page.keyboard.press('Escape');
    await page.evaluate((key) => {
      const s = window.__SERTZ_SCENE__;
      window.__SERTZ_EB__.emit('dialogue:hide'); window.__SERTZ_EB__.emit('dialogue:done');
      // A disposable QA save, so chapter gates do not replace the scene being inspected.
      s.closeFeatureTutorial(); s.pendingFeatureTuts = []; s.player.lv = 120; s.player.hp = 99999;
      s.cutsceneSeen = []; s.startTransition(key);
    }, stage);
    await page.waitForFunction(({ stage }) => {
      const s = window.__SERTZ_SCENE__;
      return s?.stageDef?.key === stage && s.camCinema;
    }, { stage, expected }, { timeout: 45000 });
    console.log('Playing', stage);
    let captured = false;
    for (let n = 0; n < 240; n++) {
      const state = await page.evaluate(() => {
        const s = window.__SERTZ_SCENE__, q = window.__CAST_QA__;
        const a = s.children.list.filter((a) => a.name?.startsWith('rea:actor:'));
        return { running: s.camCinema, actors: a.map((a) => ({ tex: a.texture.key, anim: a.anims.currentAnim?.key })), speaker: q.last?.speaker, lines: q.last?.lines ?? [] };
      });
      const expectedSpeaker = { pendant: '라일락', vellica: '벨리카', injury: '루시', relationship: '아리' }[id];
      if (!captured && state.actors.some((a) => a.tex === expected) && state.speaker === expectedSpeaker
        && (id !== 'pendant' || state.lines.some((l) => l.includes('펜던트')))
        && await page.locator('img[data-portrait-src*="cutscene-cast/portraits"]').count()) {
        if (id !== 'injury' || state.actors.some((a) => a.anim === 'cast_lucy-hurt')) {
          await page.screenshot({ path: `${out}/${id}.png` }); shots.push(id); captured = true;
        }
      }
      if (!state.running) break;
      const choice = page.getByRole('button', { name: '두려움에 도망치는 사람', exact: true });
      if (await choice.count()) await choice.click();
      else await page.keyboard.press('Space');
      await page.waitForTimeout(220);
    }
    assert.ok(captured, `${stage}: no visible portrait + actor screenshot`);
    console.log('Captured', id);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__SERTZ_SCENE__?.physics?.world && !window.__SERTZ_SCENE__.camCinema, { timeout: 15000 });
    const released = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      return { locked: s.camCinema, actors: s.children.list.filter((a) => a.name?.startsWith('rea:actor:')).length, paused: s.physics.world.isPaused };
    });
    assert.equal(released.locked, false, stage); assert.equal(released.actors, 0, stage);
  }
  // Every alias resolves its exact portrait in React, beyond the four photographed scenes.
  const portraits = [];
  for (const c of CUTSCENE_CAST) {
    await page.evaluate((speaker) => window.__SERTZ_EB__.emit('dialogue:show', { speaker, lines: ['초상화 일치 검증'] }), c.name);
    const frame = appearanceFrames[castPortrait(c.id)];
    const face = page.locator(`img[data-portrait-src="${castPortrait(c.id)}"]`);
    await face.waitFor({ timeout: 5000 });
    await face.evaluate((img) => img.decode());
    assert.equal(await face.getAttribute('src'), frame.src, c.name);
    assert.equal(await face.evaluate((img) => img.naturalWidth), frame.sheet.w, c.name); portraits.push(c.id);
  }
  await page.evaluate(() => { window.__SERTZ_EB__.emit('dialogue:hide'); window.__SERTZ_EB__.emit('dialogue:done'); });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => window.__SERTZ_SCENE__.showDialogueRaw({ speaker: '벨리카', lines: ['기획서에 맞춘 번개 궁수의 모습입니다.'] }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/mobile-dialogue.png` });
  const evidence = await page.evaluate(() => window.__CAST_QA__.dialogues);
  assert.deepEqual(badAssets, [], 'cast assets failed to load');
  assert.deepEqual(errors, [], 'browser runtime errors');
  await writeFile(`${out}/results.json`, JSON.stringify({ loaded, shots, portraits, dialogues: evidence, errors, badAssets }, null, 2));
  console.log(JSON.stringify({ atlasCount: loaded.length, validFrames: loaded.reduce((n, c) => n + c.frames, 0), portraits: portraits.length, shots, errors, badAssets, evidence: out }));
} catch (e) {
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  console.error(e);
  console.error(JSON.stringify({ errors, badAssets, text: await page.locator('body').innerText().catch(() => '') }));
  process.exitCode = 1;
} finally { await browser.close(); }
