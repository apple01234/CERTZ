import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Isolated browser profile: exercises original GameRoot, never a user's save.
const out = process.env.QA_OUT ?? '/tmp/certz-rea-playtest';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
const results = { maps: [], cameras: [], skills: [], collision: null };
const shot = name => page.screenshot({ path: path.join(out, `${name}.png`) });
try {
  await page.goto(process.env.QA_URL ?? 'http://localhost:3100', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByRole('button', { name: /게임 시작/ }).click({ timeout: 90000 });
  await page.getByRole('button', { name: '캐릭터 생성', exact: true }).first().click();
  await page.locator('input').first().fill(`검증${String(Date.now()).slice(-5)}`);
  await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: '모험가로 생성!' }).click({ timeout: 30000 });
  await page.getByRole('button', { name: '이 캐릭터로 시작' }).click({ timeout: 30000 });
  await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, { timeout: 90000 });
  await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    for (const obj of [...s.children.list]) if (obj.text === '건너뛰기') obj.emit('pointerdown');
    s.tutorialDone = true;
    s.tutStep = -1;
  });
  const transition = async stage => {
    await page.evaluate(stage => window.__SERTZ_SCENE__.startTransition(stage), stage);
    await page.waitForFunction(stage => {
      const s = window.__SERTZ_SCENE__;
      return s?.stageDef?.key === stage && s.player && !s.transitioning;
    }, stage, { timeout: 30000 });
  };
  await transition('youngprincessv');
  for (const stage of ['howlrstone1x1', 'howlrstone3x1', 'howlrstone6x1', 'howlrstone10x2']) {
    await transition(stage);
    await page.waitForTimeout(stage === 'howlrstone1x1' ? 6500 : 2300);
    const during = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      return { stage: s.stageDef.key, cinematic: s.camCinema, paused: s.physics.world.isPaused,
        zoom: s.cameras.main.zoom, actors: s.children.list.filter(o => o.name?.startsWith('rea:actor')).map(o => ({ name: o.name, texture: o.texture?.key })) };
    });
    if (during.cinematic) {
      await shot(`${stage}-cinematic`);
      await page.keyboard.press('Escape');
      const after = await page.evaluate(() => {
        const s = window.__SERTZ_SCENE__;
        return { cinematic: s.camCinema, paused: s.physics.world.isPaused, zoom: s.cameras.main.zoom, baseZoom: s.baseZoom, dialoguing: s.dialoguing };
      });
      assert.equal(after.cinematic, false);
      assert.equal(after.paused, false);
      assert.equal(after.dialoguing, false);
      assert.equal(after.zoom, after.baseZoom);
      results.cameras.push({ during, after });
    }
    const map = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      return { stage: s.stageDef.key, theme: s.layout?.authored?.theme,
        layers: s.children.list.filter(o => o.name?.startsWith('rea:')).map(o => ({ name: o.name, type: o.type })),
        inventory: [...s.player.owned], cellWidth: s.layout.cellW };
    });
    assert.equal(map.layers.filter(o => o.type === 'TilemapLayer').length, 3);
    assert.ok(map.inventory.includes('weapon_1'));
    results.maps.push(map);
    await shot(`${stage}-play`);
  }
  await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    s.time.timeScale = .2;
    s.player.lv = 200;
    s.player.hp = s.player.maxHp;
  });
  for (const cls of ['berserker', 'guardian', 'sniper', 'windrunner', 'archmage', 'sage', 'assassin', 'swashbuckler', 'corsair', 'raider']) {
    await page.evaluate(cls => {
      const s = window.__SERTZ_SCENE__, p = s.player;
      p.cancelSkillCast(); p.cls = cls; p.skill1Cd = 0; p.state = 'idle'; p.mp = p.maxMp;
      p.useSkill1();
    }, cls);
    const startup = await page.evaluate(() => window.__SERTZ_SCENE__.player.skillCastPhase);
    assert.equal(startup, 'startup');
    await page.waitForFunction(() => {
      const s = window.__SERTZ_SCENE__;
      return s.children.list.some(o => o !== s.player && o.getData?.('rea:phase') === 'release');
    }, { timeout: 5000 });
    const skill = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__;
      return { name: s.player.skill1Name, style: s.player.getData('rea:skill'), phase: s.player.skillCastPhase,
        objects: s.children.list.filter(o => o !== s.player && o.getData?.('rea:phase') === 'release').length };
    });
    results.skills.push({ cls, startup, ...skill });
    await shot(`skill-${cls}`);
    await page.evaluate(() => window.__SERTZ_SCENE__.player.cancelSkillCast());
  }
  await page.evaluate(() => { window.__SERTZ_SCENE__.time.timeScale = 1; });
  await transition('village');
  results.collision = await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    s.player.fieldDecor.push({ key: 'furn_table', x: s.player.x + 120, y: s.player.y, rot: 0, stage: 'village' });
    s.renderFieldDecor();
    const image = s.fieldDecorImgs.at(-1), first = image.getData('footCollider');
    const initial = { width: first.body.width, height: first.body.height, x: first.x, y: first.y };
    s.player.fieldDecor.at(-1).rot = 1;
    s.renderFieldDecor();
    const rotated = s.fieldDecorImgs.at(-1).getData('footCollider');
    const turned = { width: rotated.body.width, height: rotated.body.height };
    const oldRemoved = !first.scene;
    s.player.fieldDecor.pop(); s.renderFieldDecor();
    return { initial, turned, oldRemoved, finalRemoved: !rotated.scene };
  });
  assert.ok(results.collision.oldRemoved && results.collision.finalRemoved);
  assert.ok(Math.abs(results.collision.initial.width - results.collision.turned.height) < .001);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await shot('mobile-original-hud');
  assert.deepEqual(errors, []);
  await writeFile(path.join(out, 'results.json'), JSON.stringify({ ...results, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ maps: results.maps.map(m => m.theme), cameras: results.cameras.length, skills: results.skills.length, collision: results.collision, pageErrors: errors, out }, null, 2));
} catch (error) {
  await shot('failure');
  console.error(JSON.stringify({ errors, partial: results }, null, 2));
  throw error;
} finally { await browser.close(); }
