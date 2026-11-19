/** 7장 보스 3연전(해롤드 7-3 → 베로딘 7-4 → 라시온 7-5)을 실제 게임 전투로 잰다.
 *  캐릭터: measure-combat-balance 의 "최약 정상 전사"(Lv43, AP 전부 STR, 골드 상점 최고 장비, 강화 0).
 *  봇: 보스에게 다가가 기본공격(X)만 누르고 회피하지 않는다 → 받는 피해·물약은 사람보다 많은 상한값.
 *  시간은 게임 시각(scene.time.now) 기준. 임시 브라우저 저장소만 쓴다.
 *  실행: node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs scripts/playtest-ch7-boss-run.mjs */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { ITEMS } from '../src/game/data.ts';
const base = process.env.BOSS_RUN_URL ?? 'http://127.0.0.1:3100';
const out = process.env.BOSS_RUN_OUT ?? '/dev/shm/certz-ch7-boss-run';
const LV = Number(process.env.BOSS_RUN_LV ?? 43), POTIONS = Number(process.env.BOSS_RUN_POTIONS ?? 30);
// 비교용: BOSS_RUN_STAGES=lilacworld8x4 처럼 다른 보스 구역만 따로 잴 수 있다.
const STAGES = (process.env.BOSS_RUN_STAGES ?? 'lilacworld7x3,lilacworld7x4,lilacworld7x5').split(',');
await mkdir(out, { recursive: true });

// measure-combat-balance.mjs 의 gear() 와 같은 조건으로 장비 키를 고른다.
const best = (kind, stat) => Object.entries(ITEMS)
  .filter(([, i]) => i.kind === kind && !i.gmOnly && !i.bmOnly && !i.tradeLock && i.price > 0 && (i.reqLv ?? 0) <= LV
    && (!i.clsOnly || i.clsOnly.includes('warrior')) && i.price <= LV * 400)
  .sort((a, b) => (b[1][stat] ?? 0) - (a[1][stat] ?? 0))[0]?.[0];
const weapon = best('weapon', 'atk'), armor = best('armor', 'def');
const ap = 5 * (LV - 1);
const save = { v: 3, storyRevision: 'haru-evernote-v1', storyQuestMigration: { revision: 3, credits: {}, review: [] },
  stage: STAGES[0], lv: LV, exp: 0, maxHp: 100 + 18 * (LV - 1), hp: 100 + 18 * (LV - 1), maxMp: 300, atk: 12 + 3 * (LV - 1),
  stats: { str: 5 + ap, dex: 5, int: 5, luk: 5 }, ap: 0, cls: 'warrior', startCls: 'warrior',
  cleared: false, playerName: '7장측정', gold: 0, weapon, armor, owned: [weapon, armor], potions: { hp: POTIONS, mp: 10 },
  questIdx: { lilacworld5x4: 1, lilacworld7x1: 1, lilacworld7x2: 1 }, questAccepted: {}, seen: [], tutorialDone: true, introSeen: true,
  cutsceneSeen: STAGES.flatMap(k => { const ch = k.replace(/x\d+$/, ''); return [ch, `stage:${k}`, ...Array.from({ length: 5 }, (_, i) => `stage:${ch}:${i + 1}`)]; }),
  lastSeen: Date.now() };
const raw = JSON.stringify(save);
const slots = JSON.stringify({ v: 1, slots: 8, activeId: 'run', chars: { run: { id: 'run', name: save.playerName, lv: LV, stage: save.stage, cleared: false, lastSeen: save.lastSeen, createdAt: save.lastSeen, rebirths: 0 } } });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, storageState: { cookies: [], origins: [{ origin: new URL(base).origin,
  localStorage: [{ name: 'sertz_save_v2', value: raw }, { name: 'sertz_char_run', value: raw }, { name: 'sertz_slots_v1', value: slots }] }] } });
