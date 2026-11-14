import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { CHAPTER_STORY_PLAN } from '../src/game/chapterStoryPlan.ts';
import { authoredRoomLayout } from '../src/game/authoredLayouts.ts';
import { chapterTerrainData } from '../src/game/fx/ChapterTerrain.ts';
import { STAGES, BOSS_DEFS } from '../src/game/stages.ts';
import { STORY_ATTACKS, storyPattern, hazardContains } from '../src/game/entities/storyBossPatterns.ts';
import { canonBossOf, BOSS_RECORD_ALIASES } from '../src/game/entities/bossDesign.ts';
/* textures.ts 는 Phaser 를 불러와 노드에서 import 할 수 없다 — 보스 아틀라스 표(tex → 파일)만 소스에서 읽는다. */
const BOSS_ATLAS = Object.fromEntries([...fs.readFileSync(new URL('../src/game/textures.ts', import.meta.url), 'utf8').matchAll(/^  (boss\w*):\s*\{ key: "atl_\w+",\s*file: "([\w.]+)"/gm)].map(m => [m[1], m[2]]));
import { telegraphMs, recoveryMs } from '../src/game/entities/bossPhases.ts';
const read = p => JSON.parse(fs.readFileSync(new URL('../' + p, import.meta.url)));
const terrain = read('public/assets/chapter-terrain/manifest.json');

test('all 165 native chapter maps preserve the exact collision mask and world dimensions', () => {
  let rooms = 0;
  for (const [key, chapter] of Object.entries(CHAPTER_STORY_PLAN)) for (const [n, place] of chapter.places.entries()) {
    const stage = STAGES[`${key}${key.startsWith('howlrstone') ? 'x' : ''}${n + 1}`];
    const layout = authoredRoomLayout(stage.key, stage.width, stage.height), data = chapterTerrainData(layout, place);
    assert.ok(Math.abs(data.ground.length * data.tileH - stage.height) < .00001);
    assert.ok(Math.abs(data.ground[0].length * data.tileW - stage.width) < .00001);
    for (let y = 0; y < data.ground.length; y++) for (let x = 0; x < data.ground[y].length; x++) {
      const cell = Math.floor(y / data.detail) * layout.cols + Math.floor(x / data.detail);
      assert.equal(data.ground[y][x] >= 0, layout.open[cell], `${stage.key}: floor/collision mismatch`);
      for (const index of [data.ground[y][x], data.border[y][x]]) assert.ok(index === -1 || terrain.tiles[index], `${stage.key}: missing native tile ${index}`);
    }
    assert.equal(stage.bossKey, place.boss);
    if (!stage.enemies.length) assert.equal(stage.repeat, undefined, `${stage.key}: impossible repeat quest`);
    rooms++;
  }
  assert.equal(rooms, 165);
});

test('danger warnings retain readable safe corridors and a bounded recovery opportunity', () => {
  const boss = { x: 1000, y: 800, phase: 2, key: 'feron' }, target = { x: 1100, y: 900 };
  for (const kind of STORY_ATTACKS) {
    const plan = storyPattern(kind, boss, target);
    assert.ok(plan.hazards.length > 0 && plan.hazards.length <= 4);
    assert.ok(telegraphMs(kind) >= 600 && telegraphMs(kind) <= 1200);
    assert.ok(recoveryMs(kind) >= 1000 && recoveryMs(kind) <= 2000);
    for (const hazard of plan.hazards) {
      assert.ok(hazardContains(hazard, hazard));
      assert.equal(hazardContains(hazard, { x: hazard.x + hazard.w + 1, y: hazard.y + hazard.h + 1 }), false);
    }
    if (plan.safe) assert.ok(plan.hazards.every(h => !hazardContains(h, plan.safe)), `${kind}: promised safe center is damaging`);
  }
});

test('the cliff road connects both portals without filling the meadow with repeated crosses', () => {
  const stage = STAGES.howlrstone1x1;
  const layout = authoredRoomLayout(stage.key, stage.width, stage.height);
  const data = chapterTerrainData(layout, CHAPTER_STORY_PLAN.howlrstone1.places[0]);
  const roadTiles = new Set(terrain.materials.earth.tiles), cols = data.ground[0].length;
  const road = new Set(data.ground.flatMap((row, y) => row.flatMap((tile, x) => roadTiles.has(tile) ? [y * cols + x] : [])));
  const open = data.ground.flat().filter(tile => tile >= 0).length;
  assert.ok(road.size / open < .45, 'road must leave broad continuous meadow margins');
  const center = cell => (Math.floor(cell / layout.cols) * 4 + 2) * cols + cell % layout.cols * 4 + 2;
  const start = center(layout.entry), exit = center(layout.exit), visited = new Set([start]), queue = [start];
  for (let i = 0; i < queue.length; i++) for (const n of [queue[i] - 1, queue[i] + 1, queue[i] - cols, queue[i] + cols]) {
    if (road.has(n) && !visited.has(n)) { visited.add(n); queue.push(n); }
  }
  assert.ok(road.has(start) && visited.has(exit));
  assert.equal(visited.size, road.size, 'no disconnected decorative road patches');
});

test('all active canonical boss visuals and changing attack/cast frames ship offline', () => {
  const cast = read('public/assets/cutscene-cast/manifest.json');
  const combat = read('public/assets/story-bosses/manifest.json');
  assert.equal(cast.characters.length, 31); assert.equal(combat.bosses.length, 13);
  for (const boss of Object.values(BOSS_DEFS)) {
    const design = canonBossOf(boss.key); if (!design) continue;
    /* 2026-11-14 — 전투기록 보스 12종은 자기 전용 아틀라스 그림을 쓴다(스토리 보스와 겹침 해소). 패턴은 기록을 따른다. */
    if (BOSS_RECORD_ALIASES[boss.key]) { assert.ok(BOSS_ATLAS[boss.tex] && fs.existsSync(new URL(`../public/assets/${BOSS_ATLAS[boss.tex]}`, import.meta.url)), `${boss.key}: ${boss.tex} 전용 아틀라스 없음`); assert.ok(boss.patterns.p1.includes(boss.sig)); continue; }
    assert.equal(boss.tex, design.visual);
    assert.ok(boss.patterns.p1.includes(boss.sig));
    for (const visual of [design.visual, ...design.phases.flatMap(p => p.visual ? [p.visual] : [])]) {
      const id = visual.replace(/^(cast_|story_)/, '');
      assert.ok(combat.bosses.some(b => b.id === id));
      const atlas = read(`public/assets/story-bosses/${id}.json`);
      assert.equal(Object.keys(atlas.frames).length, 16);
      for (const row of ['idle','walk','attack','cast']) for (let i = 0; i < 4; i++) assert.ok(atlas.frames[`${row}-${i}`]);
    }
  }
  assert.equal(canonBossOf('harold').phases[1].visual, 'story_kraken');
  assert.ok(canonBossOf('feron').phases.every(p => !p.visual?.includes('dragon')));
});

test('main road is six fine tiles wide while keeping the collision mask and meadow margins', () => {
  const cols=10, rows=8;
  const open=Array.from({length:cols*rows},(_,i)=>i%cols>0&&i%cols<cols-1&&Math.floor(i/cols)>0&&Math.floor(i/cols)<rows-1);
  const layout={cols,rows,cellW:144,cellH:128,open,entry:4*cols+1,exit:4*cols+8};
  const place=CHAPTER_STORY_PLAN.howlrstone1.places[0];
  const data=chapterTerrainData(layout,place), road=new Set(terrain.materials[place.path].tiles);
  const centerX=4*data.detail+2;
  const painted=data.ground.map((row,y)=>road.has(row[centerX])?y:-1).filter(y=>y>=0);
  assert.equal(painted.length,6);
  assert.ok(painted.length*data.tileH>=192);
  assert.ok(data.ground.flat().filter(tile=>tile>=0&&!road.has(tile)).length>0);
});
