import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAND_PLANET_ROUTE, GRAND_PLANET_CHAPTERS, GRAND_PLANET_DIALOGUES,
  GRAND_PLANET_BOSSES, GRAND_PLANET_STAGE_BOSSES, GRAND_PLANET_EXPLORATIONS,
  GRAND_PLANET_CANON_END, SNORIKA_STORY, SNORIKA_ENTRY, SNORIKA_END,
} from '../src/game/grandPlanetCanon.ts';

test('approved Grand Planet chapters have finite ordered objectives, real dialogue and no level prerequisite', () => {
  assert.deepEqual(GRAND_PLANET_ROUTE, ['dlcstargate', 'dlcprisma', 'dlcreverse', 'dlcneocity']);
  const ids = new Set();
  for (const key of GRAND_PLANET_ROUTE) {
    const chapter = GRAND_PLANET_CHAPTERS[key];
    assert.ok(GRAND_PLANET_DIALOGUES[chapter.intro]);
    assert.ok(GRAND_PLANET_DIALOGUES[chapter.bossDone]);
    assert.deepEqual(chapter.lvGate, { enter: 0, mid: 0 });
    assert.deepEqual(chapter.beats.map(b => b.sub), [1,2,3,4,5,6,7,8,9,10]);
    for (const { dialogue, quest } of chapter.beats) {
      assert.ok(GRAND_PLANET_DIALOGUES[dialogue]?.lines.length);
      assert.equal(quest.dialogue, dialogue);
      assert.ok(!ids.has(quest.id), `duplicate quest ${quest.id}`);
      ids.add(quest.id);
      assert.ok(quest.need >= 1 && quest.need <= 6);
      assert.notEqual(quest.type, 'level');
      if (quest.type === 'hunt') assert.ok(quest.targetKey);
    }
  }
});

test('control battles and Snorika use existing texture and attack contracts without inventing a Neo City ending', () => {
  const allowedPatterns = new Set(['slam','charge','volley','ring','zones','summon','spiral','beam','blink','quake','counter','firepillars','frostnova','thunderfall','poisonfield','holymantle','crystalburst','blinkslash','greenslash','vanish','shieldcast','magicburst','portalteleport']);
  for (const [key, boss] of Object.entries(GRAND_PLANET_BOSSES)) {
    assert.equal(key, boss.key);
    assert.ok(boss.hp > 0 && boss.atk > 0 && boss.speed > 0);
    assert.ok(GRAND_PLANET_DIALOGUES[boss.introDialogue]);
    for (const phase of Object.values(boss.patterns)) {
      assert.ok(phase.length > 0);
      for (const attack of phase) assert.ok(allowedPatterns.has(attack), attack);
    }
  }
  assert.equal(GRAND_PLANET_STAGE_BOSSES.dlcreverse8, 'reversecore');
  assert.equal(GRAND_PLANET_STAGE_BOSSES.dlcneocity4, 'fabian');
  assert.ok(!GRAND_PLANET_STAGE_BOSSES.dlcneocity10);
  assert.equal(GRAND_PLANET_CANON_END, 'dlcneocity10');
  assert.equal(GRAND_PLANET_CHAPTERS.dlcneocity.boss, undefined);
  assert.equal(GRAND_PLANET_CHAPTERS.dlcneocity.beats.at(-1).quest.type, 'talk');
  assert.equal(Object.keys(GRAND_PLANET_EXPLORATIONS).length, 6);
  for (const key of Object.keys(GRAND_PLANET_EXPLORATIONS)) assert.ok(!GRAND_PLANET_ROUTE.includes(key));
  assert.equal(SNORIKA_ENTRY, 'snorika1');
  assert.equal(SNORIKA_END, 'snorika6');
  assert.equal(SNORIKA_STORY.bossAt, 5);
  for (const beat of SNORIKA_STORY.beats) assert.ok(GRAND_PLANET_DIALOGUES[beat.dialogue]);
  const text = JSON.stringify([GRAND_PLANET_CHAPTERS,GRAND_PLANET_DIALOGUES]);
  assert.doesNotMatch(text, /윤지|유진|준석|정현|호영|아니마|이그드라실|아뜰란티스/);
});