const page = await context.newPage(), errors = [], results = [];
page.on('pageerror', e => errors.push(e.stack ?? e.message));
const held = new Set();
const hold = async keys => {
  for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
};
const clearDialogs = () => page.evaluate(() => {
  const s = window.__SERTZ_SCENE__;
  if (s.bossDiffPending) { s.bossDiffPending = false; s.bossDiff = 'normal'; }
  if (s.dialoguing || s.camCinema) window.__SERTZ_EB__.emit('dialogue:done');
  s.closeFeatureTutorial?.(); s.pendingFeatureTuts = [];
});
const snap = () => page.evaluate(() => {
  const s = window.__SERTZ_SCENE__, p = s.player, b = s.boss;
  return { stage: s.stageDef.key, now: s.time.now, hp: p.hp, maxHp: p.maxHp, pots: p.potions.hp, px: p.x, py: p.y, lv: p.lv, atk: Math.round(p.atkTotal),
    boss: b && b.active ? { key: s.bossDef?.key, hp: b.hp, maxHp: b.maxHp, x: b.x, y: b.y } : null, quest: s.currentQuest()?.type ?? null, deaths: s.statDeaths };
});
try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
  await page.getByRole('button', { name: '이 캐릭터로 시작' }).click();
  await page.waitForFunction(() => window.__SERTZ_SCENE__?.assetsReady && window.__SERTZ_SCENE__.physics?.world, null, { timeout: 120000 });
  for (const stage of STAGES) {
    const cur = await snap();
    if (cur.stage !== stage) {
      await page.evaluate(stage => window.__SERTZ_SCENE__.startTransition(stage), stage);
      await page.waitForFunction(stage => { const s = window.__SERTZ_SCENE__; return s?.stageDef?.key === stage && s.assetsReady && s.player && s.physics?.world; }, stage, { timeout: 90000 });
    }
    // 보스 출현까지(대사·난이도 창은 노말로 넘긴다)
    let s = await snap();
    for (let i = 0; i < 200 && !s.boss; i++) { await clearDialogs(); await page.waitForTimeout(150); s = await snap(); }
    if (!s.boss) { results.push({ stage, error: 'boss did not spawn' }); break; }
    const start = s, startReal = Date.now();
    let minHpPct = 1, last = s, outcome = 'timeout';
    while (Date.now() - startReal < 12 * 60_000) {
      await clearDialogs();
      s = await snap(); last = s;
      if (s.stage !== stage || s.deaths > start.deaths) { outcome = 'died'; break; }
      if (!s.boss || s.boss.hp <= 0) { outcome = 'killed'; break; }
      minHpPct = Math.min(minHpPct, s.hp / s.maxHp);
      const dx = s.boss.x - s.px, dy = s.boss.y - s.py, d = Math.hypot(dx, dy);
      const keys = [];
      if (d > 80) { if (Math.abs(dx) > 20) keys.push(dx > 0 ? 'ArrowRight' : 'ArrowLeft'); if (Math.abs(dy) > 20) keys.push(dy > 0 ? 'ArrowDown' : 'ArrowUp'); }
      else keys.push(dx > 0 ? 'ArrowRight' : 'ArrowLeft'); // 바라보기
      await hold(keys);
      if (d <= 110) { await page.keyboard.down('x'); await page.waitForTimeout(40); await page.keyboard.up('x'); }
      await page.waitForTimeout(80);
    }
    await hold([]);
    const row = { stage, boss: start.boss.key, bossHp: start.boss.maxHp, outcome, gameSec: +((last.now - start.now) / 1000).toFixed(1), realSec: Math.round((Date.now() - startReal) / 1000),
      potionsUsed: start.pots - last.pots, minHpPct: +minHpPct.toFixed(2), playerAtk: start.atk, playerMaxHp: start.maxHp, bossHpLeftPct: last.boss ? +(last.boss.hp / last.boss.maxHp).toFixed(2) : 0 };
    results.push(row);
    await page.screenshot({ path: `${out}/${stage}.png` });
    console.log(JSON.stringify(row));
    if (outcome !== 'killed') break;
    await page.waitForTimeout(2500); // 처치 연출·보상
  }
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify({ lv: LV, weapon, armor, potions: POTIONS, results, errors }, null, 2));
  console.log(`weapon=${weapon} armor=${armor} pageErrors=${errors.length}`);
  await browser.close();
}
