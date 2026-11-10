/** Local disposable fixture: checks the original Player through PC and touch input. */
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.REFERENCE_QA_URL ?? 'http://127.0.0.1:3100';
const out = process.env.REFERENCE_QA_OUT ?? '/dev/shm/certz-reference-qa';
const storage = JSON.parse(await readFile(process.env.REFERENCE_QA_STORAGE ?? '/dev/shm/tutorial-complete-storage.json', 'utf8'));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ storageState: storage,
      viewport: mobile ? { width: 844, height: 390 } : { width: 1280, height: 800 },
      isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('PAGE_ERROR', error.message); });
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
    await page.getByRole('button', { name: '이 캐릭터로 시작' }).click();
    await page.waitForFunction(() => window.__SERTZ_SCENE__?.assetsReady, null, { timeout: 120000 });
    await page.waitForTimeout(1400);
    console.log('BOOT', mobile ? 'touch' : 'keyboard');
    await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__, p = s.player;
      window.__SERTZ_EB__.emit('dialogue:hide'); window.__SERTZ_EB__.emit('dialogue:done');
      s.closeFeatureTutorial(); s.pendingFeatureTuts = []; s.autoHunt = false;
      s.agroHoldUntil = s.time.now + 999999; s.camCinema = false; s.dialoguing = false;
      s.physics.world.resume(); p.cancelSkillCast(); p.stopFreeDash();
      document.activeElement?.blur();
      p.mpRegenAcc = -999999; // Isolate cast accounting from the passive +5 MP/second tick.
      p.cls = 'berserker'; p.state = 'idle'; p.mp = p.maxMp; p.skill1Cd = 0; p.iframes = 999999;
      p.skillMastery = { solar: 4 };
      p.facing.set(1, 0);
      s.time.timeScale = .2; s.tweens.timeScale = .2;
      window.__REFERENCE_HITS__ = 0;
      // Instrument connection, without replacing the actual skill or damage lifecycle.
      const original = s.onMeleeConnect.bind(s);
      s.onMeleeConnect = function(n, kind) { if (kind === 'skill') window.__REFERENCE_HITS__ += n; return original(n, kind); };
    });
    console.log('READY', await page.evaluate(() => { const s = window.__SERTZ_SCENE__, p = s.player; return {
      allowed: s.canPlayerAction('skill1'), state: p.state, mp: p.mp, key: s.keymap.skill1,
      dialogue: s.dialoguing, cinema: s.camCinema, tut: s.tut?.currentId, nav: s.panelNavOpen, transitioning: s.transitioning,
    }; }));
    // Actual remapped-key entry, not direct invocation of the method under test.
    await page.keyboard.press('z', { delay: 80 });
    await page.waitForFunction(() => window.__SERTZ_SCENE__.player.skillCastPhase === 'startup');
    const early = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      window.__REFERENCE_PREVIEW__ = s.children.list.find(o => o.type === 'Graphics' && o.getData?.('rea:phase') === 'startup');
      return { alpha: window.__REFERENCE_PREVIEW__?.alpha, mp: s.player.mp, cooldown: s.player.skill1Cd };
    });
    assert.ok(early.alpha >= .3 && early.alpha < 1);
    await page.waitForTimeout(200);
    const late = await page.evaluate(() => window.__REFERENCE_PREVIEW__.alpha);
    assert.ok(late > early.alpha && late <= 1);
    await page.screenshot({ path: `${out}/${mobile ? 'touch' : 'keyboard'}-startup.png` });
    if (mobile) await page.getByRole('button', { name: /돌진 —/ }).tap();
    else await page.keyboard.press('Shift', { delay: 80 });
    await page.waitForFunction(() => window.__SERTZ_SCENE__.player.skillCastPhase === 'cooldown');
    const cancelled = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__, p = s.player;
      return { phase: p.skillCastPhase, state: p.state, mp: p.mp, cooldown: p.skill1Cd,
        liveCastFx: s.children.list.filter(o => o !== p && o.getData?.('rea:skill') === 'solar').length,
        warningTween: s.tweens.isTweening(window.__REFERENCE_PREVIEW__), hits: window.__REFERENCE_HITS__ };
    });
    assert.equal(cancelled.liveCastFx, 0); assert.equal(cancelled.warningTween, false);
    assert.equal(cancelled.mp, early.mp); assert.ok(cancelled.cooldown > 0);
    assert.equal(await page.evaluate(() => window.__SERTZ_SCENE__.player.skillMastery.solar), 4);
    await page.evaluate(() => { const s = window.__SERTZ_SCENE__; s.time.timeScale = 1; s.tweens.timeScale = 1; });
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => window.__REFERENCE_HITS__), 0);
    // A following normal cast still releases, hits a real enemy, then clears its effects.
    const normal = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__, p = s.player;
      const e = s.enemies.find(e => e.active && e.alive);
      if (!e) throw Error('Fixture has no real enemy');
      e.setPosition(p.x + 70, p.y); e.hp = 999999; e.maxHp = 999999; e.setVelocity(0, 0);
      e.applyStun(999999);
      p.state = 'idle'; p.skill1Cd = 0; p.mp = p.maxMp; p.facing.set(1, 0);
      return { enemy: e.enemyKey ?? e.texture.key };
    });
    await page.keyboard.press('z', { delay: 80 });
    await page.waitForFunction(() => window.__REFERENCE_HITS__ > 0);
    await page.waitForFunction(() => !window.__SERTZ_SCENE__.player.signatureCast);
    const final = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      return { hits: window.__REFERENCE_HITS__, liveCastFx: s.children.list.filter(o => o !== s.player && o.getData?.('rea:skill') === 'solar').length };
    });
    assert.equal(final.liveCastFx, 0); assert.equal(errors.length, 0, errors.join('\n'));
    const mastery = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      s.save(); s.emitRpgState(); s.emitHud();
      window.__SERTZ_EB__.emit('ui:panel', { panel: 'job' });
      return { ...s.player.skill1Mastery, savedUses: s.buildSave().skillMastery.solar };
    });
    assert.equal(mastery.level, 1); assert.equal(mastery.savedUses, 5); assert.equal(mastery.powerBonusPct, 2);
    const section = page.getByRole('region', { name: '전수 기술 숙련도' });
    await section.getByText('아리 · 전수 기술', { exact: true }).waitFor();
    await section.getByText(/숙련 1\/10/).waitFor();
    await page.screenshot({ path: `${out}/${mobile ? 'touch' : 'keyboard'}-mastery.png` });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
    await page.getByRole('button', { name: '이 캐릭터로 시작' }).click();
    await page.waitForFunction(() => window.__SERTZ_SCENE__?.assetsReady, null, { timeout: 120000 });
    const restored = await page.evaluate(() => window.__SERTZ_SCENE__.player.skill1Mastery);
    assert.equal(restored.uses, 5); assert.equal(restored.level, 1);
    assert.equal(errors.length, 0, errors.join('\n'));
    results.push({ mode: mobile ? 'touch' : 'keyboard', early, lateAlpha: late, cancelled, normal, final, mastery, restored, pageErrors: errors });
    console.log('PASS', mobile ? 'touch' : 'keyboard');
    await context.close();
  }
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }
