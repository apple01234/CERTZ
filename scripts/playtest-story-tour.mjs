/** 라일락 월드 1~15장을 실제 게임에서 차원문 순서대로 들어가 지명·퀘스트·대사·보스를 기록한다.
 *  전투는 하지 않는다(장면 이동은 startTransition). 새 임시 캐릭터를 쓰고 결과는 OUT 에만 쓴다.
 *  실행: node --experimental-strip-types --import ./tests/ts-resolve-hook.mjs scripts/playtest-story-tour.mjs */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { NEXT_STAGE, STAGES } from '../src/game/stages.ts';
import { CHAPTER_STORY_PLAN } from '../src/game/chapterStoryPlan.ts';
const base = process.env.TOUR_QA_URL ?? 'http://127.0.0.1:3100';
const out = process.env.TOUR_QA_OUT ?? '/dev/shm/certz-story-tour';
const shots = process.env.TOUR_QA_SHOTS !== '0';
await mkdir(out, { recursive: true });

const chain = [];
for (let k = 'lilacworld1x1'; k && k.startsWith('lilacworld') && chain.length < 120; k = NEXT_STAGE[k]) chain.push(k);
const expectedPlace = key => {
  const m = /^(lilacworld\d+)x(\d+)$/.exec(key);
  return m ? CHAPTER_STORY_PLAN[m[1]]?.places[Number(m[2]) - 1] : undefined;
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [], rows = [], problems = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('button', { name: /게임 시작/ }).first().click({ timeout: 120000 });
  await page.getByRole('button', { name: '캐릭터 생성', exact: true }).first().click();
  await page.locator('input').first().fill('스토리' + String(Date.now()).slice(-4));
  await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: '모험가로 생성!' }).click();
  await page.getByRole('button', { name: '이 캐릭터로 시작' }).click();
  await page.waitForFunction(() => window.__SERTZ_SCENE__?.player, null, { timeout: 120000 });
  await page.evaluate(() => {
    const s = window.__SERTZ_SCENE__;
    s.tut?.skip();
    window.__TOUR_LOG__ = [];
    window.__SERTZ_EB__.on('dialogue:show', d => window.__TOUR_LOG__.push({ speaker: d.speaker ?? '', lines: d.lines ?? [], choices: (d.choices ?? []).map(c => c.label) }));
  });
  await page.keyboard.press('Escape');

  for (const stage of chain) {
    const errorsBefore = errors.length;
    await page.evaluate(stage => {
      const s = window.__SERTZ_SCENE__;
      window.__TOUR_LOG__.length = 0;
      window.__SERTZ_EB__.emit('dialogue:hide'); window.__SERTZ_EB__.emit('dialogue:done');
      s.closeFeatureTutorial?.(); s.pendingFeatureTuts = []; s.autoHunt = false;
      if (s.boss) { s.boss.destroyPool(); s.boss.destroy(); s.boss = null; }
      s.player.lv = Math.max(s.player.lv, 200); s.player.hp = s.player.maxHp;
      s.startTransition(stage);
    }, stage);
    await page.waitForFunction(stage => { const s = window.__SERTZ_SCENE__; return s?.stageDef?.key === stage && s.assetsReady && s.player && s.physics?.world; }, stage, { timeout: 90000 });
    // 입장 연출·대사를 끝까지 넘기며 기록한다(대사창은 내용 전체가 이벤트에 실려 온다).
    let quiet = 0;
    for (let i = 0; i < 120 && quiet < 6; i++) {
      await page.waitForTimeout(300);
      const busy = await page.evaluate(() => { const s = window.__SERTZ_SCENE__; return !!(s.dialoguing || s.camCinema || s.cinematicPlaying); });
      if (busy) { quiet = 0; await page.evaluate(() => { window.__SERTZ_EB__.emit('dialogue:done'); }); await page.keyboard.press('Space'); }
      else quiet++;
    }
    const row = await page.evaluate(() => {
      const s = window.__SERTZ_SCENE__, d = s.stageDef;
      return { key: d.key, name: d.name, subtitle: d.subtitle ?? '', boss: !!d.boss,
        quests: d.quests.map(q => `${q.type}:${q.title}${q.targetLabel ? `→${q.targetLabel}` : ''}`),
        spawnedBoss: s.bossDef ? `${s.bossDef.key}(${s.bossDef.name})` : null,
        terrain: s.children.list.filter(o => o.name?.startsWith('chapter-terrain:')).length,
        talkNpcs: s.interactables?.filter(it => String(it.dlg ?? '').startsWith('storyTalk|')).map(it => it.dlg.slice(10)) ?? [],
        dialogues: window.__TOUR_LOG__.map(x => ({ ...x })) };
    });
    row.errors = errors.slice(errorsBefore);
    const place = expectedPlace(stage);
    if (place && place.title !== row.name) problems.push(`${stage}: 이름 ${row.name} ≠ 계획 ${place.title}`);
    if (place?.boss && !row.boss) problems.push(`${stage}: 계획상 보스(${place.boss}) 구역인데 보스 구역이 아님`);
    if (row.errors.length) problems.push(`${stage}: 페이지 오류 ${row.errors.length}건`);
    if (!STAGES[stage]) problems.push(`${stage}: STAGES 에 없음`);
    rows.push(row);
    if (shots) await page.screenshot({ path: `${out}/${stage}.png` });
    console.log(`${stage} ${row.name} | ${row.quests.join(' / ')} | 대사 ${row.dialogues.length} (${[...new Set(row.dialogues.map(x => x.speaker))].join(',')})${row.spawnedBoss ? ' | 보스 ' + row.spawnedBoss : ''}`);
  }
} finally {
  const md = ['# 라일락 월드 스토리 실주행 기록', '', `구역 ${rows.length}/${chain.length} · 페이지 오류 ${errors.length} · 문제 ${problems.length}`, '',
    ...problems.map(p => `- 문제: ${p}`), '',
    ...rows.flatMap(r => [`## ${r.key} — ${r.name}${r.subtitle ? ` (${r.subtitle})` : ''}`,
      `- 퀘스트: ${r.quests.join(' / ') || '없음'}${r.boss ? ' · 보스 구역' : ''}${r.spawnedBoss ? ` · 출현 ${r.spawnedBoss}` : ''} · 지형층 ${r.terrain}${r.talkNpcs.length ? ` · 대화 NPC ${r.talkNpcs.join(',')}` : ''}`,
      ...r.dialogues.map(d => `- **${d.speaker || '(서술)'}**: ${d.lines.join(' ⏎ ')}${d.choices.length ? ` [선택: ${d.choices.join(' | ')}]` : ''}`), ''])];
  await writeFile(`${out}/tour.md`, md.join('\n'));
  await writeFile(`${out}/tour.json`, JSON.stringify({ rows, problems, errors }, null, 2));
  await browser.close();
  console.log(`DONE ${rows.length}/${chain.length} stages, problems=${problems.length}, pageErrors=${errors.length}`);
  if (problems.length || rows.length !== chain.length) process.exitCode = 1;
}
