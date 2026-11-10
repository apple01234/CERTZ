/** Disposable local QA: internal stage jumps and fixed attacks, not a campaign clear. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { BOSS_DEFS } from '../src/game/stages.ts';
import { DIALOGUES } from '../src/game/data.ts';
import { storyPattern } from '../src/game/entities/storyBossPatterns.ts';
import { telegraphMs } from '../src/game/entities/bossPhases.ts';
const out = process.env.BOSS_QA_OUT ?? '/dev/shm/chapter-boss-qa';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [], badAssets = [], results = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (/\/(story-bosses|chapter-terrain|cutscene-cast)\//.test(r.url()) && !r.ok()) badAssets.push([r.status(), r.url()]); });
const cases = [
  ['howlrstone2x3', 'dio', 'shadowcopies', .4, 'story_dio'],
  ['howlrstone5x4', 'harold', 'tentacleslam', .4, 'story_kraken'],
  ['howlrstone7x3', 'verodin', 'cursefield', .4, 'story_veronica'],
  ['howlrstone7x5', 'rasion', 'counter', .4, 'story_rasion'],
  ['howlrstone8x4', 'feron', 'shadowcopies', .4, 'story_feron'],
  ['howlrstone11x4', 'scarlet_blood', 'bloodseal', .4, 'story_scarlet'],
  ['howlrstone12x4', 'scarlet_dark', 'corruption', .4, 'story_scarlet'],
  ['howlrstone13x4', 'scarlet_seal', 'counter', .4, 'story_scarlet'],
  ['howlrstone14x5', 'desknis', 'corruption', .2, 'story_desknis'],
  ['dlcstargate10', 'littlestar', 'rosecore', .4, 'story_starplanet'],
  ['dlcprisma10', 'jade', 'jadeclones', .4, 'story_jade'],
  ['dlcreverse8', 'reversecore', 'cursefield', .4, 'story_aicore'],
  ['dlcneocity4', 'fabian', 'ringpush', .4, 'story_fabian'],
];
try {
  await page.goto(process.argv[2] ?? 'http://127.0.0.1:3100', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
  await page.getByRole('button', { name: '캐릭터 생성', exact: true }).first().click();
  await page.locator('input').first().fill('보스검증' + String(Date.now()).slice(-4));
  await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: '모험가로 생성!' }).click();
  await page.getByRole('button', { name: '이 캐릭터로 시작' }).click();
  await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, null, { timeout: 120000 });
  // Fixture setup: finish onboarding before isolated chapter/cast jumps.
  await page.evaluate(() => window.__SERTZ_SCENE__.tut?.skip());
  await page.keyboard.press('Escape');
  console.log('Booted original game; testing fixed attacks on a disposable save');
  for (const [stage, id, kind, hp01, expectedTexture] of cases) {
    await page.evaluate(({ stage, introIds }) => {
      const s = window.__SERTZ_SCENE__;
      window.__SERTZ_EB__.emit('dialogue:hide'); window.__SERTZ_EB__.emit('dialogue:done');
      s.closeFeatureTutorial(); s.pendingFeatureTuts = []; s.autoHunt = false;
      if (s.boss) { s.boss.destroyPool(); s.boss.destroy(); s.boss = null; }
      s.player.lv = 120; s.player.hp = 100; s.cleared = true; s.youngPrincessCleared = true; s.npcDlcTalked = true;
      const chapter = stage.replace(/x?\d+$/, '');
      s.cutsceneSeen = [...s.cutsceneSeen, chapter, ...Array.from({ length: 16 }, (_, i) => `lilacCut_rea1_lilac${String(i).padStart(2, '0')}`),
        ...Array.from({ length: 10 }, (_, i) => `stage:${chapter}:${i + 1}`)];
      for (const id of introIds) s.seenSet.add(id);
      s.startTransition(stage);
    }, { stage, introIds: Object.values(BOSS_DEFS).map(b => b.introDialogue) });
    await page.waitForFunction(stage => {
      const s = window.__SERTZ_SCENE__;
      return s?.stageDef?.key === stage && s.player && s.physics?.world;
    }, stage, { timeout: 45000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const setup = await page.evaluate(({ id, hp01, seen }) => {
      const s = window.__SERTZ_SCENE__;
      s.seenSet = new Set(seen);
      window.__SERTZ_EB__.emit('dialogue:hide'); window.__SERTZ_EB__.emit('dialogue:done');
      if (s.boss) { s.boss.destroyPool(); s.boss.destroy(); s.boss = null; }
      s.camCinema = false; s.dialoguing = false; s.autoHunt = false; s.agroHoldUntil = 0; s.introStep = 2; s.physics.world.resume();
      s.closeFeatureTutorial(); s.pendingFeatureTuts = []; s.spawnGmBoss(id);
      const b = s.boss, p = s.player;
      s.tweens.killTweensOf(b); b.countdownTimer?.remove(); b.countdown = 0; b.entranceDone = true;
      b.setAlpha(1).setVisible(true); b.body.enable = true;
      b.setPosition(s.stageW / 2, s.stageH / 2); b.setVelocity(0); b.nextAttackCd = 999999;
      b.story.origin = { x: b.x, y: b.y };
      if (b.story.ring) b.story.ring.clear().lineStyle(5, 0xe6b573, .85).strokeCircle(b.x, b.y, 235);
      b.hp = b.maxHp * hp01; b.updatePhase(); window.__SERTZ_EB__.emit("boss:update", { hp: b.hp, maxHp: b.maxHp }); b.nextAttackCd = 999999;
      s.time.timeScale = 1; s.tweens.timeScale = 1;
      p.setPosition(b.x - 100, b.y + 100); p.setVelocity(0); p.hp = 100;
      window.__BOSS_QA_HITS__ = [];
      if (!p.__qaOriginalDamage) p.__qaOriginalDamage = p.takeDamage;
      p.takeDamage = function(damage, ...args) { window.__BOSS_QA_HITS__.push(damage); return this.__qaOriginalDamage.call(this, 1, ...args); };
      s.cameras.main.startFollow(p, true, 1, 1); s.cameras.main.centerOn(b.x, b.y);
      return { texture: b.texture.key, phase: b.phase, layers: s.children.list.filter(o => o.name?.startsWith('chapter-terrain:')).length,
        dean: s.children.list.some(o => o.name === 'story-boss:dean'), x: b.x, y: b.y, target: { x: p.x, y: p.y } };
    }, { id, hp01, seen: Object.keys(DIALOGUES) });
    assert.equal(setup.texture, expectedTexture, id); assert.equal(setup.layers, 2, stage);
    if (id === 'verodin') assert.ok(setup.dean);
    await page.waitForTimeout(1600);
    // The real animation controller must use changing authored combat frames.
    await page.evaluate(() => { const b = window.__SERTZ_SCENE__.boss; b.mode = 'slamTele'; b.modeTimer = 5000; });
    const frames = new Set();
    for (let n = 0; n < 5; n++) { await page.waitForTimeout(120); frames.add(await page.evaluate(() => window.__SERTZ_SCENE__.boss.frame.name)); }
    if (frames.size < 3) console.error(await page.evaluate(() => { const s=window.__SERTZ_SCENE__, b=s.boss; return { mode:b.mode, anim:b.anims.currentAnim?.key, visible:b.visible, dialogue:s.dialoguing, cinema:s.camCinema, hp:b.hp, prologue:s.isPrologueSafe }; }));
    assert.ok([...frames].filter(f => /^attack-/.test(f)).length >= 3, `${id}: attack animation not advancing`);
    const position = await page.evaluate(() => { const s = window.__SERTZ_SCENE__; return { x: s.boss.x, y: s.boss.y, target: { x: s.player.x, y: s.player.y } }; });
    const plan = kind === 'counter' ? null : storyPattern(kind, { x: position.x, y: position.y, phase: setup.phase, key: id }, position.target);
    await page.evaluate(({ kind, plan }) => {
      const s = window.__SERTZ_SCENE__, b = s.boss;
      b.mode = 'idle'; b.nextAttackCd = 999999; b.setVelocity(0);
      window.__BOSS_QA_HITS__ = [];
      b.def = { ...b.def, sig: kind, patterns: { p1: [kind], p2: [kind], p3: [kind] } };
      b.pickAttack(s.player, 200);
      if (plan) { const h = plan.hazards[0]; s.player.setPosition(h.x, h.y); }
    }, { kind, plan });
    await page.waitForTimeout(350);
    if (plan) assert.equal(await page.evaluate(() => window.__BOSS_QA_HITS__.length), 0, `${id}: damage before warning`);
    await page.screenshot({ path: `${out}/${id}.png` });
    if (kind === 'counter') {
      const state = await page.evaluate(() => { const s = window.__SERTZ_SCENE__, b = s.boss; b.takeDamage(1, { x: 0, y: 0 }, 0); return b.mode; });
      assert.equal(state, 'staggered');
    } else {
      await page.waitForTimeout(telegraphMs(kind) + 100);
      assert.ok(await page.evaluate(() => window.__BOSS_QA_HITS__.length) > 0, `${id}: warning has no actual hit`);
    }
    await page.evaluate(() => { const s = window.__SERTZ_SCENE__; s.boss.story.clearAttack(); s.boss.mode = 'recover'; s.boss.modeTimer = 5000; });
    assert.equal(await page.evaluate(() => window.__SERTZ_SCENE__.children.list.filter(o => /^story-boss:(warning|effect|clone|label):/.test(o.name)).length), 0, id);
    if (id === 'littlestar') {
      const shared = await page.evaluate(() => {
        const s = window.__SERTZ_SCENE__, b = s.boss;
        s.bossShareActive = true; s.bossShareHost = true; s.bossShareHp = b.hp;
        b.sharedMode = true; b.sharedIsHost = true;
        const hp = s.bossShareHp;
        s.onRemoteBossMsg({ n: 1 }); const guarded = s.bossShareHp === hp;
        s.onRemoteBossMsg({ n: b.maxHp }); const coreBreak = s.bossShareHp === hp && b.story.coreHp === 0;
        s.onRemoteBossMsg({ n: 100 }); const bodyHit = s.bossShareHp === hp - 100 && b.hp === hp - 100;
        b.sharedMode = false; s.bossShareActive = false;
        return { guarded, coreBreak, bodyHit };
      });
      assert.deepEqual(shared, { guarded: true, coreBreak: true, bodyHit: true });
    }
    if (id === 'harold') {
      await page.evaluate(() => {
        const s = window.__SERTZ_SCENE__, b = s.boss;
        b.mode = 'storyCast'; b.modeTimer = 7000; b.story.start('inkflood', s.player);
      });
      await page.waitForTimeout(200);
      await page.evaluate(() => { window.__SERTZ_SCENE__.boss.story.phaseChanged(); window.__BOSS_QA_HITS__ = []; });
      await page.waitForTimeout(1300);
      assert.equal(await page.evaluate(() => window.__BOSS_QA_HITS__.length), 0, 'phase cleanup must cancel pending ink hits');
    }
    if (id === 'fabian') {
      const ringout = await page.evaluate(() => {
        const s = window.__SERTZ_SCENE__, b = s.boss;
        b.setPosition(b.story.origin.x + 240, b.story.origin.y); b.tick(16, s.player);
        return !b.alive;
      });
      assert.equal(ringout, true, 'Fabian must actually surrender after ring-out');
    }
    results.push({ stage, id, texture: setup.texture, phase: setup.phase, attackFrames: [...frames], telegraphAndHit: kind });
    console.log('PASS', id, setup.texture, frames.size, 'attack frames');
  }
  assert.deepEqual(errors, []); assert.deepEqual(badAssets, []);
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors, badAssets, evidence: 'Browser SwiftShader software renderer; fixed attack QA, not hardware or campaign/balance certification' }, null, 2));
  if (process.env.GAME_DEV_CAPTURE_MANIFEST) {
    await writeFile(process.env.GAME_DEV_CAPTURE_MANIFEST, JSON.stringify({
      schema: 'game_dev.capture.v1', runId: process.env.GAME_DEV_RUN_ID, adapterId: 'certz-browser', scenarioId: 'chapter-bosses', sourceFormat: 'game-dev-capture-v1',
      frames: results.map((r, index) => ({ index, label: r.id, attachments: [{ kind: 'color', path: `staging/${r.id}.png`, encoding: 'png', description: 'Browser SwiftShader frame of the real game, internally staged for fixed-attack QA' }] })),
      telemetry: ['staging/results.json'], adapterEvidence: { rendererClass: 'software', graphicsApi: 'WebGL / SwiftShader', windowless: true,
        gpuExecutionReported: false, gpuCompletionIdentityReported: false, hardwarePerformanceReported: false,
        notes: ['Internal stage jumps and one-damage survival override; validates motion, telegraphs and hit dispatch, not balance or campaign completion.'] }
    }, null, 2));
  }
  console.log('PASS', results.length, 'encounters; zero page errors and asset failures');
} catch (error) { await page.screenshot({ path: `${out}/failure.png` }).catch(() => {}); console.error(error); console.error(JSON.stringify({ errors, badAssets, results })); process.exitCode = 1; }
finally { await browser.close(); }
